const copy = {
  ko: {
    title: "퍼즐을 풀어 별빛을 모으고,<br><strong>멈춰버린 밤에 아침을 불러오세요.</strong>", body: "숫자 속에 흩어진 별빛을 모아 잠든 마을의 장소들을 하나씩 밝혀 나가는 감성 스도쿠 게임입니다.", cta: "상세 페이지 보기", playCta: "지금 플레이해보세요", skip: "본문으로 이동", pageTitle: "별빛 스도쿠 | Starlight Sudoku",
    demoTitle: "첫 번째 별빛을 직접 밝혀보세요.", demoLead: "설치 없이 쉬움 스테이지 1을 한 판 체험할 수 있어요.", trialBadge: "무료 체험", stageTitle: "쉬움 · STAGE 01", timeLabel: "시간", mistakeLabel: "실수", readyCopy: "숫자 사이에 숨은 첫 번째 별빛을 찾아보세요.", startButton: "플레이", controlGuide: "빈칸을 선택하고 숫자를 입력하세요.", eraseButton: "지우기", resetButton: "다시 시작", privacyNote: "플레이 기록은 저장하거나 전송하지 않습니다.", completeTitle: "첫 번째 창문에 불이 켜졌어요!", completeCopy: "별빛 +10을 획득했습니다. 정식 버전에서 마을의 다음 이야기를 만나보세요.", replayButton: "한 번 더 플레이"
  },
  "zh-CN": {
    title: "解开谜题，收集星光，<br><strong>让清晨重回停驻的长夜。</strong>", body: "在数字中找回散落的星光，逐一照亮沉睡小镇的治愈系数独游戏。", cta: "查看游戏详情", playCta: "立即试玩", skip: "跳至正文", pageTitle: "星光数独 | Starlight Sudoku",
    demoTitle: "亲手点亮第一束星光。", demoLead: "无需安装，即可试玩简单难度第 1 关。", trialBadge: "免费试玩", stageTitle: "简单 · STAGE 01", timeLabel: "时间", mistakeLabel: "失误", readyCopy: "找出藏在数字之间的第一束星光。", startButton: "开始", controlGuide: "选择空格并输入数字。", eraseButton: "删除", resetButton: "重新开始", privacyNote: "试玩记录不会保存或传输。", completeTitle: "第一扇窗亮起来了！", completeCopy: "获得星光 +10。正式版中还有更多小镇故事。", replayButton: "再玩一次"
  },
  "zh-TW": {
    title: "解開謎題，收集星光，<br><strong>讓清晨重回停駐的長夜。</strong>", body: "在數字中找回散落的星光，逐一照亮沉睡小鎮的療癒系數獨遊戲。", cta: "查看遊戲詳情", playCta: "立即試玩", skip: "跳至主要內容", pageTitle: "星光數獨 | Starlight Sudoku",
    demoTitle: "親手點亮第一束星光。", demoLead: "無需安裝，即可試玩簡單難度第 1 關。", trialBadge: "免費試玩", stageTitle: "簡單 · STAGE 01", timeLabel: "時間", mistakeLabel: "失誤", readyCopy: "找出藏在數字之間的第一束星光。", startButton: "開始", controlGuide: "選擇空格並輸入數字。", eraseButton: "刪除", resetButton: "重新開始", privacyNote: "試玩記錄不會儲存或傳輸。", completeTitle: "第一扇窗亮起來了！", completeCopy: "獲得星光 +10。正式版中還有更多小鎮故事。", replayButton: "再玩一次"
  },
  ja: {
    title: "パズルを解いて星の光を集め、<br><strong>止まった夜に朝を呼び戻そう。</strong>", body: "数字の中に散った星の光を集め、眠る村を一つずつ照らしていく心温まる数独ゲームです。", cta: "ゲーム詳細を見る", playCta: "今すぐプレイ", skip: "本文へ移動", pageTitle: "星光数独 | Starlight Sudoku",
    demoTitle: "最初の星明かりを灯してみよう。", demoLead: "インストール不要で、かんたんステージ1を体験できます。", trialBadge: "無料体験", stageTitle: "かんたん · STAGE 01", timeLabel: "時間", mistakeLabel: "ミス", readyCopy: "数字の間に隠れた最初の星明かりを見つけよう。", startButton: "プレイ", controlGuide: "空いているマスを選んで数字を入力してください。", eraseButton: "消す", resetButton: "やり直す", privacyNote: "プレイ記録は保存・送信されません。", completeTitle: "最初の窓に明かりが灯りました！", completeCopy: "星明かり +10を獲得。製品版で村の続きをお楽しみください。", replayButton: "もう一度プレイ"
  },
  en: {
    title: "Solve puzzles. Gather starlight.<br><strong>Bring morning back to a night frozen in time.</strong>", body: "A gentle Sudoku game about finding starlight hidden among the numbers and illuminating a sleeping village, one place at a time.", cta: "Explore the game", playCta: "Play it now", skip: "Skip to content", pageTitle: "Starlight Sudoku | TYCHE SPARK",
    demoTitle: "Light the first window yourself.", demoLead: "Play Easy Stage 1 right here—no installation needed.", trialBadge: "FREE TRIAL", stageTitle: "EASY · STAGE 01", timeLabel: "TIME", mistakeLabel: "MISTAKES", readyCopy: "Find the first starlight hidden among the numbers.", startButton: "PLAY", controlGuide: "Choose an empty cell, then enter a number.", eraseButton: "Erase", resetButton: "Restart", privacyNote: "Your play activity is not stored or transmitted.", completeTitle: "The first window is glowing!", completeCopy: "You earned +10 Starlight. Discover the rest of the village in the full game.", replayButton: "Play again"
  }
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
