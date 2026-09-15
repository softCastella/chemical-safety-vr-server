const $ = (id) => document.getElementById(id);
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatted = (value) => number(value).toLocaleString("ko-KR");
const modeNames = { Education: "교육", Training: "훈련", Test: "테스트" };
let selectedDays = 7;

function drawTrend(days) {
  const target = $("trendChart");
  if (!days.some((day) => number(day.newUsers) || number(day.returningUsers))) {
    target.innerHTML = '<div class="empty">선택한 기간에 사용자 플레이 기록이 없습니다.</div>';
    return;
  }
  const width = 720;
  const height = 220;
  const left = 34;
  const right = 10;
  const top = 16;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const ceiling = Math.max(1, ...days.flatMap((day) => [number(day.newUsers), number(day.returningUsers)]));
  const x = (index) => left + (days.length === 1 ? plotWidth / 2 : index * plotWidth / (days.length - 1));
  const y = (value) => top + plotHeight - number(value) / ceiling * plotHeight;
  const line = (key) => days.map((day, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(day[key]).toFixed(1)}`).join(" ");
  const ticks = days.length <= 7 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [0, 6, 12, 18, 24, days.length - 1];
  const grid = [0, 0.5, 1].map((step) => {
    const value = Math.round(ceiling * step);
    const ordinate = y(ceiling * step);
    return `<line class="gridline" x1="${left}" y1="${ordinate}" x2="${width - right}" y2="${ordinate}"/><text x="${left - 8}" y="${ordinate + 4}" text-anchor="end">${value}</text>`;
  }).join("");
  const labels = [...new Set(ticks)].map((index) => `<text x="${x(index)}" y="${height - 5}" text-anchor="middle">${days[index].day.slice(5)}</text>`).join("");
  const dots = days.length <= 7 ? days.map((day, index) =>
    `<circle class="dot-new" cx="${x(index)}" cy="${y(day.newUsers)}" r="3.5"/><circle class="dot-return" cx="${x(index)}" cy="${y(day.returningUsers)}" r="3.5"/>`).join("") : "";
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="일별 신규 사용자 및 기존 사용자 추이"><title>일별 신규 사용자 및 기존 사용자</title>${grid}<line class="axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"/>${labels}<path class="plot-line line-new" d="${line("newUsers")}"/><path class="plot-line line-return" d="${line("returningUsers")}"/>${dots}</svg>`;
}

function modeBar(value, maximum, variant, label) {
  const width = number(value) / maximum * 100;
  return `<svg class="track" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${label} ${formatted(value)}건, 최대 ${formatted(maximum)}건 기준"><rect class="track-background" width="100" height="8" rx="4"/><rect class="${variant}" width="${width}" height="8" rx="4"/></svg>`;
}

function drawModes(modes) {
  const maximum = Math.max(1, ...modes.flatMap((mode) => [number(mode.started), number(mode.completed)]));
  $("modeRows").innerHTML = modes.map((mode) => {
    const started = number(mode.started);
    const completed = number(mode.completed);
    return `<div class="mode-row"><span class="name">${modeNames[mode.mode] ?? "기타"}</span><div class="bars">${modeBar(started, maximum, "started", "시작")}${modeBar(completed, maximum, "completed", "완료")}</div><span class="counts">시작 <b>${formatted(started)}</b><br>완료 <b>${formatted(completed)}</b></span></div>`;
  }).join("");
}

function render(data) {
  $("observedUsers").textContent = formatted(data.summary.observedUsers);
  $("newUsers").textContent = formatted(data.summary.newUsers);
  $("plays").textContent = formatted(data.summary.plays);
  $("modeCompletions").textContent = formatted(data.modes.reduce((total, mode) => total + number(mode.completed), 0));
  $("rangeLabel").textContent = `${data.startUtc.slice(0, 10)} ~ ${new Date(Date.parse(data.endUtcExclusive) - 1).toISOString().slice(0, 10)} · UTC`;
  const source = data.previewCapturedAtUtc
    ? `운영 DB 스냅샷 ${new Date(data.previewCapturedAtUtc).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST`
    : "운영 DB 기록";
  $("sourceStatus").textContent = data.summary.lastEventAtUtc
    ? `${source} · 마지막 이벤트 ${new Date(data.summary.lastEventAtUtc).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST`
    : `${source} · 저장된 이벤트 없음`;
  $("refreshButton").hidden = Boolean(data.previewCapturedAtUtc);
  drawTrend(data.daily);
  drawModes(data.modes);
  $("trendSummary").textContent = `기간 내 신규 사용자 ${formatted(data.summary.newUsers)}명 · 플레이 ${formatted(data.summary.plays)}회. 기존 사용자는 첫 플레이일 이후 다른 날짜에 플레이한 사용자 ID를 날짜마다 한 번씩 표시합니다.`;
}

async function load(days) {
  selectedDays = days;
  document.querySelectorAll(".period").forEach((button) => {
    const active = Number(button.dataset.days) === days;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("error").hidden = true;
  $("sourceStatus").textContent = "운영 기록을 불러오는 중";
  try {
    const response = await fetch(`/api/training-telemetry/dashboard-overview?days=${days}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 ? "관리자 세션이 만료됐습니다. 다시 로그인해 주세요." : body.error || `조회 실패 (HTTP ${response.status})`);
    }
    const body = await response.json();
    if (selectedDays !== days) return;
    render(body.data);
  } catch (error) {
    if (selectedDays !== days) return;
    $("sourceStatus").textContent = "운영 기록 연결 실패";
    $("error").textContent = error.message;
    $("error").hidden = false;
  }
}

document.querySelectorAll(".period").forEach((button) => button.addEventListener("click", () => load(Number(button.dataset.days))));
$("refreshButton").addEventListener("click", () => load(selectedDays));
load(selectedDays);
