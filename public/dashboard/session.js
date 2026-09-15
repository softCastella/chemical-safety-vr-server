const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const directSessionId = params.get("sessionId");
const fromUsers = params.get("from") === "users";
const modeLabels = { Education: "교육", Training: "훈련", Test: "테스트" };
const workPlanLabels = { ConfinedSpace: "밀폐공간", LeakResponse: "누출 대응" };
const stateLabels = {
  Welcome: "시작 안내", NameInput: "이름 입력", ControllerRay: "트리거 안내",
  ControllerMarker: "그립·마커 안내", ControllerRayT: "조이스틱 안내",
  ControllerPanel: "컨트롤러 버튼 안내", CardIntro: "시나리오 카드 안내",
  ModalDetail: "시나리오 상세", EducationSelected: "교육 모드 선택 후 안내",
  PpeEducationSelected: "보호구 학습 선택 안내", TeleportInstruction: "이동 안내",
  PpeArea: "보호구 착용 구역", Completed: "단계 완료", TrainingSelected: "훈련 모드 선택 후 안내",
  TestSelected: "테스트 모드 선택 후 안내",
};
const ppeLabels = {
  HazmatSuit: "방호복", TacticalHarness: "안전대", GasMask: "송기마스크",
  FaceShield: "안면보호대", NitrileInnerGloveLeft: "왼쪽 니트릴 내부장갑",
  NitrileInnerGloveRight: "오른쪽 니트릴 내부장갑", SafetyGoggles: "화학보안경",
  RubberGloveLeft: "내화학성 외부 장갑 (좌)", RubberGloveRight: "내화학성 외부 장갑 (우)",
  PackingTape: "보호 테이프", RubberBootLeft: "내화학성 장화 (좌)",
  RubberBootRight: "내화학성 장화 (우)", ConstructionHelmet: "안전모",
};
const verifiedPpeTypes = new Set(Object.keys(ppeLabels));
const failedGrabOutcomes = new Set(["no_ppe_hover", "repeated_before_select", "hover_without_select"]);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const kst = (value) => new Date(value).toLocaleString("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const secondsBetween = (start, end) => {
  const milliseconds = Date.parse(end) - Date.parse(start);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds / 1000 : null;
};
const elapsed = (value) => value === null ? "미계측" : value < 1
  ? `${value.toFixed(2)}초` : value < 60
    ? `${value.toFixed(1)}초` : `${Math.floor(value / 60)}분 ${(value % 60).toFixed(1)}초`;
const difference = (actual, baseline) => actual === null || baseline === null
  ? "—" : `${actual >= baseline ? "+" : "−"}${elapsed(Math.abs(actual - baseline))}`;
const labelPpe = (itemType) => ppeLabels[itemType] ?? "장비명 미확인";
const labelStage = (flowState) => stateLabels[flowState] ?? "단계명 미확인";
const labelMode = (mode) => modeLabels[mode] ?? "모드 미확인";
const labelPlan = (plan) => workPlanLabels[plan] ?? "시나리오 미확인";
let snapshot;
let selectedSession;
let selectedRun;
let focusSequence = Number.isSafeInteger(Number(params.get("focus"))) && params.has("focus")
  ? Number(params.get("focus")) : null;
const sourceSection = ["stages", "ppe"].includes(params.get("from")) ? params.get("from") : "ppe";

function modeRuns(session) {
  const starts = session.events.filter((event) => event.eventType === "mode_session_started");
  return starts.map((start, index) => {
    const endSequence = starts[index + 1]?.sequence ?? Infinity;
    const inRun = (event) => event.sequence > start.sequence && event.sequence < endSequence;
    return {
      start, index: index + 1,
      events: session.events.filter((event) => inRun(event)
        && event.mode === start.mode && event.workPlan === start.workPlan),
      attempts: (session.grabAttempts ?? []).filter(inRun),
      selections: (session.grabSelections ?? []).filter((event) => inRun(event)
        && event.modeRunIndex === index + 1
        && event.mode === start.mode && event.workPlan === start.workPlan),
    };
  });
}

