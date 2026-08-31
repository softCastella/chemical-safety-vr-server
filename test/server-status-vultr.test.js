import assert from "node:assert/strict";
import test from "node:test";
import { nextInvoiceDate, readVultrBilling, serverStatusServiceTargets } from "../src/modules/server-admin/server-status.js";

const now = new Date("2026-08-27T12:00:00.000Z");

test("서비스 현황 점검 대상에 화학 안전 VR 전용 랜딩을 포함한다", () => {
  assert.ok(serverStatusServiceTargets.some((target) => (
    target.name === "VR LANDING"
    && target.host === "chemical-safety-vr.tycheworks.com"
    && target.path === "/"
  )));
});

test("Vultr 청구 예정일은 다음 달 1일 UTC로 계산한다", () => {
  assert.equal(nextInvoiceDate(now), "2026-09-01T00:00:00.000Z");
  assert.equal(nextInvoiceDate(new Date("2026-12-31T23:59:59.000Z")), "2027-01-01T00:00:00.000Z");
});

test("Vultr API 키가 없으면 외부 요청 없이 설정 누락을 반환한다", async () => {
  let called = false;
  const billing = await readVultrBilling({ apiKey: "", now, fetchImpl: async () => { called = true; } });

  assert.equal(called, false);
  assert.deepEqual(billing, {
    connected: false,
    status: "API 키 미설정",
    lastPaymentDate: null,
    nextInvoiceDate: "2026-09-01T00:00:00.000Z",
  });
});

test("Vultr Account API의 최근 결제일을 정규화한다", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://api.vultr.com/v2/account");
    assert.equal(options.headers.authorization, "Bearer test-key");
    assert.equal(options.headers.accept, "application/json");
    return {
      ok: true,
      async json() { return { account: { last_payment_date: "2026-08-03T09:10:11+00:00" } }; },
    };
  };

  assert.deepEqual(await readVultrBilling({ apiKey: "test-key", fetchImpl, now }), {
    connected: true,
    status: "Vultr API 연결됨",
    lastPaymentDate: "2026-08-03T09:10:11.000Z",
    nextInvoiceDate: "2026-09-01T00:00:00.000Z",
  });
});

test("Vultr API 오류와 네트워크 실패를 구분한다", async () => {
  const httpError = await readVultrBilling({ apiKey: "test-key", now, fetchImpl: async () => ({ ok: false, status: 401 }) });
  const networkError = await readVultrBilling({ apiKey: "test-key", now, fetchImpl: async () => { throw new Error("offline"); } });

  assert.equal(httpError.status, "Vultr API 오류 (HTTP 401)");
  assert.equal(networkError.status, "Vultr API 연결 실패");
});
