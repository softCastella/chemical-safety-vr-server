// 운영 도메인과 수집 경로를 확정한 뒤 배포 설정으로 교체한다.
// 비활성 상태에서도 UTM은 WebDemo 링크까지 유지된다.
window.STARLIGHT_ANALYTICS_CONFIG = Object.freeze({
  collectorUrl: "",
  gaMeasurementId: "",
  enabled: false,
  debug: false,
});