function stageSegments(run) {
  const stages = run.events.filter((event) => event.eventType === "flow_state_changed");
  const completion = run.events.find((event) => event.eventType === "mode_session_completed");
  const pairs = stages.slice(1).map((event, index) => [stages[index], event]);
  if (stages.length && completion) pairs.push([stages.at(-1), completion]);
  return pairs.map(([prior, event]) => ({
    key: `${prior.flowState}|${event.flowState ?? "mode_completed"}`,
    label: `${labelStage(prior.flowState)} → ${event.flowState ? labelStage(event.flowState) : "모드 완료"}`,
    seconds: secondsBetween(prior.timestampUtc, event.timestampUtc),
    fromTimestampUtc: prior.timestampUtc, toTimestampUtc: event.timestampUtc,
  })).filter((segment) => segment.seconds !== null);
}

function ppeSegments(run) {
  const distinct = [];
  for (const item of run.selections) {
    if (!item.itemType) continue;
    if (distinct.at(-1)?.itemType !== item.itemType) distinct.push(item);
  }
  return distinct.slice(0, -1).map((item, index) => {
    const next = distinct[index + 1];
    return {
      key: `${item.itemType}|${next.itemType}`,
      label: `${labelPpe(item.itemType)} → ${labelPpe(next.itemType)}`,
      seconds: secondsBetween(item.timestampUtc, next.timestampUtc),
      failedGrabs: run.attempts.filter((attempt) => attempt.sequence > item.sequence
        && attempt.sequence < next.sequence && failedGrabOutcomes.has(attempt.outcome)).length,
      fromTimestampUtc: item.timestampUtc, toTimestampUtc: next.timestampUtc,
    };
  }).filter((segment) => segment.seconds !== null
    && segment.key.split("|").every((type) => verifiedPpeTypes.has(type)));
}

function timelineEvents(run) {
  const rows = [{ sequence: run.start.sequence, timestampUtc: run.start.timestampUtc,
    kind: "mode", label: "모드 시작", detail: `${labelPlan(run.start.workPlan)} · ${labelMode(run.start.mode)}` }];
  for (const event of run.events) {
    if (event.eventType === "flow_state_changed") rows.push({ sequence: event.sequence,
      timestampUtc: event.timestampUtc, kind: "stage", label: "단계 이동", detail: labelStage(event.flowState) });
    if (event.eventType === "ppe_inspection_started") rows.push({ sequence: event.sequence,
      timestampUtc: event.timestampUtc, kind: "ppe", label: "보호구 검사 시작", detail: labelPpe(event.itemType) });
    if (event.eventType === "ppe_choice_resolved") rows.push({ sequence: event.sequence,
      timestampUtc: event.timestampUtc, kind: "ppe", label: "보호구 사용 판단 기록", detail: labelPpe(event.itemType) });
    if (event.eventType === "quiz_answer_resolved") rows.push({ sequence: event.sequence,
      timestampUtc: event.timestampUtc, kind: "quiz", label: Number.isInteger(Number(event.quizQuestionIndex)) && Number(event.quizQuestionIndex) > 0 ? `${event.quizQuestionIndex}번 문항 응답` : "문항 순번 미확인",
      detail: event.quizCorrect === true ? "정답" : event.quizCorrect === false ? "오답" : "정오 미계측" });
    if (event.eventType === "mode_session_completed") rows.push({ sequence: event.sequence,
      timestampUtc: event.timestampUtc, kind: "mode", label: "모드 완료 기록", detail: `${labelPlan(run.start.workPlan)} · ${labelMode(run.start.mode)}` });
  }
  for (const event of run.selections) rows.push({ sequence: event.sequence,
    timestampUtc: event.timestampUtc, kind: "ppe", label: "보호구 잡음", detail: labelPpe(event.itemType) });
  for (const attempt of run.attempts.filter((item) => failedGrabOutcomes.has(item.outcome))) {
    rows.push({ sequence: attempt.sequence, timestampUtc: attempt.timestampUtc,
      kind: "failure", label: "보호구 잡기 실패 기록", detail: labelPpe(attempt.itemType) });
  }
  return rows.sort((left, right) => left.sequence - right.sequence || left.label.localeCompare(right.label, "ko"));
}

