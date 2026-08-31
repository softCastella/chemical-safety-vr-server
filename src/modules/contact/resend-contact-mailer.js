function requireSetting(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${name} is required when ENABLE_CONTACT_FORM is true.`,
    );
  }
  return value.trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createText(submission) {
  return [
    "TYCHE WORKS 웹사이트 문의",
    "",
    `문의 종류: ${submission.inquiryTypeLabel}`,
    `이름: ${submission.name}`,
    `이메일: ${submission.email}`,
    "",
    "문의 내용",
    submission.message,
    "",
    `접수 ID: ${submission.id}`,
  ].join("\n");
}

function createHtml(submission) {
  const message = escapeHtml(submission.message).replaceAll("\n", "<br>");
  return `<!doctype html>
<html lang="ko">
  <body style="margin:0;padding:24px;background:#f4f7fa;color:#1d2630;font-family:Arial,'Noto Sans KR',sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:28px;border:1px solid #e0e7ee;border-radius:18px;background:#fff">
      <p style="margin:0 0 8px;color:#2878ff;font-size:12px;font-weight:700;letter-spacing:.08em">TYCHE WORKS CONTACT</p>
      <h1 style="margin:0 0 24px;font-size:24px">새로운 문의가 도착했습니다.</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><th style="width:92px;padding:8px 0;text-align:left;color:#6c7782">문의 종류</th><td>${escapeHtml(submission.inquiryTypeLabel)}</td></tr>
        <tr><th style="padding:8px 0;text-align:left;color:#6c7782">이름</th><td>${escapeHtml(submission.name)}</td></tr>
        <tr><th style="padding:8px 0;text-align:left;color:#6c7782">이메일</th><td>${escapeHtml(submission.email)}</td></tr>
      </table>
      <div style="margin-top:22px;padding:18px;border-radius:12px;background:#f6f8fa;font-size:14px;line-height:1.7">${message}</div>
      <p style="margin:18px 0 0;color:#89939d;font-size:11px">접수 ID: ${escapeHtml(submission.id)}</p>
    </div>
  </body>
</html>`;
}

export function createResendContactMailer({
  apiKey,
  fromEmail,
  toEmail,
  fetchImpl = fetch,
}) {
  const resolvedApiKey = requireSetting("RESEND_API_KEY", apiKey);
  const resolvedFromEmail = requireSetting("CONTACT_FROM_EMAIL", fromEmail);
  const resolvedToEmail = requireSetting("CONTACT_TO_EMAIL", toEmail);

  return {
    async send(submission) {
      let response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${resolvedApiKey}`,
            "content-type": "application/json",
            "idempotency-key": `contact/${submission.id}`,
          },
          body: JSON.stringify({
            from: resolvedFromEmail,
            to: [resolvedToEmail],
            reply_to: submission.email,
            subject: `[TYCHE 문의] ${submission.inquiryTypeLabel} · ${submission.name}`,
            text: createText(submission),
            html: createHtml(submission),
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        error.code ??= "RESEND_NETWORK_ERROR";
        throw error;
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.id !== "string") {
        const error = new Error("Resend rejected the contact email request.");
        error.code = body.name ?? "RESEND_API_ERROR";
        error.statusCode = response.status;
        throw error;
      }

      return { providerMessageId: body.id };
    },
  };
}
