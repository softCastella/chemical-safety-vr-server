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

test('모든 사이트 페이지는 공용 또는 프로젝트 전용 파비콘을 한 번만 참조한다', async () => {
  const immersaFaviconUrl = new URL(
    'assets/Immersa/Chemical%20Safety%20Training%20VR/favicon_round_crop.svg',
    siteRoot,
  );
  const sparkFaviconUrl = new URL('assets/Spark/favicon_round_crop.svg', siteRoot);
  const vrFaviconUrl = new URL(
    'assets/Immersa/Chemical%20Safety%20Training%20VR/safety_vr_banner_square.png',
    siteRoot,
  );
  const starlightFaviconUrl = new URL(
    'assets/Spark/Starlight%20Sudoku/Icon_Starlight_Sudoku_v4.png',
    siteRoot,
  );
  const htmlFiles = await findHtmlFiles(siteRoot);
  const faviconSvg = await readFile(immersaFaviconUrl, 'utf8');

  await Promise.all([access(immersaFaviconUrl), access(sparkFaviconUrl), access(vrFaviconUrl), access(starlightFaviconUrl)]);
  assert.match(faviconSvg, /<clipPath id="round-crop">/);
  assert.match(faviconSvg, /<circle cx="627" cy="627" r="627"\/>/);
  assert.match(faviconSvg, /clip-path="url\(#round-crop\)"/);
  assert.match(faviconSvg, /href="data:image\/png;base64,/);
  assert.equal(htmlFiles.length, 20);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    const faviconLinks = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) ?? [];

    assert.equal(faviconLinks.length, 1, `${htmlFile.pathname} favicon link count`);
    const href = faviconLinks[0].match(/\bhref="([^"]+)"/)?.[1];
    assert.ok(href, `${htmlFile.pathname} favicon href`);
    assert.ok(
      [immersaFaviconUrl.href, sparkFaviconUrl.href, vrFaviconUrl.href, starlightFaviconUrl.href].includes(new URL(href, htmlFile).href),
      `${htmlFile.pathname} favicon asset`,
    );
  }

  const projectFavicons = [
    ['immersa/chemical-safety-training/index.html', vrFaviconUrl],
    ['immersa/chemical-safety-training/plan/index.html', vrFaviconUrl],
    ['chemical-safety-vr-landing/index.html', vrFaviconUrl],
    ['spark/starlight-sudoku/index.html', starlightFaviconUrl],
    ['starlight-sudoku-landing/index.html', starlightFaviconUrl],
  ];
  for (const [relativePath, expectedFavicon] of projectFavicons) {
    const pageUrl = new URL(relativePath, siteRoot);
    const html = await readFile(pageUrl, 'utf8');
    const href = html.match(/<link\b[^>]*\brel="icon"[^>]*\bhref="([^"]+)"/)?.[1];
    assert.equal(new URL(href, pageUrl).href, expectedFavicon.href, `${relativePath} project favicon`);
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
  assert.match(html, /rel="icon" type="image\/png" href="\.\.\/\.\.\/assets\/Immersa\/Chemical%20Safety%20Training%20VR\/safety_vr_banner_square\.png"/);
});

