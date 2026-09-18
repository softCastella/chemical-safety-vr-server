import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../public/site/", import.meta.url);

const canonicalPages = new Map([
  ["index.html", "https://tycheworks.com/"],
  ["brand/index.html", "https://tycheworks.com/brand"],
  ["privacy/index.html", "https://tycheworks.com/privacy/"],
  ["immersa/index.html", "https://immersa.tycheworks.com/"],
  ["immersa/chemical-safety-training/index.html", "https://immersa.tycheworks.com/chemical-safety-training"],
  ["spark/index.html", "https://spark.tycheworks.com/"],
  ["spark/starlight-sudoku/index.html", "https://spark.tycheworks.com/starlight-sudoku/"],
  ["spark/starlight-sudoku/privacy/index.html", "https://spark.tycheworks.com/starlight-sudoku/privacy/"],
  ["starlight-sudoku-landing/index.html", "https://starlight-sudoku.tycheworks.com/"],
  ["loop/index.html", "https://loop.tycheworks.com/"],
  ["loop/memoring/index.html", "https://loop.tycheworks.com/memoring/"],
  ["chemical-safety-vr-landing/index.html", "https://chemical-safety-vr.tycheworks.com/"],
  ["chemical-safety-vr-landing/light/index.html", "https://chemical-safety-vr.tycheworks.com/"],
  ["chemical-safety-vr-landing/campaign/index.html", "https://chemical-safety-vr.tycheworks.com/"],
]);

test("공개 브랜드 페이지는 정식 URL을 선언한다", async () => {
  for (const [path, canonical] of canonicalPages) {
    const html = await readFile(new URL(path, siteRoot), "utf8");
    assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1, path);
    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`),
      path,
    );
  }
});

test("호스트별 사이트맵에는 색인 가능한 정식 URL만 포함한다", async () => {
  const sitemaps = new Map([
    ["sitemap.xml", ["https://tycheworks.com/", "https://tycheworks.com/brand"]],
    ["immersa/sitemap.xml", ["https://immersa.tycheworks.com/", "https://immersa.tycheworks.com/chemical-safety-training"]],
    ["spark/sitemap.xml", ["https://spark.tycheworks.com/", "https://spark.tycheworks.com/starlight-sudoku/"]],
    ["starlight-sudoku-landing/sitemap.xml", ["https://starlight-sudoku.tycheworks.com/"]],
    ["loop/sitemap.xml", ["https://loop.tycheworks.com/", "https://loop.tycheworks.com/memoring/"]],
    ["chemical-safety-vr-landing/sitemap.xml", ["https://chemical-safety-vr.tycheworks.com/"]],
  ]);

  for (const [path, expectedUrls] of sitemaps) {
    const xml = await readFile(new URL(path, siteRoot), "utf8");
    const actualUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(actualUrls, expectedUrls, path);
    assert.doesNotMatch(xml, /brand-v2|chemical-safety-training-promo|\/privacy\//);
  }
});

test("robots 정책은 학습 봇 거부와 사이트맵 위치를 명시한다", async () => {
  const robots = await readFile(new URL("robots.txt", siteRoot), "utf8");
  for (const bot of ["Applebot-Extended", "AhrefsBot", "SemrushBot"]) {
    assert.match(robots, new RegExp(`User-agent: ${bot}\\r?\\nDisallow: /`));
  }
  for (const host of [
    "tycheworks.com",
    "immersa.tycheworks.com",
    "spark.tycheworks.com",
    "starlight-sudoku.tycheworks.com",
    "loop.tycheworks.com",
    "chemical-safety-vr.tycheworks.com",
  ]) {
    assert.match(robots, new RegExp(`Sitemap: https://${host.replaceAll(".", "\\.")}/sitemap\\.xml`));
  }
});

