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
  const [html, script] = await Promise.all([
    readFile(new URL("spark/starlight-sudoku/index.html", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/i18n.js", siteRoot), "utf8"),
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
  assert.match(script, /https:\/\/tycheworks\.com\/starlight-sudoku-landing\//);
  assert.match(html, /href="privacy\/" data-privacy-link/);
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/\.\.\/assets\/Spark\/Starlight%20Sudoku\/Icon_Starlight_Sudoku_v4\.png"/);
  assert.match(script, /privacy\/\?lang=/);
  const css = await readFile(new URL("spark/spark.css", siteRoot), "utf8");
  assert.match(css, /\.detail-identity img\{[^}]*width:92px;[^}]*height:92px;[^}]*object-fit:contain/);
  assert.match(css, /\.title-poster img\{[^}]*width:100%;[^}]*height:auto;[^}]*object-fit:contain/);
  assert.match(html, /class="detail-toc"/);
  assert.match(html, /class="detail-subnav"/);
  assert.match(html, /href="https:\/\/tycheworks\.com\/">TYCHE WORKS<\/a>/);
  assert.match(html, /href="https:\/\/tycheworks\.com\/#contact">CONTACT<\/a>/);
  assert.match(css, /\.detail-subnav \.[\w-]*locale-switcher\{[^}]*position:static/);
});

test("별빛 스도쿠 개인정보처리방침은 5개 언어와 상세 복귀 경로를 제공한다", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("spark/starlight-sudoku/privacy/index.html", siteRoot), "utf8"),
    readFile(new URL("spark/starlight-sudoku/privacy/privacy-i18n.js", siteRoot), "utf8"),
  ]);

  assert.match(html, /data-detail-link/);
  assert.match(html, /starlight-sudoku-locale/);
  for (const locale of ["ko", "en", "ja", "zh-CN", "zh-TW"]) {
    assert.match(html, new RegExp(`data-locale="${locale}"`));
    assert.match(script, new RegExp(`(?:^|[\\s"'])${locale.replace("-", "\\-")}(?:[":])`, "m"));
  }
  assert.match(script, /최대 14일/);
  assert.match(script, /production app build/);
});

test("별빛 스도쿠 랜딩은 상세 페이지와 언어 상태를 연결한다", async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL("starlight-sudoku-landing/index.html", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing.css", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/landing-i18n.js", siteRoot), "utf8"),
  ]);

  assert.match(html, /href="https:\/\/spark\.tycheworks\.com\/starlight-sudoku\/"/);
  assert.match(css, /village_night_light\.png/);
  assert.match(html, /ChatGPT%20Image%202026년%209월%202일/);
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/assets\/Spark\/Starlight%20Sudoku\/Icon_Starlight_Sudoku_v4\.png"/);
  assert.match(script, /\$\{detailBase\}\?lang=/);
  assert.match(script, /https:\/\/spark\.tycheworks\.com\/starlight-sudoku/);
  assert.match(script, /localHost \? "\.\.\/spark\/starlight-sudoku\/"/);
  assert.match(css, /\.splash-art\{[^}]*background-position:right center[^}]*background-size:contain/);
  assert.match(css, /\.hero-character\{[^}]*bottom:0[^}]*object-fit:contain/);
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
  ];

  await Promise.all(assets.map((asset) => access(new URL(asset, assetRoot))));
});
