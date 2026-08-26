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

test("GET /dashboard/ serves the PPE dashboard", async () => {
  const response = await fetch(`${baseUrl}/dashboard/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<title>TYCHE PPE 실제 데이터 대시보드<\/title>/);
  assert.match(body, /실제 세션 수/);
  assert.match(body, /사용자별 기록/);
  assert.match(body, /원본 이벤트/);
  assert.match(body, /location\.protocol==="file:"/);
  assert.match(body, /http:\/\/127\.0\.0\.1:3000\/dashboard\//);
});
