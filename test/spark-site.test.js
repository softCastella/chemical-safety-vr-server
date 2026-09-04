import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../public/site/", import.meta.url);

test("SPARK 메인에서 별빛 스도쿠 상세 페이지로 연결한다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("spark/index.html", siteRoot), "utf8"),
    readFile(new URL("spark/spark.css", siteRoot), "utf8"),
  ]);

  assert.match(html, /href="starlight-sudoku\/"/);
  assert.match(html, /GOOGLE PLAY 입점 예정/);
  assert.match(css, /village_scene_night\.png/);
  assert.match(html, /class="spark-hero shell"/);
  assert.match(html, /class="spark-work-card"/);
  assert.match(html, /class="spark-vision"/);
  assert.equal(html.match(/class="feature"/g)?.length, 4);
  assert.match(css, /\.spark-hero-media img\{[^}]*object-fit:contain/);
  assert.match(css, /\.spark-work-media img\{[^}]*object-fit:contain/);
});

test("별빛 스도쿠 상세 페이지는 5개 언어와 언어별 타이틀 이미지를 지원한다", async () => {
  const [html, script, detailCss] = await Promise.all([
    readFile(new URL("spark/starlight-sudoku/index.html", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/i18n.js", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/detail.css", siteRoot), "utf8"),
  ]);

  for (const locale of ["ko", "zh-CN", "zh-TW", "ja", "en"]) {
    assert.match(html, new RegExp(`data-locale="${locale}"`));
    assert.match(script, new RegExp(`(?:^|[\\s\"'])${locale.replace("-", "\\-")}(?:[\":])`, "m"));
  }

  assert.match(
    html,
    /data-locale="ko"[^>]*>한<\/button>[\s\S]*data-locale="en"[^>]*>EN<\/button>[\s\S]*data-locale="ja"[^>]*>日<\/button>[\s\S]*data-locale="zh-CN"[^>]*>中<\/button>[\s\S]*data-locale="zh-TW"[^>]*>繁<\/button>/,
  );

  for (const titleAsset of ["KR.png", "CN.png", "TW.png", "JP.png", "EN.png"]) {
    assert.match(script, new RegExp(titleAsset.replace(".", "\\.")));
  }

  assert.match(script, /document\.documentElement\.lang = resolvedLocale/);
  assert.match(script, /url\.searchParams\.set\("lang", resolvedLocale\)/);
  assert.match(html, /data-landing-link/);
  assert.match(script, /https:\/\/starlight-sudoku\.tycheworks\.com\//);
  assert.match(html, /href="privacy\/" data-privacy-link/);
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/\.\.\/assets\/Spark\/Starlight%20Sudoku\/Icon_Starlight_Sudoku_v4\.png"/);
  assert.match(script, /privacy\/\?lang=/);
  const css = await readFile(new URL("spark/spark.css", siteRoot), "utf8");
  assert.match(css, /\.detail-identity img\{[^}]*width:92px;[^}]*height:92px;[^}]*object-fit:contain/);
  assert.match(css, /\.title-poster img\{[^}]*width:100%;[^}]*height:auto;[^}]*object-fit:contain/);
  assert.match(html, /href="detail\.css\?v=20260903-4"/);
  assert.match(html, /src="i18n\.js\?v=20260903-3"/);
  assert.match(html, /class="detail-header"/);
  assert.match(html, /class="detail-subnav"/);
  assert.match(html, /class="detail-toc"/);
  assert.match(html, /class="spark-nav"/);
  for (const title of ["별빛 스도쿠", "Starlight Sudoku", "スターライト数独", "星光数独", "星光數獨"]) {
    assert.ok(script.includes(`pageTitle: "${title} | TYCHE SPARK"`));
  }
  assert.match(script, /document\.title = copy\.pageTitle/);
  assert.match(detailCss, /\.starlight-detail\{[\s\S]*background-color:var\(--starlight-night\)/);
  assert.match(css, /\.detail-subnav \.locale-switcher\{[^}]*position:static/);
  assert.match(detailCss, /\.starlight-detail \.detail-hero,[\s\S]*\.starlight-detail \.detail-final\{[^}]*background:transparent/);
  assert.doesNotMatch(detailCss, /\.starlight-detail \.detail-section:after/);
  assert.match(detailCss, /--starlight-ivory:#fffdf8/);
  assert.match(detailCss, /\.starlight-detail \.overview-grid>div,[\s\S]*background:var\(--starlight-ivory\)/);
  assert.doesNotMatch(detailCss, /\.starlight-detail \.info-layout\{[^}]*background:var\(--starlight-ivory\)/);
  assert.doesNotMatch(detailCss, /\.starlight-detail \.final-card\{[^}]*var\(--starlight-ivory\)/);
});

