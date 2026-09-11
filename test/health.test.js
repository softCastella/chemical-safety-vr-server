import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  server = createApp({ kakaoJavaScriptKey: "test-kakao-javascript-key" }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("GET /api/health returns the server status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: "ok",
    service: "tyche-safety-training-server",
  });
});

test("GET / serves the Tyche Works site", async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<title>TYCHE WORKS<\/title>/);
});

test("GET /api/public-site-config returns the public Kakao JavaScript key", async () => {
  const response = await fetch(`${baseUrl}/api/public-site-config`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(body, {
    kakaoJavaScriptKey: "test-kakao-javascript-key",
  });
});

test("GET /assets/Immersa/Chemical%20Safety%20Training%20VR/favicon_round_crop.svg serves the self-contained round favicon", async () => {
  const response = await fetch(`${baseUrl}/assets/Immersa/Chemical%20Safety%20Training%20VR/favicon_round_crop.svg`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(body, /<clipPath id="round-crop">/);
  assert.match(body, /href="data:image\/png;base64,/);
});

test("GET /dashboard/ serves the PPE dashboard", async () => {
  const [response, scriptResponse] = await Promise.all([
    fetch(`${baseUrl}/dashboard/`),
    fetch(`${baseUrl}/dashboard/dashboard.js`),
  ]);
  const [body, script] = await Promise.all([response.text(), scriptResponse.text()]);

  assert.equal(response.status, 200);
  assert.equal(scriptResponse.status, 200);
  assert.match(body, /<title>TYCHE VR 안전교육 학습 대시보드<\/title>/);
  assert.match(body, /핵심 학습 지표/);
  assert.match(body, /모드별 이수율/);
  assert.match(body, /시나리오별 이수율/);
  assert.match(body, /사용자 반복 수행/);
  assert.match(body, /플레이 구간별 시간/);
  assert.match(body, /사용자별 반복/);
  assert.match(body, /구간별 병목/);
  assert.match(body, /플레이 상세/);
  assert.match(body, /완료 전 종료/);
  assert.match(script, /업데이트 전후 변화/);
  assert.match(script, /현재 전후 비교 불가/);
  assert.match(script, /function learningGroups\(items,kind\)/);
  assert.match(script, /Test 결과/);
  assert.match(script, /완료 전 종료 후보율/);
  assert.match(script, /서비스 문제/);
  assert.match(script, /개인 사정/);
  assert.match(script, /하드웨어 입력 지연 아님/);
  assert.match(script, /ConfinedSpace:"밀폐공간 작업"/);
  assert.match(script, /no_ppe_hover:"장비를 가리키지 않고 잡기 시도"/);
  assert.match(script, /새 세션부터 appVersion을 기록/);
  assert.match(script, /비교 기준 버전 1개/);
  assert.doesNotMatch(body, /처음 보신다면|수업을 끝냈나요|학생별 기록/);
  assert.match(script, /location\.protocol==="file:"/);
  assert.match(script, /http:\/\/127\.0\.0\.1:3000\/dashboard\//);
});
