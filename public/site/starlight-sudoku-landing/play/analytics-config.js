// Anonymous product analytics runs without an in-page consent prompt and remains separate from FCM consent.
window.STARLIGHT_ANALYTICS_CONFIG = Object.freeze({
  collectorUrl: "/api/starlight-analytics/events/batch",
  gaMeasurementId: "",
  enabled: true,
  debug: false
});
