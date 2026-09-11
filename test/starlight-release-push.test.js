import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import express from "express";

import { hashFirebaseInstallationId } from "../src/modules/starlight-release-push/starlight-release-push-repository.js";
import { createStarlightReleasePushRouter } from "../src/modules/starlight-release-push/starlight-release-push-routes.js";

function createRepository() {
  const rows = new Map();
  return {
    async upsertSubscription(subscription) {
      rows.set(subscription.installationId, {
        id: rows.size + 1,
        locale: subscription.locale,
        source: subscription.source,
        medium: subscription.medium,
        campaign: subscription.campaign,
        consent_version: subscription.consentVersion,
        consented_at: subscription.consentedAt.toISOString(),
        status: "active",
        last_success_at: null,
        expired_at: null,
      });
    },
    async listSubscriptions() {
      return [...rows.values()];
    },
  };
}

async function withServer(routerOptions, callback) {
  const app = express();
  app.use(express.json());
  app.use("/api/starlight-release-push", createStarlightReleasePushRouter(routerOptions));
  app.use((error, _request, response, _next) => {
    response.status(error.statusCode || 500).json({
      error: { code: error.code || "INTERNAL_ERROR", message: error.message },
    });
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("FCM 웹 설치 식별값과 유입 경로를 저장하고 중복 신청을 갱신한다", async () => {
  const repository = createRepository();
  await withServer({
    repository,
    subscribeEnabled: true,
    allowedOrigins: ["https://starlight-sudoku.tycheworks.com"],
    rateLimitPerHour: 10,
  }, async (baseUrl) => {
    const submit = (campaign) => fetch(`${baseUrl}/api/starlight-release-push/subscriptions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://starlight-sudoku.tycheworks.com",
      },
      body: JSON.stringify({
        installationId: "fcm-installation-id-1",
        consent: true,
        locale: "ko-KR",
        source: "youtube",
        medium: "shorts",
        campaign,
        website: "",
      }),
    });

    assert.equal((await submit("trailer-v1")).status, 202);
    assert.equal((await submit("trailer-v2")).status, 202);
    const rows = await repository.listSubscriptions();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].campaign, "trailer-v2");
  });
});

test("FCM 신청 API는 동의와 허용된 Origin을 요구한다", async () => {
  const repository = createRepository();
  await withServer({
    repository,
    subscribeEnabled: true,
    allowedOrigins: ["https://starlight-sudoku.tycheworks.com"],
  }, async (baseUrl) => {
    const payload = JSON.stringify({ installationId: "fcm-installation-id-2", consent: false });
    const noConsent = await fetch(`${baseUrl}/api/starlight-release-push/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://starlight-sudoku.tycheworks.com" },
      body: payload,
    });
    assert.equal(noConsent.status, 400);

    const wrongOrigin = await fetch(`${baseUrl}/api/starlight-release-push/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ installationId: "fcm-installation-id-2", consent: true }),
    });
    assert.equal(wrongOrigin.status, 403);
  });
});

test("관리자 목록은 FCM 식별값을 노출하지 않는다", async () => {
  const repository = createRepository();
  await repository.upsertSubscription({
    installationId: "private-fcm-installation-id",
    locale: "en",
    source: "threads",
    medium: "social",
    campaign: "launch",
    consentVersion: "2026-09-11",
    consentedAt: new Date("2026-09-11T01:02:03Z"),
  });
  await withServer({
    repository,
    requireAdmin: (_request, _response, next) => next(),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/starlight-release-push/subscriptions`);
    assert.equal(response.status, 200);
    const serialized = JSON.stringify(await response.json());
    assert.doesNotMatch(serialized, /private-fcm-installation-id/);
  });
});

test("FCM 식별값 해시와 신규 마이그레이션은 원문 중복 키를 분리한다", async () => {
  assert.equal(hashFirebaseInstallationId("same-id"), hashFirebaseInstallationId("same-id"));
  assert.notEqual(hashFirebaseInstallationId("same-id"), hashFirebaseInstallationId("other-id"));
  const migration = await readFile(
    new URL("../db/migrations/018_create_starlight_release_push_subscriptions.sql", import.meta.url),
    "utf8",
  );
  assert.equal((migration.match(/CREATE TABLE/gi) || []).length, 1);
  assert.match(migration, /UNIQUE KEY uq_starlight_release_push_installation_id_hash/);
  assert.match(migration, /installation_id VARCHAR\(512\)/);
  assert.doesNotMatch(migration, /email/i);
});

test("웹 체험판은 Firebase FCM 등록과 Google Play 이동 워커를 포함한다", async () => {
  const root = new URL("../public/site/starlight-sudoku-landing/play/", import.meta.url);
  const [html, pushConfig, pushScript, worker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("release-push-config.js", root), "utf8"),
    readFile(new URL("release-push.js", root), "utf8"),
    readFile(new URL("release-push-worker.js", root), "utf8"),
  ]);
  assert.match(html, /release-push-config\.js/);
  assert.match(html, /release-push\.js/);
  assert.match(pushConfig, /projectId: "starlight-sudoku"/);
  assert.match(pushConfig, /vapidKey: ""/);
  assert.doesNotMatch(pushConfig, /PRIVATE KEY/);
  assert.match(pushScript, /firebaseVersion = "12\.18\.0"/);
  assert.match(pushScript, /FCM web push configuration is missing/);
  assert.match(pushScript, /firebase-messaging\.js/);
  assert.match(pushScript, /messagingSdk\.register/);
  assert.match(pushScript, /onRegistered/);
  assert.match(pushScript, /installationId/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("notificationclick"/);
  assert.match(worker, /\/store/);
});
