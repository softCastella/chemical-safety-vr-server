import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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
  assert.equal((html.match(/data-landing-link/g) || []).length, 2);
  assert.match(script, /https:\/\/starlight-sudoku\.tycheworks\.com\//);
  assert.match(html, /class="hero-landing-cta"/);
  assert.match(html, /data-i18n="heroLandingCta"/);
  assert.match(script, /heroLandingCta: "별빛 스도쿠 체험하기"/);
  assert.match(script, /const landingLinks = document\.querySelectorAll/);
  assert.match(script, /landingLinks\.forEach/);
  assert.match(html, /href="privacy\/" data-privacy-link/);
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/\.\.\/assets\/Spark\/Starlight%20Sudoku\/Icon_Starlight_Sudoku_v4\.png"/);
  assert.match(script, /privacy\/\?lang=/);
  const css = await readFile(new URL("spark/spark.css", siteRoot), "utf8");
  assert.match(css, /\.detail-identity img\{[^}]*width:92px;[^}]*height:92px;[^}]*object-fit:contain/);
  assert.match(css, /\.title-poster img\{[^}]*width:100%;[^}]*height:auto;[^}]*object-fit:contain/);
  assert.match(html, /href="detail\.css\?v=20260911-5"/);
  assert.match(html, /src="i18n\.js\?v=20260911-5"/);
  assert.match(detailCss, /\.starlight-detail \.hero-landing-cta\{/);
  for (const hreflang of ["ko", "en", "ja", "zh-Hans", "zh-Hant", "x-default"]) {
    assert.match(html, new RegExp(`hreflang="${hreflang}"`));
  }
  assert.match(script, /function applySeo\(locale, copy\)/);
  assert.match(script, /link\[rel="canonical"\]/);
  assert.match(script, /#starlight-detail-structured-data/);
  assert.match(html, /class="detail-header"/);
  assert.match(html, /class="detail-subnav"/);
  assert.match(html, /class="detail-toc"/);
  assert.match(html, /class="spark-nav"/);
  for (const title of ["별빛 스도쿠", "Starlight Sudoku", "星明かりの数独", "星光数独", "星光數獨"]) {
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
  assert.match(script, /starlight-sudoku-locale/);
  assert.match(html, /privacy\.css\?v=20260909-1/);
  assert.match(html, /privacy-i18n\.js\?v=20260911-4/);
  for (const locale of ["ko", "en", "ja", "zh-CN", "zh-TW"]) {
    assert.match(html, new RegExp(`data-locale="${locale}"`));
    assert.match(script, new RegExp(`(?:^|[\\s"'])${locale.replace("-", "\\-")}(?:[":])`, "m"));
  }
  assert.match(script, /최대 14일/);
  assert.match(script, /com\.tychespark\.starlightsudoku/);
  assert.match(script, /Firebase Analytics와 AdMob도 사용하지 않습니다/);
  assert.match(script, /SS- 형식의 익명 사용자 ID/);
  assert.match(script, /익명 이용 분석을 허용하면/);
  assert.match(script, /수집 후 90일/);
  assert.match(script, /광고·분석 사업자에게 제공하지 않습니다/);
  assert.match(script, /Google Play 인앱 리뷰 흐름을 요청/);
  assert.match(script, /출시 푸시 1회 발송/);
  assert.match(script, /이메일·전화번호·이름은 수집하지 않고/);
  assert.match(script, /알림 발송 후 30일/);
  assert.match(script, /Google LLC의 Firebase Cloud Messaging/);
  assert.match(script, /Firebase Cloud Messaging이 만든 설치 식별값/);
  assert.match(script, /연령에 따라 이용을 제한하지 않는 퍼즐 게임/);
  assert.match(script, /만 14세 미만 아동을 주요 대상으로 기획하거나 홍보하는 서비스는 아니며/);
  assert.match(script, /プライバシーポリシー \| 星明かりの数独/);
  assert.match(script, /생년월일이나 연령 정보를 수집하지 않습니다/);
  assert.match(html, /support\.google\.com\/googleplay\/android-developer\/answer\/10144311/);
  assert.match(html, /support\.google\.com\/googleplay\/android-developer\/answer\/10787469/);
  assert.match(html, /developer\.android\.com\/guide\/playcore\/in-app-review/);
  assert.match(css, /--ivory: #fffaf0/);
  assert.match(css, /\.locale-switcher \{[\s\S]*?background: var\(--ivory\)/);
  assert.match(css, /\.policy-shell \{[\s\S]*?var\(--ivory\)/);
  assert.match(css, /body::before,[\s\S]*body::after/);
  assert.match(css, /@keyframes star-twinkle/);
  assert.match(css, /html:lang\(ja\) body,[\s\S]*html:lang\(zh-CN\) body,[\s\S]*html:lang\(zh-TW\) body \{[\s\S]*word-break: normal/);
  assert.match(css, /\.policy-shell \{[\s\S]*overflow-wrap: anywhere/);
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
  assert.match(html, /class="play-scroll-button" href="\/play\/\?lang=ko" target="_blank" rel="noopener noreferrer" data-play-launch/);
  assert.doesNotMatch(html, /id="play-demo"|data-start-game|landing-game\.js/);
  assert.match(html, /landing\.css\?v=20260908-107/);
  assert.match(html, /landing-i18n\.js\?v=20260908-37/);
  assert.doesNotMatch(html, /analytics-consent\.css/);
  assert.doesNotMatch(html, /analytics-consent\.js/);
  assert.match(html, /analytics-config\.js\?v=20260912-1/);
  assert.match(html, /analytics\.js\?v=20260912-1/);
  assert.match(html, /landing-launch\.js\?v=20260911-46/);
  assert.match(html, /data-i18n="title">퍼즐을 풀어<br>별빛을 모으고,<br><strong>멈춰버린 밤에<br>아침을 불러오세요\.<\/strong>/);
  assert.match(script, /title: "퍼즐을 풀어<br>별빛을 모으고,<br><strong>멈춰버린 밤에<br>아침을 불러오세요\.<\/strong>"/);
  for (const localizedTitle of [
    'title: "Solve puzzles.<br>Gather starlight.<br><strong>Bring morning back<br>to a night<br>frozen in time.</strong>"',
    'title: "パズルを解いて<br>星の光を集め、<br><strong>止まった夜に<br>朝を呼び戻そう。</strong>"',
    'title: "解开谜题，<br>收集星光，<br><strong>让清晨重回<br>停驻的长夜。</strong>"',
    'title: "解開謎題，<br>收集星光，<br><strong>讓清晨重回<br>停駐的長夜。</strong>"',
  ]) {
    assert.ok(script.includes(localizedTitle), `${localizedTitle} 의미 단위 줄바꿈이 유지되어야 한다`);
  }
  assert.match(html, /data-i18n="body">숫자 속에 흩어진 별빛을 모아 잠든 마을의 장소들을 하나씩 밝혀 나가는 감성 스도쿠 게임<\/p>/);
  assert.match(script, /body: "숫자 속에 흩어진 별빛을 모아 잠든 마을의 장소들을 하나씩 밝혀 나가는 감성 스도쿠 게임"/);
  assert.match(script, /playCta: "지금<br>플레이해보세요"/);
  assert.match(script, /pageTitle: "星明かりの数独 \| Starlight Sudoku"/);
  for (const hreflang of ["ko", "en", "ja", "zh-Hans", "zh-Hant", "x-default"]) {
    assert.match(html, new RegExp(`hreflang="${hreflang}"`));
  }
  assert.match(script, /function applySeo\(locale\)/);
  assert.match(script, /link\[rel="canonical"\]/);
  assert.match(script, /#starlight-structured-data/);
  assert.match(html, /data-i18n="releaseState">GOOGLE PLAY · 입점 준비 중/);
  assert.match(script, /releaseState: "GOOGLE PLAY · 입점 준비 중"/);
  assert.match(launchScript, /const playUrl = "\/play\/"/);
  assert.match(launchScript, /new URL\(playUrl, window\.location\.origin\)/);
  assert.match(launchScript, /url\.searchParams\.set\("lang", document\.documentElement\.lang \|\| "ko"\)/);
  assert.match(launchScript, /document\.addEventListener\("starlight:locale"/);
  assert.match(script, /ko: "Starlight%20Sdoku%20landing%20CTA_KR\.png"/);
  assert.match(script, /"zh-CN": "Starlight%20Sdoku%20landing%20CTA_CN\.png"/);
  assert.match(script, /"zh-TW": "Starlight%20Sdoku%20landing%20CTA_TW\.png"/);
  assert.match(script, /ja: "Starlight%20Sdoku%20landing%20CTA_JP\.png"/);
  assert.match(script, /en: "Starlight%20Sdoku%20landing%20CTA_EN\.png"/);
  assert.match(html, /Starlight%20Sdoku%20landing%20CTA_KR\.png/);
  assert.match(html, /target="_blank" rel="noopener noreferrer" data-play-launch/);
  assert.match(launchScript, /window\.open\(localizedPlayUrl\(\), "_blank", playWindowFeatures\(\)\)/);
  assert.match(launchScript, /const width = 390;[\s\S]*const height = 844;/);
  assert.match(launchScript, /popup=yes,width=\$\{width\},height=\$\{height\}/);
  assert.doesNotMatch(launchScript, /window\.location\.assign/);
  assert.match(launchScript, /function createStarField\(container, count, seed\)/);
  assert.match(launchScript, /state \* 1664525 \+ 1013904223/);
  assert.match(launchScript, /lowerSky = random\(\) < 0\.64/);
  assert.match(launchScript, /createStarField\(stars, 160, 20260904\)/);
  assert.match(launchScript, /0\.8 \+ random\(\) \* 2\.4/);
  assert.match(launchScript, /function createStaticStarField\(container, count, seed\)/);
  assert.match(launchScript, /createStaticStarField\(stars, 240, 20260904\)/);
  assert.match(launchScript, /lowerSky = random\(\) < 0\.68/);
  assert.match(launchScript, /function setupCursorStardust\(\)/);
  assert.match(launchScript, /window\.matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(launchScript, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(launchScript, /Array\.from\(\{ length: 96 \}/);
  assert.match(launchScript, /const trailLength = 60 \+ Math\.min\(110, movementLength \* 2\.8\)/);
  assert.match(launchScript, /const halfWidth = 5 \+ tailRatio \* \(44 \+ Math\.min\(36, movementLength \* 0\.6\)\)/);
  assert.match(launchScript, /const sideDistance = \(Math\.random\(\) \* 2 - 1\) \* halfWidth/);
  assert.match(launchScript, /const emissionCount = !lastPoint \? 1 : movementLength >= 20 \? 3 : 2/);
  assert.match(launchScript, /document\.addEventListener\("pointermove"/);
  assert.match(launchScript, /window\.requestAnimationFrame\(drawCursorStardust\)/);
  assert.match(css, /\.cursor-stardust\{[^}]*position:fixed;[^}]*pointer-events:none;[^}]*contain:strict/);
  assert.match(css, /\.cursor-stardust-particle\{[^}]*#f7d66f[^}]*rgba\(235,178,54,\.48\)[^}]*mix-blend-mode:screen/);
  assert.match(launchScript, /0\.86 \+ Math\.random\(\) \* 0\.13/);
  assert.match(css, /0%\{opacity:var\(--cursor-dust-opacity\)/);
  assert.doesNotMatch(css, /\.cursor-stardust-particle\.is-spark/);
  assert.match(css, /\.cursor-stardust-particle\.is-active\{animation:cursor-stardust-trail/);
  assert.match(css, /@media\(pointer:coarse\),\(prefers-reduced-motion:reduce\)\{\.cursor-stardust\{display:none\}\}/);
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
  assert.match(html, /<img class="cta-star-art" src="Starlight%20Sdoku%20landing%20CTA_KR\.png" alt="" aria-hidden="true">/);
  assert.match(css, /\.play-scroll-button::before,\.play-scroll-button::after\{content:none\}/);
  assert.match(css, /\.cta-star-art\{[^}]*width:294px;[^}]*object-fit:contain;[^}]*drop-shadow\(0 0 var\(--cta-glow-core-idle\)/);
  assert.match(css, /\.cta-accessible-label\{[^}]*clip:rect\(0,0,0,0\)/);
  assert.match(html, /<em class="cta-sparkles" aria-hidden="true">[\s\S]*class="cta-twinkle"[\s\S]*<\/em>/);
  assert.equal((html.match(/class="cta-twinkle"/g) || []).length, 24);
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
  assert.match(css, /\.cta-twinkle\{[^}]*color:#fff;[^}]*rgba\(255,255,255,\.78\)/);
  assert.match(css, /@keyframes cta-twinkle-out/);
  assert.match(css, /\.play-scroll-button\.is-bursting \.cta-twinkle\{font-size:0!important;color:transparent;opacity:0!important;animation:none!important\}/);
  assert.match(css, /@keyframes cta-carbonation/);
  assert.match(launchScript, /function createCtaBurst\(\)/);
  assert.match(launchScript, /const twinkles = \[\.\.\.playLink\.querySelectorAll\("\.cta-twinkle"\)\]/);
  assert.match(launchScript, /particle\.style\.setProperty\("--burst-color", "#ffffff"\)/);
  assert.match(launchScript, /for \(const \[index, start\] of particleStarts\.entries\(\)\)/);
  assert.doesNotMatch(launchScript, /--burst-end-x|--burst-end-y|endX|endY/);
  assert.match(css, /\.play-scroll-button\.is-bursting,\.play-scroll-button\.is-bursting:active\{transform:translateX\(-50%\) scale\(1\.025\);transition:none\}/);
  assert.match(css, /@keyframes cta-carbonation\{[^}]*var\(--burst-start-x\)[\s\S]*100%\{opacity:0;transform:translate\(calc\(-50% \+ var\(--burst-start-x\)\),calc\(-50% \+ var\(--burst-start-y\)\)\)\}/);
  assert.doesNotMatch(css.match(/@keyframes cta-carbonation\{[^\n]+/)[0], /scale\(/);
  assert.match(launchScript, /playLink\.addEventListener\("pointerdown", createCtaBurst\)/);
  assert.doesNotMatch(launchScript, /launchTimer|\}, 420\);/);
  assert.match(css, /@keyframes cta-orbit-travel\{to\{offset-distance:112%\}\}/);
  assert.doesNotMatch(css, /cta-star-flip|cta-star-softlight|cta-star-halo/);
  assert.match(html, /<div class="sudoku-number-art" aria-hidden="true">[\s\S]*sudoku_number_3\.png[\s\S]*sudoku_number_1\.png[\s\S]*sudoku_number_7\.png[\s\S]*<\/div>/);
  assert.match(css, /\.sudoku-number-three\{left:53\.5vw;top:24vh;width:clamp\(86px,7\.35vw,141px\);transform:rotate\(-13deg\)/);
  assert.match(css, /\.sudoku-number-one\{left:65vw;top:8vh;[^}]*rotate\(11deg\)/);
  assert.match(css, /\.sudoku-number-seven\{left:60\.5vw;top:42vh;width:clamp\(116px,9\.6vw,184px\);transform:rotate\(12deg\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.play-scroll-button,\.cta-star-art,\.cta-sparkles,\.cta-twinkle,\.cta-orbit-dot::before,\.cta-burst-particle\{animation:none\}\}/);
  assert.match(css, /\.play-scroll-button:hover\{[^}]*filter:none/);
  assert.match(css, /@media\(min-width:681px\)\{\.splash-header\{padding-top:20px;padding-bottom:20px\}\.splash-content\{padding-top:clamp\(12px,2\.5vh,26px\);padding-bottom:clamp\(36px,5vh,56px\)\}\}/);
  assert.match(css, /@media\(min-width:681px\)\{\.game-mark\{margin-bottom:46px\}\}/);
  assert.match(css, /@keyframes launch-arrow/);
  assert.doesNotMatch(css, /star-drift/);
});

test("별빛 스도쿠 랜딩의 금빛 별가루 커서는 입자 풀을 재사용한다", async () => {
  const script = await readFile(new URL("starlight-sudoku-landing/landing-launch.js", siteRoot), "utf8");
  const listeners = new Map();
  const bodyChildren = [];
  let scheduledFrame = null;

  function createElement() {
    const element = {
      className: "",
      children: [],
      attributes: new Map(),
      style: {
        properties: new Map(),
        setProperty(name, value) { this.properties.set(name, value); },
      },
      append(child) { this.children.push(child); },
      setAttribute(name, value) { this.attributes.set(name, value); },
      get offsetWidth() { return 1; },
    };
    element.classList = {
      contains: (name) => element.className.split(" ").includes(name),
      add: (name) => {
        if (!element.classList.contains(name)) element.className = `${element.className} ${name}`.trim();
      },
      remove: (name) => {
        element.className = element.className.split(" ").filter((value) => value && value !== name).join(" ");
      },
    };
    return element;
  }

  const document = {
    body: { append: (child) => bodyChildren.push(child) },
    createElement,
    querySelector: () => null,
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  const window = {
    matchMedia: (query) => ({ matches: query.includes("pointer: fine") }),
    requestAnimationFrame: (callback) => {
      scheduledFrame = callback;
      return 1;
    },
  };

  vm.runInNewContext(script, { document, window, URL, Math });

  assert.equal(bodyChildren.length, 1);
  const layer = bodyChildren[0];
  assert.equal(layer.className, "cursor-stardust");
  assert.equal(layer.attributes.get("aria-hidden"), "true");
  assert.equal(layer.children.length, 96);
  assert.ok(listeners.has("pointermove"));

  listeners.get("pointermove")({ pointerType: "mouse", clientX: 120, clientY: 84 });
  assert.equal(typeof scheduledFrame, "function");
  scheduledFrame(30);
  assert.ok(layer.children[0].classList.contains("is-active"));
  assert.notEqual(layer.children[0].style.left, "");
  assert.ok(layer.children[0].style.properties.has("--cursor-dust-duration"));
  assert.ok(layer.children[0].style.properties.has("--cursor-dust-opacity"));

  scheduledFrame = null;
  listeners.get("pointermove")({ pointerType: "mouse", clientX: 180, clientY: 84 });
  scheduledFrame(60);
  assert.ok(layer.children[3].classList.contains("is-active"), "빠른 이동 구간을 보간해 긴 꼬리를 만들어야 한다");

  scheduledFrame = null;
  listeners.get("pointermove")({ pointerType: "touch", clientX: 40, clientY: 40 });
  assert.equal(scheduledFrame, null);
});

test("별빛 스도쿠 랜딩은 선택 언어의 탭 제목과 CTA 이미지를 실제로 적용한다", async () => {
  const script = await readFile(new URL("starlight-sudoku-landing/landing-i18n.js", siteRoot), "utf8");
  const expected = new Map([
    ["ko", ["별빛 스도쿠 | Starlight Sudoku", "CTA_KR.png", "https://starlight-sudoku.tycheworks.com/", "별빛 스도쿠", "ko"]],
    ["en", ["Starlight Sudoku | TYCHE SPARK", "CTA_EN.png", "https://starlight-sudoku.tycheworks.com/?lang=en", "Starlight Sudoku", "en"]],
    ["ja", ["星明かりの数独 | Starlight Sudoku", "CTA_JP.png", "https://starlight-sudoku.tycheworks.com/?lang=ja", "星明かりの数独", "ja"]],
    ["zh-CN", ["星光数独 | Starlight Sudoku", "CTA_CN.png", "https://starlight-sudoku.tycheworks.com/?lang=zh-CN", "星光数独", "zh-Hans"]],
    ["zh-TW", ["星光數獨 | Starlight Sudoku", "CTA_TW.png", "https://starlight-sudoku.tycheworks.com/?lang=zh-TW", "星光數獨", "zh-Hant"]],
  ]);

  for (const [locale, [title, imageSuffix, canonicalUrl, schemaName, schemaLanguage]] of expected) {
    const ctaImage = { src: "" };
    const canonical = { href: "" };
    const structuredData = { textContent: JSON.stringify({ publisher: {} }) };
    const metas = new Map([
      ['meta[name="description"]', { content: "" }],
      ['meta[property="og:title"]', { content: "" }],
      ['meta[property="og:description"]', { content: "" }],
      ['meta[property="og:url"]', { content: "" }],
      ['meta[property="og:image"]', { content: "" }],
      ['meta[property="og:image:alt"]', { content: "" }],
      ['meta[property="og:locale"]', { content: "" }],
      ['meta[name="twitter:title"]', { content: "" }],
      ['meta[name="twitter:description"]', { content: "" }],
      ['meta[name="twitter:image"]', { content: "" }],
      ['meta[name="twitter:image:alt"]', { content: "" }],
      ['link[rel="canonical"]', canonical],
      ["#starlight-structured-data", structuredData],
    ]);
    const document = {
      documentElement: { lang: "ko" },
      title: "",
      querySelector: (selector) => selector === ".cta-star-art" ? ctaImage : metas.get(selector) || null,
      querySelectorAll: () => [],
      dispatchEvent: () => {},
    };
    const location = new URL(`https://starlight-sudoku.tycheworks.com/?lang=${locale}`);
    vm.runInNewContext(script, {
      document,
      window: { location },
      history: { replaceState: () => {} },
      localStorage: { getItem: () => "", setItem: () => {} },
      navigator: { language: "ko" },
      CustomEvent: class {},
      URL,
      URLSearchParams,
      encodeURIComponent,
    });

    assert.equal(document.documentElement.lang, locale);
    assert.equal(document.title, title);
    assert.ok(ctaImage.src.endsWith(imageSuffix), locale);
    assert.equal(canonical.href, canonicalUrl);
    assert.equal(metas.get('meta[property="og:url"]').content, canonicalUrl);
    assert.equal(metas.get('meta[name="twitter:title"]').content, title);
    assert.ok(metas.get('meta[name="description"]').content.length > 0);
    const schema = JSON.parse(structuredData.textContent);
    assert.equal(schema.name, schemaName);
    assert.equal(schema.inLanguage, schemaLanguage);
    assert.equal(schema.url, canonicalUrl);
  }
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
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA_KR.png",
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA_EN.png",
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA_JP.png",
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA_CN.png",
    "../../../starlight-sudoku-landing/Starlight%20Sdoku%20landing%20CTA_TW.png",
    "../../../starlight-sudoku-landing/sudoku_number_1.png",
    "../../../starlight-sudoku-landing/sudoku_number_3.png",
    "../../../starlight-sudoku-landing/sudoku_number_7.png",
  ];

  await Promise.all(assets.map((asset) => access(new URL(asset, assetRoot))));
});
