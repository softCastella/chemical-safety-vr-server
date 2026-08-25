TYCHE WORKS — static HTML package

LOCAL / ENDPOINT STRUCTURE
- index.html                                  : TYCHE WORKS landing
- brand/index.html                            : Brand page
- immersa/index.html                          : TYCHE IMMERSA (VR/XR)
- immersa/chemical-safety-training/index.html : Chemical Safety Training VR
- spark/index.html                            : TYCHE SPARK — 준비중
- loop/index.html                             : TYCHE LOOP — 준비중

OLD ROUTES
- /vr/   -> /immersa/
- /game/ -> /spark/
- /app/  -> /loop/

SUBDOMAIN PLAN (deployment)
- tycheworks.com         -> root landing
- immersa.tycheworks.com -> /immersa
- spark.tycheworks.com   -> /spark
- loop.tycheworks.com    -> /loop

현재 패키지는 로컬 파일로도 모든 링크가 열리도록 index.html을 명시적으로 연결했습니다.
실서버에서는 호스팅/리버스프록시에서 위 폴더를 각 서브도메인 document root로 매핑하면 됩니다.
