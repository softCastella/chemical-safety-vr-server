import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import {
  createMetaUserProofVerifier,
  createTrainingTelemetrySessionTokenService,
} from "../src/modules/training-telemetry/training-telemetry-meta-auth.js";
import { createInMemoryTrainingTelemetryRepository } from "../test-support/in-memory-training-telemetry-repository.js";

const developmentToken = "development-token-1234567890";
const sessionTokenSecret = "meta-session-signing-secret-1234567890";
const verifiedMetaUserId = "123456789012345";
const validUserProof = "single-use-user-proof-1234567890";
const clientInstanceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const startedAtUtc = "2026-09-09T12:00:00.000Z";

let server;
let baseUrl;

async function jsonRequest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

async function authenticate(userProof = validUserProof) {
  return jsonRequest("/api/training-telemetry/auth/meta", {
    method: "POST",
    body: { metaUserId: verifiedMetaUserId, userProof },
  });
}

function session(sessionId, metaUserId = verifiedMetaUserId) {
  return {
    schemaVersion: 1,
    sourceProject: "chemical-safety-vr-client",
    clientInstanceId,
    metaUserId,
    sessionId,
    startedAtUtc,
    appVersion: "0.1.0",
    scene: "Assets/Scenes/4_PPE_Room.unity",
  };
}

before(async () => {
  server = createApp({
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: true,
    trainingTelemetryUploadToken: developmentToken,
    enableMetaTrainingTelemetryAuth: true,
    trainingTelemetrySessionTokenSecret: sessionTokenSecret,
    trainingTelemetrySessionTokenTtlSeconds: 900,
    trainingTelemetryMetaProofVerifier: async ({ metaUserId, userProof }) =>
      metaUserId === verifiedMetaUserId && userProof === validUserProof,
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

test("검증된 Meta User Proof에만 짧은 수명의 Release 업로드 토큰을 발급한다", async () => {
  const authenticated = await authenticate();
  assert.equal(authenticated.response.status, 200);
  assert.equal(authenticated.body.data.tokenType, "Bearer");
  assert.equal(authenticated.body.data.expiresIn, 900);
  assert.equal(authenticated.body.data.metaUserId, verifiedMetaUserId);
  assert.ok(authenticated.body.data.accessToken.length > 32);
  assert.doesNotMatch(authenticated.body.data.accessToken, /single-use-user-proof/);

  const rejected = await authenticate("invalid-user-proof-1234567890");
  assert.equal(rejected.response.status, 401);
  assert.equal(rejected.body.error.code, "UNAUTHORIZED");
});

test("Release 토큰은 검증된 Meta 사용자 세션의 업로드만 허용한다", async () => {
  const authenticated = await authenticate();
  const token = authenticated.body.data.accessToken;
  const sessionId = "release-meta-session-0001";

  const created = await jsonRequest("/api/training-telemetry/sessions", {
    method: "POST",
    token,
    body: session(sessionId),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.participantId, 1);

  const event = {
    schemaVersion: 1,
    sessionId,
    eventId: `${sessionId}:00000001`,
    sequence: 1,
    timestampUtc: startedAtUtc,
    eventType: "session_started",
  };
  const saved = await jsonRequest(
    `/api/training-telemetry/sessions/${sessionId}/events`,
    { method: "POST", token, body: { events: [event] } },
  );
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.acceptedThroughSequence, 1);

  const completed = await jsonRequest(
    `/api/training-telemetry/sessions/${sessionId}/complete`,
    {
      method: "POST",
      token,
      body: {
        schemaVersion: 1,
        endedAtUtc: "2026-09-09T12:01:00.000Z",
        reason: "application_quitting",
      },
    },
  );
  assert.equal(completed.response.status, 200);

  const releaseRead = await jsonRequest(
    `/api/training-telemetry/sessions/${sessionId}`,
    { token },
  );
  assert.equal(releaseRead.response.status, 401);

  const developmentRead = await jsonRequest(
    `/api/training-telemetry/sessions/${sessionId}`,
    { token: developmentToken },
  );
  assert.equal(developmentRead.response.status, 200);
  assert.equal(developmentRead.body.data.eventCount, 1);
});

test("Release 토큰의 Meta ID 불일치와 서명 변조를 거부한다", async () => {
  const authenticated = await authenticate();
  const token = authenticated.body.data.accessToken;

  const mismatch = await jsonRequest("/api/training-telemetry/sessions", {
    method: "POST",
    token,
    body: session("release-meta-session-mismatch", "999999999999999"),
  });
  assert.equal(mismatch.response.status, 401);

  const tampered = await jsonRequest("/api/training-telemetry/sessions", {
    method: "POST",
    token: `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`,
    body: session("release-meta-session-tampered"),
  });
  assert.equal(tampered.response.status, 401);
});

test("Release 토큰은 만료 시 거부된다", () => {
  let now = Date.parse("2026-09-09T12:00:00.000Z");
  const service = createTrainingTelemetrySessionTokenService({
    secret: sessionTokenSecret,
    lifetimeSeconds: 60,
    now: () => now,
  });
  const token = service.issue(verifiedMetaUserId);
  assert.equal(service.verify(token).metaUserId, verifiedMetaUserId);
  now += 60_000;
  assert.throws(() => service.verify(token), /invalid or expired/);
});

test("Meta 검증기는 공식 user_nonce_validate 계약에 비밀값을 서버에서만 추가한다", async () => {
  let requestedUrl;
  let requestedOptions;
  const verifier = createMetaUserProofVerifier({
    appAccessToken: "server-only-app-access-token-123456",
    fetchImplementation: async (url, options) => {
      requestedUrl = new URL(url);
      requestedOptions = options;
      return new Response(JSON.stringify({ is_valid: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(await verifier({
    metaUserId: verifiedMetaUserId,
    userProof: validUserProof,
  }), true);
  assert.equal(requestedUrl.origin, "https://graph.oculus.com");
  assert.equal(requestedUrl.pathname, "/user_nonce_validate");
  assert.equal(requestedUrl.search, "");
  assert.equal(requestedOptions.method, "POST");
  assert.equal(
    requestedOptions.headers["Content-Type"],
    "application/x-www-form-urlencoded",
  );
  assert.equal(requestedOptions.body.get("user_id"), verifiedMetaUserId);
  assert.equal(requestedOptions.body.get("nonce"), validUserProof);
  assert.equal(
    requestedOptions.body.get("access_token"),
    "server-only-app-access-token-123456",
  );
});

test("Meta Release 인증 필수 설정 누락은 설정명을 포함해 즉시 실패한다", () => {
  assert.throws(
    () => createApp({
      enableTrainingTelemetryIngest: true,
      trainingTelemetryUploadToken: developmentToken,
      enableMetaTrainingTelemetryAuth: true,
      trainingTelemetrySessionTokenSecret: "",
      trainingTelemetryMetaProofVerifier: async () => true,
      trainingTelemetryRepository: createInMemoryTrainingTelemetryRepository(),
    }),
    /TRAINING_TELEMETRY_SESSION_TOKEN_SECRET/,
  );

  assert.throws(
    () => createApp({
      enableTrainingTelemetryIngest: true,
      trainingTelemetryUploadToken: developmentToken,
      enableMetaTrainingTelemetryAuth: true,
      trainingTelemetrySessionTokenSecret: sessionTokenSecret,
      metaPlatformAppAccessToken: "",
      trainingTelemetryRepository: createInMemoryTrainingTelemetryRepository(),
    }),
    /META_PLATFORM_APP_ACCESS_TOKEN/,
  );
});
