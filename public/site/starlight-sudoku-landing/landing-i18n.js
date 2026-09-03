const copy = {
  ko: { title: "퍼즐을 풀어 별빛을 모으고,<br><strong>멈춰버린 밤에 아침을 불러오세요.</strong>", body: "숫자 속에 흩어진 별빛을 모아 잠든 마을의 장소들을 하나씩 밝혀 나가는 감성 스도쿠 게임입니다.", cta: "상세 페이지 보기", skip: "본문으로 이동", pageTitle: "별빛 스도쿠 | Starlight Sudoku" },
  "zh-CN": { title: "解开谜题，收集星光，<br><strong>让清晨重回停驻的长夜。</strong>", body: "在数字中找回散落的星光，逐一照亮沉睡小镇的治愈系数独游戏。", cta: "查看游戏详情", skip: "跳至正文", pageTitle: "星光数独 | Starlight Sudoku" },
  "zh-TW": { title: "解開謎題，收集星光，<br><strong>讓清晨重回停駐的長夜。</strong>", body: "在數字中找回散落的星光，逐一照亮沉睡小鎮的療癒系數獨遊戲。", cta: "查看遊戲詳情", skip: "跳至主要內容", pageTitle: "星光數獨 | Starlight Sudoku" },
  ja: { title: "パズルを解いて星の光を集め、<br><strong>止まった夜に朝を呼び戻そう。</strong>", body: "数字の中に散った星の光を集め、眠る村を一つずつ照らしていく心温まる数独ゲームです。", cta: "ゲーム詳細を見る", skip: "本文へ移動", pageTitle: "星光数独 | Starlight Sudoku" },
  en: { title: "Solve puzzles. Gather starlight.<br><strong>Bring morning back to a night frozen in time.</strong>", body: "A gentle Sudoku game about finding starlight hidden among the numbers and illuminating a sleeping village, one place at a time.", cta: "Explore the game", skip: "Skip to content", pageTitle: "Starlight Sudoku | TYCHE SPARK" }
};

function normalizeLocale(value) {
  const locale = String(value || "").toLowerCase();
  if (locale.startsWith("zh-tw") || locale.startsWith("zh-hk") || locale === "tw") return "zh-TW";
  if (locale.startsWith("zh")) return "zh-CN";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("en")) return "en";
  return "ko";
}

function applyLocale(locale, updateUrl = true) {
  const resolved = copy[locale] ? locale : "ko";
  document.documentElement.lang = resolved;
  document.title = copy[resolved].pageTitle;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = copy[resolved][element.dataset.i18n];
    if (value) element.innerHTML = value;
  });
  document.querySelectorAll("[data-locale]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.locale === resolved)));
  const detailLink = document.querySelector("[data-detail-link]");
  if (detailLink) {
    const localHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const detailBase = localHost ? "../spark/starlight-sudoku/" : "https://spark.tycheworks.com/starlight-sudoku/";
    detailLink.href = resolved === "ko" ? detailBase : `${detailBase}?lang=${encodeURIComponent(resolved)}`;
  }
  try { localStorage.setItem("starlight-sudoku-locale", resolved); } catch {}
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (resolved === "ko") url.searchParams.delete("lang"); else url.searchParams.set("lang", resolved);
    history.replaceState(null, "", url);
  }
}

const queryLocale = new URLSearchParams(window.location.search).get("lang");
let storedLocale = "";
try { storedLocale = localStorage.getItem("starlight-sudoku-locale") || ""; } catch {}
applyLocale(queryLocale ? normalizeLocale(queryLocale) : normalizeLocale(storedLocale || navigator.language), Boolean(queryLocale));
document.querySelectorAll("[data-locale]").forEach((button) => button.addEventListener("click", () => applyLocale(button.dataset.locale)));
