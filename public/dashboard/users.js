const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const modeLabels = { Education: "교육", Training: "훈련", Test: "테스트" };
const planLabels = { ConfinedSpace: "밀폐공간", LeakResponse: "누출 대응" };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const time = (value) => value ? new Date(value).toLocaleString("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
}) : "기록 없음";
const duration = (seconds) => seconds === null || seconds === undefined ? "" : seconds < 60
  ? ` · ${seconds.toFixed(1)}초` : ` · ${Math.floor(seconds / 60)}분 ${(seconds % 60).toFixed(1)}초`;
let participantId = query.get("participantId") ?? "";
let usersPage = Number(query.get("page")) || 1;
let selectedId = Number(query.get("user")) || null;
let historyPage = Number(query.get("historyPage")) || 1;
let usersResult = null;
let userResult = null;
let requestNumber = 0;

function showError(message) {
  $("error").hidden = !message;
  $("error").textContent = message ?? "";
}

function updateUrl() {
  const next = new URLSearchParams();
  if (participantId) next.set("participantId", participantId);
  if (usersPage > 1) next.set("page", String(usersPage));
  if (selectedId) next.set("user", String(selectedId));
  if (historyPage > 1) next.set("historyPage", String(historyPage));
  history.replaceState(null, "", `${location.pathname}${next.size ? `?${next}` : ""}`);
}

function renderList() {
  const { users, total, page, pageSize, preview } = usersResult;
  $("userCount").textContent = `${total}명 · 최근 플레이 순`;
  $("userList").innerHTML = users.length ? users.map((user, index) =>
    `<button type="button" data-user="${user.participantId}" aria-current="${user.participantId === selectedId}">
      <b>사용자 ID ${escapeHtml(user.participantId)}</b>
      <small>플레이 ${user.playCount}회 · 최근 ${time(user.lastPlayAtUtc)}</small>
    </button>`).join("") : `<p class="empty-row">${participantId ? "검색한 사용자 ID가 없습니다." : "조회된 사용자가 없습니다."}</p>`;
  $("userList").querySelectorAll("[data-user]").forEach((button) => button.addEventListener("click", () => {
    selectedId = Number(button.dataset.user);
    historyPage = 1;
    renderList();
    loadUser();
  }));
  $("usersPage").textContent = `${page} / ${Math.max(1, Math.ceil(total / pageSize))}`;
  $("usersPrev").disabled = page <= 1;
  $("usersNext").disabled = !usersResult.moreAvailable;
  $("sourceStatus").textContent = preview
    ? "운영 DB 실데이터 로컬 스냅샷 · 내부 사용자 ID 기준 · 새 플레이 자동 반영 전"
    : "관리자 전용 운영 조회 · 내부 사용자 ID 기준";
}

function clearHistory() {
  userResult = null;
  $("userIdentity").textContent = "사용자를 선택해 주세요.";
  $("userFacts").innerHTML = "";
  $("historyRows").innerHTML = '<tr><td colspan="5" class="empty-row">표시할 플레이가 없습니다.</td></tr>';
  $("historyPage").textContent = "—";
  $("historyPrev").disabled = true;
  $("historyNext").disabled = true;
}

