import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createApp } from "../src/app.js";

async function createWebsiteFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tyche-website-public-"));
  for (const directory of [
    "site/immersa/chemical-safety-training",
    "dashboard",
    "starlight-analytics",
    "server-status",
  ]) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  await writeFile(path.join(root, "site", "index.html"), "external website root", "utf8");
  await writeFile(path.join(root, "dashboard", "index.html"), "external dashboard root", "utf8");
  await writeFile(
    path.join(root, "site", "immersa", "chemical-safety-training", "index.html"),
    "external VR detail root",
    "utf8",
  );
  return root;
}

test("TYCHE_WEBSITE_PUBLIC_ROOT의 홈페이지·대시보드 정적 파일을 제공한다", async (t) => {
  const websitePublicRoot = await createWebsiteFixture();
  const server = createApp({
    websitePublicRoot,
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: false,
    enableServerAdmin: false,
    enableContactForm: false,
    enableStarlightAnalyticsIngest: false,
    enableStarlightReleasePush: false,
  }).listen(0);

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(websitePublicRoot, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(`${baseUrl}/`)).text(), "external website root");
  assert.equal(await (await fetch(`${baseUrl}/dashboard/`)).text(), "external dashboard root");
  assert.equal(
    await (await fetch(`${baseUrl}/chemical-safety-training/`)).text(),
    "external VR detail root",
  );
});

test("TYCHE_WEBSITE_PUBLIC_ROOT가 잘못되면 시작 단계에서 설정명을 보고한다", async (t) => {
  assert.throws(
    () => createApp({ websitePublicRoot: "relative/public" }),
    /TYCHE_WEBSITE_PUBLIC_ROOT must be an absolute path/,
  );

  const incompleteRoot = await mkdtemp(path.join(tmpdir(), "tyche-website-incomplete-"));
  t.after(() => rm(incompleteRoot, { recursive: true, force: true }));
  assert.throws(
    () => createApp({ websitePublicRoot: incompleteRoot }),
    /TYCHE_WEBSITE_PUBLIC_ROOT is missing required directory/,
  );
});
