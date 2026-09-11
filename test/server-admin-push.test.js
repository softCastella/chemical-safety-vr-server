import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createServerAlertMonitor } from "../src/modules/server-admin/server-alert-monitor.js";
import { createServerAdminPushService } from "../src/modules/server-admin/server-admin-push.js";

test("웹 푸시 설정이 꺼져 있으면 자격 증명 없이 비활성 서비스가 생성된다", async () => {
  const service = createServerAdminPushService({ enabled: false });
  assert.equal(service.enabled, false);
  assert.equal(service.publicKey, "");
  assert.deepEqual(await service.send(), { skipped: true });
});

test("웹 푸시 설정이 켜지면 VAPID와 구독 정보를 사용해 알림을 보낸다", async () => {
  const calls = [];
  const webPushImpl = {
    setVapidDetails(...args) { calls.push(["vapid", ...args]); },
    async sendNotification(...args) { calls.push(["send", ...args]); },
  };
  const service = createServerAdminPushService({
    enabled: true,
    vapidPublicKey: "public-key",
    vapidPrivateKey: "private-key",
    subject: "mailto:admin@example.com",
    webPushImpl,
  });

  await service.send(
    { endpoint: "https://push.example/subscription", p256dh: "p256dh", auth: "auth" },
    { title: "서버 알림", body: "테스트" },
  );

  assert.deepEqual(calls[0], ["vapid", "mailto:admin@example.com", "public-key", "private-key"]);
  assert.equal(calls[1][0], "send");
  assert.equal(calls[1][1].endpoint, "https://push.example/subscription");
  assert.match(calls[1][2], /서버 알림/);
  assert.deepEqual(calls[1][3], { TTL: 300, urgency: "high" });
});

test("알림 모니터 첫 실행은 기존 경고를 기준선으로 저장하고 푸시하지 않는다", async () => {
  const initialized = [];
  const repository = {
    async getAlertMonitorState() { return { initialized: 0, lastSecurityEventId: 0 }; },
    async recentSecurityEvents() { return [{ id: 7, ipAddress: "203.0.113.7" }]; },
    async initializeAlertMonitor(value) { initialized.push(value); },
  };
  const monitor = createServerAlertMonitor({
    repository,
    pushService: { enabled: true, async send() { throw new Error("must not send"); } },
    intervalMs: 60_000,
    collectOverview: async () => ({ alertItems: [{ id: "disk-high", message: "디스크 경고" }] }),
    logger: { error() {} },
  });

  await monitor.runOnce();

  assert.equal(initialized.length, 1);
  assert.deepEqual(initialized[0].alerts, [{ key: "system:disk-high", message: "디스크 경고" }]);
  assert.equal(initialized[0].securityEvents[0].key, "security:7");
});

test("알림 모니터는 기준선 이후 새 경고만 구독 기기로 전송한다", async () => {
  const calls = [];
  const pending = [{ alertKey: "system:service:test", generation: 2, source: "system", message: "서비스 경고" }];
  const repository = {
    async getAlertMonitorState() { return { initialized: 1, lastSecurityEventId: 7 }; },
    async syncSystemAlertOccurrences(value) { calls.push(["system", value]); },
    async listSecurityEventsAfter(id) { calls.push(["after", id]); return [{ id: 8, ipAddress: "203.0.113.8" }]; },
    async syncSecurityAlertOccurrences(value) { calls.push(["security", value]); },
    async listPendingAlertOccurrences() { return pending; },
    async listPushSubscriptions() { return [{ id: "subscription-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }]; },
    async markPushSubscriptionSucceeded(id) { calls.push(["success", id]); },
    async removePushSubscriptionById() {},
    async markAlertOccurrencesPushProcessed(value) { calls.push(["processed", value]); },
  };
  const pushService = {
    enabled: true,
    async send(subscription, payload) { calls.push(["push", subscription.id, payload]); },
  };
  const monitor = createServerAlertMonitor({
    repository,
    pushService,
    intervalMs: 60_000,
    collectOverview: async () => ({ alertItems: [] }),
    logger: { error() {} },
  });

  await monitor.runOnce();

  assert.deepEqual(calls.find(([name]) => name === "after"), ["after", 7]);
  assert.equal(calls.find(([name]) => name === "security")[1][0].key, "security:8");
  assert.equal(calls.find(([name]) => name === "push")[2].tag, "system:service:test@2");
  assert.deepEqual(calls.find(([name]) => name === "processed")[1], pending);
});

test("대시보드 푸시 마이그레이션과 휴대폰 구독 UI가 함께 존재한다", async () => {
  const [migrations, html, dashboard, worker] = await Promise.all([
    Promise.all([
      "013_create_server_admin_push_subscriptions.sql",
      "014_create_server_admin_alert_occurrences.sql",
      "015_create_server_admin_alert_acknowledgements.sql",
      "016_create_server_admin_alert_monitor_state.sql",
    ].map((name) => readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"))).then((files) => files.join("\n")),
    readFile(new URL("../public/server-status/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/server-status/dashboard.js", import.meta.url), "utf8"),
    readFile(new URL("../public/server-status/push-worker.js", import.meta.url), "utf8"),
  ]);

  assert.match(migrations, /CREATE TABLE IF NOT EXISTS server_admin_push_subscriptions/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS server_admin_alert_occurrences/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS server_admin_alert_acknowledgements/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS server_admin_alert_monitor_state/);
  assert.match(html, /data-push-toggle/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(dashboard, /serviceWorker\.register\("\/server\/push-worker\.js"/);
  assert.match(dashboard, /\/api\/server-status\/alerts\/acknowledge/);
  assert.match(worker, /notificationclick/);
});

test("인증된 관리자는 푸시 구독 저장과 경고 확인 API를 사용할 수 있다", async (context) => {
  const calls = [];
  const repository = {
    async findSession() { return { admin_id: 3, username: "admin", role: "admin" }; },
    async savePushSubscription(value) { calls.push(["subscribe", value]); return { id: "saved" }; },
    async acknowledgeAlertOccurrences(adminId, occurrences) { calls.push(["ack", adminId, occurrences]); },
  };
  const app = createApp({
    enableServerAdmin: true,
    serverAdminRepository: repository,
    serverAdminPushService: { enabled: true, publicKey: "public-key", async send() {} },
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: false,
    enableContactForm: false,
  });
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const headers = { cookie: "tyche_admin_session=test", "content-type": "application/json" };

  const configResponse = await fetch(`http://127.0.0.1:${port}/api/server-status/push-config`, { headers });
  assert.equal(configResponse.status, 200);
  assert.deepEqual(await configResponse.json(), { enabled: true, publicKey: "public-key" });

  const subscription = {
    endpoint: "https://push.example/subscription",
    keys: { p256dh: "p".repeat(32), auth: "a".repeat(16) },
  };
  const subscriptionResponse = await fetch(`http://127.0.0.1:${port}/api/server-status/push-subscriptions`, {
    method: "POST", headers, body: JSON.stringify(subscription),
  });
  assert.equal(subscriptionResponse.status, 201);
  assert.equal(calls[0][0], "subscribe");
  assert.equal(calls[0][1].adminId, 3);

  const acknowledgeResponse = await fetch(`http://127.0.0.1:${port}/api/server-status/alerts/acknowledge`, {
    method: "POST", headers, body: JSON.stringify({ keys: ["system:disk-high@2", "security:17@1"] }),
  });
  assert.equal(acknowledgeResponse.status, 204);
  assert.deepEqual(calls[1], ["ack", 3, [
    { alertKey: "system:disk-high", generation: 2 },
    { alertKey: "security:17", generation: 1 },
  ]]);
});
