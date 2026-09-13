import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import vm from "node:vm";

import { createApp } from "../src/app.js";
import { aggregateStarlightEvents } from "../src/modules/starlight-analytics/starlight-analytics-aggregation.js";
import { sanitizeStarlightEvent } from "../src/modules/starlight-analytics/starlight-analytics-contract.js";
import { createStarlightAnalyticsRetentionMonitor } from "../src/modules/starlight-analytics/starlight-analytics-retention.js";
import { createInMemoryStarlightAnalyticsRepository } from "../test-support/in-memory-starlight-analytics-repository.js";

let server;
let baseUrl;
const repository = createInMemoryStarlightAnalyticsRepository();

function event(overrides = {}) {
  return {
    event_id: `event-${Math.random().toString(16).slice(2)}`,
    event_name: "landing_view",
    anonymous_user_id: "user-1",
    session_id: "session-1",
    platform: "web",
    timestamp: "2026-09-10T01:02:03.000Z",
    locale: "ko",
    source: "threads",
    medium: "organic_social",
    campaign: "starlight_webdemo_qa",
    content: "post_01",
    ...overrides,
  };
}

before(async () => {
  server = createApp({
    enableUserCrud: false,
    enableServerAdmin: false,
    enableStarlightAnalyticsIngest: true,
    starlightAnalyticsRepository: repository,
    starlightAnalyticsAllowedOrigins: ["https://softcastella.github.io"],
    starlightAnalyticsRateLimitPerHour: 100,
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("별빛 이벤트는 UTM과 정규화 좌표만 허용해 저장한다", () => {
  const sanitized = sanitizeStarlightEvent(event({
    event_name: "pointer_tap",
    screen_id: "title",
    x_ratio: 0.51,
    y_ratio: 0.43,
    is_interactive: false,
    properties: { interaction_kind: "wrong_input", entered_text: "저장하면 안 됨" },
  }));
  assert.equal(sanitized.source, "threads");
  assert.equal(sanitized.content, "post_01");
  assert.equal(sanitized.x_ratio, 0.51);
  assert.equal(sanitized.properties.entered_text, undefined);
});

test("별빛 수집 API는 허용 Origin과 event_id 중복 방지를 적용한다", async () => {
  const payload = { events: [event({ event_id: "threads-entry-1" })] };
  const request = () => fetch(`${baseUrl}/api/starlight-analytics/events/batch`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://softcastella.github.io" },
    body: JSON.stringify(payload),
  });
  const first = await request();
  assert.equal(first.status, 202);
  assert.deepEqual(await first.json(), { accepted: 1, duplicates: 0 });
  const duplicate = await request();
  assert.deepEqual(await duplicate.json(), { accepted: 0, duplicates: 1 });

  const rejected = await fetch(`${baseUrl}/api/starlight-analytics/events/batch`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://untrusted.example" },
    body: JSON.stringify({ events: [event()] }),
  });
  assert.equal(rejected.status, 403);
});

test("별빛 수집 API는 256 KiB를 넘는 배치를 거부한다", async () => {
  const response = await fetch(`${baseUrl}/api/starlight-analytics/events/batch`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://softcastella.github.io" },
    body: JSON.stringify({ events: [event({ padding: "x".repeat(257 * 1024) })] }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /256 KiB/);
});

test("집계는 Threads 유입과 Android No Data를 구분한다", () => {
  const rows = [
    sanitizeStarlightEvent(event({ event_id: "funnel-1", event_name: "landing_view" })),
    sanitizeStarlightEvent(event({ event_id: "funnel-2", event_name: "landing_cta_click", timestamp: "2026-09-10T01:02:05.000Z" })),
    sanitizeStarlightEvent(event({ event_id: "funnel-3", event_name: "puzzle_start", timestamp: "2026-09-10T01:02:09.000Z", stage_id: 1 })),
  ].map((item) => ({ ...item, occurred_at: item.occurred_at.toISOString() }));
  const result = aggregateStarlightEvents(rows, { dateFrom: "2026-09-10", dateTo: "2026-09-10", hasAnyData: true });
  assert.equal(result.acquisition[0].source, "threads");
  assert.equal(result.acquisition[0].start_rate, 1);
  assert.equal(result.platforms.find((item) => item.platform === "android").state, "no_data");
  assert.equal(result.funnel[0].avg_time_to_next, 2);
});

test("랜딩은 분석 동의 UI 없이 UTM을 WebDemo로 전달한다", async () => {
  const root = new URL("../public/site/starlight-sudoku-landing/", import.meta.url);
  const [html, launch, analytics, config] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("landing-launch.js", root), "utf8"),
    readFile(new URL("analytics.js", root), "utf8"),
    readFile(new URL("analytics-config.js", root), "utf8"),
  ]);
  assert.doesNotMatch(html, /analytics-consent\.css/);
  assert.doesNotMatch(html, /analytics-consent\.js/);
  assert.match(html, /analytics-config\.js/);
  assert.match(html, /analytics\.js/);
  assert.match(launch, /decorateUrl/);
  assert.match(launch, /landing_view/);
  assert.match(launch, /landing_cta_click/);
  assert.match(analytics, /utm_source/);
  assert.match(analytics, /sessionStorage\.setItem\('starlight_utm_v1'/);
  assert.match(analytics, /return url\.href/);
  assert.match(analytics, /starlightAnalyticsConsent/);
  assert.match(analytics, /consent\.onGranted\(activate\)/);
  assert.match(analytics, /isGranted:\(\)=>true/);
  assert.match(config, /collectorUrl: "\/api\/starlight-analytics\/events\/batch"/);
  assert.match(config, /enabled: true/);
});

test("별빛 익명 분석 이벤트는 90일 보유기간 기준으로 주기 삭제한다", async () => {
  const cutoffs = [];
  let scheduledCallback;
  let cancelled = false;
  const timer = { unref() {} };
  const monitor = createStarlightAnalyticsRetentionMonitor({
    repository: {
      async deleteEventsBefore(cutoff) { cutoffs.push(cutoff.toISOString()); },
    },
    retentionDays: 90,
    intervalMs: 21600000,
    now: () => Date.parse("2026-09-11T00:00:00.000Z"),
    schedule(callback, interval) {
      assert.equal(interval, 21600000);
      scheduledCallback = callback;
      return timer;
    },
    cancel(value) {
      assert.equal(value, timer);
      cancelled = true;
    },
  });

  await monitor.start();
  assert.deepEqual(cutoffs, ["2026-06-13T00:00:00.000Z"]);
  await scheduledCallback();
  assert.equal(cutoffs.length, 2);
  monitor.stop();
  assert.equal(cancelled, true);
});

test("같은 Origin의 /play/ 산출물은 랜딩 식별자와 UTM을 이어받는다", async () => {
  const root = new URL("../public/site/starlight-sudoku-landing/", import.meta.url);
  const [landingIndex, landingLaunch, playIndex, playBootstrap, playAnalytics, playConfig] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("landing-launch.js", root), "utf8"),
    readFile(new URL("play/index.html", root), "utf8"),
    readFile(new URL("play/flutter_bootstrap.js", root), "utf8"),
    readFile(new URL("play/analytics.js", root), "utf8"),
    readFile(new URL("play/analytics-config.js", root), "utf8"),
  ]);

  assert.match(landingLaunch, /const playUrl = "\/play\/"/);
  assert.match(landingLaunch, /url\.searchParams\.set\("lang"/);
  assert.match(landingLaunch, /decorateUrl/);
  assert.match(landingIndex, /target="_blank" rel="noopener noreferrer" data-play-launch/);
  assert.match(landingLaunch, /window\.open\(localizedPlayUrl\(\), "_blank", playWindowFeatures\(\)\)/);
  assert.match(landingLaunch, /const width = 390;[\s\S]*const height = 844;/);
  assert.match(landingLaunch, /if \(popup\) \{[\s\S]*event\.preventDefault\(\)/);
  assert.doesNotMatch(landingLaunch, /window\.location\.assign/);
  assert.match(playIndex, /<base href="\/play\/">/);
  assert.match(playBootstrap, /"useLocalCanvasKit":true/);
  assert.match(playAnalytics, /starlight_anonymous_user_id_v1/);
  assert.match(playAnalytics, /starlight_analytics_session_id_v1/);
  assert.match(playAnalytics, /utm_source/);
  assert.match(playAnalytics, /starlightAnalyticsConsent/);
  assert.match(playAnalytics, /consent\.onGranted\(activate\)/);
  assert.doesNotMatch(playIndex, /analytics-consent\.css/);
  assert.doesNotMatch(playIndex, /analytics-consent\.js/);
  assert.match(playConfig, /collectorUrl: "\/api\/starlight-analytics\/events\/batch"/);
  assert.match(playConfig, /enabled: true/);
  assert.match(playAnalytics, /isGranted:\(\)=>true/);
});

