// 수집 API 활성 여부는 서버의 ENABLE_STARLIGHT_ANALYTICS_INGEST가 결정한다.
// 랜딩과 /play/는 같은 Origin의 상대 경로를 사용한다.
window.STARLIGHT_ANALYTICS_CONFIG = Object.freeze({
  collectorUrl: "/api/starlight-analytics/events/batch",
  gaMeasurementId: "",
  enabled: false,
  debug: false,
});
