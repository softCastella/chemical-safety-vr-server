import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { createInMemoryTrainingRegistrationRepository } from "../test-support/in-memory-training-registration-repository.js";

let server;
let baseUrl;

before(async () => {
  server = createApp({
    enableUserCrud: false,
    enableTrainingRegistration: true,
    trainingRegistrationRepository: createInMemoryTrainingRegistrationRepository(),
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("Unity registration POST is readable by the same session ID", async () => {
  const payload = {
    metaUserId: "38950798361185177",
    sessionId: "89556d2796f141378061b77d6477c325",
    timestampUtc: "2026-08-26T07:25:48.000Z",
    scene: "Assets/Scenes/3_PPE_Room_3mode_loco.unity",
    mode: "Education",
    workPlan: "LeakResponse",
    flowState: "PpeSelection",
  };

  const createResponse = await fetch(`${baseUrl}/api/training-registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const createBody = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createBody.message, "가입이 완료되었습니다.");
  assert.equal(createBody.data.metaUserId, payload.metaUserId);
  assert.equal(createBody.data.sessionId, payload.sessionId);

  const readResponse = await fetch(
    `${baseUrl}/api/training-registrations/${payload.sessionId}`,
  );
  const readBody = await readResponse.json();

  assert.equal(readResponse.status, 200);
  assert.deepEqual(readBody.data, createBody.data);
});

test("invalid registration data is rejected and missing sessions return 404", async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/training-registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ metaUserId: "meta-only" }),
  });
  assert.equal(invalidResponse.status, 400);

  const missingResponse = await fetch(
    `${baseUrl}/api/training-registrations/missing-session`,
  );
  assert.equal(missingResponse.status, 404);
});

test("Meta age category is rejected by the registration contract", async () => {
  const response = await fetch(`${baseUrl}/api/training-registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      metaUserId: "38950798361185177",
      metaAgeCategory: "Adult",
      sessionId: "age-category-is-not-supported",
      timestampUtc: "2026-09-11T00:00:00.000Z",
      scene: "Assets/Scenes/0_App.unity",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.error.details.fields, ["metaAgeCategory"]);
});
