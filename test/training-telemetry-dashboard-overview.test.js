import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { createTrainingTelemetryRepository } from "../src/modules/training-telemetry/training-telemetry-repository.js";

test("관리자 프록시는 VR 대시보드 조회 API만 전달한다", async () => {
  const config = await readFile(new URL("../ops/nginx/tycheworks-admin.conf", import.meta.url), "utf8");
  assert.match(config, /location \/api\/training-telemetry\/dashboard- \{/);
  assert.doesNotMatch(config, /location \/api\/training-telemetry\/ \{/);
});

test("VR 병목 화면의 DOM 참조와 장비 표기는 실제 화면 계약과 일치한다", async () => {
  const html = await readFile(new URL("../public/dashboard/play.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../public/dashboard/play.js", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const staticReferences = [...script.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
  const scopeReferences = ["candidateScope", "stageScope", "ppeScope", "quizScope"];
  for (const id of [...staticReferences, ...scopeReferences]) {
    assert.ok(ids.has(id), `play.js references missing #${id}`);
  }
  assert.doesNotMatch(script, /안전 하네스|방독면|공기호흡기|고무장갑|니트릴 속장갑|dashboard-baseline-preview/);
});

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

test("VR 병목 조회는 최근 세션의 계산 이벤트만 반환하고 원본 식별·응답 내용을 숨긴다", async () => {
  const rawEvents = [
    { sequence: 1, timestampUtc: "2026-09-14T00:00:00.000Z", eventType: "session_started", metaUserId: "private-meta-id" },
    { sequence: 2, timestampUtc: "2026-09-14T00:00:01.000Z", eventType: "mode_session_started", mode: "Education", workPlan: "LeakResponse" },
    { sequence: 3, timestampUtc: "2026-09-14T00:00:02.000Z", eventType: "ppe_grab_attempted", attemptId: "attempt-1", itemType: "GasMask" },
    { sequence: 4, timestampUtc: "2026-09-14T00:00:03.000Z", eventType: "ppe_grab_attempt_resolved", attemptId: "attempt-1", attemptOutcome: "selected", itemType: "GasMask", mode: "Education", workPlan: "LeakResponse" },
    { sequence: 5, timestampUtc: "2026-09-14T00:00:04.000Z", eventType: "quiz_answer_resolved", mode: "Education", workPlan: "LeakResponse", quizQuestionIndex: 1, quizCorrect: false, answerText: "private-answer" },
    { sequence: 6, timestampUtc: "2026-09-14T00:00:05.000Z", eventType: "ppe_grab_selected_without_attempt", mode: "Education", workPlan: "LeakResponse", itemType: "TacticalHarness" },
  ];
  const pool = {
    async execute(sql, values) {
      if (sql.includes("FROM training_telemetry_sessions")) {
        if (sql.includes("SELECT app_version")) return [[{ app_version: "1.0.0" }]];
        assert.deepEqual(values, ["1.0.0", 101]);
        return [[{ session_id: "session-1", participant_id: 7, app_version: "1.0.0", status: "active", started_at: "2026-09-14T00:00:00.000Z" }]];
      }
      if (sql.includes("FROM training_telemetry_events")) {
        assert.deepEqual(values, ["session-1"]);
        return [rawEvents.map((event) => ({ session_id: "session-1", payload_json: JSON.stringify(event) }))];
      }
      throw new Error("Unexpected SQL query");
    },
  };
  const result = await createTrainingTelemetryRepository(pool).getDashboardPlay();
  assert.equal(result.baseline.runs.length, 6);
  assert.doesNotMatch(JSON.stringify(result.baseline), /sessionId|participantId|metaUserId|clientInstanceId|timestampUtc/);
  assert.equal(result.sessions[0].participantId, 7);
  assert.equal(result.sessions[0].grabSelections[0].itemType, "GasMask");
  assert.equal(result.sessions[0].grabSelections[0].modeRunIndex, 1);
  assert.equal(result.sessions[0].grabSelections[1].itemType, "TacticalHarness");
  assert.equal(result.sessions[0].grabAttempts[0].outcome, "selected");
  assert.equal(result.sessions[0].events.find((event) => event.eventType === "quiz_answer_resolved").quizCorrect, false);
  assert.doesNotMatch(JSON.stringify(result), /private-meta-id|private-answer|attempt-1/);
});

test("사용자 목록은 내부 사용자 ID로 조회하고 Meta ID는 상세과 플레이 이력에만 연결한다", async () => {
  const calls = [];
  const pool = {
    async execute(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("COUNT(DISTINCT participant.participant_id) AS total")) return [[{ total: 21 }]];
      if (sql.includes("ORDER BY last_play_at DESC")) return [[{
        participant_id: 7, play_count: 2,
        first_play_at: "2026-09-13T00:00:00.000Z", last_play_at: "2026-09-14T00:00:00.000Z",
      }]];
      if (sql.includes("WHERE participant.participant_id = ?") && sql.includes("GROUP BY")) return [[{
        participant_id: 7, meta_user_id: "123456789", play_count: 2,
        first_play_at: "2026-09-13T00:00:00.000Z", last_play_at: "2026-09-14T00:00:00.000Z",
      }]];
      if (sql.includes("FROM training_telemetry_sessions") && sql.includes("LIMIT ? OFFSET ?")) return [[
        { session_id: "session-a", started_at: "2026-09-14T00:00:00.000Z", app_version: "1.0.0", status: "active" },
      ]];
      if (sql.includes("FROM training_telemetry_events")) return [[
        { session_id: "session-a", payload_json: JSON.stringify({ sequence: 2, eventType: "mode_session_started", timestampUtc: "2026-09-14T00:00:01.000Z", mode: "Education", workPlan: "LeakResponse" }) },
        { session_id: "session-a", payload_json: JSON.stringify({ sequence: 3, eventType: "mode_session_completed", timestampUtc: "2026-09-14T00:01:01.000Z", mode: "Education", workPlan: "LeakResponse" }) },
        { session_id: "session-a", payload_json: JSON.stringify({ sequence: 4, eventType: "mode_session_started", timestampUtc: "2026-09-14T00:01:02.000Z", mode: "Test", workPlan: "LeakResponse" }) },
      ]];
      throw new Error("Unexpected SQL query");
    },
  };
  const repository = createTrainingTelemetryRepository(pool);
  const users = await repository.getDashboardUsers({ participantId: 7, page: 2 });
  assert.equal(users.total, 21);
  assert.equal(users.moreAvailable, false);
  assert.equal(users.users[0].participantId, 7);
  assert.equal(Object.hasOwn(users.users[0], "metaUserId"), false);
  assert.deepEqual(calls[0].values, [7]);
  assert.deepEqual(calls[1].values, [7, 20, 20]);
  const user = await repository.getDashboardUser({ participantId: 7, page: 1 });
  assert.equal(user.playCount, 2);
  assert.equal(user.sessions[0].runs.length, 2);
  assert.equal(user.sessions[0].runs[0].durationSeconds, 60);
  assert.equal(user.sessions[0].runs[1].completed, false);
  assert.deepEqual(calls[3].values, [7, 20, 0]);
});

test("VR 첫 화면의 운영 집계와 정적 자산은 관리자 세션으로 보호한다", async () => {
  const calls = [];
  const overview = { days: 7, summary: { observedUsers: 2, plays: 3, newUsers: 1 }, daily: [], modes: [] };
  const app = createApp({
    enableUserCrud: false,
    enableTrainingTelemetryIngest: true,
    enableMetaTrainingTelemetryAuth: false,
    trainingTelemetryUploadToken: "valid-development-token",
    trainingTelemetryRepository: {
      async getDashboardOverview(days) { calls.push(days); return overview; },
      async getDashboardPlay() { return { sessions: [], limit: 100, moreAvailable: false }; },
      async getDashboardUsers({ participantId, page }) { return { users: [], total: 0, page, pageSize: 20, participantId }; },
      async getDashboardUser({ participantId, page }) { return participantId === 7
        ? { participantId, page, metaUserId: "123456789", sessions: [] } : null; },
      async findSession(sessionId) {
        return sessionId === "session-1" ? {
          sessionId, participantId: 7, appVersion: "1.0.0", status: "active",
          startedAtUtc: "2026-09-14T00:00:00.000Z",
          events: [{ eventType: "session_started", sequence: 1, timestampUtc: "2026-09-14T00:00:00.000Z", metaUserId: "hidden-id" }],
        } : null;
      },
    },
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
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-play`)).status, 401);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users`)).status, 401);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users/7`)).status, 401);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-play/sessions/session-1`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/overview.js`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/details.html`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/session.html`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/session.js`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/users.html`)).status, 401);
    const page = await fetch(`${url}/chemical-safety-training-vr/`, { headers });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /사람이 들어오고, 다시 오고/);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/overview.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/session.html`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/session.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/users.html`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/users.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users?participantId=7&page=2`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users?participantId=a`, { headers })).status, 400);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users?participantId=0`, { headers })).status, 400);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users/7`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-users/8`, { headers })).status, 404);
    assert.equal((await fetch(`${url}/api/training-telemetry/dashboard-overview?days=1`, { headers })).status, 400);
    const response = await fetch(`${url}/api/training-telemetry/dashboard-overview?days=7`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()).data, overview);
    const playResponse = await fetch(`${url}/api/training-telemetry/dashboard-play`, { headers });
    assert.equal(playResponse.status, 200);
    assert.equal(playResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual((await playResponse.json()).data, { sessions: [], limit: 100, moreAvailable: false });
    const detailResponse = await fetch(`${url}/api/training-telemetry/dashboard-play/sessions/session-1`, { headers });
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()).data;
    assert.equal(detail.sessionId, "session-1");
    assert.doesNotMatch(JSON.stringify(detail), /hidden-id/);
    const directPayload = await (await fetch(`${url}/api/training-telemetry/dashboard-play/sessions/session-1`, { headers })).json();
    assert.equal(directPayload.baseline.runs.length, 6);
    assert.deepEqual(calls, [7]);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});
