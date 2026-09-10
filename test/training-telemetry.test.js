import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { createInMemoryTrainingTelemetryRepository } from "../test-support/in-memory-training-telemetry-repository.js";

const uploadToken = "test-telemetry-token-123456";
const sessionId = "test-session-0001";
const clientInstanceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const startedAtUtc = "2026-08-28T03:03:37.824Z";

let server;
let baseUrl;

function authorization(token = uploadToken) {
  return { Authorization: `Bearer ${token}` };
}

function event(sequence, overrides = {}) {
  return {
    schemaVersion: 1,
    sessionId,
    eventId: `${sessionId}:${String(sequence).padStart(8, "0")}`,
    sequence,
    timestampUtc: new Date(Date.parse(startedAtUtc) + sequence * 1000).toISOString(),
    eventType: sequence === 1 ? "session_started" : "flow_state_changed",
    scene: "Assets/Scenes/3_PPE_Room_3mode_loco.unity",
    mode: "Education",
    flowState: sequence === 1 ? "Welcome" : "CardIntro",
    ...overrides,
  };
}

function eventFor(targetSessionId, sequence, overrides = {}) {
  return event(sequence, {
    sessionId: targetSessionId,
    eventId: `${targetSessionId}:${String(sequence).padStart(8, "0")}`,
    ...overrides,
  });
}

async function request(path, { method = "GET", body, token = uploadToken } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...authorization(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    response,
    body: await response.json(),
  };
}

before(async () => {
  server = createApp({
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: true,
    trainingTelemetryUploadToken: uploadToken,
    trainingTelemetryRepository: createInMemoryTrainingTelemetryRepository(),
    enableServerAdmin: false,
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()));
});

test("훈련 텔레메트리 API는 업로드 토큰을 요구한다", async () => {
  const response = await fetch(`${baseUrl}/api/training-telemetry/sessions`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHORIZED");
});

test("수집 기능을 켤 때 업로드 토큰이 없으면 설정명을 포함해 실패한다", () => {
  assert.throws(
    () => createApp({
      enableTrainingTelemetryIngest: true,
      trainingTelemetryUploadToken: "",
      trainingTelemetryRepository: createInMemoryTrainingTelemetryRepository(),
    }),
    /TRAINING_TELEMETRY_UPLOAD_TOKEN/,
  );
});

test("업로드 토큰은 HTTP 헤더에서 안전한 공백 없는 ASCII만 허용한다", () => {
  for (const invalidToken of [
    "한글로만든업로드테스트토큰입니다",
    "test token with spaces",
    "short-token",
  ]) {
    assert.throws(
      () => createApp({
        enableTrainingTelemetryIngest: true,
        trainingTelemetryUploadToken: invalidToken,
        trainingTelemetryRepository: createInMemoryTrainingTelemetryRepository(),
      }),
      /non-whitespace ASCII/,
    );
  }
});

test("이전 모노리포 출처의 세션은 수신하지 않는다", async () => {
  const result = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: {
      schemaVersion: 1,
      sourceProject: "final-vr-tyche-pivot",
      clientInstanceId,
      sessionId: "old-monorepo-session",
      startedAtUtc,
      appVersion: "0.1.0",
    },
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error.message, /chemical-safety-vr-client/);
});