function renderHistory() {
  const user = userResult;
  const preview = usersResult?.preview === true;
  const metaIdentity = user.metaUserId
    ? `Meta 앱 범위 사용자 ID · ${user.metaUserId}`
    : preview && !usersResult?.metaIdsIncluded ? "이 로컬 스냅샷에서는 Meta ID 값을 제거했습니다." : "Meta ID가 기록되지 않았습니다.";
  $("userIdentity").textContent = `사용자 ID ${user.participantId} · ${metaIdentity}`;
  $("userFacts").innerHTML = `<span>플레이 <b>${user.playCount}회</b></span><span>첫 플레이 <b>${time(user.firstPlayAtUtc)}</b></span><span>최근 플레이 <b>${time(user.lastPlayAtUtc)}</b></span>`;
  $("historyRows").innerHTML = user.sessions.length ? user.sessions.map((session) => {
    const runs = session.runs ?? [];
    const completed = runs.filter((run) => run.completed).length;
    const href = preview
      ? `session.html?play=${encodeURIComponent(session.key)}&started=${encodeURIComponent(session.startedAtUtc)}&from=users`
      : `session.html?sessionId=${encodeURIComponent(session.sessionId)}&from=users`;
    const runLabels = runs.length ? runs.map((run) =>
      `<span class="run-line">${escapeHtml(planLabels[run.workPlan] ?? "시나리오 미확인")} · ${escapeHtml(modeLabels[run.mode] ?? "모드 미확인")}${run.completed ? duration(run.durationSeconds) : ""}</span>`).join("") : "모드 시작 기록 없음";
    return `<tr><td>${time(session.startedAtUtc)}</td><td>${escapeHtml(session.appVersion ?? "미확인")}</td><td>${runLabels}</td><td>${runs.length ? `${completed}/${runs.length}회` : "—"}</td><td><a href="${href}">플레이 상세 보기</a></td></tr>`;
  }).join("") : '<tr><td colspan="5" class="empty-row">이 사용자에게 기록된 플레이가 없습니다.</td></tr>';
  $("historyPage").textContent = `${user.page} / ${Math.max(1, Math.ceil(user.playCount / user.pageSize))}`;
  $("historyPrev").disabled = user.page <= 1;
  $("historyNext").disabled = !user.moreAvailable;
}

async function readData(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`기록 조회 실패 (HTTP ${response.status})`);
  return (await response.json()).data;
}

async function loadUser() {
  if (!selectedId) { clearHistory(); updateUrl(); return; }
  const request = ++requestNumber;
  showError(null);
  try {
    const user = await readData(`/api/training-telemetry/dashboard-users/${selectedId}?page=${historyPage}`);
    if (request !== requestNumber) return;
    userResult = user;
    renderHistory();
    updateUrl();
  } catch (error) {
    if (request !== requestNumber) return;
    clearHistory();
    showError(error.message);
  }
}

async function loadUsers(keepSelected = false) {
  const request = ++requestNumber;
  showError(null);
  try {
    const params = new URLSearchParams({ page: String(usersPage) });
    if (participantId) params.set("participantId", participantId);
    const result = await readData(`/api/training-telemetry/dashboard-users?${params}`);
    if (request !== requestNumber) return;
    usersResult = result;
    if (!keepSelected) {
      selectedId = null;
      historyPage = 1;
    }
    renderList();
    await loadUser();
  } catch (error) {
    if (request !== requestNumber) return;
    showError(error.message);
    $("sourceStatus").textContent = "사용자 기록을 불러오지 못했습니다.";
  }
}

$("userIdSearch").value = participantId;
$("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("userIdSearch").value.trim();
  if (value && (!/^[0-9]{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
    showError("사용자 ID는 1 이상의 숫자로 입력해 주세요."); return;
  }
  participantId = value;
  usersPage = 1;
  selectedId = null;
  loadUsers();
});
$("clearSearch").addEventListener("click", () => {
  $("userIdSearch").value = "";
  participantId = "";
  usersPage = 1;
  selectedId = null;
  loadUsers();
});
$("usersPrev").addEventListener("click", () => { usersPage -= 1; selectedId = null; loadUsers(); });
$("usersNext").addEventListener("click", () => { usersPage += 1; selectedId = null; loadUsers(); });
$("historyPrev").addEventListener("click", () => { historyPage -= 1; loadUser(); });
$("historyNext").addEventListener("click", () => { historyPage += 1; loadUser(); });
if ((participantId && (!/^[0-9]{1,16}$/.test(participantId) || !Number.isSafeInteger(Number(participantId)) || Number(participantId) < 1))
  || !Number.isSafeInteger(usersPage) || usersPage < 1
  || (selectedId !== null && (!Number.isSafeInteger(selectedId) || selectedId < 1))
  || !Number.isSafeInteger(historyPage) || historyPage < 1) {
  showError("조회 주소의 사용자 ID 또는 페이지 번호가 올바르지 않습니다.");
} else {
  loadUsers(Boolean(selectedId));
}
