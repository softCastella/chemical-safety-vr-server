const $ = (id) => document.getElementById(id);
const route = ["0_App", "1_Title", "2_Intro", "3_Loading", "4_PPE_Room"];
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
const initialQuery = typeof location === "undefined" ? null : new URLSearchParams(location.search);
const selection = {
  workPlan: workPlanLabels[initialQuery?.get("plan")] ? initialQuery.get("plan") : "LeakResponse",
  mode: modeLabels[initialQuery?.get("mode")] ? initialQuery.get("mode") : "Education",
};
let selectedFirstPpe = null;

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
const median = (values) => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const elapsed = (value) => value === null ? "미계측" : value < 1
  ? `${value.toFixed(2)}초` : value < 60
    ? `${value.toFixed(1)}초` : `${Math.floor(value / 60)}분 ${(value % 60).toFixed(1)}초`;
const difference = (actual, baseline) => actual === null || baseline === null
  ? "—" : `${actual >= baseline ? "+" : "−"}${elapsed(Math.abs(actual - baseline))}`;
const sceneName = (value) => String(value ?? "").split(/[\\/]/).at(-1).replace(/\.unity$/i, "");
const startedAt = (session) => session.events.find((event) => event.eventType === "session_started")?.timestampUtc
  ?? session.startedAtUtc;
const labelPpe = (itemType) => ppeLabels[itemType] ?? "장비명 미확인";
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
  const completion = run.events.find((event) => event.eventType === "mode_session_completed");
  const pairs = stages.slice(1).map((event, index) => [stages[index], event]);
  if (stages.length && completion) pairs.push([stages.at(-1), completion]);
  return pairs.map(([prior, event], index) => ({
    key: `${prior.flowState}|${event.flowState ?? "mode_completed"}`,
    label: `${labelStage(prior.flowState)} → ${event.flowState ? labelStage(event.flowState) : "모드 완료"}`,
    seconds: secondsBetween(prior.timestampUtc, event.timestampUtc),
    fromSequence: prior.sequence,
    toSequence: event.sequence,
    fromTimestampUtc: prior.timestampUtc,
    toTimestampUtc: event.timestampUtc,
    order: index,
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
      failedGrabs: run.attempts.filter((attempt) =>
        attempt.sequence > item.sequence && attempt.sequence < next.sequence
        && failedGrabOutcomes.has(attempt.outcome)).length,
      fromSequence: item.sequence,
      toSequence: next.sequence,
      fromTimestampUtc: item.timestampUtc,
      toTimestampUtc: next.timestampUtc,
      order: index,
    };
  }).filter((segment) => segment.seconds !== null
    && segment.key.split("|").every((type) => verifiedPpeTypes.has(type)));
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
  }).filter((item) => verifiedPpeTypes.has(item.key) && item.seconds !== null);
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
        key, label: items[0].label, order: items[0].order ?? Infinity,
        seconds: [], failedGrabs: [], records: [],
      });
      const group = groups.get(key);
      group.order = Math.min(group.order, items[0].order ?? Infinity);
      const seconds = mean(items.map((item) => item.seconds));
      group.seconds.push(seconds);
      group.records.push({
        sessionIndex: run.sessionIndex,
        runStartSequence: run.start.sequence,
        seconds,
        occurrences: items.length,
        fromSequence: items[0].fromSequence,
        toSequence: items.at(-1).toSequence,
        intervals: items.map((item) => ({ fromTimestampUtc: item.fromTimestampUtc, toTimestampUtc: item.toTimestampUtc, seconds: item.seconds })),
      });
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

function evidence(group, sessions, section) {
  return `<details class="evidence"><summary>시간을 잰 기록 ${group.records.length}회 보기</summary><ul>${group.records.map((record) => {
    const session = sessions[record.sessionIndex];
    const key = escapeHtml(session?.key ?? "미식별 플레이");
    const source = session?.key && record.runStartSequence !== undefined
      ? `<a href="session.html?play=${encodeURIComponent(session.key)}&started=${encodeURIComponent(session.startedAtUtc)}&run=${record.runStartSequence}&focus=${record.fromSequence}&from=${section}">${key} 실행 상세 보기</a>`
      : key;
    const intervals = record.intervals.map((item) => `${kst(item.fromTimestampUtc)} → ${kst(item.toTimestampUtc)} (${elapsed(item.seconds)})`).join(" / ");
    return `<li>${source} · ${record.occurrences > 1 ? `같은 구간 ${record.occurrences}건 평균 ${elapsed(record.seconds)} · 각 기록: ` : "기록 시각: "}${intervals}</li>`;
  }).join("")}</ul></details>`;
}