test("별빛 스도쿠 개인정보처리방침은 앱·웹 데이터 처리와 5개 언어를 안내한다", async () => {
  const [html, script, css] = await Promise.all([
    readFile(new URL("spark/starlight-sudoku/privacy/index.html", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/privacy/privacy-i18n.js", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/privacy/privacy.css", siteRoot), "utf8"),
  ]);

  assert.match(html, /data-detail-link/);
  assert.match(html, /starlight-sudoku-locale/);
  assert.match(html, /privacy\.css\?v=20260904-1/);
  assert.match(html, /privacy-i18n\.js\?v=20260904-1/);
  for (const locale of ["ko", "en", "ja", "zh-CN", "zh-TW"]) {
    assert.match(html, new RegExp(`data-locale="${locale}"`));
    assert.match(script, new RegExp(`(?:^|[\\s"'])${locale.replace("-", "\\-")}(?:[":])`, "m"));
  }
  assert.match(script, /최대 14일/);
  assert.match(script, /com\.tychespark\.starlightsudoku/);
  assert.match(script, /Firebase Analytics와 AdMob도 사용하지 않습니다/);
  assert.match(script, /SS- 형식의 익명 사용자 ID/);
  assert.match(script, /Google Play 인앱 리뷰 흐름을 요청/);
  assert.match(script, /전송 시 암호화/);
  assert.match(script, /연령에 따라 이용을 제한하지 않는 퍼즐 게임/);
  assert.match(script, /만 14세 미만 아동을 주요 대상으로 기획하거나 홍보하는 서비스는 아니며/);
  assert.match(script, /생년월일이나 연령 정보를 수집하지 않습니다/);
  assert.match(html, /support\.google\.com\/googleplay\/android-developer\/answer\/10144311/);
  assert.match(html, /support\.google\.com\/googleplay\/android-developer\/answer\/10787469/);
  assert.match(html, /developer\.android\.com\/guide\/playcore\/in-app-review/);
  assert.match(css, /--ivory: #fffaf0/);
  assert.match(css, /\.locale-switcher \{[\s\S]*?background: var\(--ivory\)/);
  assert.match(css, /\.policy-shell \{[\s\S]*?var\(--ivory\)/);
  assert.match(css, /body::before,[\s\S]*body::after/);
  assert.match(css, /@keyframes star-twinkle/);
});

test("별빛 스도쿠 랜딩은 상세 페이지와 언어 상태를 연결한다", async () => {
  const [html, css, script, gameScript] = await Promise.all([
    readFile(new URL("starlight-sudoku-landing/index.html", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing.css", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing-i18n.js", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing-game.js", siteRoot), "utf8"),
  ]);

  assert.match(html, /href="https:\/\/spark\.tycheworks\.com\/starlight-sudoku\/"/);
  assert.match(html, /rel="canonical" href="https:\/\/starlight-sudoku\.tycheworks\.com\/"/);
  assert.match(html, /property="og:url" content="https:\/\/starlight-sudoku\.tycheworks\.com\/"/);
  assert.match(css, /village_night_light\.png/);
  assert.match(html, /ChatGPT%20Image%202026년%209월%202일/);
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/assets\/Spark\/Starlight%20Sudoku\/Icon_Starlight_Sudoku_v4\.png"/);
  assert.match(script, /\$\{detailBase\}\?lang=/);
  assert.match(script, /https:\/\/spark\.tycheworks\.com\/starlight-sudoku/);
  assert.match(script, /localHost \? "\.\.\/spark\/starlight-sudoku\/"/);
  assert.match(css, /\.splash-art\{[^}]*background-position:right center[^}]*background-size:contain/);
  assert.match(css, /\.hero-character\{[^}]*bottom:0[^}]*object-fit:contain/);
  assert.match(css, /\.project-label\{[^}]*text-decoration:none/);
  assert.match(css, /Keep the project route crisp[\s\S]*\.project-label\{color:#fff;text-shadow:none\}/);
  assert.match(css, /\.project-label:hover\{color:var\(--gold\)/);
  assert.match(css, /\.project-label:focus-visible\{[^}]*outline:/);
  assert.match(html, /class="play-scroll-button" href="#play-demo"/);
  assert.match(html, /id="play-demo" class="play-demo"/);
  assert.match(html, /data-start-game/);
  assert.match(html, /landing-game\.js\?v=20260904-13/);
  assert.match(script, /playCta: "지금<br>플레이해보세요"/);
  assert.match(gameScript, /\[0, 0, 8, 5, 0, 6, 3, 0, 4\]/);
  assert.match(gameScript, /\[2, 7, 8, 5, 9, 6, 3, 1, 4\]/);
  assert.match(gameScript, /function isComplete\(\)/);
  assert.doesNotMatch(gameScript, /localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
  assert.match(html, /data-game-bgm[^>]+level_starfall_grid\.ogg/);
  assert.match(html, /data-demo-title-art/);
  assert.match(html, /play\.google\.com\/store\/apps\/details\?id=com\.tychespark\.starlightsudoku/);
  assert.match(html, /GoogolePlayLogo\.png/);
  assert.match(gameScript, /await bgm\.play\(\)/);
  assert.match(html, /data-memo aria-pressed="false" disabled/);
  assert.match(html, /class="audio-notice"/);
  assert.match(script, /audioNotice: "플레이 버튼을 누르면 BGM이 재생됩니다\."/);
  assert.match(gameScript, /let notes = Array\.from/);
  assert.match(gameScript, /function toggleMemoMode\(\)/);
  assert.match(html, /class="scroll-reveal-shade"/);
  assert.match(gameScript, /function updateScrollReveal\(\)/);
  assert.match(gameScript, /--reveal-progress/);
  assert.match(script, /const demoTitleImages =/);
  assert.match(css, /\.sudoku-board\{[^}]*grid-template-columns:repeat\(9,1fr\)/);
  assert.match(css, /@keyframes arrow-down/);
  assert.match(gameScript, /function createStarField\(container, count, seed\)/);
  assert.match(gameScript, /state \* 1664525 \+ 1013904223/);
  assert.match(gameScript, /lowerSky = random\(\) < 0\.64/);
  assert.match(gameScript, /index === 0 \? 160 : 230/);
  assert.match(gameScript, /0\.8 \+ random\(\) \* 2\.4/);
  assert.match(gameScript, /function createStaticStarField\(container, count, seed\)/);
  assert.match(gameScript, /index === 0 \? 240 : 340/);
  assert.match(gameScript, /lowerSky = random\(\) < 0\.68/);
  assert.match(css, /\.stars,\.demo-stars\{opacity:1;background:none\}/);
  assert.match(css, /\.star-dust\{[^}]*background:#ffe8a0/);
  assert.match(css, /\.star-dot\{[^}]*background:#ffd86a/);
  assert.match(css, /@keyframes scattered-twinkle-a/);
  assert.match(css, /@keyframes scattered-twinkle-b/);
  assert.match(css, /\.play-scroll-button\{[^}]*width:148px;[^}]*aspect-ratio:1;[^}]*flex-direction:column/);
  assert.match(html, /<small>PLAY<br>THE FIRST LIGHT<\/small><b data-i18n="playCta">지금<br>플레이해보세요<\/b>/);
  assert.match(css, /\.play-scroll-button\{[^}]*left:calc\(50vw - 7vw\)/);
  assert.match(css, /\.play-scroll-button:after\{[^}]*inset:-7px;[^}]*border:1px solid rgba\(255,216,106,\.3\)/);
  assert.match(css, /\.play-scroll-button:hover:after\{[^}]*border-color:rgba\(255,232,158,\.9\);[^}]*0 0 34px rgba\(255,178,45,\.42\)/);
  assert.match(css, /@media\(min-width:681px\)\{\.splash-header\{padding-top:20px;padding-bottom:20px\}\.splash-content\{padding-top:clamp\(12px,2\.5vh,26px\);padding-bottom:clamp\(36px,5vh,56px\)\}\}/);
  assert.match(css, /\.cell-note\{/);
  assert.match(css, /\.sudoku-cell\.selected\{[^}]*background:#ffe3a0;[^}]*#c9902e/);
  assert.doesNotMatch(css, /star-drift/);
  assert.match(css, /\.store-card\{/);
  assert.match(css, /\.demo-title-art\{[^}]*object-position:center 29%/);
  assert.match(css, /\.scroll-reveal-shade\{[^}]*opacity:calc\(1 - var\(--reveal-progress\)\)/);
  assert.match(css, /rgba\(0,3,11,\.82\) 0%/);
  assert.match(css, /rgba\(0,2,8,1\) 100%/);
});

test("별빛 스도쿠 페이지가 참조하는 핵심 자산이 존재한다", async () => {
  const assetRoot = new URL("assets/Spark/Starlight%20Sudoku/", siteRoot);
  const assets = [
    "Title_Image_Starlight%20Sdoku%20KR.png",
    "Starlight%20Sdoku%20Title%20CN.png",
    "Starlight%20Sdoku%20Title%20TW.png",
    "Starlight%20Sdoku%20Title%20JP.png",
    "Starlight%20Sdoku%20Title%20EN.png",
    "Icon_Starlight_Sudoku_v4.png",
    "village_night_light.png",
    "village_scene_day.png",
    "icon_bakery.png",
    "icon_book.png",
    "icon_fontaine.png",
    "GoogolePlayLogo.png",
    "level_starfall_grid.ogg",
  ];

  await Promise.all(assets.map((asset) => access(new URL(asset, assetRoot))));
});