test("세션과 행동 이벤트를 저장하고 원본을 다시 조회한다", async () => {
  const created = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: {
      schemaVersion: 1,
      sourceProject: "chemical-safety-vr-client",
      clientInstanceId,
      sessionId,
      startedAtUtc,
      appVersion: "0.1.0",
      scene: "Assets/Scenes/3_PPE_Room_3mode_loco.unity",
      mode: "Education",
      workPlan: "None",
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.status, "open");
  assert.equal(created.body.data.participantId, 1);

  const saved = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(1), event(3)] },
  });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body, {
    accepted: 2,
    duplicates: 0,
    rejected: 0,
    acceptedThroughSequence: 1,
  });

  const gapFilled = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(2)] },
  });
  assert.equal(gapFilled.body.acceptedThroughSequence, 3);

  const detail = await request(`/api/training-telemetry/sessions/${sessionId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.eventCount, 3);
  assert.deepEqual(detail.body.data.events.map((item) => item.sequence), [1, 2, 3]);
});

test("교육·훈련·테스트 모드의 실행 경계와 평가 원본을 저장한다", async () => {
  const modeSession = "three-mode-session-0001";
  const created = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: {
      schemaVersion: 1,
      sourceProject: "chemical-safety-vr-client",
      clientInstanceId,
      sessionId: modeSession,
      startedAtUtc,
      appVersion: "0.1.0",
    },
  });
  assert.equal(created.response.status, 201);

  const modes = [
    { mode: "Education", id: "11111111111111111111111111111111", correct: 5, wrong: 0, elapsed: 72.5 },
    { mode: "Training", id: "22222222222222222222222222222222", correct: 5, wrong: 0, elapsed: 81.25 },
    { mode: "Test", id: "33333333333333333333333333333333", correct: 4, wrong: 2, elapsed: 91.75 },
  ];
  const events = modes.flatMap((item, index) => {
    const firstSequence = index * 4 + 1;
    return [
      eventFor(modeSession, firstSequence, {
        eventType: "mode_session_started",
        mode: item.mode,
        workPlan: "ConfinedSpace",
        modeSessionId: item.id,
      }),
      eventFor(modeSession, firstSequence + 1, {
        eventType: "ppe_choice_resolved",
        mode: item.mode,
        workPlan: "ConfinedSpace",
        modeSessionId: item.id,
        itemType: "GasMask",
        choice: "Use",
        result: "UseApproved",
      }),
      eventFor(modeSession, firstSequence + 2, {
        eventType: "quiz_answer_resolved",
        mode: item.mode,
        workPlan: "ConfinedSpace",
        modeSessionId: item.id,
        quizTopic: "PpeSelection",
        quizQuestionIndex: 1,
        quizQuestionCount: 5,
        quizSelectedOptionIndex: 2,
        quizCorrect: item.mode !== "Test",
      }),
      eventFor(modeSession, firstSequence + 3, {
        eventType: "mode_session_completed",
        mode: item.mode,
        workPlan: "ConfinedSpace",
        modeSessionId: item.id,
        result: "completed",
        quizQuestionCount: 5,
        quizCorrectCount: item.correct,
        ppeWrongCount: item.wrong,
        modeElapsedSec: item.elapsed,
      }),
    ];
  });

  const saved = await request(`/api/training-telemetry/sessions/${modeSession}/events`, {
    method: "POST",
    body: { events },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.acceptedThroughSequence, 12);

  const detail = await request(`/api/training-telemetry/sessions/${modeSession}`);
  assert.equal(detail.response.status, 200);
  const completed = detail.body.data.events.filter(
    (item) => item.eventType === "mode_session_completed",
  );
  assert.deepEqual(completed.map((item) => item.mode), ["Education", "Training", "Test"]);
  assert.deepEqual(completed.map((item) => item.modeSessionId), modes.map((item) => item.id));
  assert.equal(completed[2].quizCorrectCount, 4);
  assert.equal(completed[2].quizQuestionCount, 5);
  assert.equal(completed[2].ppeWrongCount, 2);
  assert.equal(completed[2].modeElapsedSec, 91.75);
  const ppeChoices = detail.body.data.events.filter(
    (item) => item.eventType === "ppe_choice_resolved",
  );
  assert.deepEqual(ppeChoices.map((item) => item.modeSessionId), modes.map((item) => item.id));

  const invalid = await request(`/api/training-telemetry/sessions/${modeSession}/events`, {
    method: "POST",
    body: {
      events: [eventFor(modeSession, 13, {
        eventType: "mode_session_completed",
        mode: "Unknown",
        modeSessionId: "44444444444444444444444444444444",
        quizQuestionCount: 5,
        quizCorrectCount: 5,
      })],
    },
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error.message, /Education, Training, or Test/);
});

test("Meta 테스트 사용자와 ID 없는 사용자를 숫자 participantId로 구분한다", async () => {
  const secondAnonymous = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: {
      schemaVersion: 1,
      sourceProject: "chemical-safety-vr-client",
      clientInstanceId,
      sessionId: "anonymous-test-session-0002",
      startedAtUtc: "2026-08-28T03:30:00.000Z",
      appVersion: "0.1.0",
    },
  });
  assert.equal(secondAnonymous.response.status, 201);
  assert.equal(secondAnonymous.body.data.participantId, 1);

  const metaBody = {
    schemaVersion: 1,
    sourceProject: "chemical-safety-vr-client",
    clientInstanceId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    metaUserId: "123456789012345",
    sessionId: "meta-test-session-0001",
    startedAtUtc: "2026-08-28T04:00:00.000Z",
    appVersion: "0.1.0",
  };
  const firstMeta = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: metaBody,
  });
  assert.equal(firstMeta.response.status, 201);
  assert.equal(firstMeta.body.data.participantId, 2);

  const secondMeta = await request("/api/training-telemetry/sessions", {
    method: "POST",
    body: {
      ...metaBody,
      clientInstanceId: "cccccccccccccccccccccccccccccccc",
      sessionId: "meta-test-session-0002",
      startedAtUtc: "2026-08-28T05:00:00.000Z",
    },
  });
  assert.equal(secondMeta.body.data.participantId, 2);

  const participants = await request("/api/training-telemetry/participants");
  assert.equal(participants.response.status, 200);
  assert.equal(participants.body.data.length, 2);
  assert.deepEqual(
    participants.body.data.map((participant) => participant.identityType).sort(),
    ["anonymous", "meta"],
  );

  const metaSessions = await request(
    "/api/training-telemetry/sessions?participantId=2",
  );
  assert.equal(metaSessions.body.data.length, 2);
  assert.ok(metaSessions.body.data.every((session) => session.participantId === 2));

  const detail = await request("/api/training-telemetry/participants/2");
  assert.equal(detail.body.data.sessionCount, 2);
  assert.equal(detail.body.data.identityType, "meta");
});

test("동일 이벤트 재전송은 중복으로 응답하고 DB 원본 수를 늘리지 않는다", async () => {
  const duplicate = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(1), event(2)] },
  });
  assert.deepEqual(duplicate.body, {
    accepted: 0,
    duplicates: 2,
    rejected: 0,
    acceptedThroughSequence: 3,
  });
  const detail = await request(`/api/training-telemetry/sessions/${sessionId}`);
  assert.equal(detail.body.data.eventCount, 3);
});

test("같은 sequence에 다른 이벤트를 저장하지 않는다", async () => {
  const result = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(2, { eventId: `${sessionId}:different`, result: "changed" })] },
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.error.code, "CONFLICT");
});

test("Meta 식별·연령 필드와 로컬 파일 경로는 수신하지 않는다", async () => {
  const identity = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(4, { metaAppScopedUserId: "123456" })] },
  });
  assert.equal(identity.response.status, 400);
  assert.deepEqual(identity.body.error.details.unknownFields, ["metaAppScopedUserId"]);

  const localPath = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(4, { note: "outputPath=C:\\Users\\tester\\telemetry.jsonl" })] },
  });
  assert.equal(localPath.response.status, 400);
  assert.match(localPath.body.error.message, /local filesystem path/);
});

test("완료 세션은 종료와 기존 이벤트 재전송에 idempotent하고 새 이벤트를 받지 않는다", async () => {
  const invalidCompletion = await request(`/api/training-telemetry/sessions/${sessionId}/complete`, {
    method: "POST",
    body: {
      schemaVersion: 1,
      endedAtUtc: "2026-08-28T03:00:00.000Z",
      reason: "invalid_test_time",
    },
  });
  assert.equal(invalidCompletion.response.status, 409);

  const completion = {
    schemaVersion: 1,
    endedAtUtc: "2026-08-28T03:13:44.198Z",
    reason: "application_quitting",
  };
  const completed = await request(`/api/training-telemetry/sessions/${sessionId}/complete`, {
    method: "POST",
    body: completion,
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.data.status, "completed");

  const repeated = await request(`/api/training-telemetry/sessions/${sessionId}/complete`, {
    method: "POST",
    body: completion,
  });
  assert.equal(repeated.response.status, 200);

  const duplicateEvents = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(1), event(2)] },
  });
  assert.equal(duplicateEvents.response.status, 200);
  assert.deepEqual(duplicateEvents.body, {
    accepted: 0,
    duplicates: 2,
    rejected: 0,
    acceptedThroughSequence: 3,
  });

  const lateEvent = await request(`/api/training-telemetry/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [event(4)] },
  });
  assert.equal(lateEvent.response.status, 409);
});