function comparisonRows(groups, references) {
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const referenceKeys = new Set((references ?? []).map((item) => item.key));
  return [
    ...(references ?? []).map((item) => ({ key: item.key, baselineSeconds: item.seconds, group: byKey.get(item.key) ?? null })),
    ...groups.filter((group) => !referenceKeys.has(group.key)).map((group) => ({ key: group.key, baselineSeconds: null, group })),
  ];
}

function renderPpeComparison(rows, sessions) {
  const firstTypes = Object.keys(ppeLabels);
  if (!selectedFirstPpe || !verifiedPpeTypes.has(selectedFirstPpe)) {
    selectedFirstPpe = rows.find((row) => row.group)?.key.split("|")[0]
      ?? rows[0]?.key.split("|")[0] ?? firstTypes[0];
  }
  $("ppeFirstList").innerHTML = firstTypes.map((type) => {
    const nextRows = rows.filter((row) => row.key.split("|")[0] === type && row.key.split("|")[1] !== type);
    const observed = nextRows.filter((row) => row.group).length;
    const references = nextRows.filter((row) => row.baselineSeconds !== null).length;
    return `<button type="button" data-first-ppe="${escapeHtml(type)}" aria-pressed="${type === selectedFirstPpe}"><span>${escapeHtml(labelPpe(type))}</span><small>실제 ${observed}종 · 기준 ${references}종</small></button>`;
  }).join("");
  $("ppeFirstList").querySelectorAll("[data-first-ppe]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedFirstPpe = button.dataset.firstPpe;
      renderPpeComparison(rows, sessions);
    });
  });
  $("ppeNextTitle").textContent = `${labelPpe(selectedFirstPpe)} 다음에 잡은 보호구`;
  const matching = rows.filter((row) => row.key.split("|")[0] === selectedFirstPpe && row.key.split("|")[1] !== selectedFirstPpe)
    .sort((left, right) => labelPpe(left.key.split("|")[1]).localeCompare(labelPpe(right.key.split("|")[1]), "ko"));
  $("transitionRows").innerHTML = matching.length ? matching.map((row) => {
    const current = row.group ? median(row.group.seconds) : null;
    const failures = row.group?.failedGrabs.filter((count) => count > 0).length ?? 0;
    const next = row.key.split("|")[1];
    return `<tr><td><b>${escapeHtml(labelPpe(next))}</b></td><td>${row.baselineSeconds === null ? "기준 없음" : elapsed(row.baselineSeconds)}</td><td>${current === null ? "구간 기록 없음" : elapsed(current)}</td><td>${difference(current, row.baselineSeconds)}</td><td>${row.group ? `${failures}회` : "—"}</td><td>${row.group?.seconds.length ?? 0}회</td><td>${row.group ? evidence(row.group, sessions, "ppe") : "—"}</td></tr>`;
  }).join("") : '<tr><td colspan="7" class="empty-row">선택한 보호구 다음에 잡힌 기록이 없습니다.</td></tr>';
}

function quizByQuestion(runs) {
  const byQuestion = new Map();
  runs.forEach((run) => {
    for (const event of run.events.filter((item) => item.eventType === "quiz_answer_resolved")) {
      const index = Number(event.quizQuestionIndex);
      if (!Number.isInteger(index) || index < 1) continue;
      if (!byQuestion.has(index)) byQuestion.set(index, { answers: 0, wrong: 0, runs: new Set(), wrongRuns: new Set() });
      const row = byQuestion.get(index);
      row.answers += 1;
      if (event.quizCorrect === false) {
        row.wrong += 1;
        row.wrongRuns.add(run);
      }
      row.runs.add(run);
    }
  });
  return byQuestion;
}