test("Nginx 배포 초안은 공개 호스트 보안과 이전 경로 정책을 명시한다", async () => {
  const nginxRoot = new URL("../ops/nginx/", import.meta.url);
  const hardening = await readFile(new URL("tycheworks-public-hardening.conf", nginxRoot), "utf8");
  const legacyRoutes = await readFile(new URL("tycheworks-legacy-routes.conf", nginxRoot), "utf8");
  const starlight = await readFile(new URL("tycheworks-starlight-sudoku.conf", nginxRoot), "utf8");
  const admin = await readFile(new URL("tycheworks-admin.conf", nginxRoot), "utf8");
  const starlightPlayPages = await Promise.all([
    readFile(new URL("starlight-sudoku-landing/play/index.html", siteRoot), "utf8"),
    readFile(new URL("starlight-sudoku-landing/play/landing/index.html", siteRoot), "utf8"),
  ]);
  const immersaKakaoCspPatch = await readFile(new URL("tycheworks-immersa-kakao-share-csp.patch", nginxRoot), "utf8");
  const immersaTrainingTelemetry = await readFile(new URL("tycheworks-immersa-training-telemetry.conf", nginxRoot), "utf8");
  const wwwCanonicalPatch = await readFile(new URL("tycheworks-www-canonical-redirect.patch", nginxRoot), "utf8");

  assert.match(hardening, /server_tokens off;/);
  assert.match(hardening, /http2 on;/);
  assert.match(hardening, /Strict-Transport-Security "max-age=86400" always;/);
  assert.match(hardening, /gzip on;/);
  assert.match(hardening, /location ~\* \\\.\(\?:css\|js\|png\|jpe\?g\|webp\|avif\|svg\|woff2\?\|mp3\|wav\)\$/);
  assert.match(hardening, /expires -1;/);
  assert.match(legacyRoutes, /location \^~ \/app\/ \{ return 301 https:\/\/loop\.tycheworks\.com\//);
  assert.match(legacyRoutes, /location \^~ \/brand-v2\/ \{ return 404; \}/);
  assert.match(starlight, /include .*tycheworks-public-hardening\.conf;/);
  assert.match(starlight, /script-src 'self' https:\/\/www\.gstatic\.com 'wasm-unsafe-eval'/);
  for (const html of starlightPlayPages) {
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const [, inlineScript] of inlineScripts) {
      const hash = createHash("sha256").update(inlineScript).digest("base64");
      assert.ok(starlight.includes(`'sha256-${hash}'`), `missing CSP hash for /play/ inline script: ${hash}`);
    }
  }
  assert.match(starlight, /worker-src 'self'/);
  assert.match(starlight, /location = \/yt \{\s*return 302 \/\?utm_source=youtube&utm_medium=shorts&utm_campaign=starlight_gameplay_trailer&utm_content=trailer_v1;\s*\}/);
  assert.match(starlight, /location = \/threads \{\s*return 302 \/\?utm_source=threads&utm_medium=social&utm_campaign=starlight_gameplay_trailer&utm_content=post_v1;\s*\}/);
  assert.match(starlight, /location = \/api\/starlight-analytics\/events\/batch/);
  assert.match(starlight, /location = \/api\/starlight-release-push\/subscriptions/);
  assert.match(starlight, /location = \/store \{\s*return 302 https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.tychespark\.starlightsudoku/);
  assert.match(starlight, /https:\/\/www\.gstatic\.com/);
  assert.match(starlight, /https:\/\/firebaseinstallations\.googleapis\.com/);
  assert.match(starlight, /https:\/\/fcmregistrations\.googleapis\.com/);
  assert.match(starlight, /client_max_body_size 256k;/);
  assert.match(starlight, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  assert.match(admin, /server_name admin\.tycheworks\.com;/);
  assert.match(admin, /location = \/ \{ return 302 \/server\/login; \}/);
  assert.match(admin, /location \/api\/starlight-analytics\//);
  assert.match(admin, /server\|starlight-sudoku\|chemical-safety-training-vr\|server-status\|starlight-analytics/);
  assert.match(admin, /location \/ \{ return 404; \}/);
  assert.match(immersaTrainingTelemetry, /location \^~ \/api\/training-telemetry\//);
  assert.match(immersaTrainingTelemetry, /limit_except POST \{ deny all; \}/);
  assert.match(immersaTrainingTelemetry, /limit_req zone=public_site burst=20 nodelay;/);
  assert.match(immersaTrainingTelemetry, /client_max_body_size 1m;/);
  assert.match(immersaTrainingTelemetry, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  assert.doesNotMatch(starlight, /location = \/index\.html/);
  assert.doesNotMatch(starlight, /location ~\* \\\.\(\?:css\|js\|png/);
  assert.match(
    immersaKakaoCspPatch,
    /form-action 'self' https:\/\/sharer\.kakao\.com https:\/\/accounts\.kakao\.com/,
  );
  assert.match(immersaKakaoCspPatch, /connect-src 'self' https:\/\/kapi\.kakao\.com/);
  assert.equal(
    (wwwCanonicalPatch.match(/^\+\s+return 301 https:\/\/tycheworks\.com\$request_uri;/gm) || []).length,
    2,
  );
  assert.doesNotMatch(wwwCanonicalPatch, /^\+\s+return 301 https:\/\/\$host\$request_uri;/m);
});

test("비공개 시안과 개인정보 문서는 검색 색인에서 제외한다", async () => {
  for (const path of [
    "brand-v2/index.html",
    "immersa/chemical-safety-training-promo/index.html",
  ]) {
    const html = await readFile(new URL(path, siteRoot), "utf8");
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/, path);
  }

  for (const path of ["privacy/index.html", "spark/starlight-sudoku/privacy/index.html"]) {
    const html = await readFile(new URL(path, siteRoot), "utf8");
    assert.match(html, /<meta name="robots" content="noindex,follow">/, path);
  }

  for (const path of [
    "chemical-safety-vr-landing/light/index.html",
    "chemical-safety-vr-landing/campaign/index.html",
  ]) {
    const html = await readFile(new URL(path, siteRoot), "utf8");
    assert.match(html, /<meta name="robots" content="noindex,follow">/, path);
    assert.match(html, /<link rel="canonical" href="https:\/\/chemical-safety-vr\.tycheworks\.com\/">/, path);
  }
});

test("색인 대상 페이지는 파싱 가능한 구조화 데이터를 제공한다", async () => {
  for (const path of [
    "index.html",
    "brand/index.html",
    "immersa/index.html",
    "immersa/chemical-safety-training/index.html",
    "spark/index.html",
    "spark/starlight-sudoku/index.html",
    "starlight-sudoku-landing/index.html",
    "loop/index.html",
    "loop/memoring/index.html",
    "chemical-safety-vr-landing/index.html",
  ]) {
    const html = await readFile(new URL(path, siteRoot), "utf8");
    const blocks = [...html.matchAll(/<script(?:\s+id="[^"]+")?\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, `${path}: JSON-LD가 필요하다`);
    for (const [, source] of blocks) {
      const data = JSON.parse(source);
      assert.equal(data["@context"], "https://schema.org", path);
    }
  }
});
