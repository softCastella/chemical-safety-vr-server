import assert from "node:assert/strict";
import test from "node:test";

import { validateKoreanCommitMessage } from "../Tools/KoreanCommitMessageHarness.mjs";

test("commit message harness accepts a Korean subject and numbered body", () => {
  const errors = validateKoreanCommitMessage(
    "한글 커밋 제목\n\n1. 변경 내용을 기록한다.\n2. 검증 결과를 기록한다.\n",
  );
  assert.deepEqual(errors, []);
});

test("commit message harness rejects an English-only subject", () => {
  const errors = validateKoreanCommitMessage(
    "Add a commit hook\n\n1. 변경 내용을 기록한다.\n",
  );
  assert.match(errors.join(" "), /한글/u);
});

test("commit message harness requires a numbered body", () => {
  const errors = validateKoreanCommitMessage(
    "한글 커밋 제목\n\n변경 내용을 기록한다.\n",
  );
  assert.match(errors.join(" "), /번호 목록/u);
});
