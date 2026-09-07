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

test("별빛 스도쿠 랜딩은 모바일 크기 웹 체험판을 연결한다", async () => {
  const [html, css, script, launchScript] = await Promise.all([
    readFile(new URL("starlight-sudoku-landing/index.html", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing.css", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing-i18n.js", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing-launch.js", siteRoot), "utf8"),
  ]);

  assert.doesNotMatch(html, /class="enter-button"|data-detail-link/);
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
  assert.match(html, /class="play-scroll-button" href="https:\/\/softcastella\.github\.io\/Starlight-Sudoku\/" target="_blank" rel="noopener noreferrer" data-play-launch/);
  assert.doesNotMatch(html, /id="play-demo"|data-start-game|landing-game\.js/);
  assert.match(html, /landing\.css\?v=20260907-97/);
  assert.match(html, /landing-i18n\.js\?v=20260907-33/);
  assert.match(html, /landing-launch\.js\?v=20260907-33/);
  assert.match(html, /data-i18n="title">퍼즐을 풀어<br>별빛을 모으고,<br><strong>멈춰버린 밤에<br>아침을 불러오세요\.<\/strong>/);
  assert.match(script, /title: "퍼즐을 풀어<br>별빛을 모으고,<br><strong>멈춰버린 밤에<br>아침을 불러오세요\.<\/strong>"/);
  assert.match(script, /playCta: "지금<br>플레이해보세요"/);
  assert.match(html, /data-i18n="releaseState">GOOGLE PLAY · 입점 준비 중/);
  assert.match(script, /releaseState: "GOOGLE PLAY · 입점 준비 중"/);
  assert.match(launchScript, /const playUrl = "https:\/\/softcastella\.github\.io\/Starlight-Sudoku\/"/);
  assert.match(launchScript, /window\.matchMedia\("\(max-width: 680px\)"\)/);
  assert.match(launchScript, /Math\.min\(430, window\.screen\.availWidth - 32\)/);
  assert.match(launchScript, /Math\.min\(900, window\.screen\.availHeight - 48\)/);
  assert.match(launchScript, /window\.open\(playUrl, "starlightSudokuMobile", features\)/);
  assert.match(launchScript, /gameWindow\.focus\(\)/);
  assert.match(launchScript, /window\.location\.assign\(playUrl\)/);
  assert.match(launchScript, /function createStarField\(container, count, seed\)/);
  assert.match(launchScript, /state \* 1664525 \+ 1013904223/);
  assert.match(launchScript, /lowerSky = random\(\) < 0\.64/);
  assert.match(launchScript, /createStarField\(stars, 160, 20260904\)/);
  assert.match(launchScript, /0\.8 \+ random\(\) \* 2\.4/);
  assert.match(launchScript, /function createStaticStarField\(container, count, seed\)/);
  assert.match(launchScript, /createStaticStarField\(stars, 240, 20260904\)/);
  assert.match(launchScript, /lowerSky = random\(\) < 0\.68/);
  assert.match(css, /\.stars,\.demo-stars\{opacity:1;background:none\}/);
  assert.match(css, /\.star-dust\{[^}]*background:#ffe8a0/);
  assert.match(css, /\.star-dot\{[^}]*background:#ffd86a/);
  assert.match(launchScript, /index % 3 === 0 \? " is-white"/);
  assert.match(css, /\.star-dot\.is-white\{[^}]*background:#fffaf0/);
  assert.match(css, /@keyframes scattered-twinkle-a/);
  assert.match(css, /@keyframes scattered-twinkle-b/);
  assert.match(css, /\.play-scroll-button\{[^}]*width:148px;[^}]*aspect-ratio:1;[^}]*flex-direction:column/);
  assert.match(html, /<small>PLAY<br>THE FIRST LIGHT<\/small><b data-i18n="playCta">지금<br>플레이해보세요<\/b>/);
  assert.match(css, /\.play-scroll-button\{[^}]*left:calc\(50vw - 7vw\)/);
  assert.match(css, /@media\(min-width:681px\)\{html,body\{height:100%;overflow:hidden\}\.splash\{height:100svh;min-height:0;overflow:hidden\}\.play-scroll-button\{top:-148px;left:calc\(50vw - 7vw \+ 124px\)\}/);
  assert.match(css, /\.hero-actions::after\{[^}]*left:calc\(50vw - 7vw \+ 124px\);[^}]*top:115px;[^}]*width:180px;[^}]*height:18px;[^}]*border:1px solid rgba\(255,255,255,\.18\);[^}]*background:radial-gradient\(ellipse at center,rgba\(255,255,255,\.16\)[^}]*filter:none/);
  assert.doesNotMatch(css, /\.hero-actions::after\{[^}]*rgba\(255,216,106/);
  assert.match(css, /@keyframes appear\{from\{opacity:0;transform:translateX\(96px\)\}to\{opacity:1;transform:translateX\(0\)\}\}/);
  assert.match(css, /html\[lang="en"\] \.splash-content h1\{font-size:clamp\(40px,4\.6vw,64px\);line-height:\.98\}/);
  assert.match(css, /\.play-scroll-button\{[^}]*width:254\.4px;[^}]*background:transparent;[^}]*filter:none/);
  assert.match(css, /\.play-scroll-button\{[^}]*-webkit-backdrop-filter:none;backdrop-filter:none/);
  assert.match(html, /<img class="cta-star-art" src="Starlight%20Sdoku%20landing%20CTA\.png" alt="" aria-hidden="true">/);
  assert.match(css, /\.play-scroll-button::before,\.play-scroll-button::after\{content:none\}/);
  assert.match(css, /\.cta-star-art\{[^}]*width:294px;[^}]*object-fit:contain;[^}]*drop-shadow\(0 0 var\(--cta-glow-core-idle\)/);
  assert.match(css, /\.cta-accessible-label\{[^}]*clip:rect\(0,0,0,0\)/);
  assert.match(html, /<em class="cta-sparkles" aria-hidden="true">[\s\S]*class="cta-twinkle"[\s\S]*<\/em>/);
  assert.equal((html.match(/class="cta-twinkle"/g) || []).length, 16);
  assert.match(html, /<em class="cta-burst-layer" aria-hidden="true"><\/em>/);
  assert.doesNotMatch(html, /cta-star-halo|cta-label-back/);
  assert.match(html, /<em class="cta-orbit" aria-hidden="true"><\/em>/);
  assert.match(html, /<em class="cta-orbit-front" aria-hidden="true"><\/em>/);
  assert.match(html, /<em class="cta-orbit-dot" aria-hidden="true"><\/em>/);
  assert.match(css, /\.cta-sparkles\{[^}]*inset:-28px/);
  assert.match(css, /\.cta-orbit\{[^}]*width:340px;[^}]*height:118px;[^}]*rotate\(-12deg\);[^}]*border:1px solid rgba\(255,255,255,\.22\)/);
  assert.match(css, /\.cta-orbit-dot\{[^}]*z-index:4;[^}]*width:340px;[^}]*height:118px/);
  assert.match(css, /\.cta-orbit-dot::before\{[^}]*width:7px;[^}]*offset-path:ellipse\(169px 58px at 170px 59px\);[^}]*offset-anchor:50% 50%;[^}]*offset-rotate:0deg;[^}]*offset-distance:12%/);
  assert.match(css, /\.cta-orbit-front\{[^}]*z-index:3;[^}]*width:340px;[^}]*height:118px;[^}]*clip-path:inset\(50% -10px -10px -10px\)/);
  assert.match(css, /\.cta-orbit-front,\.cta-orbit-dot\{animation:none\}/);
  const baseCtaGlow = css.match(/\.play-scroll-button\{--cta-glow-core-idle:(\d+)px;--cta-glow-core-pulse:(\d+)px;--cta-glow-idle:(\d+)px;--cta-glow-pulse:(\d+)px;--cta-glow-wide-idle:(\d+)px;--cta-glow-wide-pulse:(\d+)px/);
  const hoverCtaGlow = css.match(/\.play-scroll-button:hover\{--cta-glow-core-idle:(\d+)px;--cta-glow-core-pulse:(\d+)px;--cta-glow-idle:(\d+)px;--cta-glow-pulse:(\d+)px;--cta-glow-wide-idle:(\d+)px;--cta-glow-wide-pulse:(\d+)px/);
  assert.ok(baseCtaGlow, "별 CTA 기본 금빛 글로우 수치를 정의해야 한다");
  assert.ok(hoverCtaGlow, "별 CTA hover 금빛 글로우 수치를 정의해야 한다");
  for (let index = 1; index <= 6; index += 1) {
    assert.ok(
      Number(hoverCtaGlow[index]) > Number(baseCtaGlow[index]),
      "별 CTA hover 글로우는 기본 글로우보다 모든 반경에서 강해야 한다",
    );
  }
  assert.match(css, /\.play-scroll-button:hover \.cta-star-art\{[^}]*brightness\(1\.08\)[^}]*var\(--cta-glow-wide-idle\)/);
  assert.match(css, /\.play-scroll-button:hover\{[^}]*transform:translateX\(-50%\) scale\(1\.025\);[^}]*filter:none/);
  assert.doesNotMatch(css, /cta-art-hover-pulse|cta-art-bloom|cta-star-sparkle-art/);
  assert.match(css, /\.play-scroll-button:hover \.cta-twinkle\{animation:cta-twinkle-out 1\.45s/);
  assert.match(css, /@keyframes cta-twinkle-out/);
  assert.match(css, /\.play-scroll-button\.is-bursting \.cta-twinkle\{animation:cta-twinkle-collapse \.34s/);
  assert.match(css, /@keyframes cta-carbonation/);
  assert.match(launchScript, /function createCtaBurst\(\)/);
  assert.match(launchScript, /for \(let index = 0; index < 18; index \+= 1\)/);
  assert.match(launchScript, /playLink\.addEventListener\("pointerdown", createCtaBurst\)/);
  assert.match(css, /@keyframes cta-orbit-travel\{to\{offset-distance:112%\}\}/);
  assert.doesNotMatch(css, /cta-star-flip|cta-star-softlight|cta-star-halo/);
  assert.match(html, /<div class="sudoku-number-art" aria-hidden="true">[\s\S]*sudoku_number_3\.png[\s\S]*sudoku_number_1\.png[\s\S]*sudoku_number_7\.png[\s\S]*<\/div>/);
  assert.match(css, /\.sudoku-number-three\{left:53\.5vw;top:24vh;[^}]*rotate\(-13deg\)/);
  assert.match(css, /\.sudoku-number-one\{left:65vw;top:8vh;[^}]*rotate\(11deg\)/);
  assert.match(css, /\.sudoku-number-seven\{left:60\.5vw;top:42vh;width:clamp\(116px,9\.6vw,184px\);transform:rotate\(12deg\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.play-scroll-button,\.cta-star-art,\.cta-sparkles,\.cta-twinkle,\.cta-orbit-dot::before,\.cta-burst-particle\{animation:none\}\}/);
  assert.match(css, /\.play-scroll-button:hover\{[^}]*filter:none/);
  assert.match(css, /@media\(min-width:681px\)\{\.splash-header\{padding-top:20px;padding-bottom:20px\}\.splash-content\{padding-top:clamp\(12px,2\.5vh,26px\);padding-bottom:clamp\(36px,5vh,56px\)\}\}/);
  assert.match(css, /@media\(min-width:681px\)\{\.game-mark\{margin-bottom:46px\}\}/);
  assert.match(css, /@keyframes launch-arrow/);
  assert.doesNotMatch(css, /star-drift/);
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
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA.png",
    "../../../starlight-sudoku-landing/sudoku_number_1.png",
    "../../../starlight-sudoku-landing/sudoku_number_3.png",
    "../../../starlight-sudoku-landing/sudoku_number_7.png",
  ];

  await Promise.all(assets.map((asset) => access(new URL(asset, assetRoot))));
});
