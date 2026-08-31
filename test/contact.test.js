import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { createResendContactMailer } from "../src/modules/contact/resend-contact-mailer.js";

const siteRoot = new URL("../public/site/", import.meta.url);
const deliveries = [];
let server;
let baseUrl;

function validPayload(overrides = {}) {
  return {
    name: "홍길동",
    email: "Visitor@Example.com",
    inquiryType: "business",
    message: "VR 안전교육 도입에 대해 문의드립니다.",
    website: "",
    ...overrides,
  };
}

async function listen(app) {
  const listeningServer = app.listen(0);
  await new Promise((resolve) => listeningServer.once("listening", resolve));
  return listeningServer;
}

async function close(listeningServer) {
  await new Promise((resolve, reject) => {
    listeningServer.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postContact(url, payload) {
  return fetch(`${url}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

before(async () => {
  server = await listen(
    createApp({
      enableUserCrud: false,
      enableContactForm: true,
      contactRateLimitPerHour: 100,
      contactMailer: {
        async send(submission) {
          deliveries.push(submission);
          return { providerMessageId: "resend-test-message" };
        },
      },
    }),
  );
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await close(server);
});

test("문의 API는 입력을 정규화해 메일을 전송한다", async () => {
  const response = await postContact(baseUrl, validPayload());
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.data.accepted, true);
  assert.match(body.data.id, /^[0-9a-f-]{36}$/);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].email, "visitor@example.com");
  assert.equal(deliveries[0].inquiryTypeLabel, "비즈니스 문의");
});

test("문의 API는 잘못된 입력과 알 수 없는 항목을 거부한다", async () => {
  const shortMessageResponse = await postContact(
    baseUrl,
    validPayload({ message: "짧음" }),
  );
  assert.equal(shortMessageResponse.status, 400);

  const unknownFieldResponse = await postContact(
    baseUrl,
    validPayload({ unexpected: true }),
  );
  assert.equal(unknownFieldResponse.status, 400);
  assert.equal(deliveries.length, 1);
});

test("숨김 입력값을 채운 봇 요청은 성공처럼 응답하고 전송하지 않는다", async () => {
  const response = await postContact(
    baseUrl,
    validPayload({ website: "https://spam.example" }),
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.data.id, null);
  assert.equal(deliveries.length, 1);
});

test("Resend 오류는 문의 전송 실패로 응답한다", async () => {
  const failingServer = await listen(
    createApp({
      enableUserCrud: false,
      enableContactForm: true,
      contactMailer: {
        async send() {
          const error = new Error("provider unavailable");
          error.code = "RESEND_UNAVAILABLE";
          throw error;
        },
      },
    }),
  );

  try {
    const response = await postContact(
      `http://127.0.0.1:${failingServer.address().port}`,
      validPayload(),
    );
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, "CONTACT_DELIVERY_FAILED");
  } finally {
    await close(failingServer);
  }
});

test("문의 API는 시간당 요청 수를 제한한다", async () => {
  const limitedServer = await listen(
    createApp({
      enableUserCrud: false,
      enableContactForm: true,
      contactRateLimitPerHour: 1,
      contactMailer: { async send() {} },
    }),
  );

  try {
    const limitedBaseUrl = `http://127.0.0.1:${limitedServer.address().port}`;
    assert.equal((await postContact(limitedBaseUrl, validPayload())).status, 202);
    const response = await postContact(limitedBaseUrl, validPayload());
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.equal(body.error.code, "CONTACT_RATE_LIMITED");
  } finally {
    await close(limitedServer);
  }
});

test("Resend 메일러는 답장 주소와 중복 방지 키를 전달한다", async () => {
  let request;
  const mailer = createResendContactMailer({
    apiKey: "re_test_only",
    fromEmail: "TYCHE 문의 <contact@mail.tycheworks.com>",
    toEmail: "owner@example.com",
    async fetchImpl(url, options) {
      request = { url, options };
      return new Response(JSON.stringify({ id: "resend-message-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await mailer.send({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "<문의자>",
    email: "visitor@example.com",
    inquiryTypeLabel: "일반 문의",
    message: "테스트 문의 내용입니다.",
  });
  const payload = JSON.parse(request.options.body);

  assert.equal(result.providerMessageId, "resend-message-id");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(
    request.options.headers["idempotency-key"],
    "contact/123e4567-e89b-12d3-a456-426614174000",
  );
  assert.equal(payload.reply_to, "visitor@example.com");
  assert.match(payload.html, /&lt;문의자&gt;/);
  assert.doesNotMatch(payload.html, /<문의자>/);
});

test("문의 기능을 켤 때 Resend 필수 설정 누락을 명확히 보고한다", () => {
  assert.throws(
    () =>
      createResendContactMailer({
        apiKey: "",
        fromEmail: "TYCHE 문의 <contact@mail.tycheworks.com>",
        toEmail: "owner@example.com",
      }),
    /RESEND_API_KEY is required when ENABLE_CONTACT_FORM is true/,
  );
});

test("홈 문의 폼은 활성 버튼과 비동기 전송 스크립트를 제공한다", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("index.html", siteRoot), "utf8"),
    readFile(new URL("contact.js", siteRoot), "utf8"),
  ]);

  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /문의 보내기/);
  assert.doesNotMatch(html, /문의 폼 준비 중/);
  assert.match(html, /placeholder="문의 내용을 입력해주세요 \(10자 이상\)"/);
  assert.match(html, /name="website"/);
  assert.match(html, /<script src="contact\.js"><\/script>/);
  assert.match(script, /fetch\(contactForm\.action/);
  assert.match(script, /"content-type": "application\/json"/);
  assert.match(script, /문의가 접수되었습니다/);
});
