import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const siteRoot = new URL('../public/site/', import.meta.url);

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryUrl = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      return entry.isDirectory() ? findHtmlFiles(entryUrl) : [entryUrl];
    }),
  );

  return nestedFiles.flat().filter((file) => file.pathname.endsWith('.html'));
}

test('모든 사이트 페이지는 흰 원형 파비콘을 한 번만 참조한다', async () => {
  const faviconUrl = new URL('assets/Favicon_round.svg', siteRoot);
  const htmlFiles = await findHtmlFiles(siteRoot);
  const faviconSvg = await readFile(faviconUrl, 'utf8');

  await access(faviconUrl);
  assert.match(faviconSvg, /<circle cx="608" cy="608" r="608" fill="#ffffff"\/>/);
  assert.equal(htmlFiles.length, 15);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    const faviconLinks = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) ?? [];

    assert.equal(faviconLinks.length, 1, `${htmlFile.pathname} favicon link count`);
    const href = faviconLinks[0].match(/\bhref="([^"]+)"/)?.[1];
    assert.ok(href, `${htmlFile.pathname} favicon href`);
    assert.equal(new URL(href, htmlFile).href, faviconUrl.href);
  }
});

test('홈 작품 캐러셀은 세 배너를 유지하고 이동 트랙에서 슬라이드를 자르지 않는다', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('index.html', siteRoot), 'utf8'),
    readFile(new URL('styles.css', siteRoot), 'utf8'),
  ]);

  const slides = html.match(/class="[^"]*\brelease-slide\b[^"]*"/g) ?? [];
  assert.equal(slides.length, 3);

  const trackRules = [...css.matchAll(/\.release-track\s*\{([^}]*)\}/g)];
  assert.ok(trackRules.length > 0);
  assert.equal(
    trackRules.some(([, declarations]) => /overflow\s*:\s*hidden/.test(declarations)),
    false,
  );
});

test('홈 첫 번째 VR 배너의 남는 영역은 흰색 배경을 사용한다', async () => {
  const css = await readFile(new URL('styles.css', siteRoot), 'utf8');
  const mediaRule = css.match(/\.release-media-banner\s*\{([^}]*)\}/);
  const slideRule = css.match(/\.release-slide-vr\s*\{([^}]*)\}/);

  assert.ok(mediaRule);
  assert.ok(slideRule);
  assert.match(mediaRule[1], /background\s*:\s*#fff!important/);
  assert.match(slideRule[1], /background\s*:\s*#fff/);
});

test('홈 작품 배너 외곽은 매우 연한 회색 선을 사용한다', async () => {
  const css = await readFile(new URL('styles.css', siteRoot), 'utf8');
  const carouselRules = [...css.matchAll(/\.release-carousel\s*\{([^}]*)\}/g)];
  const finalCarouselRule = carouselRules.at(-1)?.[1] ?? '';

  assert.match(css, /--line-soft\s*:\s*rgba\(32,32,32,\.06\)/);
  assert.match(finalCarouselRule, /border\s*:\s*1px solid var\(--line-soft\)/);
});

test('홈과 세부 라인의 포인트 컬러 역할을 구분한다', async () => {
  const css = await readFile(new URL('styles.css', siteRoot), 'utf8');

  assert.match(css, /--brand-accent\s*:\s*#6c4bd8/);
  assert.match(css, /\.btn-primary\{[^}]*background\s*:\s*var\(--brand-accent\)/);
  assert.match(css, /\.active-line\{[^}]*rgba\(40,120,255,\.065\)/);
  assert.match(css, /\.status\.live\{[^}]*color\s*:\s*var\(--immersa\)/);
  assert.match(css, /--immersa\s*:\s*#2878ff/);
  assert.match(css, /--spark\s*:\s*#ff7a00/);
  assert.match(css, /--loop\s*:\s*#f4c430/);
  assert.doesNotMatch(css, /var\(--orange\)/);
});

test('화학물질 안전훈련 VR 상세페이지 푸터는 공개 개인정보처리방침으로 연결한다', async () => {
  const html = await readFile(
    new URL('immersa/chemical-safety-training/index.html', siteRoot),
    'utf8',
  );
  const privacyUrl =
    'https://softcastella.github.io/tycheworks-safetytrainingvr-privacy/';

  assert.equal(html.match(new RegExp(`href="${privacyUrl}"`, 'g'))?.length, 1);
  assert.match(
    html,
    new RegExp(
      `<a href="${privacyUrl}" target="_blank" rel="noopener noreferrer">VR PRIVACY POLICY<\\/a>`,
    ),
  );
  assert.doesNotMatch(
    html,
    /href="https:\/\/github\.com\/softCastella\/tycheworks-safetytrainingvr-privacy"/,
  );
});
