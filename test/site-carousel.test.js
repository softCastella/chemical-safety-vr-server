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
  const faviconUrl = new URL('assets/favicon_round_crop.svg', siteRoot);
  const htmlFiles = await findHtmlFiles(siteRoot);
  const faviconSvg = await readFile(faviconUrl, 'utf8');

  await access(faviconUrl);
  assert.match(faviconSvg, /<clipPath id="round-crop">/);
  assert.match(faviconSvg, /<circle cx="627" cy="627" r="627"\/>/);
  assert.match(faviconSvg, /clip-path="url\(#round-crop\)"/);
  assert.match(faviconSvg, /href="data:image\/png;base64,/);
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

test('화학물질 안전훈련 VR 상세페이지는 SNS 공유 모달을 제공한다', async () => {
  const [html, script] = await Promise.all([
    readFile(
      new URL('immersa/chemical-safety-training/index.html', siteRoot),
      'utf8',
    ),
    readFile(
      new URL('immersa/chemical-safety-training/detail-share.js', siteRoot),
      'utf8',
    ),
  ]);

  assert.match(html, /<script src="\/chemical-safety-training\/detail-share\.js\?v=20260831-10" defer><\/script>/);
  assert.match(html, /class="detail-share-button"/);
  assert.match(html, /aria-label="이 페이지 공유하기"/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.doesNotMatch(html, /data-share-native|기기에서 공유/);
  assert.match(html, /data-share-kakao/);
  assert.match(html, /data-share-platform="naver"/);
  assert.match(html, /data-share-platform="facebook"/);
  assert.match(html, /data-share-platform="x"/);
  assert.match(html, /data-share-platform="linkedin"/);
  assert.match(html, /data-share-platform="telegram"/);
  assert.match(html, /data-share-platform="line"/);
  assert.match(html, /data-share-platform="email"/);
  assert.match(html, /data-share-copy/);
  assert.match(html, /\.detail-share-status\s*\{[\s\S]*?top:\s*76px/);
  assert.match(html, /\.detail-share-dialog\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(html, /linear-gradient\(145deg, rgba\(124, 235, 240, 0\.22\), rgba\(112, 160, 248, 0\.34\)\)/);
  assert.match(html, /stroke-width="2\.25"/);
  assert.match(html, /border:\s*1px solid transparent !important/);
  assert.match(html, /linear-gradient\(#fff, #fff\) padding-box/);
  assert.match(html, /linear-gradient\(135deg, #70a0f8 0%, #7cebf0 100%\) border-box/);
  assert.doesNotMatch(script, /navigator\.share|data-share-native/);
  assert.match(script, /fetch\("\/api\/public-site-config"/);
  assert.match(script, /t1\.kakaocdn\.net\/kakao_js_sdk\/2\.8\.2\/kakao\.min\.js/);
  assert.match(script, /kakaoSdk\.Share\.sendDefault/);
  assert.match(script, /imageWidth:\s*1200/);
  assert.match(script, /imageHeight:\s*630/);
  assert.doesNotMatch(script, /window\.open\s*=/);
  assert.match(script, /blog\.naver\.com\/openapi\/share/);
  assert.match(script, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(script, /twitter\.com\/intent\/tweet/);
  assert.match(script, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(script, /t\.me\/share\/url/);
  assert.match(script, /social-plugins\.line\.me\/lineit\/share/);
  assert.match(script, /navigator\.clipboard\.writeText\(shareUrl\)/);
  assert.match(script, /event\.key === "Escape"/);
});

test('서버 어드민 로그인과 대시보드는 새 원형 파비콘을 사용한다', async () => {
  const [login, dashboard] = await Promise.all([
    readFile(new URL('../server-status/login.html', siteRoot), 'utf8'),
    readFile(new URL('../server-status/index.html', siteRoot), 'utf8'),
  ]);

  for (const html of [login, dashboard]) {
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/server-status\/favicon\.svg\?v=4">/);
  }
});

test('화학물질 안전훈련 VR 페이지는 전용 OG 배너와 HD 히어로 이미지를 사용한다', async () => {
  const [home, detail, landing, light, campaign] = await Promise.all([
    readFile(new URL('index.html', siteRoot), 'utf8'),
    readFile(
      new URL('immersa/chemical-safety-training/index.html', siteRoot),
      'utf8',
    ),
    readFile(new URL('chemical-safety-vr-landing/index.html', siteRoot), 'utf8'),
    readFile(
      new URL('chemical-safety-vr-landing/light/index.html', siteRoot),
      'utf8',
    ),
    readFile(
      new URL('chemical-safety-vr-landing/campaign/index.html', siteRoot),
      'utf8',
    ),
  ]);
  const ogImage =
    'https://tycheworks.com/assets/metahorizon_og_banner_1200x630.png';

  assert.match(
    home,
    /<img src="assets\/metahorizon_hero_v2\.png" width="3000" height="900"/,
  );
  assert.doesNotMatch(home, /safety_vr_banner_(?:small|big)\.png/);
  assert.match(
    detail,
    /<img src="\.\.\/\.\.\/assets\/metahorizon_title_v2_hd\.png" width="1920" height="1080"/,
  );

  for (const html of [detail, landing, light, campaign]) {
    assert.match(html, new RegExp(`<meta property="og:image" content="${ogImage}">`));
    assert.match(html, /<meta property="og:image:width" content="1200">/);
    assert.match(html, /<meta property="og:image:height" content="630">/);
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${ogImage}">`));
  }
});
