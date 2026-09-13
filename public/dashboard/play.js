const $ = (id) => document.getElementById(id);
const route = ["0_App", "1_Title", "2_Intro", "3_Loading", "4_PPE_Room"];
const modeLabels = { Education: "교육", Training: "훈련", Test: "테스트" };
const workPlanLabels = { ConfinedSpace: "밀폐공간", LeakResponse: "누출 대응" };
const stateLabels = {
  Welcome: "시작 안내", NameInput: "이름 입력", ControllerRay: "트리거 안내",
  ControllerMarker: "그립·마커 안내", ControllerRayT: "조이스틱 안내",
  ControllerPanel: "컨트롤러 버튼 안내", CardIntro: "시나리오 카드 안내",
  ModalDetail: "시나리오 상세", EducationSelected: "교육 선택",
  PpeEducationSelected: "PPE 교육 선택", TeleportInstruction: "이동 안내",
  PpeArea: "PPE 구역", Completed: "단계 완료", TrainingSelected: "훈련 선택",
  TestSelected: "테스트 선택",
};
const ppeLabels = {
  HazmatSuit: "방호복", TacticalHarness: "안전 하네스", ScubaGear: "공기호흡기",
  FaceShield: "안면 보호구", GasMask: "방독면", RubberGloveLeft: "왼쪽 고무장갑",
  RubberGloveRight: "오른쪽 고무장갑", NitrileInnerGloveLeft: "왼쪽 니트릴 속장갑",
  NitrileInnerGloveRight: "오른쪽 니트릴 속장갑", SafetyGoggles: "보안경",
  PackingTape: "보호 테이프", RubberBootLeft: "왼쪽 고무장화",
  RubberBootRight: "오른쪽 고무장화", ConstructionHelmet: "안전모",
};
const failedGrabOutcomes = new Set(["no_ppe_hover", "repeated_before_select", "hover_without_select"]);
const selection = { workPlan: "LeakResponse", mode: "Education" };

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
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const elapsed = (value) => value === null ? "미계측" : value < 1
  ? `${value.toFixed(2)}초` : value < 60
    ? `${value.toFixed(1)}초` : `${Math.floor(value / 60)}분 ${(value % 60).toFixed(1)}초`;
const sceneName = (value) => String(value ?? "").split(/[\\/]/).at(-1).replace(/\.unity$/i, "");
const startedAt = (session) => session.events.find((event) => event.eventType === "session_started")?.timestampUtc
  ?? session.startedAtUtc;
const labelPpe = (itemType) => ppeLabels[itemType] ?? "미분류 PPE";
const labelStage = (flowState) => stateLabels[flowState] ?? "미분류 단계";

function buildModeRuns(sessions) {
  const runs = [];
  sessions.forEach((session, sessionIndex) => {
    const starts = session.events.filter((event) => event.eventType === "mode_session_started");
    starts.forEach((start, startIndex) => {
      const endSequence = starts[startIndex + 1]?.sequence ?? Infinity;
      const inRun = (event) => event.sequence > start.sequence && event.sequence < endSequence;
      runs.push({
        sessionIndex, start,
        events: session.events.filter((event) => inRun(event)
          && event.mode === start.mode && event.workPlan === start.workPlan),
        attempts: (session.grabAttempts ?? []).filter(inRun),
        selections: (session.grabSelections ?? []).filter((event) => inRun(event)
          && event.modeRunIndex === startIndex + 1
          && event.mode === start.mode && event.workPlan === start.workPlan),
      });
    });
  });
  return runs;
}

