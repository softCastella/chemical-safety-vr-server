import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createResumePlan,
  findRecoverableSessions,
  readSessionMetadata,
} from "../Tools/CodexSessionRecoveryHarness.mjs";

const ids = {
  current: "11111111-1111-4111-8111-111111111111",
  previous: "22222222-2222-4222-8222-222222222222",
  otherRepo: "33333333-3333-4333-8333-333333333333",
};

function writeSession(codexHome, id, cwd, updatedAt, lifecycleEvent = "task_complete") {
  const directory = path.join(codexHome, "sessions", "2026", "09", "04");
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `rollout-${id}.jsonl`);
  const records = [
    {
      type: "session_meta",
      payload: { id, cwd, source: "cli", cli_version: "test" },
    },
    { type: "event_msg", payload: { type: "task_started" } },
    { type: "event_msg", payload: { type: lifecycleEvent } },
  ];
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  fs.utimesSync(filePath, new Date(updatedAt), new Date(updatedAt));
  return filePath;
}

test("같은 저장소의 현재 세션을 제외하고 최신 이전 세션을 찾는다", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-harness-"));
  try {
    const cwd = path.join(codexHome, "server");
    const otherCwd = path.join(codexHome, "client");
    fs.mkdirSync(cwd);
    fs.mkdirSync(otherCwd);

    writeSession(codexHome, ids.previous, cwd, "2026-09-04T12:00:00.000Z", "turn_aborted");
    writeSession(codexHome, ids.current, cwd, "2026-09-04T12:10:00.000Z");
    writeSession(codexHome, ids.otherRepo, otherCwd, "2026-09-04T12:20:00.000Z");
    fs.writeFileSync(
      path.join(codexHome, "session_index.jsonl"),
      [
        JSON.stringify({ id: ids.previous, thread_name: "처음 이름" }),
        JSON.stringify({ id: ids.previous, thread_name: "최근 문서 내용 파악" }),
      ].join("\n"),
      "utf8",
    );

    const sessions = findRecoverableSessions({
      codexHome,
      cwd,
      excludedSessionIds: [ids.current],
    });

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, ids.previous);
    assert.equal(sessions[0].name, "최근 문서 내용 파악");
    assert.equal(sessions[0].lifecycleEvent, "turn_aborted");
    assert.equal(sessions[0].interrupted, true);
  } finally {
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
});

test("손상된 세션 메타데이터는 복구 후보로 사용하지 않는다", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-meta-"));
  try {
    const filePath = path.join(directory, "broken.jsonl");
    fs.writeFileSync(filePath, "{not-json}\n", "utf8");
    assert.equal(readSessionMetadata(filePath), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Windows 재개 계획은 검증된 세션 ID와 저장 경로를 인자로 분리한다", () => {
  const session = { id: ids.previous, cwd: "C:\\Workspace\\server" };
  const plan = createResumePlan(session, {
    platform: "win32",
    environment: { APPDATA: "C:\\Users\\tester\\AppData\\Roaming" },
    codexScript: "C:\\Users\\tester\\AppData\\Roaming\\npm\\codex.ps1",
  });

  assert.equal(plan.command, "powershell.exe");
  assert.deepEqual(plan.arguments.slice(-2), ["resume", ids.previous]);
  assert.equal(plan.cwd, session.cwd);
});
