import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { createInMemoryUserRepository } from "../test-support/in-memory-user-repository.js";

let server;
let baseUrl;

before(async () => {
  server = createApp({
    userRepository: createInMemoryUserRepository(),
    enableUserCrud: true,
  }).listen(0);
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

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test("user CRUD lifecycle uses an internal UUID and a Meta identity", async () => {
  const createResult = await request("/api/users", {
    method: "POST",
    body: JSON.stringify({
      metaUserId: "meta-app-scoped-user-001",
      ageGroup: "teen",
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.match(
    createResult.body.data.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.match(createResult.body.data.participantCode, /^TY-[0-9A-F]{12}$/);
  assert.equal(createResult.body.data.identities[0].provider, "meta");
  assert.equal(
    createResult.body.data.identities[0].providerUserId,
    "meta-app-scoped-user-001",
  );

  const userId = createResult.body.data.id;
  assert.equal(
    createResult.response.headers.get("location"),
    `/api/users/${userId}`,
  );

  const readResult = await request(`/api/users/${userId}`);
  assert.equal(readResult.response.status, 200);
  assert.equal(readResult.body.data.id, userId);

  const listResult = await request("/api/users?limit=10&offset=0");
  assert.equal(listResult.response.status, 200);
  assert.equal(listResult.body.pagination.total, 1);
  assert.equal(listResult.body.data.length, 1);
  assert.deepEqual(listResult.body.data[0].identities, []);

  const updateResult = await request(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ageGroup: "adult",
      controllerGuideVersionCompleted: 1,
      status: "inactive",
    }),
  });
  assert.equal(updateResult.response.status, 200);
  assert.equal(updateResult.body.data.status, "inactive");
  assert.equal(updateResult.body.data.controllerGuideVersionCompleted, 1);
  assert.equal(updateResult.body.data.identities[0].ageGroup, "adult");

  const deleteResult = await request(`/api/users/${userId}`, {
    method: "DELETE",
  });
  assert.equal(deleteResult.response.status, 204);

  const deletedReadResult = await request(`/api/users/${userId}`);
  assert.equal(deletedReadResult.response.status, 404);
  assert.equal(deletedReadResult.body.error.code, "NOT_FOUND");
});

test("duplicate Meta identities return conflict", async () => {
  const payload = JSON.stringify({ metaUserId: "duplicate-meta-user" });
  const first = await request("/api/users", { method: "POST", body: payload });
  const second = await request("/api/users", { method: "POST", body: payload });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 409);
  assert.equal(second.body.error.code, "CONFLICT");
});

test("name and profile fields are rejected", async () => {
  const result = await request("/api/users", {
    method: "POST",
    body: JSON.stringify({
      metaUserId: "meta-user-with-name",
      displayName: "Not collected",
    }),
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, "BAD_REQUEST");
  assert.deepEqual(result.body.error.details.fields, ["displayName"]);
});

test("invalid user IDs and pagination are rejected", async () => {
  const invalidId = await request("/api/users/not-a-uuid");
  assert.equal(invalidId.response.status, 400);

  const invalidPagination = await request("/api/users?limit=1000");
  assert.equal(invalidPagination.response.status, 400);
});

test("invalid JSON returns bad request", async () => {
  const result = await request("/api/users", {
    method: "POST",
    body: "{invalid-json",
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, "BAD_REQUEST");
});

test("the user CRUD route can be disabled before production authentication", async () => {
  const disabledServer = createApp({
    userRepository: createInMemoryUserRepository(),
    enableUserCrud: false,
  }).listen(0);
  await new Promise((resolve) => disabledServer.once("listening", resolve));

  try {
    const address = disabledServer.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/users`,
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
  } finally {
    await new Promise((resolve, reject) => {
      disabledServer.close((error) =>
        error ? reject(error) : resolve(),
      );
    });
  }
});