function stageSegments(run) {
  const stages = run.events.filter((event) => event.eventType === "flow_state_changed");
  return stages.map((event, index) => {
    const prior = stages[index - 1];
    return {
      key: `${prior?.flowState ?? "mode_start"}|${event.flowState}`,
      label: `${prior ? labelStage(prior.flowState) : "모드 시작"} → ${labelStage(event.flowState)}`,
      seconds: secondsBetween(prior?.timestampUtc ?? run.start.timestampUtc, event.timestampUtc),
      order: index,
    };
  }).filter((segment) => segment.seconds !== null);
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
      failedGrabs: run.attempts.filter((attempt) =>
        attempt.sequence > item.sequence && attempt.sequence < next.sequence
        && failedGrabOutcomes.has(attempt.outcome)).length,
      order: index,
    };
  }).filter((segment) => segment.seconds !== null);
}

function ppeChoices(run) {
  const choices = run.events.filter((event) => event.eventType === "ppe_choice_resolved");
  return choices.map((choice, index) => {
    const boundary = choices[index - 1]?.sequence ?? run.start.sequence;
    const firstAttempt = run.events.find((event) =>
      event.sequence > boundary && event.sequence < choice.sequence
      && event.itemType === choice.itemType
      && ["ppe_grab_attempted", "ppe_inspection_started"].includes(event.eventType));
    return {
      key: choice.itemType,
      label: labelPpe(choice.itemType),
      seconds: firstAttempt ? secondsBetween(firstAttempt.timestampUtc, choice.timestampUtc) : null,
    };
  }).filter((item) => item.key && item.seconds !== null);
}

function averagePerRun(runs, extract) {
  const groups = new Map();
  runs.forEach((run) => {
    const withinRun = new Map();
    for (const item of extract(run)) {
      if (!withinRun.has(item.key)) withinRun.set(item.key, []);
      withinRun.get(item.key).push(item);
    }
    for (const [key, items] of withinRun) {
      if (!groups.has(key)) groups.set(key, {
        key, label: items[0].label, order: items[0].order ?? Infinity, seconds: [], failedGrabs: [],
      });
      const group = groups.get(key);
      group.order = Math.min(group.order, items[0].order ?? Infinity);
      group.seconds.push(mean(items.map((item) => item.seconds)));
      if (items[0].failedGrabs !== undefined) {
        group.failedGrabs.push(mean(items.map((item) => item.failedGrabs)));
      }
    }
  });
  return [...groups.values()].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, "ko"));
}

function renderSceneAverages(sessions) {
  const rows = route.map((name, index) => {
    const gaps = [];
    const cumulative = [];
    for (const session of sessions) {
      const byName = new Map();
      for (const event of session.events.filter((item) => item.eventType === "scene_loaded")) {
        const key = sceneName(event.scene);
        if (!byName.has(key)) byName.set(key, event);
      }
      const event = byName.get(name);
      if (!event) continue;
      const elapsedFromStart = secondsBetween(startedAt(session), event.timestampUtc);
      if (elapsedFromStart !== null) cumulative.push(elapsedFromStart);
      const prior = byName.get(route[index - 1]);
      const gap = prior ? secondsBetween(prior.timestampUtc, event.timestampUtc) : null;
      if (gap !== null) gaps.push(gap);
    }
    return `<tr><td><b>${escapeHtml(name)}</b></td><td>${index === 0 ? "—" : elapsed(mean(gaps))}</td><td>${elapsed(mean(cumulative))}</td><td>${cumulative.length}개 플레이</td></tr>`;
  });
  $("sceneRows").innerHTML = rows.join("");
}

