import assert from "node:assert/strict";
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
    ["loop/sitemap.xml", ["https://loop.tycheworks.com/"]],
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

  assert.match(hardening, /server_tokens off;/);
  assert.match(hardening, /http2 on;/);
  assert.match(hardening, /Strict-Transport-Security "max-age=86400" always;/);
  assert.match(hardening, /gzip on;/);
  assert.match(hardening, /location ~\* \\\.\(\?:css\|js\|png\|jpe\?g\|webp\|avif\|svg\|woff2\?\|mp3\|wav\)\$/);
  assert.match(hardening, /expires -1;/);
  assert.match(legacyRoutes, /location \^~ \/app\/ \{ return 301 https:\/\/loop\.tycheworks\.com\//);
  assert.match(legacyRoutes, /location \^~ \/brand-v2\/ \{ return 404; \}/);
  assert.match(starlight, /include .*tycheworks-public-hardening\.conf;/);
  assert.doesNotMatch(starlight, /location = \/index\.html/);
  assert.doesNotMatch(starlight, /location ~\* \\\.\(\?:css\|js\|png/);
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
