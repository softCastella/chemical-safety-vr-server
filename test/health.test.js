import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
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

test("GET /assets/favicon_round_crop.svg serves the self-contained round favicon", async () => {
  const response = await fetch(`${baseUrl}/assets/favicon_round_crop.svg`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(body, /<clipPath id="round-crop">/);
  assert.match(body, /href="data:image\/png;base64,/);
});

test("GET /dashboard/ serves the PPE dashboard", async () => {
  const response = await fetch(`${baseUrl}/dashboard/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<title>TYCHE VR 안전교육 운영 대시보드<\/title>/);
  assert.match(body, /데이터 활용 기준/);
  assert.match(body, /세션 종료 직후 · 교육 운영/);
  assert.match(body, /주간·월간 · 직원 역량 관리/);
  assert.match(body, /공식 직원 평가·수료 판정/);
  assert.match(body, /추가 계약 전에는 인사평가 근거로 사용하지 않음/);
  assert.match(body, /서비스 개선/);
  assert.match(body, /회원사·직원/);
  assert.match(body, /직원 상세/);
  assert.match(body, /콘텐츠 품질/);
  assert.match(body, /이탈 분석/);
  assert.match(body, /업데이트 전후 변화/);
  assert.match(body, /현재 전후 비교 불가/);
  assert.match(body, /DIRECTORY 미연동/);
  assert.match(body, /Test 결과/);
  assert.match(body, /완료 전 종료 후보율/);
  assert.match(body, /서비스 문제/);
  assert.match(body, /개인 사정/);
  assert.match(body, /하드웨어 입력 지연 아님/);
  assert.match(body, /ConfinedSpace:"밀폐공간 작업"/);
  assert.match(body, /no_ppe_hover:"장비를 가리키지 않고 잡기 시도"/);
  assert.match(body, /새 세션부터 appVersion을 기록/);
  assert.match(body, /비교 기준 버전 1개/);
  assert.doesNotMatch(body, /처음 보신다면|수업을 끝냈나요|학생별 기록/);
  assert.match(body, /location\.protocol==="file:"/);
  assert.match(body, /http:\/\/127\.0\.0\.1:3000\/dashboard\//);
});
