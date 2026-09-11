// 익명 제품 분석은 별도 화면 내 동의 UI 없이 수집한다. FCM 출시 알림 동의와는 분리한다.
window.STARLIGHT_ANALYTICS_CONFIG = Object.freeze({
  collectorUrl: "/api/starlight-analytics/events/batch",
  gaMeasurementId: "",
  enabled: true,
  debug: false,
});
