import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createApp } from "../src/app.js";
import { createLocalTelemetryRepository } from "../src/modules/local-telemetry/local-telemetry-repository.js";

let directory;
let server;
let baseUrl;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "tyche-telemetry-"));
  const events = [
    { sessionId: "session-one", timestampUtc: "2026-08-26T08:00:00.000Z", eventType: "session_started" },
    { sessionId: "session-one", timestampUtc: "2026-08-26T08:01:00.000Z", eventType: "flow_state_changed", flowState: "PpeArea", mode: "Education", workPlan: "LeakResponse", metaAppScopedUserId: "meta-1", metaAgeCategory: "Adult" },
    { sessionId: "session-one", timestampUtc: "2026-08-26T08:01:01.000Z", eventType: "ppe_grab_attempted", hand: "Right" },
    { sessionId: "session-one", timestampUtc: "2026-08-26T08:01:01.100Z", eventType: "ppe_grab_attempt_resolved", attemptOutcome: "selected" },
    { sessionId: "session-one", timestampUtc: "2026-08-26T08:02:00.000Z", eventType: "session_ended", note: "application_quitting" },
  ];
  await writeFile(
    path.join(directory, "session-one.jsonl"),
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n{invalid-json\n`,
    "utf8",
  );

  server = createApp({
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: true,
    localTelemetryRepository: createLocalTelemetryRepository(directory),
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(directory, { recursive: true, force: true });
});

test("local telemetry API lists summaries and returns raw evidence", async () => {
  const listResponse = await fetch(`${baseUrl}/api/local-telemetry/sessions`);
  const listBody = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.data.length, 1);
  assert.equal(listBody.data[0].eventCount, 5);
  assert.equal(listBody.data[0].invalidLineCount, 1);
  assert.equal(listBody.data[0].grabAttemptCount, 1);
  assert.equal(listBody.data[0].grabSuccessCount, 1);
  assert.equal(Object.hasOwn(listBody.data[0], "metaAgeCategory"), false);

  const detailResponse = await fetch(
    `${baseUrl}/api/local-telemetry/sessions/session-one`,
  );
  const detailBody = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailBody.data.events.length, 5);
  assert.equal(detailBody.data.summary.metaUserId, "meta-1");
  assert.equal(Object.hasOwn(detailBody.data.summary, "metaAgeCategory"), false);
  assert.equal(
    detailBody.data.events.some((event) => Object.hasOwn(event, "metaAgeCategory")),
    false,
  );
  assert.deepEqual(detailBody.data.summary.invalidLineNumbers, [6]);
  assert.equal(detailBody.data.parseErrors.length, 1);
  assert.equal(detailBody.data.parseErrors[0].lineNumber, 6);
  assert.equal(detailBody.data.parseErrors[0].rawLine, "{invalid-json");
  assert.match(detailBody.data.parseErrors[0].message, /JSON/i);
});