function updateUrl() {
  const query = new URLSearchParams();
  if (directSessionId) query.set("sessionId", directSessionId);
  else {
    query.set("play", selectedSession.key);
    query.set("started", selectedSession.startedAtUtc);
  }
  if (selectedRun) query.set("run", String(selectedRun.start.sequence));
  if (focusSequence !== null) query.set("focus", String(focusSequence));
  query.set("from", fromUsers ? "users" : sourceSection);
  history.replaceState(null, "", `${location.pathname}?${query}`);
}

function renderRun() {
  const session = selectedSession;
  const runs = modeRuns(session);
  $("playSelect").value = String(snapshot.sessions.indexOf(session));
  $("runTabs").innerHTML = runs.length ? runs.map((run) =>
    `<button type="button" data-run="${run.start.sequence}" aria-pressed="${run.start.sequence === selectedRun?.start.sequence}">${run.index}회차 · ${escapeHtml(labelPlan(run.start.workPlan))} · ${escapeHtml(labelMode(run.start.mode))}</button>`).join("")
    : '<span class="session-scope">이 플레이에는 모드 시작 기록이 없습니다.</span>';
  $("runTabs").querySelectorAll("[data-run]").forEach((button) => button.addEventListener("click", () => {
    selectedRun = runs.find((run) => run.start.sequence === Number(button.dataset.run));
    focusSequence = null;
    updateUrl();
    renderRun();
  }));
  const run = selectedRun;
  $("rawSource").innerHTML = session.sessionId
    ? `<a href="/api/training-telemetry/dashboard-play/sessions/${encodeURIComponent(session.sessionId)}" target="_blank" rel="noopener">이 플레이의 조회 원본 보기</a> · 관리자 인증 필요`
    : "로컬 미리보기에는 원본 세션 ID가 포함되지 않습니다. 화면의 기록 시각과 이벤트 순서는 익명화된 스냅샷에서 계산했습니다.";
  if (!run) {
    $("sessionScope").textContent = `${session.key} 플레이 · ${kst(session.startedAtUtc)} · 앱 ${session.appVersion ?? "미확인"} · 모드 실행 기록 없음`;
    for (const id of ["durationValue", "completionValue", "selectionValue", "failureValue", "quizValue"]) $(id).textContent = "—";
    $("quizDetail").textContent = "응답 이벤트 기준";
    for (const id of ["timelineRows", "stageRows", "ppeRows", "quizRows"]) $(id).innerHTML = '<tr><td colspan="6" class="empty-row">이 플레이에는 선택할 모드 실행 기록이 없습니다.</td></tr>';
    $("baselineSource").textContent = "모드 시작 기록이 없어 기준시간과 비교하지 않습니다.";
    $("backLink").href = fromUsers ? `users.html?user=${session.participantId}` : "play.html";
    $("backLink").textContent = "전 화면으로 돌아가기";
    return;
  }
  const scope = `${labelPlan(run.start.workPlan)} · ${labelMode(run.start.mode)} · ${run.index}회차`;
  for (const id of ["timelineScope", "stageScope", "ppeScope", "quizScope"]) $(id).textContent = scope;
  $("sessionScope").textContent = `${session.key} 플레이 · ${kst(session.startedAtUtc)} · 앱 ${session.appVersion ?? "미확인"} · ${scope}`;
  const completion = run.events.find((event) => event.eventType === "mode_session_completed");
  const duration = completion ? secondsBetween(run.start.timestampUtc, completion.timestampUtc) : null;
  const failures = run.attempts.filter((attempt) => failedGrabOutcomes.has(attempt.outcome));
  const quizzes = run.events.filter((event) => event.eventType === "quiz_answer_resolved");
  $("durationValue").textContent = duration === null ? "완료 기록 없음" : elapsed(duration);
  $("completionValue").textContent = completion ? "완료 기록 있음" : "완료 기록 없음";
  $("selectionValue").textContent = `${run.selections.length}건`;
  $("failureValue").textContent = `${failures.length}건`;
  $("quizValue").textContent = `${quizzes.length}건`;
  $("quizDetail").textContent = `오답 기록 ${quizzes.filter((event) => event.quizCorrect === false).length}건`;
  const baseline = snapshot.baseline?.runs?.find((item) => item.workPlan === run.start.workPlan && item.mode === run.start.mode) ?? null;
  $("baselineSource").textContent = baseline
    ? `기준: ${snapshot.baseline.description} · ${baseline.reference} · 앱 ${baseline.appVersion}. 이 실행: 앱 ${session.appVersion ?? "미확인"}. 같은 시나리오·모드·구간만 비교하며, 앱 버전과 실행 환경이 달라 차이만으로 지연을 판정하지 않습니다.`
    : "선택한 시나리오·모드의 기준 실행이 없어 시간 차이를 계산하지 않습니다.";
  const stageReferences = new Map((baseline?.stages ?? []).map((item) => [item.key, item.seconds]));
  const ppeReferences = new Map((baseline?.transitions ?? []).map((item) => [item.key, item.seconds]));
  const events = timelineEvents(run);
  $("timelineRows").innerHTML = events.length ? events.map((event) => {
    const cumulative = secondsBetween(run.start.timestampUtc, event.timestampUtc);
    return `<tr id="event-${event.sequence}" data-kind="${event.kind}" class="${event.sequence === focusSequence ? "is-focused" : ""}"><td class="time-cell">${elapsed(cumulative)}</td><td><b>${escapeHtml(event.label)}</b></td><td>${escapeHtml(event.detail)}</td><td class="time-cell">${kst(event.timestampUtc)}</td></tr>`;
  }).join("") : '<tr><td colspan="4" class="empty-row">모드 실행 이벤트가 없습니다.</td></tr>';
  const stages = stageSegments(run);
  $("stageRows").innerHTML = stages.length ? stages.map((item) => {
    const reference = stageReferences.get(item.key) ?? null;
    return `<tr><td><b>${escapeHtml(item.label)}</b></td><td>${elapsed(item.seconds)}</td><td>${reference === null ? "기준 없음" : elapsed(reference)}</td><td>${difference(item.seconds, reference)}</td><td class="time-cell">${kst(item.fromTimestampUtc)} → ${kst(item.toTimestampUtc)}</td></tr>`;
  }).join("") : '<tr><td colspan="5" class="empty-row">다음 단계까지 시간을 계산할 기록이 없습니다.</td></tr>';
  const transitions = ppeSegments(run);
  $("ppeRows").innerHTML = transitions.length ? transitions.map((item) => {
    const reference = ppeReferences.get(item.key) ?? null;
    return `<tr><td><b>${escapeHtml(item.label)}</b></td><td>${elapsed(item.seconds)}</td><td>${reference === null ? "기준 없음" : elapsed(reference)}</td><td>${difference(item.seconds, reference)}</td><td>${item.failedGrabs}건</td><td class="time-cell">${kst(item.fromTimestampUtc)} → ${kst(item.toTimestampUtc)}</td></tr>`;
  }).join("") : '<tr><td colspan="6" class="empty-row">연속으로 잡은 보호구 구간이 기록되지 않았습니다.</td></tr>';
  $("quizRows").innerHTML = quizzes.length ? quizzes.map((event) =>
    `<tr><td><b>${Number.isInteger(Number(event.quizQuestionIndex)) && Number(event.quizQuestionIndex) > 0 ? `${event.quizQuestionIndex}번 문항` : "문항 순번 미확인"}</b></td><td>${event.quizCorrect === true ? "정답" : event.quizCorrect === false ? "오답" : "정오 미계측"}</td><td class="time-cell">${kst(event.timestampUtc)}</td></tr>`).join("")
    : '<tr><td colspan="3" class="empty-row">문항 응답 기록이 없습니다.</td></tr>';
  const backQuery = new URLSearchParams({ plan: run.start.workPlan ?? "", mode: run.start.mode ?? "" });
  $("backLink").href = fromUsers
    ? `users.html?user=${session.participantId}`
    : `play.html?${backQuery}#${sourceSection}`;
  $("backLink").textContent = "전 화면으로 돌아가기";
  if (focusSequence !== null && events.some((event) => event.sequence === focusSequence)) {
    requestAnimationFrame(() => $(`event-${focusSequence}`)?.scrollIntoView({ block: "center" }));
  }
}