test("별빛 대시보드는 실제 화면 카탈로그와 앱 No Data 탭을 제공한다", async () => {
  const root = new URL("../public/starlight-analytics/", import.meta.url);
  const [html, catalog] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("screen-catalog.js", root), "utf8"),
  ]);
  assert.match(html, /data-heatmap-platform="web"/);
  assert.match(html, /앱 히트맵 영역/);
  assert.match(catalog, /title-bgm/);
  assert.match(catalog, /game-retry/);
  assert.match(catalog, /demo-complete/);
});

test("별빛 Analytics는 새 마이그레이션과 기본 비활성 환경값을 사용한다", async () => {
  const [migration, example] = await Promise.all([
    readFile(new URL("../db/migrations/017_create_starlight_analytics_events.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /UNIQUE KEY uq_starlight_analytics_event_id/);
  assert.match(migration, /CHECK \(x_ratio IS NULL OR x_ratio BETWEEN 0 AND 1\)/);
  assert.match(example, /ENABLE_STARLIGHT_ANALYTICS_INGEST=false/);
  assert.match(example, /STARLIGHT_ANALYTICS_RETENTION_DAYS=90/);
  assert.match(example, /STARLIGHT_ANALYTICS_CLEANUP_INTERVAL_SECONDS=21600/);
});

test("별빛 대시보드 화면과 조회 API는 기존 관리자 세션으로 보호한다", async () => {
  const adminRepository = {
    async findSession(token) {
      return token === "valid-session" ? { admin_id: 1, username: "viewer", role: "viewer" } : null;
    },
  };
  const protectedServer = createApp({
    enableUserCrud: false,
    enableServerAdmin: true,
    serverAdminRepository: adminRepository,
    serverAdminCountryLookupService: { async enrichEvents(rows) { return rows; } },
    serverAdminPushService: { enabled: false, publicKey: "" },
    starlightAnalyticsRepository: repository,
    enableStarlightAnalyticsIngest: false,
  }).listen(0);
  await new Promise((resolve) => protectedServer.once("listening", resolve));
  const url = `http://127.0.0.1:${protectedServer.address().port}`;
  try {
    const unauthenticatedPages = [
      ["/server/", "/server/login?next=%2Fserver%2F"],
      ["/starlight-sudoku/", "/server/login?next=%2Fstarlight-sudoku%2F"],
      ["/chemical-safety-training-vr/", "/server/login?next=%2Fchemical-safety-training-vr%2F"],
    ];
    for (const [path, location] of unauthenticatedPages) {
      const response = await fetch(`${url}${path}`, { redirect: "manual" });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), location);
    }
    assert.equal((await fetch(`${url}/server/login.css`)).status, 200);
    assert.equal((await fetch(`${url}/server/dashboard-switcher.js`)).status, 200);
    assert.equal((await fetch(`${url}/starlight-sudoku/dashboard.js`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/dashboard.css`)).status, 401);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/dashboard.js`)).status, 401);
    const headers = { cookie: "tyche_admin_session=valid-session" };
    assert.equal((await fetch(`${url}/server/`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/starlight-sudoku/`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/starlight-sudoku/dashboard.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/dashboard.css`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/chemical-safety-training-vr/dashboard.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/server`, { redirect: "manual" })).headers.get("location"), "/server/");
    assert.equal((await fetch(`${url}/starlight-sudoku`, { redirect: "manual" })).headers.get("location"), "/starlight-sudoku/");
    assert.equal((await fetch(`${url}/chemical-safety-training-vr`, { redirect: "manual" })).headers.get("location"), "/chemical-safety-training-vr/");
    assert.equal((await fetch(`${url}/server-status/`, { redirect: "manual" })).headers.get("location"), "/server/");
    assert.equal((await fetch(`${url}/starlight-analytics/`, { redirect: "manual" })).headers.get("location"), "/starlight-sudoku/");
    assert.equal((await fetch(`${url}/api/starlight-analytics/dashboard?from=2026-09-01&to=2026-09-30`)).status, 401);
    const response = await fetch(`${url}/api/starlight-analytics/dashboard?from=2026-09-01&to=2026-09-30`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).meta.product, "starlight-sudoku");
  } finally {
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("공용 관리자 로그인은 세 대시보드 중 하나를 선택해 이동한다", async () => {
  const root = new URL("../public/server-status/", import.meta.url);
  const [html, script] = await Promise.all([
    readFile(new URL("login.html", root), "utf8"),
    readFile(new URL("login.js", root), "utf8"),
  ]);

  assert.match(html, /<h1 id="login-title">관리자 대시보드<\/h1>/);
  assert.equal((html.match(/name="destination"/g) || []).length, 3);
  for (const destination of [
    "/server/",
    "/starlight-sudoku/",
    "/chemical-safety-training-vr/",
  ]) {
    assert.match(html, new RegExp(`value="${destination.replaceAll("/", "\\/")}"`));
    assert.match(script, new RegExp(`"${destination.replaceAll("/", "\\/")}"`));
  }
  assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\("next"\)/);
  assert.match(script, /dashboardDestinations\.has\(requested\)/);
  assert.match(script, /JSON\.stringify\(\{[\s\S]*username:[\s\S]*password:/);
  assert.match(script, /window\.location\.assign\(destination\)/);
  assert.doesNotMatch(script, /Object\.fromEntries/);
});

test("세 관리자 대시보드는 공용 전환 메뉴와 로그아웃을 제공한다", async () => {
  const [serverHtml, starlightHtml, vrHtml, vrDetailHtml, switcherScript, switcherCss] = await Promise.all([
    readFile(new URL("../public/server-status/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/starlight-analytics/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/dashboard/details.html", import.meta.url), "utf8"),
    readFile(new URL("../public/server-status/dashboard-switcher.js", import.meta.url), "utf8"),
    readFile(new URL("../public/server-status/dashboard-switcher.css", import.meta.url), "utf8"),
  ]);

  for (const html of [serverHtml, starlightHtml, vrHtml]) {
    assert.match(html, /data-dashboard-switcher/);
    assert.match(html, /dashboard-switcher\.css\?v=20260911-1/);
    assert.match(html, /dashboard-switcher\.js\?v=20260911-1/);
  }
  assert.match(vrHtml, /href="overview\.css\?v=20260914-2"/);
  assert.match(vrHtml, /src="overview\.js\?v=20260914-1"/);
  assert.match(vrDetailHtml, /href="dashboard\.css\?v=20260911-2"/);
  assert.match(vrDetailHtml, /src="dashboard\.js\?v=20260911-2"/);
  assert.doesNotMatch(vrHtml, /<style>/);
  assert.doesNotMatch(vrHtml, /<script>\s*[\s\S]+?<\/script>/);
  for (const destination of [
    "/server/",
    "/starlight-sudoku/",
    "/chemical-safety-training-vr/",
  ]) {
    assert.match(switcherScript, new RegExp(destination.replaceAll("/", "\\/")));
  }
  assert.match(switcherScript, /\/api\/server-status\/logout/);
  assert.match(switcherScript, /window\.location\.assign\("\/server\/login"\)/);
  assert.match(switcherCss, /@media\(max-width:760px\)/);
});

test("VR 기존 상세 화면은 일반 사용자 학습 지표와 업무용 시각 체계를 보존한다", async () => {
  const [html, script, css] = await Promise.all([
    readFile(new URL("../public/dashboard/details.html", import.meta.url), "utf8"),
    readFile(new URL("../public/dashboard/dashboard.js", import.meta.url), "utf8"),
    readFile(new URL("../public/dashboard/dashboard.css", import.meta.url), "utf8"),
  ]);

  for (const label of ["학습 현황", "모드·시나리오", "사용자별 반복", "구간별 병목", "플레이 상세"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(script, /완료 플레이 수 ÷ 해당 항목 플레이 수|과정 완료 세션 ÷ 해당 항목 플레이 수/);
  assert.match(script, /동일 사용자의 두 번째 이후 플레이 수/);
  assert.match(script, /function learningGroups\(items,kind\)/);
  assert.match(script, /function stageAggregates\(items\)/);
  assert.doesNotMatch(script, /metaAgeCategory|연령 범주/);
  assert.match(script, /앱 사용자 \$\{String\(value\)\.slice\(0,8\)\}/);
  assert.match(css, /--bg:#f3f6fa/);
  assert.match(css, /background:#102a43/);
  assert.match(css, /color-scheme:light/);

  const dashboardWithoutStartup = script.split('document.querySelectorAll("#desktopNav button")')[0];
  const context = { window: { location: { protocol: "https:" } }, result: null };
  const sessions = [
    { summary: { metaUserId: "user-a", modes: ["Education"], workPlans: ["ConfinedSpace"], courseCompleted: true } },
    { summary: { metaUserId: "user-a", modes: ["Education"], workPlans: ["ConfinedSpace"], courseCompleted: false } },
    { summary: { metaUserId: "user-b", modes: ["Education"], workPlans: ["LeakResponse"], courseCompleted: true } },
  ];
  vm.runInNewContext(
    `${dashboardWithoutStartup}\nresult = learningGroups(${JSON.stringify(sessions)}, "mode");`,
    context,
  );
  assert.equal(context.result.length, 1);
  assert.equal(context.result[0].plays, 3);
  assert.equal(context.result[0].completed, 2);
  assert.equal(context.result[0].users, 2);
  assert.equal(context.result[0].repeats, 1);
  assert.ok(Math.abs(context.result[0].rate - (2 / 3) * 100) < 0.0001);
});
