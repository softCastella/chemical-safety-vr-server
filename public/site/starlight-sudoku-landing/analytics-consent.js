(function (global) {
  "use strict";

  const storageKey = "starlight_analytics_consent_v1";
  const allowedStates = new Set(["granted", "denied"]);
  const grantedCallbacks = [];
  let state = readState();

  const copy = {
    ko: {
      title: "익명 이용 분석",
      body: "유입 경로와 체험판 이용 기록을 서비스 개선에 사용합니다. 이름·이메일·광고 ID는 수집하지 않으며 분석 기록은 90일 후 삭제합니다.",
      detail: "자세히",
      deny: "허용 안 함",
      allow: "허용",
    },
    en: {
      title: "Anonymous usage analytics",
      body: "We use referral and trial-play events to improve the service. We do not collect names, email addresses, or advertising IDs, and delete analytics events after 90 days.",
      detail: "Details",
      deny: "Decline",
      allow: "Allow",
    },
    ja: {
      title: "匿名利用分析",
      body: "流入経路と体験版の利用記録をサービス改善に使用します。氏名・メールアドレス・広告IDは収集せず、分析記録は90日後に削除します。",
      detail: "詳細",
      deny: "許可しない",
      allow: "許可する",
    },
    "zh-CN": {
      title: "匿名使用分析",
      body: "我们使用来源渠道和试玩事件来改进服务。不收集姓名、电子邮件地址或广告ID，分析记录将在90天后删除。",
      detail: "查看详情",
      deny: "不允许",
      allow: "允许",
    },
    "zh-TW": {
      title: "匿名使用分析",
      body: "我們使用來源管道與試玩事件來改善服務。不收集姓名、電子郵件地址或廣告ID，分析記錄將於90天後刪除。",
      detail: "查看詳情",
      deny: "不允許",
      allow: "允許",
    },
  };

  function readState() {
    try {
      const value = global.localStorage.getItem(storageKey);
      return allowedStates.has(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeState(value) {
    state = value;
    try { global.localStorage.setItem(storageKey, value); } catch (_) {}
    document.getElementById("starlight-analytics-consent")?.remove();
    if (value === "granted") {
      grantedCallbacks.splice(0).forEach((callback) => callback());
    } else {
      grantedCallbacks.length = 0;
    }
  }

  function resolveLocale() {
    const requested = new URLSearchParams(global.location.search).get("lang");
    const value = requested || document.documentElement.lang || navigator.language || "ko";
    if (/^zh-(?:CN|Hans)/i.test(value)) return "zh-CN";
    if (/^zh-(?:TW|Hant)/i.test(value)) return "zh-TW";
    if (/^ja/i.test(value)) return "ja";
    if (/^en/i.test(value)) return "en";
    return "ko";
  }

  function privacyUrl(locale) {
    const url = new URL("https://spark.tycheworks.com/starlight-sudoku/privacy/");
    if (locale !== "ko") url.searchParams.set("lang", locale);
    return url.href;
  }

  function prompt() {
    if (state || document.getElementById("starlight-analytics-consent")) return;
    const locale = resolveLocale();
    const text = copy[locale];
    const panel = document.createElement("section");
    panel.id = "starlight-analytics-consent";
    panel.className = "analytics-consent";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "analytics-consent-title");
    panel.innerHTML = `
      <div class="analytics-consent-copy">
        <strong id="analytics-consent-title">${text.title}</strong>
        <p>${text.body} <a href="${privacyUrl(locale)}" target="_blank" rel="noopener noreferrer">${text.detail}</a></p>
      </div>
      <div class="analytics-consent-actions">
        <button type="button" data-analytics-consent="denied">${text.deny}</button>
        <button type="button" class="primary" data-analytics-consent="granted">${text.allow}</button>
      </div>`;
    panel.querySelectorAll("[data-analytics-consent]").forEach((button) => {
      button.addEventListener("click", () => writeState(button.dataset.analyticsConsent));
    });
    document.body.appendChild(panel);
  }

  function onGranted(callback) {
    if (state === "granted") callback();
    else if (state !== "denied") grantedCallbacks.push(callback);
  }

  global.starlightAnalyticsConsent = Object.freeze({
    isGranted: () => state === "granted",
    isDenied: () => state === "denied",
    onGranted,
    prompt,
  });
})(window);