function renderCohort(snapshot, allRuns) {
  const runs = allRuns.filter((run) =>
    run.start.workPlan === selection.workPlan && run.start.mode === selection.mode);
  const playCount = new Set(runs.map((run) => run.sessionIndex)).size;
  const stageItems = runs.flatMap(stageSegments);
  const ppeItems = runs.flatMap(ppeSegments);
  const firstGrabTimes = runs.map((run) => {
    const first = run.selections[0];
    return first ? secondsBetween(run.start.timestampUtc, first.timestampUtc) : null;
  }).filter((value) => value !== null);
  const scope = `${workPlanLabels[selection.workPlan]} · ${modeLabels[selection.mode]}`;
  $("stageScope").textContent = scope;
  $("ppeScope").textContent = scope;
  $("playCount").textContent = `${playCount}건`;
  $("runCount").textContent = `${runs.length}회`;
  $("firstGrabMean").textContent = elapsed(mean(firstGrabTimes));
  $("firstGrabSample").textContent = `모드 시작 기준 · 평균에 포함된 실행 ${firstGrabTimes.length}회`;
  $("stageSampleCount").textContent = `${stageItems.length}건`;
  $("ppeSampleCount").textContent = `${ppeItems.length}건`;

  const stages = averagePerRun(runs, stageSegments);
  $("stageRows").innerHTML = stages.length ? stages.map((group) =>
    `<tr><td><b>${escapeHtml(group.label)}</b></td><td>${elapsed(mean(group.seconds))}</td><td>${group.seconds.length}회</td></tr>`).join("")
    : '<tr><td colspan="3" class="empty-row">이 조건에서 관측된 단계 간격이 없습니다.</td></tr>';

  const transitions = averagePerRun(runs, ppeSegments);
  $("transitionRows").innerHTML = transitions.length ? transitions.map((group) =>
    `<tr><td><b>${escapeHtml(group.label)}</b></td><td>${elapsed(mean(group.seconds))}</td><td>${mean(group.failedGrabs).toFixed(1)}회</td><td>${group.seconds.length}회</td></tr>`).join("")
    : '<tr><td colspan="4" class="empty-row">이 조건에서 서로 다른 PPE를 연이어 잡은 기록이 없습니다.</td></tr>';

  const choices = averagePerRun(runs, ppeChoices);
  $("ppeRows").innerHTML = choices.length ? choices.map((group) =>
    `<tr><td><b>${escapeHtml(group.label)}</b></td><td>${elapsed(mean(group.seconds))}</td><td>${group.seconds.length}회</td></tr>`).join("")
    : '<tr><td colspan="3" class="empty-row">이 조건에서 시간 계산이 가능한 PPE 사용 판정이 없습니다.</td></tr>';
}

function updateButtons() {
  document.querySelectorAll("[data-plan]").forEach((button) => {
    const active = button.dataset.plan === selection.workPlan;
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === selection.mode;
    button.setAttribute("aria-pressed", String(active));
  });
}

async function load() {
  try {
    const response = await fetch("/api/training-telemetry/dashboard-play-preview", { cache: "no-store" });
    if (!response.ok) throw new Error(`실제 기록 스냅샷 조회 실패 (HTTP ${response.status})`);
    const snapshot = (await response.json()).data;
    if (!Array.isArray(snapshot.sessions) || snapshot.sessions.length === 0) throw new Error("조회된 플레이가 없습니다.");
    for (const session of snapshot.sessions) session.events.sort((left, right) => left.sequence - right.sequence);
    const allRuns = buildModeRuns(snapshot.sessions);
    const dates = snapshot.sessions.map((session) => session.startedAtUtc).sort();
    $("sourceStatus").textContent = `운영 MySQL 읽기 전용 스냅샷 · ${kst(snapshot.capturedAtUtc)} KST 확보 · 이후 플레이 자동 반영 전`;
    $("rangeLabel").textContent = `${kst(dates[0])} ~ ${kst(dates.at(-1))} · 앱 버전 1.0.0 · ${snapshot.sessions.length}개 세션`;
    renderSceneAverages(snapshot.sessions);
    document.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", () => {
      selection.workPlan = button.dataset.plan;
      updateButtons();
      renderCohort(snapshot, allRuns);
    }));
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      selection.mode = button.dataset.mode;
      updateButtons();
      renderCohort(snapshot, allRuns);
    }));
    updateButtons();
    renderCohort(snapshot, allRuns);
  } catch (error) {
    $("sourceStatus").textContent = "수행시간 기록 연결 실패";
    $("error").textContent = error.message;
    $("error").hidden = false;
  }
}

load();
