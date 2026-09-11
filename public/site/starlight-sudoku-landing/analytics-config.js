// 마지막 모달 동의 흐름을 구현하고 검증하기 전까지 클라이언트 수집을 비활성화한다.
window.STARLIGHT_ANALYTICS_CONFIG = Object.freeze({
  collectorUrl: "/api/starlight-analytics/events/batch",
  gaMeasurementId: "",
  enabled: false,
  debug: false,
});
