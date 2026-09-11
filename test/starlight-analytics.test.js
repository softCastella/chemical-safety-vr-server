import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { aggregateStarlightEvents } from "../src/modules/starlight-analytics/starlight-analytics-aggregation.js";
import { sanitizeStarlightEvent } from "../src/modules/starlight-analytics/starlight-analytics-contract.js";
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

test("랜딩은 Analytics를 로드하고 UTM을 WebDemo로 전달한다", async () => {
  const root = new URL("../public/site/starlight-sudoku-landing/", import.meta.url);
  const [html, launch, analytics, config] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("landing-launch.js", root), "utf8"),
    readFile(new URL("analytics.js", root), "utf8"),
    readFile(new URL("analytics-config.js", root), "utf8"),
  ]);
  assert.match(html, /analytics-config\.js/);
  assert.match(html, /analytics\.js/);
  assert.match(launch, /decorateUrl/);
  assert.match(launch, /landing_view/);
  assert.match(launch, /landing_cta_click/);
  assert.match(analytics, /utm_source/);
  assert.match(analytics, /sessionStorage\.setItem\('starlight_utm_v1'/);
  assert.match(analytics, /return url\.href/);
  assert.match(config, /collectorUrl: "\/api\/starlight-analytics\/events\/batch"/);
  assert.match(config, /enabled: false/);
});

test("같은 Origin의 /play/ 산출물은 랜딩 식별자와 UTM을 이어받는다", async () => {
  const root = new URL("../public/site/starlight-sudoku-landing/", import.meta.url);
  const [landingLaunch, playIndex, playAnalytics, playConfig] = await Promise.all([
    readFile(new URL("landing-launch.js", root), "utf8"),
    readFile(new URL("play/index.html", root), "utf8"),
    readFile(new URL("play/analytics.js", root), "utf8"),
    readFile(new URL("play/analytics-config.js", root), "utf8"),
  ]);

  assert.match(landingLaunch, /const playUrl = "\/play\/"/);
  assert.match(landingLaunch, /url\.searchParams\.set\("lang"/);
  assert.match(landingLaunch, /decorateUrl/);
  assert.match(landingLaunch, /window\.location\.assign\(localizedPlayUrl\(\)\)/);
  assert.match(playIndex, /<base href="\/play\/">/);
  assert.match(playAnalytics, /starlight_anonymous_user_id_v1/);
  assert.match(playAnalytics, /starlight_analytics_session_id_v1/);
  assert.match(playAnalytics, /utm_source/);
  assert.match(playConfig, /collectorUrl: "\/api\/starlight-analytics\/events\/batch"/);
  assert.match(playConfig, /enabled: false/);
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
    assert.equal((await fetch(`${url}/starlight-analytics/`)).status, 401);
    assert.equal((await fetch(`${url}/starlight-analytics/dashboard.js`)).status, 401);
    const headers = { cookie: "tyche_admin_session=valid-session" };
    assert.equal((await fetch(`${url}/starlight-analytics/`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/starlight-analytics/dashboard.js`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/api/starlight-analytics/dashboard?from=2026-09-01&to=2026-09-30`)).status, 401);
    const response = await fetch(`${url}/api/starlight-analytics/dashboard?from=2026-09-01&to=2026-09-30`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).meta.product, "starlight-sudoku");
  } finally {
    await new Promise((resolve, reject) => protectedServer.close((error) => error ? reject(error) : resolve()));
  }
});
