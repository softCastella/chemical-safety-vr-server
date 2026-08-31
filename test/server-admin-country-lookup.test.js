import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createServerAdminCountryLookup } from "../src/modules/server-admin/server-admin-country-lookup.js";

test("국가 조회가 꺼져 있으면 이벤트를 변경하거나 데이터베이스를 열지 않는다", async () => {
  let opened = false;
  const service = createServerAdminCountryLookup({
    enabled: false,
    maxmindImpl: { async open() { opened = true; } },
  });
  const events = [{ id: 1, ipAddress: "8.8.8.8" }];

  assert.equal(service.enabled, false);
  assert.equal(await service.enrichEvents(events), events);
  assert.equal(opened, false);
});

test("국가 조회 활성화에는 GeoLite2 데이터베이스 경로가 필요하다", () => {
  assert.throws(
    () => createServerAdminCountryLookup({ enabled: true, databasePath: "" }),
    /GEOLITE2_COUNTRY_DB_PATH/,
  );
});

test("GeoLite2 결과를 한국어 국가명과 ISO 코드로 변환하고 자동 재로딩을 켠다", async () => {
  const calls = [];
  const service = createServerAdminCountryLookup({
    enabled: true,
    databasePath: "/var/lib/GeoIP/GeoLite2-Country.mmdb",
    maxmindImpl: {
      validate(value) { return value === "8.8.8.8"; },
      async open(databasePath, options) {
        calls.push({ databasePath, options });
        return {
          get() {
            return { country: { iso_code: "US", names: { ko: "미국", en: "United States" } } };
          },
        };
      },
    },
  });

  const events = await service.enrichEvents([
    { id: 1, ipAddress: "8.8.8.8" },
    { id: 2, ipAddress: "invalid" },
  ]);

  assert.equal(events[0].countryName, "미국 (US)");
  assert.equal(events[1].countryName, "확인 불가");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].databasePath, "/var/lib/GeoIP/GeoLite2-Country.mmdb");
  assert.equal(calls[0].options.watchForUpdates, true);
  assert.equal(calls[0].options.watchForUpdatesNonPersistent, true);
});

test("GeoLite2 파일을 열 수 없으면 실패 상태를 반환하고 다음 조회에서 재시도한다", async () => {
  let attempts = 0;
  const errors = [];
  const service = createServerAdminCountryLookup({
    enabled: true,
    databasePath: "/missing.mmdb",
    maxmindImpl: {
      validate() { return true; },
      async open() { attempts += 1; throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
    },
    logger: { error(...args) { errors.push(args); } },
  });

  const first = await service.enrichEvents([{ id: 1, ipAddress: "8.8.8.8" }]);
  const second = await service.enrichEvents([{ id: 2, ipAddress: "1.1.1.1" }]);

  assert.equal(first[0].countryName, "국가 조회 실패");
  assert.equal(second[0].countryName, "국가 조회 실패");
  assert.equal(attempts, 2);
  assert.equal(errors.length, 1);
});

test("인증된 보안 이벤트 API가 국가 조회 결과를 포함한다", async (context) => {
  const repository = {
    async findSession() { return { admin_id: 3, username: "admin", role: "admin" }; },
    async listSecurityEvents() {
      return { items: [{ id: 7, ipAddress: "8.8.8.8" }], total: 1, page: 1, pageSize: 20 };
    },
  };
  const app = createApp({
    enableServerAdmin: true,
    serverAdminRepository: repository,
    serverAdminCountryLookupService: {
      enabled: true,
      async enrichEvents(events) {
        return events.map((event) => ({ ...event, countryName: "미국 (US)" }));
      },
    },
    serverAdminPushService: { enabled: false, publicKey: "", async send() {} },
    enableUserCrud: false,
    enableTrainingRegistration: false,
    enableLocalTelemetryRead: false,
    enableTrainingTelemetryIngest: false,
    enableContactForm: false,
  });
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/server-status/security-events`, {
    headers: { cookie: "tyche_admin_session=test" },
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).items[0].countryName, "미국 (US)");
});
