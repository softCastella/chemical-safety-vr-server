import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../public/site/", import.meta.url);

test("LOOP 메인에서 메모링 상세 페이지로 연결한다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("loop/index.html", siteRoot), "utf8"),
    readFile(new URL("loop/loop.css", siteRoot), "utf8"),
  ]);

  assert.match(html, /href="memoring\/"/);
  assert.match(html, /GOOGLE PLAY 입점 예정/);
  assert.match(html, /<h3>메모링<\/h3>/);
  assert.doesNotMatch(html, /class="work-logo"/);
  assert.match(html, /class="loop-hero shell"/);
  assert.match(html, /class="loop-work-card"/);
  assert.match(html, /class="loop-vision"/);
  assert.equal(html.match(/class="feature"/g)?.length, 4);
  assert.match(html, /rel="canonical" href="https:\/\/loop\.tycheworks\.com\/"/);
  assert.match(html, /assets\/Loop\/Logo_Memoring\.png/);
  assert.doesNotMatch(html, /Memoring_demo_image/);
  assert.match(css, /\.loop-hero-media img\{[^}]*object-fit:contain/);
  assert.match(css, /\.loop-work-media img\{[^}]*object-fit:contain/);
  await access(new URL("assets/Loop/Logo_Memoring.png", siteRoot));
  await access(new URL("assets/Loop/Memoring_demo_image.png", siteRoot));
});

test("메모링 상세 페이지는 LOOP 라인 안에서 앱 정보를 안내한다", async () => {
  const [html, detailCss] = await Promise.all([
    readFile(new URL("loop/memoring/index.html", siteRoot), "utf8"),
    readFile(new URL("loop/memoring/detail.css", siteRoot), "utf8"),
  ]);

  assert.match(html, /rel="canonical" href="https:\/\/loop\.tycheworks\.com\/memoring\/"/);
  assert.match(html, /class="detail-header"/);
  assert.match(html, /class="detail-subnav"/);
  assert.match(html, /class="detail-toc"/);
  assert.match(html, /class="loop-nav"/);
  assert.match(html, /href="\.\.\/"/);
  assert.match(html, /LOOP로 돌아가기/);
  assert.match(html, /Google Play 입점 예정/);
  assert.match(html, /id="memoring-detail-structured-data"/);
  assert.match(html, /href="detail\.css\?v=20260918-7"/);
  assert.match(detailCss, /\.memoring-detail\{/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/Loop\/Logo_Memoring\.png"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/Loop\/Memoring_demo_image\.png"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/Loop\/Memoring_skin_image\.png"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/Loop\/Memoring_mySkin_image\.png"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/Loop\/Memoring_setting_image\.png"/);
  assert.match(html, /class="shell demo-screen"/);
  assert.match(html, /class="shell feature-showcase"/);
  assert.match(html, /href="#checklist"/);
  assert.match(html, /href="#skin"/);
  assert.match(html, /href="#settings"/);
  assert.match(html, /01 · CHECKLIST/);
  assert.match(html, /02 · SKIN/);
  assert.match(html, /03 · SETTINGS/);
  assert.match(html, /자정에 다시 채워지는/);
  assert.match(html, /매일 다시 적을 필요 없는/);
  assert.match(html, /SKIN SYSTEM/);
  const loopCss = await readFile(new URL("loop/loop.css", siteRoot), "utf8");
  assert.match(loopCss, /\.title-poster img\{[^}]*width:425px;[^}]*max-width:100%/);
  assert.match(loopCss, /\.demo-screen img\{[^}]*width:428px;[^}]*max-width:100%/);
  assert.match(loopCss, /\.showcase-phone img\{[^}]*width:425px;[^}]*max-width:100%/);
  assert.match(loopCss, /\.skin-tones/);
  await access(new URL("assets/Loop/Memoring_skin_image.png", siteRoot));
  await access(new URL("assets/Loop/Memoring_mySkin_image.png", siteRoot));
  await access(new URL("assets/Loop/Memoring_setting_image.png", siteRoot));
});