test('화학물질 안전훈련 VR 상세페이지는 세 학습 모드의 실제 차이를 안내한다', async () => {
  const html = await readFile(
    new URL('immersa/chemical-safety-training/index.html', siteRoot),
    'utf8',
  );

  const modeSection = html.match(
    /<section class="learning-modes-section"[\s\S]*?<\/section>/,
  )?.[0] ?? '';
  const aboutSection = html.match(
    /<section class="detail-about-section"[\s\S]*?<\/section>/,
  )?.[0] ?? '';
  assert.match(html, /<span class="chip">PPE Training<\/span>/);
  assert.match(aboutSection, /화학물질 작업 전,[\s\S]*?PPE를 올바르게 선택하고 착용합니다/);
  assert.match(aboutSection, /작업계획에 맞는 개인보호구/);
  assert.match(aboutSection, /오염·손상 여부를 판별/);
  assert.match(aboutSection, /PPE 착용 안전교육입니다/);
  assert.ok(modeSection);
  assert.equal((modeSection.match(/class="learning-mode-card /g) ?? []).length, 3);
  assert.match(modeSection, /<h3>교육 모드<\/h3>[\s\S]*?상세 음성 안내[\s\S]*?정답 해설/);
  assert.match(modeSection, /<h3>훈련 모드<\/h3>[\s\S]*?오답 후 재선택[\s\S]*?반복 연습/);
  assert.match(modeSection, /<h3>테스트 모드<\/h3>[\s\S]*?첫 선택 채점[\s\S]*?결과 확인/);
  assert.match(modeSection, /선택한 작업 시나리오에 맞춰 PPE 선택·상태 판단·착용·거울 확인·5문항 퀴즈/);
  assert.match(modeSection, /현재는 밀폐공간과 누출 대응 시나리오를 제공합니다/);
  assert.doesNotMatch(modeSection, /무작위|랜덤/);
  assert.ok(
    html.indexOf('detail-about-section') < html.indexOf('learning-modes-section'),
    'PPE 착용 교육 소개는 세 학습 모드보다 먼저 표시해야 한다',
  );
  assert.ok(
    html.indexOf('learning-modes-section') < html.indexOf('id="overview"'),
    '학습 모드 안내는 상세 체험 순서보다 먼저 표시해야 한다',
  );
  assert.match(html, /<dt>학습 구성<\/dt>\s*<dd>교육 모드 · 훈련 모드 · 테스트 모드<\/dd>/);
  assert.match(html, /<dt>현재 시나리오<\/dt>\s*<dd>밀폐공간 작업 전 PPE 착용 · 화학물질 누출 대응 PPE 착용<\/dd>/);
});

test('브랜드 홈은 공용 개인정보처리방침으로 연결한다', async () => {
  const [home, brand, policy] = await Promise.all([
    readFile(new URL('index.html', siteRoot), 'utf8'),
    readFile(new URL('brand/index.html', siteRoot), 'utf8'),
    readFile(new URL('privacy/index.html', siteRoot), 'utf8'),
  ]);

  for (const html of [home, brand]) {
    assert.match(html, /href="https:\/\/tycheworks\.com\/privacy\/">개인정보처리방침<\/a>/);
  }
  assert.match(policy, /TYCHE WORKS는 웹사이트 방문자와 문의자의 개인정보/);
  assert.match(policy, /Resend 서비스를 사용/);
  assert.match(policy, /최대 14일간 보관/);
});

test('세부 라인 홈 푸터는 공용 개인정보처리방침으로 연결한다', async () => {
  const lineHomes = await Promise.all([
    readFile(new URL('immersa/index.html', siteRoot), 'utf8'),
    readFile(new URL('spark/index.html', siteRoot), 'utf8'),
    readFile(new URL('loop/index.html', siteRoot), 'utf8'),
  ]);

  for (const html of lineHomes) {
    assert.equal(
      html.match(/href="https:\/\/tycheworks\.com\/privacy\/">개인정보처리방침<\/a>/g)?.length,
      1,
    );
    assert.match(
      html,
      /<nav[^>]*><strong>COMPANY<\/strong>[\s\S]*?href="https:\/\/tycheworks\.com\/privacy\/">개인정보처리방침<\/a><\/nav>/,
    );
  }
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

  assert.match(html, /<script src="\/chemical-safety-training\/detail-share\.js\?v=20260908-1" defer><\/script>/);
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
  assert.match(script, /t1\.kakaocdn\.net\/kakao_js_sdk\/2\.8\.3\/kakao\.min\.js/);
  assert.match(script, /sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy/);
  assert.match(script, /kakaoSdk\.Share\.sendDefault/);
  assert.match(script, /imageWidth:\s*1200/);
  assert.match(script, /imageHeight:\s*630/);
  assert.doesNotMatch(script, /window\.open\s*=/);
  assert.match(script, /share\.naver\.com\/web\/shareView/);
  assert.doesNotMatch(script, /blog\.naver\.com\/openapi\/share/);
  assert.match(script, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(script, /twitter\.com\/intent\/tweet/);
  assert.match(script, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(script, /t\.me\/share\/url/);
  assert.match(script, /social-plugins\.line\.me\/lineit\/share/);
  assert.match(script, /navigator\.clipboard\.writeText\(shareUrl\)/);
  assert.match(script, /event\.key === "Escape"/);
});

test('브랜드 페이지 패밀리의 상단 내비게이션은 모바일에서도 동일한 타이포와 전체 메뉴를 유지한다', async () => {
  const [siteCss, immersaCss, sparkCss, loopCss] = await Promise.all([
    readFile(new URL('styles.css', siteRoot), 'utf8'),
    readFile(new URL('immersa/immersa.css', siteRoot), 'utf8'),
    readFile(new URL('spark/spark.css', siteRoot), 'utf8'),
    readFile(new URL('line-coming.css', siteRoot), 'utf8'),
  ]);

  for (const [name, css, selector] of [
    ['TYCHE', siteCss, '.nav'],
    ['IMMERSA', immersaCss, '.vr-nav'],
    ['SPARK', sparkCss, '.spark-nav'],
    ['LOOP', loopCss, '.line-nav'],
  ]) {
    const escapedSelector = selector.replace('.', '\\.');
    const rule = css.match(new RegExp(`${escapedSelector}\\{([^}]+)\\}`));
    assert.ok(rule, `${name} 내비게이션 기본 규칙이 필요하다`);
    assert.match(rule[1], /color:#66707b/);
    assert.match(rule[1], /font-size:12px/);
    assert.match(rule[1], /font-weight:800/);
    assert.match(rule[1], /line-height:1\.2/);
    assert.match(rule[1], /letter-spacing:\.08em/);
    assert.match(rule[1], /text-transform:uppercase/);
  }

  assert.doesNotMatch(siteCss, /\.nav a:nth-child\([^)]*\)[^{]*\{display:none\}/);
  assert.doesNotMatch(immersaCss, /\.vr-nav a:nth-child\([^)]*\)[^{]*\{display:none\}/);
  assert.doesNotMatch(loopCss, /\.line-nav a:nth-child\([^)]*\)[^{]*\{display:none\}/);
  assert.match(sparkCss, /\.spark-nav a\{display:block!important\}/);

  for (const css of [siteCss, immersaCss, sparkCss, loopCss]) {
    assert.match(css, /flex:1 0 100%/);
    assert.match(css, /flex-wrap:wrap/);
    assert.match(css, /white-space:nowrap/);
  }
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
    'https://tycheworks.com/assets/Immersa/Chemical%20Safety%20Training%20VR/metahorizon_og_banner_1200x630.png';

  assert.match(
    home,
    /<img src="assets\/Immersa\/Chemical%20Safety%20Training%20VR\/metahorizon_hero_v2\.png" width="3000" height="900"/,
  );
  assert.doesNotMatch(home, /safety_vr_banner_(?:small|big)\.png/);
  assert.match(
    detail,
    /<img src="\.\.\/\.\.\/assets\/Immersa\/Chemical%20Safety%20Training%20VR\/metahorizon_title_v2_hd\.png" width="1920" height="1080"/,
  );

  for (const html of [detail, landing, light, campaign]) {
    assert.match(html, new RegExp(`<meta property="og:image" content="${ogImage}">`));
    assert.match(html, /<meta property="og:image:width" content="1200">/);
    assert.match(html, /<meta property="og:image:height" content="630">/);
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${ogImage}">`));
  }
});
