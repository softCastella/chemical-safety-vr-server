import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrls = [
  "009_create_training_telemetry.sql",
  "010_create_training_telemetry_identities.sql",
  "011_create_training_telemetry_sessions.sql",
  "012_create_training_telemetry_events.sql",
].map((name) => new URL(`../db/migrations/${name}`, import.meta.url));

test("텔레메트리 migration은 새 클라이언트 세션과 원본 이벤트 중복 제약을 정의한다", async () => {
  const migrations = await Promise.all(
    migrationUrls.map((url) => readFile(url, "utf8")),
  );
  assert.ok(
    migrations.every((sql) => (sql.match(/CREATE TABLE/gi) ?? []).length === 1),
    "기존 migration 실행기는 파일당 SQL 문 하나만 실행한다.",
  );
  const sql = migrations.join("\n");
  assert.match(sql, /CREATE TABLE training_telemetry_participants/i);
  assert.match(sql, /participant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT/i);
  assert.match(sql, /CREATE TABLE training_telemetry_identities/i);
  assert.match(sql, /UNIQUE KEY uq_training_telemetry_identity \(source_project, identity_type, identity_value\)/i);
  assert.match(sql, /CREATE TABLE training_telemetry_sessions/i);
  assert.match(sql, /source_project VARCHAR\(64\).*NOT NULL/i);
  assert.match(sql, /FOREIGN KEY \(participant_id\) REFERENCES training_telemetry_participants \(participant_id\)/i);
  assert.match(sql, /CREATE TABLE training_telemetry_events/i);
  assert.match(sql, /payload_json JSON NOT NULL/i);
  assert.match(sql, /UNIQUE KEY uq_training_telemetry_events_event_id \(event_id\)/i);
  assert.match(sql, /UNIQUE KEY uq_training_telemetry_events_session_sequence \(session_id, sequence\)/i);
  assert.match(sql, /FOREIGN KEY \(session_id\) REFERENCES training_telemetry_sessions \(session_id\)/i);
});