function renderCohort(snapshot, allRuns) {
  const sameCondition = (run) => run.start.workPlan === selection.workPlan && run.start.mode === selection.mode;
  const runs = allRuns.filter(sameCondition);
  const baseline = snapshot.baseline?.runs?.find((item) => item.workPlan === selection.workPlan && item.mode === selection.mode) ?? null;
  const stages = averagePerRun(runs, stageSegments);
  const transitions = averagePerRun(runs, ppeSegments);
  const incomplete = runs.filter((run) => !run.events.some((event) => event.eventType === "mode_session_completed"));
  const scope = `${workPlanLabels[selection.workPlan]} · ${modeLabels[selection.mode]}`;
  const participantCount = (runList) => {
    const ids = runList.map((run) => snapshot.sessions[run.sessionIndex]?.participantId);
    return ids.every((id) => Number.isSafeInteger(id) && id > 0) ? new Set(ids).size : null;
  };
  const participantDetail = (runList) => {
    const count = participantCount(runList);
    return count === null ? "" : `연결된 참여자 ${count}명 · `;
  };
  for (const id of ["baselineScope", "candidateScope", "stageScope", "ppeScope", "quizScope"]) $(id).textContent = scope;
  $("playCount").textContent = `${new Set(runs.map((run) => run.sessionIndex)).size}건`;
  $("runCount").textContent = `${runs.length}회`;
  $("incompleteCount").textContent = `${incomplete.length}회`;
  const users = participantCount(runs);
  $("userCount").textContent = users === null ? "산정 불가" : `${users}명`;
  $("comparisonNote").textContent = `${scope} · 기준 실행과 실제 기록은 같은 시나리오·모드에서만 대조합니다. ${users === null ? "참여자 연결 정보가 없어 여러 사용자에게 공통된 현상인지는 산정할 수 없습니다." : `연결된 참여자 ${users}명 기준입니다.`} ${snapshot.moreAvailable ? `최근 ${snapshot.limit}개 플레이까지만 포함되어 이전 기록은 빠집니다.` : ""}`;
  const completedTimes = runs.map((run) => {
    const end = run.events.find((event) => event.eventType === "mode_session_completed");
    return end ? secondsBetween(run.start.timestampUtc, end.timestampUtc) : null;
  }).filter((value) => value !== null);
  const actualMode = median(completedTimes);
  const baselineMode = Number.isFinite(baseline?.modeSeconds) ? baseline.modeSeconds : null;
  $("baselineSource").textContent = baseline
    ? `기준: ${snapshot.baseline.description} · ${baseline.reference} · 앱 ${baseline.appVersion}. 실제: 앱 ${[...new Set(runs.map((run) => snapshot.sessions[run.sessionIndex].appVersion))].join(", ") || "미확인"}. 앱 버전과 실행 환경이 달라 시간 차이만 표시하며 정상·지연 판정은 하지 않습니다.${completedTimes.length ? "" : " 이 조건은 완료 실행이 없어 총시간 차이를 계산하지 않습니다."}`
    : "선택한 조건의 채택된 기준 실행을 제공받지 못했습니다. 기준 없는 시간은 병목으로 판정하지 않습니다.";
  $("modeComparisonRows").innerHTML = `<tr><td>${baselineMode === null ? "기준 없음" : elapsed(baselineMode)}</td><td>${actualMode === null ? "완료 기록 없음" : elapsed(actualMode)}</td><td>${difference(actualMode, baselineMode)}</td><td>${completedTimes.length}회</td></tr>`;
  const unmapped = new Map();
  for (const run of runs) for (const item of run.selections) {
    if (item.itemType && !verifiedPpeTypes.has(item.itemType)) {
      unmapped.set(item.itemType, (unmapped.get(item.itemType) ?? 0) + 1);
    }
  }
  $("unmappedPpeNote").textContent = unmapped.size
    ? `시간 계산에서 제외된 장비 기록: ${[...unmapped].map(([type, count]) => `${type} ${count}건`).join(" · ")}. 원본 기록은 상세 조회에서 확인할 수 있습니다.`
    : "이 조건에서 시간 계산에서 제외된 장비 기록은 없습니다.";

  const lastStateLabel = (run) => {
    const state = run.events.filter((event) => event.eventType === "flow_state_changed").at(-1)?.flowState;
    return state ? labelStage(state) : "단계 기록 없음";
  };
  const lastStates = new Map();
  for (const run of incomplete) {
    const label = lastStateLabel(run);
    if (!lastStates.has(label)) lastStates.set(label, []);
    lastStates.get(label).push(run);
  }
  const quiz = quizByQuestion(runs);
  const stageComparisons = comparisonRows(stages, baseline?.stages);
  const ppeComparisons = comparisonRows(transitions, baseline?.transitions);
  const share = (part, whole) => whole ? `${(part / whole * 100).toFixed(0)}%` : "산정 불가";
  const observations = [];
  for (const [label, affected] of lastStates) observations.push({
    affected, count: affected.length, target: "#stages", label: `모드 완료 미확인 · ${label}`,
    value: `${affected.length} / ${runs.length}회`,
    detail: `${participantDetail(affected)}선택 실행의 ${share(affected.length, runs.length)} · 종료 이유 미확인`,
  });
  for (const group of transitions) {
    const affected = group.records.filter((_record, index) => group.failedGrabs[index] > 0);
    if (!affected.length) continue;
    observations.push({
      affected, count: affected.length, target: "#ppe", ppeSource: group.key.split("|")[0], label: `잡기 실패 포함 · ${group.label}`,
      value: `${affected.length} / ${group.seconds.length}회`,
      detail: `${participantDetail(affected)}이 전환 관측 실행의 ${share(affected.length, group.seconds.length)} · 원인 미확인`,
    });
  }
  for (const [index, row] of quiz) {
    if (!row.wrong) continue;
    const affected = [...row.wrongRuns];
    observations.push({
      affected, count: row.wrong, target: "#quiz", label: `${index}번 문항 · 오답 기록`,
      value: `${row.wrong} / ${row.answers}건`,
      detail: `${participantDetail(affected)}응답 이벤트의 ${share(row.wrong, row.answers)} · 오답 실행 ${affected.length}회`,
    });
  }
  const timeCards = [
    ...stageComparisons.map((row) => ({ ...row, target: "#stages", label: row.group?.label ?? row.key.split("|").map((part) => part === "mode_completed" ? "모드 완료" : labelStage(part)).join(" → ") })),
    ...ppeComparisons.map((row) => ({ ...row, target: "#ppe", label: row.group?.label ?? row.key.split("|").map(labelPpe).join(" → ") })),
  ].filter((row) => row.group && row.baselineSeconds !== null && median(row.group.seconds) > row.baselineSeconds)
    .sort((left, right) => (median(right.group.seconds) - right.baselineSeconds) - (median(left.group.seconds) - left.baselineSeconds))
    .slice(0, 3).map((row) => ({
      target: row.target,
      ppeSource: row.target === "#ppe" ? row.key.split("|")[0] : null,
      label: `기준보다 오래 기록됨 · ${row.label}`,
      value: difference(median(row.group.seconds), row.baselineSeconds),
      detail: `기준 ${elapsed(row.baselineSeconds)} · 실제 중앙값 ${elapsed(median(row.group.seconds))} · 기록 ${row.group.seconds.length}회`,
    }));
  const otherCards = observations.sort((left, right) => {
    const leftImpact = users === null ? left.affected.length : participantCount(left.affected);
    const rightImpact = users === null ? right.affected.length : participantCount(right.affected);
    return rightImpact - leftImpact || right.count - left.count;
  }).slice(0, 5 - timeCards.length);
  const cards = [...timeCards, ...otherCards];
  $("candidateRows").innerHTML = cards.length ? cards.map((card) =>
    `<a class="candidate" href="${card.target}"${card.ppeSource ? ` data-ppe-source="${escapeHtml(card.ppeSource)}"` : ""}><span>${escapeHtml(card.label)}</span><strong>${card.value}</strong><small>${escapeHtml(card.detail)}</small></a>`).join("")
    : '<p class="empty-candidates">선택 조건에서 계산 가능한 관측 신호가 없습니다. 아래 표에서 기록 상태를 확인하세요.</p>';
  $("candidateRows").querySelectorAll("[data-ppe-source]").forEach((link) => {
    link.addEventListener("click", () => {
      selectedFirstPpe = link.dataset.ppeSource;
      renderPpeComparison(ppeComparisons, snapshot.sessions);
    });
  });

  $("stageRows").innerHTML = stageComparisons.length ? stageComparisons.map((row) => {
    const current = row.group ? median(row.group.seconds) : null;
    const label = row.group?.label ?? row.key.split("|").map((part) => part === "mode_completed" ? "모드 완료" : labelStage(part)).join(" → ");
    return `<tr><td><b>${escapeHtml(label)}</b></td><td>${row.baselineSeconds === null ? "기준 없음" : elapsed(row.baselineSeconds)}</td><td>${current === null ? "구간 기록 없음" : elapsed(current)}</td><td>${difference(current, row.baselineSeconds)}</td><td>${row.group?.seconds.length ?? 0}회</td><td>${row.group ? evidence(row.group, snapshot.sessions, "stages") : "—"}</td></tr>`;
  }).join("") : '<tr><td colspan="6" class="empty-row">이 조건에서 비교할 단계 기록이 없습니다.</td></tr>';
  $("unfinishedStageNote").textContent = incomplete.length
    ? `모드 완료 이벤트가 없는 실행의 마지막 기록 단계: ${[...lastStates].map(([label, items]) => `${label} ${items.length}회`).join(" · ")}. 종료 원인은 이 기록만으로 알 수 없습니다.`
    : "선택한 조건의 모든 모드 실행에 완료 이벤트가 있습니다.";

  renderPpeComparison(ppeComparisons, snapshot.sessions);

  const choices = averagePerRun(runs, ppeChoices);
  $("ppeRows").innerHTML = choices.length ? choices.map((group) =>
    `<tr><td><b>${escapeHtml(group.label)}</b></td><td>${elapsed(mean(group.seconds))}</td><td>${group.seconds.length}회</td></tr>`).join("")
    : '<tr><td colspan="3" class="empty-row">이 조건에서 시간 계산이 가능한 PPE 선택 결과가 없습니다.</td></tr>';

  $("quizRows").innerHTML = quiz.size ? [...quiz].sort(([left], [right]) => left - right).map(([index, row]) => {
    return `<tr><td><b>${index}번 문항</b></td><td>${row.wrong} / ${row.answers}건</td><td>${share(row.wrong, row.answers)}</td><td>${row.runs.size}회</td></tr>`;
  }).join("") : '<tr><td colspan="4" class="empty-row">이 조건에서 문항 응답 이벤트가 없습니다.</td></tr>';
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
    const response = await fetch("/api/training-telemetry/dashboard-play", { cache: "no-store" });
    if (!response.ok) throw new Error(`실제 기록 스냅샷 조회 실패 (HTTP ${response.status})`);
    const snapshot = (await response.json()).data;
    if (!Array.isArray(snapshot.sessions)) throw new Error("플레이 조회 형식이 올바르지 않습니다.");
    for (const session of snapshot.sessions) session.events.sort((left, right) => left.sequence - right.sequence);
    const allRuns = buildModeRuns(snapshot.sessions);
    const dates = snapshot.sessions.map((session) => session.startedAtUtc).sort();
    $("sourceStatus").textContent = snapshot.preview
      ? `운영 MySQL 읽기 전용 로컬 스냅샷 · ${kst(snapshot.capturedAtUtc)} KST 확보 · 참여자 ID는 익명 번호 · 이후 플레이 자동 반영 전`
      : `관리자 전용 운영 조회 · ${kst(snapshot.capturedAtUtc)} KST 기준 · 최근 최대 ${snapshot.limit}개 플레이`;
    const versions = [...new Set(snapshot.sessions.map((session) => session.appVersion ?? "미확인"))];
    $("rangeLabel").textContent = snapshot.sessions.length
      ? `${kst(dates[0])} ~ ${kst(dates.at(-1))} · 앱 버전 ${versions.join(", ")} · ${snapshot.sessions.length}개 세션${snapshot.moreAvailable ? " · 이전 기록 더 있음" : ""}`
      : "조회된 플레이 없음";
    renderSceneAverages(snapshot.sessions);
    document.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", () => {
      selection.workPlan = button.dataset.plan;
      selectedFirstPpe = null;
      updateButtons();
      renderCohort(snapshot, allRuns);
    }));
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      selection.mode = button.dataset.mode;
      selectedFirstPpe = null;
      updateButtons();
      renderCohort(snapshot, allRuns);
    }));
    updateButtons();
    renderCohort(snapshot, allRuns);
  } catch (error) {
    $("sourceStatus").textContent = "병목 분석 기록 연결 실패";
    $("error").textContent = error.message;
    $("error").hidden = false;
  }
}

load();
