import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const siteRoot = new URL('../public/site/', import.meta.url);

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