test("개발 확인 페이지는 수집 기능이 켜진 경우에만 제공된다", async () => {
  const response = await fetch(`${baseUrl}/telemetry-ingest-test/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /훈련 텔레메트리 DB 확인/);
  assert.match(html, /Meta 테스트 ID\(선택\)/);
  assert.match(html, /자체 ID로 세션 필터/);
  assert.match(html, /앱 버전\/출처/);
  assert.match(html, /Meta 입점 확인/);
  assert.match(html, /Meta 연결 성공/);
  assert.match(html, /Meta 연결 Unity/);
  assert.match(html, /합성 검증/);

  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "확인 페이지의 스크립트를 찾을 수 있어야 한다.");
  assert.doesNotThrow(() => new Function(script));
});

test("저장소의 확인 페이지도 숫자 자체 ID와 선택형 Meta ID 계약을 표시한다", async () => {
  const html = await readFile(
    new URL("../public/telemetry-ingest-test/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /clientInstanceId/);
  assert.match(html, /participantId/);
  assert.match(html, /metaUserId/);
});

test("수집 기능 기본값이 꺼져 있으면 API와 확인 페이지가 노출되지 않는다", async () => {
  const disabledServer = createApp({
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: false,
    enableServerAdmin: false,
  }).listen(0);
  await new Promise((resolve) => disabledServer.once("listening", resolve));
  const disabledBaseUrl = `http://127.0.0.1:${disabledServer.address().port}`;
  try {
    assert.equal((await fetch(`${disabledBaseUrl}/api/training-telemetry/sessions`)).status, 404);
    assert.equal((await fetch(`${disabledBaseUrl}/telemetry-ingest-test/`)).status, 404);
  } finally {
    await new Promise((resolve, reject) =>
      disabledServer.close((error) => error ? reject(error) : resolve()));
  }
});