async function load() {
  try {
    const endpoint = directSessionId
      ? `/api/training-telemetry/dashboard-play/sessions/${encodeURIComponent(directSessionId)}`
      : "/api/training-telemetry/dashboard-play";
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`플레이 기록 조회 실패 (HTTP ${response.status})`);
    const payload = await response.json();
    const data = payload.data;
    snapshot = directSessionId ? { sessions: [data], baseline: payload.baseline ?? null, preview: false } : data;
    if (!Array.isArray(snapshot.sessions)) throw new Error("플레이 조회 형식이 올바르지 않습니다.");
    for (const session of snapshot.sessions) session.events.sort((left, right) => left.sequence - right.sequence);
    $("sourceStatus").textContent = directSessionId
      ? "관리자 전용 운영 조회 · 선택한 플레이 기록"
      : snapshot.preview
      ? `운영 MySQL 읽기 전용 로컬 스냅샷 · ${kst(snapshot.capturedAtUtc)} KST 확보 · 새 플레이 자동 반영 전`
      : `관리자 전용 운영 조회 · ${kst(snapshot.capturedAtUtc)} KST 기준 · 최근 최대 ${snapshot.limit}개 플레이`;
    $("playSelect").innerHTML = snapshot.sessions.map((session, index) =>
      `<option value="${index}">${kst(session.startedAtUtc)} · ${escapeHtml(session.key)} · 모드 실행 ${modeRuns(session).length}회</option>`).join("");
    const requestedKey = directSessionId ? null : params.get("play");
    const matches = requestedKey ? snapshot.sessions.filter((session) => session.key === requestedKey
      && session.startedAtUtc === params.get("started")) : [];
    if (requestedKey && matches.length !== 1) throw new Error("요청한 플레이를 현재 조회 범위에서 찾지 못했습니다. 병목 분석에서 다시 선택해 주세요.");
    selectedSession = matches[0] ?? snapshot.sessions.find((session) => modeRuns(session).length) ?? snapshot.sessions[0];
    if (!selectedSession) throw new Error("조회된 플레이가 없습니다.");
    const runs = modeRuns(selectedSession);
    const requestedRun = params.has("run") ? Number(params.get("run")) : null;
    selectedRun = requestedRun === null ? runs[0] ?? null : runs.find((run) => run.start.sequence === requestedRun) ?? null;
    if (requestedRun !== null && !selectedRun) throw new Error("요청한 모드 실행을 이 플레이에서 찾지 못했습니다. 병목 분석에서 다시 선택해 주세요.");
    $("playSelect").addEventListener("change", (event) => {
      selectedSession = snapshot.sessions[Number(event.target.value)];
      selectedRun = modeRuns(selectedSession)[0] ?? null;
      focusSequence = null;
      updateUrl();
      renderRun();
    });
    updateUrl();
    renderRun();
  } catch (error) {
    $("error").hidden = false;
    $("error").textContent = error.message;
    $("sourceStatus").textContent = "플레이 기록을 불러오지 못했습니다.";
  }
}
load();
