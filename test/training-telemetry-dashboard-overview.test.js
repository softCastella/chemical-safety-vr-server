import assert from "node:assert/strict";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { createTrainingTelemetryRepository } from "../src/modules/training-telemetry/training-telemetry-repository.js";

test("VR 첫 화면 집계는 첫 플레이와 재방문을 구분하고 빈 날짜를 채운다", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const pool = {
    async execute(sql) {
      if (sql.includes("first_session.first_started_at")) return [[{
        day, active_users: 2, new_users: 1, returning_users: 1, plays: 3,
      }]];
      if (sql.includes("COUNT(DISTINCT participant_id) AS observed_users")) {
        return [[{ observed_users: 2, plays: 3 }]];
      }
      if (sql.includes("JSON_UNQUOTE(JSON_EXTRACT")) return [[
        { mode: "Education", event_type: "mode_session_started", event_count: 2 },
        { mode: "Education", event_type: "mode_session_completed", event_count: 1 },
        { mode: "Test", event_type: "mode_session_completed", event_count: 1 },
      ]];
      if (sql.includes("MAX(timestamp_utc)")) return [[{ last_event_at: "2026-09-11T12:00:00.000Z" }]];
      throw new Error("Unexpected SQL query");
    },
  };
  const result = await createTrainingTelemetryRepository(pool).getDashboardOverview(7);
  assert.equal(result.daily.length, 7);
  assert.deepEqual(result.daily.at(-1), {
    day, activeUsers: 2, newUsers: 1, returningUsers: 1, plays: 3,
  });
  assert.equal(result.daily.filter((row) => row.plays === 0).length, 6);
  assert.deepEqual(result.summary, {
    observedUsers: 2, plays: 3, newUsers: 1,
    lastEventAtUtc: "2026-09-11T12:00:00.000Z",
  });
  assert.deepEqual(result.modes, [
    { mode: "Education", started: 2, completed: 1 },
    { mode: "Training", started: 0, completed: 0 },
    { mode: "Test", started: 0, completed: 1 },
  ]);
});

test("VR 첫 화면의 운영 집계와 정적 자산은 관리자 세션으로 보호한다", async () => {
  const calls = [];
  const overview = { days: 7, summary: { observedUsers: 2, plays: 3, newUsers: 1 }, daily: [], modes: [] };
  const app = createApp({
    enableUserCrud: false,
    enableTrainingTelemetryIngest: true,
    enableMetaTrainingTelemetryAuth: false,
    trainingTelemetryUploadToken: "valid-development-token",
    trainingTelemetryRepository: { async getDashboardOverview(days) { calls.push(days); return overview; } },
    enableServerAdmin: true,
    serverAdminRepository: {
      async findSession(token) {
        return token === "valid-session" ? { admin_id: 1, username: "viewer", role: "viewer" } : null;
      },
    },
    serverAdminCountryLookupService: { async enrichEvents(rows) { return rows; } },
    serverAdminPushService: { enabled: false, publicKey: "" },
  }).listen(0);
  await new Promise((resolve) => app.once("listening", resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  const headers = { cookie: "tyche_admin_session=valid-session" };
  try {
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-overview?days=7`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/overview.js`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/details.html`)).status, 401);
    const page = await fetch(`${url}/chemical-safety-training-vr/`, { headers });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /사람이 들어오고, 다시 오고/);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/overview.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-overview?days=1`, { headers })).status, 400);
    const response = await fetch(`${url}/api/training-telemetry/dashboard-overview?days=7`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()).data, overview);
    assert.deepEqual(calls, [7]);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});
