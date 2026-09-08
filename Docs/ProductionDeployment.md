# Tyche Works 운영 배포 구성

이 문서는 Vultr Ubuntu 운영 서버에 적용된 Tyche Works 웹사이트 배포 구성과 현재 검증 범위를 기록한다. 운영 자격 증명, 개인키와 비밀번호는 이 문서와 저장소에 기록하지 않는다.

## 저장소와 실행 환경

- 서버 프로젝트 경로: `/home/linuxuser/workspace/chemical-safety-vr`
- Git 원격 저장소: `https://github.com/softCastella/chemical-safety-vr-server.git`
- 기준 브랜치: `main`
- 최초 배포 기준 커밋: `f6a9ed95969df122724efdf01a003e8ce9201d6e`
- Node.js: `v22.22.1`
- npm: `9.2.0`
- Nginx: `1.28.3`
- 애플리케이션 프로세스: PM2의 `tyche-safety-training-server`, 내부 포트 `3000`

정적 사이트는 Nginx가 `public/site` 아래 파일을 직접 제공한다. Express는 API를 담당하며 외부에서 포트 3000에 직접 접근시키지 않는다.

## 공개 URL과 파일 매핑

| 공개 URL | 저장소 파일 또는 디렉터리 |
| --- | --- |
| `https://tycheworks.com/` | `public/site/index.html` |
| `https://tycheworks.com/brand` | `public/site/brand/index.html` |
| `https://tycheworks.com/privacy/` | `public/site/privacy/index.html` |
| `https://immersa.tycheworks.com/` | `public/site/immersa/index.html` |
| `https://immersa.tycheworks.com/chemical-safety-training` | `public/site/immersa/chemical-safety-training/index.html` |
| `https://spark.tycheworks.com/` | `public/site/spark/index.html` |
| `https://spark.tycheworks.com/starlight-sudoku` | `public/site/spark/starlight-sudoku/index.html` |
| `https://spark.tycheworks.com/starlight-sudoku/privacy/` | `public/site/spark/starlight-sudoku/privacy/index.html` |
| `https://starlight-sudoku.tycheworks.com/` | `public/site/starlight-sudoku-landing/index.html` |
| `https://loop.tycheworks.com/` | `public/site/loop/index.html` |

사이트 내부 링크는 위 정식 HTTPS URL을 사용한다. `#contact`와 `#featured-releases`처럼 `#`이 붙은 값은 API가 아니라 같은 HTML 문서 안의 요소로 이동하는 앵커다.

개인정보처리방침은 서비스 범위별로 구분한다. 브랜드 홈의 공용 방침은 웹 문의 양식과 일반 접속 로그를 다루고, 화학물질 안전훈련 VR 상세페이지는 기존 VR 전용 공개 방침으로 연결한다. 별빛 스도쿠 상세페이지는 5개 언어를 지원하는 전용 방침으로 연결한다. 별빛 스도쿠 전용 방침은 현재 사전 공개 웹페이지에서 확인된 언어 설정과 웹 로그만 확정 사실로 기재하며, 출시 앱의 최종 권한·SDK·데이터 흐름은 출시 빌드 검증 후 Google Play 데이터 보안 양식과 함께 갱신한다.

대시보드는 현재 공개 대상이 아니다. Nginx에서 `https://tycheworks.com/dashboard/` 요청은 `404`로 처리한다.

## DNS와 HTTPS

- 도메인 등록기관: 가비아
- 권한 네임서버: `ns1.vultr.com`, `ns2.vultr.com`
- 루트 A 레코드: `158.247.238.180`
- 와일드카드 CNAME: `*` → `tycheworks.com`
- 인증서 발급 도구: Certbot 및 Let's Encrypt
- 인증서 대상: `tycheworks.com`, `www.tycheworks.com`, `immersa.tycheworks.com`, `spark.tycheworks.com`, `loop.tycheworks.com`, `admin.tycheworks.com`
- 현재 인증서 만료일: 2026-11-25
- Certbot 자동 갱신 타이머와 갱신 모의시험을 확인했다.

HTTP 요청은 HTTPS로 전환한다. 서버 내부 DNS 캐시에 이전 조회 결과가 남을 수 있으므로, 운영 확인이 필요할 때는 공용 DNS 결과와 실제 HTTPS 응답을 함께 확인한다.

## Nginx와 네트워크 보안

- 활성 설정: `/etc/nginx/sites-available/tycheworks`
- 활성 링크: `/etc/nginx/sites-enabled/tycheworks`
- 관리자 사이트 설정: `/etc/nginx/sites-available/tycheworks-admin`
- Ubuntu 기본 사이트는 비활성화했다. 원본 설정 파일은 삭제하지 않았다.
- 알 수 없는 Host 요청은 기본 서버에서 `444`로 종료한다.
- `/api/health`는 Express로 프록시한다.
- 공개하지 않은 `/api/` 경로는 `404`로 제한한다.
- 요청 속도 제한을 사이트 전체와 문의 경로에 적용했다.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP 보안 헤더를 적용했다.
- UFW는 SSH와 Nginx HTTP/HTTPS만 허용한다.

Nginx 설정을 변경할 때에는 먼저 다음 검사를 통과시킨 뒤 다시 불러온다.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 크롤러와 문의 폼

`public/site/robots.txt`에는 정상 검색엔진의 일반 접근은 허용하면서 알려진 AI 학습·데이터 수집 사용자 에이전트에 수집 거부 의사를 표시했다. `robots.txt`는 자발적으로 규칙을 지키는 봇에만 유효하므로 악성 수집기를 강제로 막는 보안 장치는 아니다. 강제 방어는 Nginx 속도 제한, 방화벽과 추후 필요 시 CDN/WAF 규칙으로 보완한다.

문의 UI는 `POST /api/contact`를 호출하며 `ENABLE_CONTACT_FORM=true`일 때만 서버 라우트가 활성화된다.
운영 메일은 Resend API로 전달한다. 서버는 허용 필드만 받고 이름·이메일·문의 종류·문의 내용의 형식과
길이를 검사하며, 문의 내용은 10자 이상 5,000자 이하로 제한한다. 시간당 IP 요청 제한과 숨김
`website` 입력을 이용한 허니팟을 적용했고, 전송 실패 로그에는 이름·이메일·문의 본문을 기록하지 않는다.
Resend API 키와 실제 발신·수신 주소는 저장소 밖 운영 `.env`에서만 관리한다.

상세페이지 공유 모달의 `이메일`은 문의 폼과 별개다. 사용자의 기본 메일 프로그램을 여는 `mailto:`
링크이며 Resend나 서버 API를 호출하지 않는다.

## 브랜드 사이트 보안·SEO 감사 (2026-09-07)

이 절은 브랜드 홈과 프로젝트 랜딩의 운영 응답, `public/site` 전체 정적 소스, 사이트가 호출하는 공개 API와
운영 의존성을 함께 점검한 재현 가능한 감사 기록이다. 기준 코드는 `main@55eeb017beeda4e4e4c8c78aa5b881e75ae13749`이며,
이 결과가 위의 초기 `npm audit` 및 공개 URL 검증 기록보다 최신이다. 이번 감사에서는 운영 배포, Nginx 다시
불러오기와 운영 데이터 변경을 수행하지 않았다.

### 확인된 정상 항목

- 여섯 공개 호스트는 HTTP 요청을 HTTPS로 `301` 전환하고 HTTPS 본문을 `200`으로 제공했다.
- 운영 응답에는 `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, 카메라·마이크·위치·결제를 차단하는
  `Permissions-Policy`가 적용돼 있다.
- 공개 `tycheworks.com/dashboard`와 `tycheworks.com/api/local-telemetry`는 각각 `404`였다.
- 문의 API는 허용 필드, 자료형, 길이, 이메일 형식과 문의 종류를 검사한다. 숨김 필드 허니팟과 IP별 시간당
  제한도 적용한다. 메일 제목·본문에 들어가는 사용자 값은 HTML 이스케이프하고 개인정보를 오류 로그에
  기록하지 않는다.
- 정적 사이트에서 URL·해시·로컬 저장소 값을 `eval`, `document.write` 또는 동적 스크립트로 실행하는 경로는
  발견하지 않았다. 별빛 스도쿠의 두 `innerHTML` 사용처는 허용 목록으로 정규화한 언어 키와 코드에 고정된
  번역 사전만 사용한다. 현재 외부 입력으로 HTML을 주입할 수 있는 경로는 확인되지 않았지만, 번역 사전에
  HTML을 추가할 때 실행 태그가 섞이지 않도록 계속 제한해야 한다.
- 새 창 링크에는 `noopener noreferrer`가 있고, 카카오 SDK는 고정 버전·SRI 무결성 값·`crossorigin`을 사용한다.
- DB 런타임 쿼리는 사용자 값을 `mysql2.execute` 매개변수로 전달한다. 고정 허용 목록에서 조합하는 컬럼 외에
  사용자 입력을 SQL 문자열에 직접 붙이는 경로는 발견하지 않았다.
- 추적 파일에서 운영 키나 개인키 패턴은 발견되지 않았고 실제 `.env`와 `node_modules`는 Git에서 제외돼 있다.
- 현재 기준 `npm test`는 77개가 통과했고 실패는 0개였다.

### 보안과 봇 처리에서 보완할 항목

1. 여섯 공개 호스트의 HTTPS 응답에 `Strict-Transport-Security`가 없다. HTTP 전환은 정상이나, 브라우저가
   한 번 HTTPS 정책을 기억한 뒤 다운그레이드를 거부하게 하는 HSTS 보호가 빠져 있다. 모든 실제 서브도메인의
   TLS 상태를 확인한 다음 짧은 `max-age`로 시작해 단계적으로 늘리고, `includeSubDomains`와 `preload`는 전체
   서브도메인 준비가 끝난 뒤 별도로 결정한다.
2. 운영 의존성 검사에서 Express 5.2.1의 전이 의존성 `qs@6.15.3`에 서비스 거부 관련 보통 심각도 취약점
   2건이 보고됐다. 현재 앱은 URL 인코딩 본문 파서를 등록하지 않고 JSON 본문만 사용하므로 브랜드 문의
   경로에서 해당 파서가 직접 노출된 사실은 확인되지 않았다. `npm audit fix --omit=dev --dry-run`은 다른
   패키지 변경 없이 `qs@6.16.0`으로 갱신하는 수정안을 제시했다.
3. 대부분 호스트의 CSP `script-src`에 `'unsafe-inline'`이 남아 있다. 공개 HTML에는 인라인 스크립트와 이벤트
   속성이 없어서 현재 소스 기준으로는 제거 가능성이 높다. IMMERSA에 필요한 인라인 스타일과 카카오 허용
   출처를 분리한 뒤 Report-Only 확인을 거쳐 스크립트 정책만 강화한다.
4. 운영 응답은 `Server: nginx/1.28.3 (Ubuntu)`로 정확한 버전을 노출한다. 공격 경로 자체는 아니지만
   `server_tokens off`로 불필요한 버전 정보를 줄일 수 있다.
5. `robots.txt`는 일반 검색 크롤러를 허용하고 GPTBot·ClaudeBot·CCBot 등 학습·수집 봇을 차단한다.
   `OAI-SearchBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`은 일반 허용 규칙을 적용받으므로 AI 검색
   노출은 막지 않는다. 반면 Apple의 학습 제어 토큰 `Applebot-Extended`가 없어 현재 문서에 적은 “AI 학습
   거부” 정책을 완전히 구현하지 못한다. `Google-Extended` 차단은 Google 검색 순위에는 영향을 주지 않지만
   Gemini 학습뿐 아니라 Gemini 검색 기반 그라운딩에도 적용되므로, AI 답변 노출을 원하면 정책 선택이 필요하다.
6. Nginx 사이트 전체 속도 제한은 운영 문서에만 있고, 실제 주 설정 `/etc/nginx/sites-available/tycheworks`는
   저장소에 없다. 저장소에서 재현 가능한 설정은 별빛 스도쿠 전용 호스트 파일 하나뿐이어서 다른 호스트의
   보안 헤더·속도 제한·리다이렉트 변경 이력을 코드 리뷰로 검증할 수 없다.

### SEO와 검색 노출에서 보완할 항목

1. 여섯 호스트 모두 `/sitemap.xml`이 `404`이고 공용 `robots.txt`에도 `Sitemap:` 항목이 없다. 호스트별로
   검색에 노출할 정식 URL만 담은 사이트맵을 만들고 각 호스트의 `robots.txt` 또는 Search Console에서 제출해야 한다.
2. 운영 공개 페이지 13개 중 별빛 스도쿠 전용 랜딩 한 곳만 `rel="canonical"`을 제공한다. 나머지 12개는
   self-canonical이 없다. `/index.html`, 디렉터리 슬래시 유무처럼 같은 문서를 제공하는 URL도 다수 `200`으로
   열려 있어 검색 신호가 나뉠 수 있다. Nginx 영구 리다이렉트와 HTML canonical을 같은 정식 URL로 맞춘다.
3. 운영에서 다음 이전 경로가 모두 `200`이고 `noindex`도 없다.
   - `/app/`, `/game/`, `/vr/`: HTML meta refresh 방식의 이전 이동 페이지
   - `/brand-v2/`, `/immersa/chemical-safety-training-promo/`: 내비게이션에 연결하지 않은 검토용 시안
   - `/chemical-safety-vr-landing/`: 전용 서브도메인과 같은 랜딩 파일을 노출하는 이전 경로

   이동이 확정된 세 경로와 이전 랜딩은 Nginx `301`로 정식 URL에 합치고, 검토용 시안은 공개 루트에서
   제거하거나 인증을 적용한다. 검색 제외만 필요하면 크롤링을 허용한 상태에서 `noindex` 응답을 제공한다.
   `robots.txt` 차단만으로는 이미 알려진 URL의 검색 제외를 보장하지 않는다.
4. 브랜드 홈, BRAND, IMMERSA 홈, LOOP와 개인정보처리방침은 Open Graph·Twitter 미리보기 메타데이터가 없고,
   일부 프로젝트 페이지도 `og:url`, 이미지 크기 또는 Twitter 제목·설명이 빠져 있다. LOOP는 일반 검색용
   meta description도 없다. 공유 대상 페이지부터 제목·설명·대표 이미지를 정식 URL과 함께 통일한다.
5. 조직·브랜드·게임 또는 소프트웨어를 설명하는 JSON-LD 구조화 데이터가 전체 페이지에 없다. 이는 필수
   색인 조건은 아니며, 실제 공개 정보와 일치하는 `Organization`, `WebSite`, `SoftwareApplication` 범위만
   선별해 추가한다.
6. 별빛 스도쿠의 다섯 언어는 `?lang=`와 클라이언트 JavaScript로 전환한다. `hreflang`이 없고 전용 랜딩은
   언어를 바꿔도 description·Open Graph·Twitter 메타가 한국어로 남는다. 언어별 검색 노출이 목표라면 고정
   언어 URL과 서버가 반환하는 번역 메타데이터가 필요하다. 한 URL의 사용자 편의용 언어 전환만 목표라면
   현재 root canonical을 유지하고 그 한계를 문서화한다.

### 전송 성능과 검색 경험

운영 정적 응답은 HTTP/1.1로 제공되며 CSS·JavaScript·이미지에 명시적 `Cache-Control` 또는 `Expires`가 없다.
텍스트 정적 파일도 gzip 또는 Brotli 압축 응답을 하지 않았다. 페이지는 화면 크기보다 훨씬 큰 1~6MB PNG를
다수 내려받으며, Lighthouse가 추정한 이미지 절감 가능 용량은 브랜드 홈 약 1.8MB, 별빛 전용 랜딩 약 6.4MB,
IMMERSA 상세 약 16.3MB, SPARK 상세 약 6.0MB였다.

| 직렬 모바일 Lighthouse 대상 | Performance | SEO | LCP |
| --- | ---: | ---: | ---: |
| `https://tycheworks.com/` | 73 | 100 | 11.8초 |
| `https://starlight-sudoku.tycheworks.com/` | 59 | 100 | 40.2초 |
| `https://immersa.tycheworks.com/chemical-safety-training` | 49 | 100 | 41.8초 |
| `https://spark.tycheworks.com/starlight-sudoku/` | 70 | 100 | 12.2초 |

위 값은 단일 개발 PC에서 측정한 실험실 결과이며 실제 사용자 현장 지표가 아니다. 별빛 측정에는 느린 CPU
경고도 있었다. 다만 모든 측정에서 대형 이미지와 캐시 부재가 반복됐으므로 원인 자체는 재현됐다. Lighthouse의
SEO 기본 점수는 canonical, 사이트맵과 공유 메타 완전성을 검사하지 않으므로 100점이 위 SEO 누락을 반박하지 않는다.
대표 이미지를 AVIF/WebP와 화면별 `srcset`으로 제공하고, 실제 렌더 크기에 맞춘 파일을 사용한다. 버전이 붙은
정적 자산에는 장기 immutable 캐시를, HTML에는 재검증 정책을 적용하고 HTTP/2를 활성화한 뒤 같은 조건으로 다시 측정한다.

### 2026-09-07 저장소 반영

이번 감사에서 확인한 항목 가운데 저장소에서 바로 고칠 수 있는 부분은 다음과 같이 반영했다.

1. `qs`를 6.16.0으로 갱신하고 `npm audit --omit=dev` 결과 알려진 취약점 0건을 확인했다.
2. 여섯 공개 호스트의 사이트맵을 추가하고 공용 `robots.txt`에 사이트맵 위치를 선언했다. 일반 검색
   크롤러는 계속 허용하고 `Applebot-Extended`, `AhrefsBot`, `SemrushBot`은 수집 거부 목록에 추가했다.
   `robots.txt`는 자발적으로 준수하는 봇에 대한 정책이므로 악성 수집 방어는 속도 제한·방화벽·WAF에서
   별도로 다뤄야 한다.
3. 공개 페이지에 canonical과 공유 메타데이터를 보완하고, 이전 경로에는 canonical과 Nginx `301` 초안을,
   공개하지 않을 시안에는 `noindex`와 Nginx `404` 초안을 추가했다.
   화학물질 안전훈련의 `/light/`와 `/campaign/`은 같은 제품의 디자인 변형이므로 `noindex,follow`와 대표
   랜딩 canonical을 적용하고 사이트맵에서는 제외했다.
4. `server_tokens off`, HTTP/2, 단계적 HSTS, gzip과 정적 자산 캐시를 공용으로 적용할 수 있는
   `ops/nginx/tycheworks-public-hardening.conf`를 추가했다. 실제 주 호스트 설정에서 include한 뒤
   `nginx -t`와 운영 응답 헤더를 확인해야 적용 완료로 볼 수 있다.
5. 색인 대상 브랜드·프로젝트 페이지에 실제 공개 정보만 사용한 `Organization`, `WebSite`, `AboutPage`,
   `VideoGame`, `SoftwareApplication` JSON-LD를 추가했다.
6. 별빛 스도쿠 랜딩의 CTA 이미지를 한국어·영어·일본어·중국어 간체·번체별로 연결하고, CTA로 여는
   GitHub Pages 웹 데모에 선택 언어를 `lang` 쿼리로 전달한다. 일본어 제품명은 `星明かりの数独`으로
   랜딩·상세·개인정보처리방침·웹 데모와 Android 리소스에서 통일했다. 랜딩과 상세 페이지에는 다섯 언어의
   `hreflang` 및 `x-default`를 선언하고, 언어 전환 시 canonical·description·Open Graph·Twitter·JSON-LD도
   선택 언어와 같은 값으로 갱신한다.
7. 웹 데모에는 검색 중복을 막는 `noindex`와 공식 랜딩 canonical을 추가했다. GitHub Pages는 저장소에서
   임의 응답 헤더를 설정할 수 없으므로 CSP 등 강제 응답 헤더는 별도 프록시나 커스텀 호스팅이 필요하다.
8. 스도쿠 풀이 로직이 이미 완성된 잘못된 보드를 해답으로 인정하지 않도록 행·열·블록 유효성 검사를
   추가했고, 손상된 로컬 진행 JSON은 시작 실패 대신 해당 스냅샷을 폐기하도록 보완했다.

이 저장소 반영 시점에는 운영 배포, Nginx include·reload, Search Console 사이트맵 제출이 포함되지 않았다.

### 2026-09-07 공용 Nginx hardening 운영 적용

1. `tycheworks.com`(및 `www`), `immersa`, `spark`, `loop`, `chemical-safety-vr`의 다섯 HTTPS 서버 블록에
   `ops/nginx/tycheworks-public-hardening.conf` include를 추가했다. 기존 별빛 스도쿠 호스트까지 포함해 여섯 공개
   호스트가 같은 `server_tokens off`, HTTP/2, `Strict-Transport-Security: max-age=86400`, gzip 정책을 사용한다.
2. 정적 자산은 `expires -1`로 로컬 캐시를 보관하면서 ETag 재검증을 강제한다. 따라서 같은 URL의 이미지·CSS·JS를
   교체해도 다음 요청에서 변경된 파일만 자동으로 다시 받는다. 공용 정규식보다 우선하는 SPARK·LOOP의
   `line-coming.css`와 IMMERSA·SPARK·LOOP의 공용 이미지 `alias /assets/`도 같은 정책을 사용하며,
   후자는 `location ^~ /assets/`로 정규식에 가로채이지 않게 한다. HTML과 API 응답은 이 규칙의 대상이 아니다.
3. 적용 전 `/etc/nginx/sites-available/`의 세 사이트 설정을 백업했고, `nginx -t` 통과 후 reload했다. 여섯 호스트의
   HTTPS 응답에서 HSTS와 `Server: nginx`(버전 미노출), 대표 정적 자산에서 `Cache-Control: no-cache`와 ETag를 확인했다.
   HSTS에는 아직 `includeSubDomains` 또는 `preload`를 사용하지 않는다.

### 권장 적용 순서와 남은 운영 검증

1. `Google-Extended`는 Gemini 검색 기반 노출 정책을 정한 뒤 유지 또는 변경한다.
2. 대형 이미지를 변환하고 캐시·HTTP/2 적용 후 Lighthouse를 재실행한다. Search Console에서는 각 호스트
   소유권, 사이트맵 처리, URL 검사, 페이지 색인과 보안 문제 보고서를 별도로 확인한다.

### WWW 대표 URL 통합

Google Search Console은 `https://www.tycheworks.com/`을 `https://tycheworks.com/`과 내용이 같은
중복 페이지로 발견했다. HTTP 주소 두 개가 HTTPS로 이동하는 것은 의도한 동작이지만, 기존 HTTPS 서버
블록은 `www`와 루트 도메인에 같은 HTML을 `200`으로 제공해 검색 신호가 나뉠 수 있었다.

`ops/nginx/tycheworks-www-canonical-redirect.patch`는 다음 두 경로를 모두 경로와 쿼리를 보존한
단일 `301` 응답으로 대표 URL에 통합한다.

- `http://www.tycheworks.com/*` → `https://tycheworks.com/*`
- `https://www.tycheworks.com/*` → `https://tycheworks.com/*`

루트 도메인 `https://tycheworks.com/*`의 기존 정적 페이지와 API 동작은 변경하지 않는다. 적용 전 활성
Nginx 설정을 별도 백업하고, 패치 기준 줄이 운영 설정과 일치하는지 확인한 다음 `nginx -t` 통과 시에만
다시 불러온다. 적용 후에는 루트 URL `200`, 두 WWW URL `301`, 경로·쿼리 보존과 Search Console의
사용자 선언 canonical을 확인한다. Search Console의 기존 제외 보고서는 Google 재크롤링 뒤 갱신되며,
리디렉션 URL 자체는 색인 대상이 아니다.

#### 2026-09-08 운영 적용 결과

- 메인 구현 커밋: `main@21b1065858db5442b40e4c865742d9acdb635eb0`
- 운영 브랜치 병합 커밋: `production/spark-starlight-20260903@9fd90db9f814c6beb142df7041870772a5ebd40d`
- 활성 설정 백업: `/home/linuxuser/.config/tycheworks/nginx-backups/tycheworks-20260908-www-canonical-before.conf`
- 로컬과 운영 서버에서 자동 테스트 85개, `git diff --check`, Nginx 패치 dry-run과 `nginx -t` 통과
- Nginx reload 후 서비스 `active`, `https://tycheworks.com/`과 `/brand`는 `200` 유지
- `http://www.tycheworks.com/*`와 `https://www.tycheworks.com/*`는 경로·쿼리를 보존해
  `https://tycheworks.com/*`로 `301` 전환
- IMMERSA 카카오 공유 CSP의 `sharer.kakao.com`, `accounts.kakao.com`, `kapi.kakao.com` 허용 유지

남은 수동 검증은 Search Console의 `사용자가 선택한 표준이 없는 중복 페이지`에서
`https://www.tycheworks.com/` 항목에 대해 `수정 결과 확인`을 시작하고 Google 재크롤링 결과를 기다리는 것이다.

핵심 결과는 다음 명령으로 다시 확인할 수 있다. 다른 공개 호스트와 경로에도 같은 검사를 반복한다.

```powershell
curl.exe -sS -I https://tycheworks.com/
curl.exe -sS -I https://tycheworks.com/index.html
curl.exe -sS -I https://tycheworks.com/sitemap.xml
npm audit --omit=dev
npx --yes lighthouse https://tycheworks.com/ --quiet --chrome-flags="--headless --no-sandbox --disable-gpu" --only-categories=performance,seo,best-practices
```

공식 기준은 Google Search Central의
[사이트맵 지침](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[canonical 지침](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[robots와 noindex 구분](https://developers.google.com/search/docs/crawling-indexing/robots/intro),
OWASP의 [HTTP 보안 헤더 지침](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html),
OpenAI의 [크롤러 구분](https://developers.openai.com/api/docs/bots), Anthropic의
[Claude 크롤러 구분](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler),
Apple의 [Applebot-Extended 설명](https://support.apple.com/119829)을 대조했다.

## 완료한 검증

- 여섯 개 공개 HTTPS URL: 모두 HTTP `200`
- 비공개 대시보드 URL: HTTP `404`
- HTTP → HTTPS 전환
- TLS 인증서 검증 및 Certbot 갱신 모의시험
- Nginx 설정 문법 검사
- UFW 허용 포트 확인
- `npm test`: 19개 통과, 실패 0개
- `npm audit --audit-level=high`: 알려진 취약점 0개
- `git diff --check`: 공백 오류 없음
- 관리자 로그인 페이지: HTTPS `200`
- 미인증 관리자 대시보드와 상태 API: `401`
- 서비스 상태 점검: 브랜드 홈·BRAND·IMMERSA·VR TRAINING·SPARK·LOOP 모두 `200`
- 인증서 상태 조회: 인증서 1개와 대상 도메인 6개 확인

이 검증은 정적 웹사이트, 서버 상태 대시보드와 당시 서버 회귀 테스트의 결과다. 실제 Unity 전송과 VR 데이터 대시보드 운영 공개를 의미하지 않는다. 문의 메일은 아래의 별도 운영 배포 기록을 기준으로 판단한다.

## 배포에서 제외하거나 보류한 항목

- VR 데이터용 `/dashboard/`는 공개하지 않았다.
- 서버 대시보드는 `VULTR_API_KEY`가 설정된 경우 Vultr Account API에서 최근 결제일을 조회하고, Vultr의 월별 청구 기준에 따라 다음 달 1일을 다음 청구서 발행 예정일로 표시한다. 운영 API 키는 저장소에 기록하지 않는다. API 키가 없거나 호출에 실패하면 대시보드에 실패 지점을 표시한다.
- OTP와 관리자 보안 이벤트 이메일 알림은 연결하지 않았다. 웹 푸시는 코드와 migration `013`~`016`까지
  구현했으며 운영 DB migration과 VAPID 환경 변수 적용 전에는 비활성 상태다.
- 비정상 접속 IP의 국가는 MaxMind GeoLite2 Country 로컬 데이터베이스로 조회한다. 운영 서버의
  `geoipupdate.timer`가 DB 갱신을 확인하며, 접속 IP를 외부 조회 API로 전송하지 않는다. VPN·프록시
  사용 시 실제 사용자 위치가 아니라 출구 IP의 국가로 판정되므로 국가 정보만으로 접속 원인이나 사용자
  위치를 확정하지 않는다.
- 운영 비밀번호와 API 키는 저장소에 기록하지 않았다.
- 문의 폼과 VR 상세 웹사이트 변경은 `main@d08c8cd8d8ea9708a1c4e79de6e2c432b0d6de33`으로 운영 배포했다.

## 관리자 대시보드 접근 정책

서버 상태 대시보드는 `admin.tycheworks.com`을 사용한다. 집과 학원 IP는 강제 허용목록이 아니라 신뢰 위치 판별에 사용한다. Android 휴대전화와 국내 이동 접속의 공인 IP가 바뀔 수 있으므로 국내 미등록 IP를 IP만으로 차단하지 않고 새 위치 접속으로 기록한다. 해외 접속 제한과 OTP는 관리자 로그인과 상태 API가 안정화된 뒤 단계적으로 적용한다.

서버 상태 대시보드와 향후 VR 운영 데이터 대시보드는 같은 관리자 인증 기반을 사용한다. 관리자 ID와 비밀번호 해시는 공통 관리자 계정 테이블에 한 번만 저장하고, 대시보드마다 별도 계정을 중복 생성하지 않는다. 비밀번호는 평문으로 저장하지 않으며 세션, 로그인 실패 제한, 감사 기록과 HTTPS 정책을 공통 적용한다.

권한은 대시보드별로 분리한다.

- 서버 운영 권한: 서버 자원, 서비스, 포트, 인증서와 보안 이력을 조회한다.
- VR 운영 권한: 허용된 교육·훈련 데이터를 조회한다.
- 전체 관리자 권한: 두 대시보드에 접근한다.

VR 사용자 데이터는 서버 상태 대시보드에 섞어 표시하지 않는다. 향후 VR 대시보드를 공개할 때에는 공통 로그인 성공만으로 모든 데이터 접근을 허용하지 않고 계정 권한을 서버 API에서 다시 검사한다.

## 서버 상태 대시보드 운영 상태

- 로그인 URL: `https://admin.tycheworks.com/server-status/login`
- 상태 화면: `https://admin.tycheworks.com/server-status/`
- API: `/api/server-status`
- 세션 유효시간: 8시간
- 세션 저장: DB, 토큰은 SHA-256 해시로 저장
- 관리자 비밀번호: scrypt 해시로 저장
- 연속 로그인 실패: 5회부터 계정 15분 잠금
- Nginx 로그인 제한: IP당 분당 5회, burst 5
- 관리자 역할: `admin`, `viewer`
- `viewer`: 조회만 가능하며 신뢰 IP 추가·삭제 API는 `403`
- 임시 viewer: 4자리 PIN을 사용할 수 있으나 1시간 후 자동 만료되고 기존 세션도 무효화됨

대시보드는 서버 사양, 메모리, SSD, 시스템 가동시간, CPU 코어당 시스템 부하, 공개 서비스별 HTTPS 응답·응답시간, Nginx·Express·MySQL 포트 구분, 인증서 대상·최근 갱신일·만료일·자동 갱신 점검 상태, Vultr 결제 일정, 신뢰 IP와 로그인 실패 이력을 표시한다. 인증서의 최근 갱신일은 현재 인증서의 유효 시작일을 근거로 표시한다. 인증서나 개별 서비스 조회가 실패해도 전체 상태 API가 종료되지 않도록 실패를 별도 상태로 반환한다.

### 적용 변경

- 전체 콘텐츠 최대 너비를 `1080px`로 제한하고, 서비스 현황·포트·신뢰 IP·보안 이력 목록은 각 정보량에 맞는 별도 최대 너비와 중앙 정렬을 적용했다.
- 보조 문구 `11px`, 일반 본문과 표 `12px`, 강조 정보 `13px` 이상으로 화면 글자 체계를 정리했다.
- 서비스 현황은 번호, 서비스명·주소, HTTP 상태와 응답시간을 구분하고, 포트 및 프로세스 표의 셀 내용을 중앙 정렬했다.
- HTTPS 인증서는 대상 도메인, 최근 갱신일, 만료일, 남은 일수, Certbot 자동 갱신 점검 상태와 다음 점검 시각을 표시한다.
- 신뢰 IP는 번호, 위치명, CIDR, 상태와 삭제 동작을 분리하고 위치 행 사이 간격을 적용했다. 새 IP 추가 시 현재 접속 IPv4를 `/32` 후보로 제시한다.
- 비정상 접속 이력은 선택 삭제, 페이지당 20건, 최대 5개의 숫자 페이지 버튼, 요일을 포함한 발생 시각을 제공한다. 관리자만 삭제할 수 있고 `viewer`에는 선택·삭제 동작을 노출하지 않는다.
- 비정상 접속 이력의 IP는 로컬 GeoLite2 Country 데이터베이스에서 조회해 한국어 국가명과 ISO 국가
  코드를 함께 표시한다. 외부 IP 조회 API 호출과 DB 스키마 변경은 없다.
- 경고 배너의 `×` 또는 `상세 확인`을 누르면 현재 표시된 경고를 건별로 확인 처리한다. 비정상 접속은
  DB 이벤트 ID, 서버 이상은 메모리·디스크·서비스·부하별 고정 ID와 발생 세대로 구분한다. 확인 상태는
  관리자 계정별 DB 기록으로 저장하므로 로그아웃·재접속 뒤에도 같은 건을 다시 알리지 않는다. 서버
  이상이 정상으로 복구된 뒤 같은 원인이 재발하면 발생 세대가 증가해 새 경고로 처리한다.
- 서버 관리자 화면의 파비콘은 `/server-status/favicon.svg?v=2` 절대 경로로 제공해 상대 경로와 기존 브라우저 캐시 영향을 줄였다.
- Vultr Account API 연결은 운영 서버 공인 IP `158.247.238.180/32`만 허용하고, API 키는 운영 `.env`에서만 읽는다.

### 근본 원인과 영향 범위

- 기존 화면은 `1280px` 콘텐츠 영역과 폭 `100%`인 목록·표가 함께 적용돼 정보량보다 가로 폭이 과도하게 늘어났다. 서버 관리자 정적 화면의 레이아웃만 조정했으며 공개 사이트와 VR 데이터 대시보드에는 영향을 주지 않는다.
- 인증서 자동 갱신 표시는 인증서의 정적 문구만 사용해 실제 Certbot 타이머 상태를 구분하지 못했다. 현재는 `certbot.timer` 조회 성공·실패를 별도 상태로 반환한다.
- Vultr 결제 정보는 API 키 미설정, 계정 API 비활성화와 허용 IP 누락 시 조회할 수 없다. 대시보드는 이 경우 임의 값을 만들지 않고 실패 지점을 표시한다.
- 감사 로그에는 기존과 같이 원본 IP만 저장하고, 국가 정보는 화면 조회 시점의 GeoLite2 데이터로
  계산한다. 파일이 없거나 손상되면 `국가 조회 실패`, 유효한 국가 결과가 없으면 `확인 불가`로 표시한다.
  국가 정보는 보조 정보이며 해외 접속 여부나 실제 사용자 위치를 확정하는 근거로 사용하지 않는다.
- 기존 경고 확인 이력은 브라우저 로컬 저장소에만 있어 다른 기기나 새 브라우저에서는 같은 경고가 다시
  표시될 수 있었다. 현재는 경고 ID와 발생 세대별 확인 이력을 DB에 저장하고, 기존 로컬 확인 이력은
  최초 접속 때 서버 기록으로 이관한다. 서버 상태 API의 기존 `alerts` 문자열 배열은 유지하므로 공개
  사이트, VR 훈련 데이터와 클라이언트 계약에는 영향이 없다.

### 휴대폰 웹 푸시

웹 푸시는 외부 유료 알림 서비스 없이 표준 Push API와 VAPID를 사용한다. 서버가 대시보드 접속 여부와
관계없이 기본 60초 간격으로 현재 서버 경고와 새 관리자 로그인 실패를 확인한다.

- 기존 경고와 기존 로그인 실패 이력은 알림 기능 최초 실행 때 기준선으로 저장하고 푸시하지 않는다.
- 기준선 이후 새 경고만 푸시하며 같은 발생 세대는 한 번 처리한다.
- 메모리·디스크·서비스·부하 경고가 해소된 뒤 같은 원인으로 재발하면 새 세대로 다시 푸시한다.
- 만료되거나 해지된 브라우저 구독은 푸시 서버의 HTTP `404` 또는 `410` 응답 시 자동 삭제한다.
- 일시적인 푸시 전송 오류는 자격 증명과 본문을 로그에 남기지 않고 다음 점검에서 재시도한다.

운영 적용에는 server admin push migration `013`~`016`과 다음 환경 변수가 필요하다.

```dotenv
ENABLE_SERVER_ADMIN_PUSH=true
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:운영연락주소
SERVER_ALERT_POLL_INTERVAL_SECONDS=60
```

VAPID 키는 운영 적용 시 한 번 생성해 서버 `.env`에만 저장한다. 공개 키만 인증된 대시보드 API를 통해
브라우저에 전달하며 개인키는 저장소, HTML과 로그에 기록하지 않는다.

휴대전화 등록 방법은 다음과 같다.

1. Android는 Chrome에서 관리자 대시보드에 로그인하고 `이 기기 알림 켜기`를 누른다.
2. iPhone은 Safari에서 대시보드를 홈 화면에 추가한 뒤 설치된 홈 화면 앱을 열어 로그인하고 같은 버튼을
   누른다.
3. 운영체제의 알림 권한을 허용하면 서버가 즉시 `서버 알림 연결 완료` 테스트 푸시를 보낸다.
4. 버튼이 `이 기기 알림 끄기`로 바뀌면 구독 저장이 완료된 상태다.
5. 다른 휴대전화에도 알림이 필요하면 해당 기기에서 같은 절차를 반복한다.

### 국가 조회와 GeoLite2 자동 갱신

국가 조회는 `maxmind` Node.js 라이브러리가 운영 서버의 `GeoLite2-Country.mmdb` 파일을 직접 읽는다.
외부 서비스에 관리자 접속 IP를 전달하지 않는다. GeoLite2 파일이 갱신되면 애플리케이션의 파일 감시가
새 데이터베이스를 다시 읽으므로 정상적인 파일 교체에는 PM2 재시작이 필요하지 않다.

운영 적용에는 무료 MaxMind 계정의 Account ID와 License Key가 필요하다. 실제 값은 저장소나 서버
애플리케이션 `.env`에 기록하지 않고 권한 `0600`인 `/etc/GeoIP.conf`에만 저장한다. 기준 템플릿은
`ops/maxmind/GeoIP.conf.example`이다. 애플리케이션에는 다음 설정만 추가한다.

```dotenv
ENABLE_SERVER_ADMIN_COUNTRY_LOOKUP=true
GEOLITE2_COUNTRY_DB_PATH=/var/lib/GeoIP/GeoLite2-Country.mmdb
```

MaxMind 공식 `geoipupdate` 프로그램과 Ubuntu 제공 `geoipupdate.timer`를 사용한다. 저장소의 다음
systemd 템플릿은 별도 배포 환경에서 갱신 시각을 고정해야 할 때만 사용한다.

- `ops/systemd/tyche-geoipupdate.service`
- `ops/systemd/tyche-geoipupdate.timer`

타이머는 매일 `04:15`에 최대 45분의 무작위 지연을 더해 새 버전을 확인한다. GeoLite2 Country의 정기
배포일 사이에도 업데이트 확인만 수행할 수 있으며, 새 데이터가 있을 때만 파일을 내려받는다. 여러 서버가
동시에 MaxMind에 요청하는 것을 피하려고 무작위 지연을 적용했다.

운영 설치 순서는 다음과 같다. 아래 작업은 실제 Account ID와 License Key를 `/etc/GeoIP.conf`에 입력하고
파일 권한을 확인한 뒤 실행한다.

```bash
sudo add-apt-repository ppa:maxmind/ppa
sudo apt update
sudo apt install geoipupdate
sudo install -d -m 0755 /var/lib/GeoIP
sudo install -m 0600 ops/maxmind/GeoIP.conf.example /etc/GeoIP.conf
sudoedit /etc/GeoIP.conf
sudo install -m 0644 ops/systemd/tyche-geoipupdate.service /etc/systemd/system/
sudo install -m 0644 ops/systemd/tyche-geoipupdate.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start tyche-geoipupdate.service
sudo systemctl enable --now tyche-geoipupdate.timer
```

운영 확인 명령은 다음과 같다.

```bash
systemctl status tyche-geoipupdate.timer --no-pager
systemctl list-timers tyche-geoipupdate.timer --no-pager
journalctl -u tyche-geoipupdate.service -n 50 --no-pager
test -r /var/lib/GeoIP/GeoLite2-Country.mmdb
```

갱신에 실패하면 systemd 서비스가 실패 상태와 로그를 남기고, 애플리케이션은 이미 읽은 마지막 정상
데이터베이스를 계속 사용한다. 애플리케이션 시작 후에도 파일을 전혀 읽을 수 없으면 국가 열에
`국가 조회 실패`를 표시하고 다른 서버 상태 조회는 계속 제공한다.

### 완료 검증

- Vultr Account API: 운영 서버에서 HTTP `200`, `last_payment_date` 필드 확인
- PM2: `tyche-safety-training-server` 재시작 후 `online`
- 로컬 헬스체크: `/api/health` 응답 `status: ok`
- 현재 로컬 자동 테스트: 64개 통과, 실패 0개
- 의존성 검사: 운영 의존성 취약점 0개
- JavaScript 문법 검사와 `git diff --check`: 통과
- 파비콘: 로컬 Express와 `admin.tycheworks.com` HTTPS 경로에서 HTTP `200`

### 남은 수동 검증

- 실제 관리자와 `viewer` 계정으로 데스크톱·Android 화면의 너비, 숫자 페이지 이동, 선택 삭제와 현재 IP 자동 입력을 확인한다.
- 실제 브라우저에서 같은 보안 이벤트와 서버 이상 경고가 `×` 및 `상세 확인` 뒤 재표시되지 않고, 새 이벤트 발생 또는 서버 상태 정상화 후 재발 시에만 다시 표시되는지 확인한다.
- 인증서의 다음 점검 시각이 운영 서버의 `certbot.timer` 출력과 일치하는지 갱신 실행 이후 다시 확인한다.
- 웹 푸시는 운영 migration·환경 변수 적용과 실제 휴대전화 테스트가 끝나기 전까지 운영 성공으로
  표시하지 않는다. 이메일 보안 알림은 보류 항목이다.
- 국가 조회는 운영 서버에서 GeoLite2 최초 다운로드와 `geoipupdate.timer` 활성 상태를 확인했다.
  실제 관리자 브라우저에서 한국·해외·VPN·사설 IP 표시와 파일 갱신 후 무중단 재로딩은 별도 수동 검증
  대상으로 남긴다.

## MySQL 운영 구성

- MySQL: `8.4.10`
- 수신 주소: `127.0.0.1:3306` 전용, 외부 미공개
- 데이터베이스: `tyche_training`
- 애플리케이션 계정: `tyche_app`
- 비밀번호 파일과 `.env`: 권한 `600`, Git 제외
- 적용 마이그레이션: `001`부터 `008`까지
- 관리자 계정, 세션, 신뢰 IP와 감사 로그 테이블을 운영 DB에 적용함

관리자·DB 비밀번호, 임시 viewer PIN과 원문 세션 토큰은 문서나 저장소에 기록하지 않는다. 임시 viewer를 다시 발급하면 기존 PIN과 만료시간을 교체한다.

## 홈페이지 포인트 컬러 운영 반영

2026-08-28 홈의 오렌지 포인트가 SPARK 라인 컬러와 겹치는 문제를 해결하기 위해 모기업 홈과 공통 브랜드 영역을 바이올렛 `#6C4BD8`로 분리했다. IMMERSA `#2878FF`, SPARK `#FF7A00`, LOOP `#F4C430`은 각 라인의 고유 색으로 유지했다.

- 운영 반영 커밋: `8961843821050e606619fd9116db1b0153f84108`
- 운영 서버 반영 방식: `main` fast-forward
- 공개 확인: 루트, 브랜드, IMMERSA, SPARK, LOOP HTTPS 페이지 모두 HTTP `200`
- CSS 확인: `--brand-accent:#6c4bd8`, `--immersa:#2878ff` 존재 및 `var(--orange)` 미사용
- 운영 검증: 자동 테스트 20개 통과, 의존성 취약점 0개, `git diff --check`와 `nginx -t` 통과
- 변경 제외: Express API, 운영 DB, 마이그레이션, 텔레메트리, PM2와 Unity 클라이언트 코드

정적 파일은 Nginx가 직접 읽으므로 PM2 재시작과 Nginx reload 없이 반영했다. 실제 데스크톱·모바일 브라우저의 색감과 명도 대비는 별도 육안 확인 대상으로 남긴다.

## SSH 보안 남은 작업

현재 `linuxuser`의 ED25519 키 접속은 확인했지만 SSH hardening은 아직 적용하지 않았다. 점검 당시 `PermitRootLogin yes`, `PasswordAuthentication yes`, 22번 포트 전체 공개, Fail2ban 비활성 상태였으며 해외 IP의 `root`·`ubuntu` 로그인 시도가 실제 로그에 있었다. 다음 작업에서 현재 SSH 창을 유지한 채 새 창의 `ssh tycheworks` 키 접속을 재확인하고 root 로그인 차단, 비밀번호 로그인 차단, `linuxuser` 허용과 Fail2ban 활성화를 순서대로 적용해야 한다.

## 변경 후 확인 절차

저장소에서 사이트나 서버 코드를 변경한 뒤 다음 순서로 확인한다.

```bash
cd /home/linuxuser/workspace/chemical-safety-vr
git status --short
npm test
npm audit --audit-level=high
git diff --check
sudo nginx -t
```

정적 파일 변경은 Nginx가 파일을 직접 읽으므로 일반적으로 PM2 재시작이 필요 없다. Express 코드나 환경 변수 변경은 테스트와 설정 검토를 마친 뒤에만 PM2 재시작 여부를 결정한다. DB 마이그레이션, PM2 재시작과 운영 배포는 각각 영향 범위를 확인하고 명시적으로 수행한다.

## VR 개인정보처리방침 링크 운영 배포

2026-08-31 화학물질 안전훈련 VR 상세페이지 푸터에 VR 전용 개인정보처리방침 링크를 반영했다.

- 최초 링크 반영 커밋: `main@a59c247f026d3db4ff46cd4761a33f882985ac46`
- 새 창 열기 반영 커밋: `main@25cf5aa6e7b845c9be2a90a5bb9f34df47677dae`
- 운영 배포 브랜치: `production/privacy-policy-20260831`
- 최초 운영 배포 커밋: `45b1ad5c2a46d5e15e37bdb8413154d9651ed869`
- 새 창 열기 운영 배포 커밋: `ba93ee0ebe104bae4b7ec39c56fc0d328c4200eb`
- 변경 파일: VR 상세페이지 HTML과 해당 링크 회귀 테스트 2개
- 공개 링크 문구: `VR PRIVACY POLICY`
- 연결 대상: `https://softcastella.github.io/tycheworks-safetytrainingvr-privacy/`
- 열기 방식: 새 창(`target="_blank"`)과 원본 창 보호(`rel="noopener noreferrer"`)

운영 서버의 기존 `main`은 배포 당시 `1f90b784204710ffd6ffab46408fbb78039a1239`였고, 최신 `main`까지
fast-forward하면 아직 운영 반영 승인을 받지 않은 텔레메트리 코드·DB 마이그레이션·별도 랜딩 페이지가
함께 들어오는 상태였다. 이번 요청 범위를 지키기 위해 기존 운영 커밋에서 개인정보 링크와 회귀 테스트만
적용한 전용 브랜치를 만들었다. 다음 전체 운영 배포 전에는 이 전용 브랜치와 `main`의 이력을 먼저
재조정하고, 운영 브랜치를 임의로 reset하지 않는다.

운영 서버에서 자동 테스트 21개 통과, `npm audit --audit-level=high` 취약점 0건,
`git diff --check`와 `nginx -t` 통과를 확인했다. 공개 VR 상세페이지, 개인정보처리방침 페이지와 운영
헬스체크는 모두 HTTP 200이었고, 공개 상세페이지에서 링크 문구와 대상 URL이 각각 한 번 존재했다.
운영 HTML에서 새 창 열기와 원본 창 보호 속성이 함께 적용된 것도 확인했다.
Nginx가 정적 파일을 직접 제공하므로 PM2 재시작, Nginx reload, DB 마이그레이션과 운영 데이터 변경은
수행하지 않았다.

## 화학 안전 VR 전용 랜딩 배포 상태

화학 안전 VR 전용 랜딩은 `https://chemical-safety-vr.tycheworks.com/`에서 제공한다. 배포 요청 기준
서버 커밋은 `main@5b7125745fa187d4472ac488d32669d6129f0de0`이며, 배포 응답에는 운영 checkout SHA가
별도로 포함되지 않았다.

### 적용 변경

- 랜딩 루트와 `/light/`, `/campaign/` 정적 페이지를 전용 도메인에서 제공한다.
- 이전 `/landing/` 접근은 전용 도메인 루트로 `301` 이동한다.
- 공용 `favicon_round_crop.svg`를 랜딩, 홈페이지, IMMERSA와 서버 관리자 화면의 파비콘으로 사용한다.
- 새 파비콘은 사각 PNG 원본을 자체 포함한 SVG이며 원 내부는 흰색, 원 바깥은 투명하다.
- TLS 인증서 자동 갱신, Nginx 설정과 PM2 애플리케이션 구성은 기존 운영 정책을 유지한다.
- DB 마이그레이션 `009`~`012`는 이번 배포에서 실행하지 않았고 텔레메트리 수집 기능도 비활성 상태를
  유지한다.

### 완료 검증

- `https://chemical-safety-vr.tycheworks.com/`: HTTP `200`
- `https://chemical-safety-vr.tycheworks.com/landing/`: 루트로 HTTP `301`
- `https://chemical-safety-vr.tycheworks.com/light/`: HTTP `200`
- `https://chemical-safety-vr.tycheworks.com/campaign/`: HTTP `200`
- `https://chemical-safety-vr.tycheworks.com/assets/favicon_round_crop.svg`: HTTP `200`,
  `Content-Type: image/svg+xml`
- 배포 응답 기준 Nginx 설정 검사 통과, PM2 애플리케이션 `online`, 새 헬스체크 정상, 정적 파일 소유권
  정상과 홈페이지·IMMERSA·서버 관리자 화면의 새 파비콘 HTTP `200`을 확인했다.

### 남은 후속 검증과 수정

- 랜딩 세 페이지의 `og:image`와 `twitter:image`는
  `https://tycheworks.com/assets/metahorizon_og_banner_1200x630.png`로 교체했고 운영에서
  `200 image/png`를 확인했다.
- 파비콘은 브라우저 캐시 때문에 이전 이미지가 보일 수 있으므로 강력 새로고침 또는 새 탭·시크릿 창에서
  최종 시각 확인한다.

## 브랜드 페이지 패밀리 모바일 상단 내비게이션

### 적용 변경

- TYCHE 홈페이지와 BRAND, IMMERSA, SPARK, LOOP 및 같은 공통 헤더를 쓰는 상세페이지의 상단 이동 메뉴를
  `12px`, `font-weight: 800`, `line-height: 1.2`, `letter-spacing: .08em`, `#66707b`로 통일했다.
- IMMERSA에 혼재하던 `Brand`, `Spark`, `Loop`, `Contact` 표기는 CSS 대문자 표기로 맞췄다.
  각 라인의 hover 색상은 라인 정체성을 위해 기존 값을 유지한다.
- 모바일에서 일부 링크를 `nth-child`로 숨기던 규칙을 제거했다. 상단은 로고 행과 메뉴 행으로
  나뉘며, 메뉴 행 너비가 부족하면 링크 단위로 다음 줄에 배치된다.
- 장기 캐시된 이전 CSS가 남지 않도록 대상 HTML의 스타일시트 버전을 `20260908-1`로 갱신했다.

### 근본 원인과 영향 범위

- 기존 모바일 CSS가 페이지마다 서로 다른 링크를 숨겼고, 내비게이션 크기도 `10px`, `12px`,
  `13px`, 굵기도 `800`, `850`, 색상도 `#777`, `#657386`, `#5c6470`으로 달랐다.
- 변경 범위는 공개 브랜드 페이지 패밀리의 상단 내비게이션과 캐시 버전이다. 본문, API,
  Unity 클라이언트, 데이터베이스와 운영 데이터는 변경하지 않는다.

### 완료 검증과 남은 수동 검증

- 정적 회귀 테스트에서 네 패밀리의 기본 타이포 값, 모바일 전체 메뉴 노출, 줄바꿈 규칙을 확인한다.
- 인앱 브라우저 연결 대상이 없어 렌더링 비교는 수행하지 못했다. 배포 후 320px, 375px,
  430px 너비에서 메뉴 누락·가로 잘림·헤더 높이와 sticky 동작을 수동 확인한다.

## Resend 문의 폼과 VR 상세 공유 운영 배포

2026-08-31 홈페이지 문의 폼, VR 상세 공유 버튼, OG 배너와 HD 이미지를 운영에 반영했다. 최초
문의·자산 배포 기준은 `main@d08c8cd8d8ea9708a1c4e79de6e2c432b0d6de33`이며, SNS 공유 설정과
카카오·네이버 수정까지 포함한 현재 기준은
`main@ed35fc3c58101b81123e88eef1b0cc9b52621e99`이다.

- 운영 설정: `ENABLE_CONTACT_FORM`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`을
  저장소 밖 `.env`에 설정하고 기존 파일을 `/home/linuxuser/.config/tycheworks/env-backups`에 백업했다.
- Resend 발신 도메인 DKIM·SPF·DMARC 검증과 실제 Gmail 수신을 확인했다.
- 운영 `POST https://tycheworks.com/api/contact`는 실제 Resend 호출에서 HTTP `202`와 접수 ID를 반환했다.
- 홈페이지, VR 상세페이지, 전용 랜딩과 1200×630 OG 이미지는 모두 HTTP `200`을 반환했다.
- 공개 HTML에서 `contact.js`, `detail-share.js`, `metahorizon_hero_v2.png`,
  `metahorizon_title_v2_hd.png`, `metahorizon_og_banner_1200x630.png` 참조를 확인했다.
- 최초 배포 당시 운영 자동 테스트 50개, `npm audit --audit-level=high` 취약점 0건,
  `git diff --check`, `nginx -t`, PM2 `online`과 내부 헬스체크를 확인했다.
- DB 마이그레이션과 운영 DB 변경은 수행하지 않았다.

### 문의 메일 운영 설정

문의 폼을 활성화할 때 운영 `.env`에서 다음 변수를 설정한다.

```dotenv
ENABLE_CONTACT_FORM=true
RESEND_API_KEY=
CONTACT_FROM_EMAIL=
CONTACT_TO_EMAIL=
CONTACT_RATE_LIMIT_PER_HOUR=5
```

- `RESEND_API_KEY`: Resend에서 발급한 비밀 API 키다. 클라이언트 JavaScript에 넣지 않는다.
- `CONTACT_FROM_EMAIL`: Resend에서 발신 인증한 도메인의 주소다.
- `CONTACT_TO_EMAIL`: 실제 문의를 받을 메일함 주소다. Gmail로 받으려면 해당 Gmail 주소를 입력한다.
- `CONTACT_RATE_LIMIT_PER_HOUR`: 한 IP에서 한 시간 동안 허용할 문의 수이며 기본값은 5다.

Resend 발신 도메인은 가비아 DNS 관리 화면에서 Resend가 제시한 DKIM TXT와 발신용 CNAME 레코드를
그대로 등록하고, 필요하면 DMARC TXT도 추가한다. 레코드 이름과 값은 Resend 화면에 표시된 값을
기준으로 하며 문서나 Git에 복사하지 않는다. 문의 메일 발신만 필요하므로 Resend의 수신 기능과 MX
레코드는 활성화하지 않아도 된다. Resend에서 도메인과 각 발신 레코드가 `Verified`가 된 뒤 실제
문의 폼으로 전송하고 Resend의 `Delivered` 상태와 최종 수신 메일함을 각각 확인한다.

### 상세페이지 공유 구성

- 구현 파일: `public/site/immersa/chemical-safety-training/index.html`, 같은 디렉터리의
  `detail-share.js`
- 공유 대상: 카카오톡, 네이버, Facebook, X, LinkedIn, Telegram, LINE, 이메일과 링크 복사
- 네이버·Facebook·X·LinkedIn·Telegram·LINE은 각 서비스의 웹 공유 URL을 새 탭에서 연다.
- 네이버는 공식 `https://share.naver.com/web/shareView`를 사용한다. 이전
  `https://blog.naver.com/openapi/share` 주소는 사용하지 않는다.
- 이메일은 `mailto:`, 링크 복사는 Clipboard API를 사용한다. 둘 다 Resend와 무관하다.
- 페이지 OG와 X 카드 이미지는 `metahorizon_og_banner_1200x630.png`이며, OG 너비·높이는
  1,200×630, X 카드 타입은 `summary_large_image`다.
- 플랫폼의 공유 선택 화면에서 이미지를 작은 썸네일로 축소하는 것은 해당 플랫폼 UI다. 원본 이미지
  크기 오류로 판단하지 않는다.

### 카카오톡 공유 설정

카카오톡은 `Kakao.Share.sendDefault()`와 Kakao JavaScript SDK 2.8.3을 사용한다. 브라우저에는
서버의 `GET /api/public-site-config`를 통해 공개 JavaScript 키만 전달하고 응답은 `no-store`로
제공한다. 실제 환경 변수 값은 문서나 저장소에 기록하지 않는다.

카카오 Developers에서 다음 항목을 설정한다.

1. `앱` → `플랫폼 키` → `JavaScript 키` → `JavaScript SDK 도메인`에
   `https://immersa.tycheworks.com`을 등록한다.
2. `앱` → `제품 링크 관리` → `웹 도메인`에 `https://immersa.tycheworks.com`을 등록하고 기본
   웹 도메인으로 선택한다. 이 설정이 없으면 공유된 카드의 이미지·본문·버튼을 눌러도 페이지로
   이동하지 않을 수 있다.
3. 홈페이지 이동만 제공하므로 기본 네이티브 앱 스킴과 Android·iOS 스토어 주소는 설정하지 않는다.
4. 카카오 로그인용 Redirect URI와 OpenID Connect는 카카오톡 링크 공유에 필요하지 않다.

서버 운영 `.env`에는 다음 변수 이름만 사용한다.

```dotenv
KAKAO_JAVASCRIPT_KEY=
```

공유 콘텐츠와 버튼의 `mobileWebUrl`, `webUrl`은 모두
`https://immersa.tycheworks.com/chemical-safety-training`을 사용한다. 카카오 카드가 1200×630
배너를 임의로 세로 크롭하지 않도록 `imageWidth: 1200`, `imageHeight: 630`을 함께 전달한다.

Kakao SDK가 공유 팝업의 크기와 로그인·친구 선택 흐름을 관리하므로 애플리케이션 코드에서
`window.open`을 재정의하지 않는다. 이미 열려 있던 상세페이지는 배포 후에도 이전 JavaScript를
계속 실행할 수 있다. 팝업이 전체 탭으로 열리는 등 이전 동작이 남으면 카카오 공유 탭을 닫고
상세페이지에서 강력 새로고침한 뒤 다시 시도한다.

### 보안 헤더와 운영 검증

카카오 SDK와 공유 폼이 CSP에 차단되지 않도록 운영 Nginx 정책에 다음 출처를 허용한다.

- `script-src`: `https://t1.kakaocdn.net`
- `form-action`: `https://sharer.kakao.com`, `https://accounts.kakao.com`
- `connect-src`: `https://kapi.kakao.com`

모바일 브라우저에서는 SDK가 카카오톡 앱을 열기 전에 `kapi.kakao.com`의
`/v2/api/kakaolink/talk/template/default`로 템플릿을 검증한다. 기존 운영 CSP의
`connect-src 'self'`는 이 요청을 차단해 모바일에서 빈 탭 또는 실패 화면을 남겼다.

데스크톱 브라우저는 `sharer.kakao.com/picker/link`로 폼을 제출하고, 카카오 로그인이 없으면
`accounts.kakao.com/login`으로 이동한다. Chrome은 `form-action`을 리디렉션 목적지에도 적용하므로
`sharer.kakao.com`만 허용하면 최초 공유 팝업은 열리지만 계정 로그인 이동이 차단되어 `about:blank`로
남는다.

운영 키를 노출하지 않는 읽기 전용 점검에서 다음을 확인했다.

- `GET https://immersa.tycheworks.com/api/public-site-config`: `200`, `Cache-Control: no-store`
- 현재 앱 키·호출 도메인·기본 피드 템플릿으로 `https://sharer.kakao.com/picker/link` 검증:
  카카오 계정 로그인 화면까지 `200`으로 진행
- 운영 `immersa.tycheworks.com` CSP와 SDK 2.8.3에서 모바일 공유 정상 동작 확인
- 격리된 데스크톱 Chrome에서 공유 클릭 시 `about:blank`를 재현하고, 브라우저 보안 로그에서
  `form-action` 차단을 확인
- 같은 조건에서 CSP 검사를 우회한 진단 실행은 `accounts.kakao.com/login` 화면까지 이동함을 확인

저장소의 `ops/nginx/tycheworks-immersa-kakao-share-csp.patch`는 IMMERSA 서버 블록에서 모바일용
`connect-src`의 카카오 API 출처를 유지하면서, 데스크톱 로그인 리디렉션에 필요한
`accounts.kakao.com`을 `form-action`에 추가하는 교체 패치다. SDK는 2.8.3과 해당 SRI 해시를 사용하고
`detail-share.js` 참조 버전은 `20260908-1`이다.

저장소 변경만으로 운영 CSP는 바뀌지 않는다. 운영 적용 시에는 기존 설정을 별도 백업하고 패치의
대상 서버 블록을 확인한 뒤 `nginx -t` 통과 후 Nginx를 다시 불러온다. PM2 재시작과 DB 변경은
필요하지 않다. 공유 플랫폼은 외부 로그인 상태와 쿠키·캐시의 영향을 받으므로 다음 수동 검증을
별도로 수행한다.

1. 상세페이지 공유 모달 열기·닫기와 키보드 `Escape` 동작을 확인한다.
2. 데스크톱 Chrome에서 카카오 공유 팝업이 `about:blank`에 머물지 않고 계정 로그인 또는 공유 선택
   화면으로 이동하는지 확인한다.
3. 모바일 카카오톡에서 새 메시지를 공유하고 이미지 비율, 본문과 `VR 상세페이지 보기` 링크를 확인한다.
4. 카카오 Developers 설정 변경은 이미 보낸 메시지에 소급 적용되지 않으므로 반드시 새 카드로
   확인한다.
5. 네이버 공유가 빈 페이지가 아닌 공식 공유 화면을 열고 제목과 URL을 전달하는지 확인한다.
6. Facebook, X, LinkedIn, Telegram과 LINE에서 공개 URL 및 OG 미리보기를 확인한다. 각 서비스가
   이전 미리보기를 캐시하면 서비스별 캐시 갱신 도구 또는 새 공유 요청으로 다시 확인한다.
7. 모바일 Chrome과 Safari에서 개발자 도구 또는 CSP 보고로 `kapi.kakao.com` 차단이 사라졌는지
   확인하고, 카카오톡 앱의 친구·채팅방 선택 화면이 실제로 열리는지 확인한다.

## SPARK 별빛 스도쿠 운영 배포

2026-09-03에 SPARK 홈, 별빛 스도쿠 랜딩·상세·개인정보처리방침과 사이트 공용
개인정보처리방침을 운영에 반영했다.

- 메인 구현 기준: `main@ecac56dbadcbaa4e275ab6dc5dcb68b6b0a4729e`
- 운영 분기: `production/spark-starlight-20260903`
- 운영 콘텐츠 기준: `fc7a9f9b474eee7fce15f3610cfd55b45a6d1e5d`
- 운영 서버 체크아웃: `/home/linuxuser/workspace/chemical-safety-vr`
- 운영 서버 자동 테스트: 70개 통과
- 메인 브랜치 자동 테스트: 71개 통과
- `git diff --check`, `nginx -t` 통과, PM2 `tyche-safety-training-server` 상태 `online`
- DB 마이그레이션, 운영 데이터 변경, 환경 변수 변경과 Nginx 설정 재적용은 수행하지 않았다.

다음 공개 경로에서 HTTP `200`을 확인했다.

- `https://spark.tycheworks.com/`
- `https://spark.tycheworks.com/starlight-sudoku/`
- `https://spark.tycheworks.com/starlight-sudoku/privacy/`
- `https://starlight-sudoku.tycheworks.com/`
- `https://tycheworks.com/privacy/`
- `https://tycheworks.com/brand`
- `https://immersa.tycheworks.com/chemical-safety-training`
- `https://tycheworks.com/api/health`

별빛 스도쿠 앱은 입점 예정 상태이므로 현재 개인정보처리방침은 공개 랜딩·상세 페이지에서
확인 가능한 처리 범위만 확정해서 기록했다. 출시 전 실제 앱 빌드의 권한, SDK, 광고·분석,
계정, 저장·전송 항목을 재검증하고 앱 내부와 스토어 등록 정보에 같은 최신 정책을 연결한다.

## 2026-09-04 별빛 스도쿠 개인정보처리방침 개편 배포

기존 방침은 출시 전 웹페이지의 접속 로그와 언어 설정을 중심으로 작성되어 실제 앱의 로컬 저장,
Google Play 인앱 리뷰와 삭제 방법을 충분히 설명하지 못했다. 별빛 스도쿠 Flutter 프로젝트
`softCastella/Starlight-Sudoku`의 `main@70178fb13dabaa5b5fe7a15bb80ca2dbce5e6135` 및 당시
로컬 작업 트리에서 앱 ID, 설정의 방침 링크, `SharedPreferences`, `SS-` 익명 ID와 인앱 리뷰
호출을 대조해 방침을 갱신했다.

- 메인 구현 기준: `main@6c445287595019e7084b51650c60e0b847e65b56`
- 운영 분기 기준: `production/spark-starlight-20260903@703603002bec6d339be6b9db13254996991f0556`
- 공개 주소: `https://spark.tycheworks.com/starlight-sudoku/privacy/`
- 적용 내용: 앱·웹 적용 범위, 수집하지 않는 정보, 기기 내 로컬 저장, 웹 접속 로그, Google Play
  인앱 리뷰 처리, 보유·삭제, 아동 비대상과 연령 무제한 이용, 보호 조치 및 문의를 한국어·영어·
  일본어·중국어 간체·번체로 공개했다.
- 디자인: 언어 선택과 본문 표면을 아이보리로 변경하고 남색 배경에 CSS 별빛·미세 이동 효과를
  추가했다. 모션 감소 설정과 본문 색상 대비를 함께 적용했다.
- 공식 근거: Google Play 사용자 데이터 정책, 데이터 보안, 인앱 리뷰 문서 링크를 본문 하단에
  제공한다.

완료 검증은 다음과 같다.

- 로컬 `npm test` 74개 통과, `git diff --check` 통과
- 운영 체크아웃 `npm test` 74개 통과, `nginx -t` 통과
- 공개 HTML, CSS와 다국어 JavaScript에서 `20260904-1` 캐시 버전, 새 아동 이용 문구,
  Google Play 리뷰 처리, 아이보리 토큰과 별빛 애니메이션을 확인
- 개인정보처리방침과 `https://tycheworks.com/api/health`가 외부에서 HTTP `200` 응답
- 정적 파일을 Nginx가 직접 제공하므로 PM2와 Nginx를 재시작하지 않았다. DB 마이그레이션,
  운영 DB·환경 변수와 사용자 데이터도 변경하지 않았다.

남은 검증은 Play Console의 데이터 보안·대상 연령·콘텐츠 등급 입력, 업로드 키로 서명한 AAB
생성, 실제 데스크톱·모바일 브라우저 육안 확인이다. 현재 앱의 자체 별점 질문과 `전송` 버튼이
인앱 리뷰 API를 직접 호출하는 흐름은 Google Play 인앱 리뷰 UX 지침과 다시 대조해 클라이언트에서
별도로 조정해야 한다.

## 별빛 스도쿠 전용 랜딩 도메인 배포

2026-09-03에 기존 브랜드 홈 하위 랜딩 주소를 별빛 스도쿠 전용 서브도메인으로 전환했다.

- 정식 랜딩 주소: `https://starlight-sudoku.tycheworks.com/`
- 메인 코드 기준: `main@be435c2d96f1d83e95cad44547cc5d41ab15d197`
- 메인 Nginx 설정 기준: `main@45194411d2700eeb92046d449b848014abbbc3ef`
- 운영 브랜치 기준: `production/spark-starlight-20260903@323033e6307e02a5b5f42fc3f97a9f4bc20931d2`
- DNS: 기존 와일드카드 CNAME을 통해 `tycheworks.com` 운영 서버로 연결
- TLS: 기존 `tycheworks.com` 인증서의 SAN에 전용 서브도메인을 추가했고 만료일은 2026-12-02이다.
- Nginx 설정: `ops/nginx/tycheworks-starlight-sudoku.conf`
- 이전 주소 리디렉션 패치: `ops/nginx/tycheworks-starlight-sudoku-redirect.patch`

검증 결과는 다음과 같다.

- 메인 브랜치 자동 테스트 72개 통과
- 운영 브랜치와 운영 서버 자동 테스트 71개 통과
- Nginx 설정 검사 통과, PM2 애플리케이션 `online`
- 새 랜딩 루트와 프로젝트 아이콘 자산 HTTP `200`
- HTTP 요청은 새 HTTPS 주소로 `301` 이동
- 기존 `/starlight-sudoku-landing`과 `/starlight-sudoku-landing/` 요청은 `lang` 쿼리를 보존해 새 주소로 `301` 이동
- 랜딩 canonical·Open Graph URL과 SPARK 상세페이지의 랜딩 링크가 새 주소를 사용
- DB 마이그레이션, 운영 DB·환경 변수 변경은 수행하지 않았다.

## 2026-09-03 SPARK·별빛 스도쿠 최종 운영 상태

> 추가 반영: 별빛 스도쿠 상세페이지는 상단 글로벌·목차 네비게이션을 제거하고 언어 전환만 유지했다. 전체 본문과 푸터는 흰색·주황색 SPARK 공용 섹션 대신 하나로 이어지는 남색 별밤 배경과 별빛 골드 포인트를 사용한다. SPARK 홈과 전용 랜딩 복귀 경로는 마지막 본문 및 푸터에 유지한다.
>
> 공용 정책 보완: IMMERSA·SPARK·LOOP 각 라인 홈 푸터의 `COMPANY` 목록에 `https://tycheworks.com/privacy/` 공용 개인정보처리방침 링크를 추가했다.
>
> 상세 화면 가독성 보완: 별빛 스도쿠 상세페이지는 모든 본문 영역에 동일한 남색 별밤 배경을 끊김 없이 사용한다. 개요·게임 루프·마을 비교·복원에 있는 실제 반복 카드만 흰색에 가까운 아이보리로 표시하고, 복원 카드의 이미지 영역은 한 톤 진한 베이지로 구분한다. 프로젝트 정보와 마지막 배너는 기존 별밤 디자인을 유지한다.
>
> 상세 네비게이션·일본어 제목 보완: SPARK 글로벌 네비와 페이지 목차·언어 선택의 2단 헤더를 복원했다. 일본어 선택 시 브라우저 제목은 중국어와 구분되는 `スターライト数独 | TYCHE SPARK`로 표시한다.

오늘 작업은 SPARK 게임 라인과 첫 프로젝트인 별빛 스도쿠의 공개 경로를 다음처럼 분리하는 것을
최종 기준으로 삼았다.

| 역할 | 운영 주소 | 서버 상태 화면 표기 |
| --- | --- | --- |
| SPARK 게임 라인 홈 | `https://spark.tycheworks.com/` | `SPARK` |
| 별빛 스도쿠 상세페이지 | `https://spark.tycheworks.com/starlight-sudoku/` | `STARLIGHT SUDOKU` |
| 별빛 스도쿠 랜딩페이지 | `https://starlight-sudoku.tycheworks.com/` | `STARLIGHT SUDOKU LANDING` |
| LOOP 앱 라인 홈 | `https://loop.tycheworks.com/` | `LOOP` |

### 최종 적용 내용

- SPARK 홈은 IMMERSA 라인 홈과 같은 정보 구조를 따르되 SPARK의 게임 라인 색상과 콘텐츠를 사용한다.
- 별빛 스도쿠 상세페이지는 한국어·영어·일본어·중국어 간체·중국어 번체를 지원하며 전환 순서는
  `한 → EN → 日 → 中 → 繁`이다.
- 랜딩과 상세페이지는 서로 연결되고 `lang` 쿼리를 유지한다.
- 공급된 타이틀·마을·캐릭터 이미지는 원본 비율을 유지하며 `contain` 중심으로 표시한다.
- 브랜드 공용, 화학 안전 VR 전용, 별빛 스도쿠 전용 개인정보처리방침을 각각 구분했다.
- 화학 안전 VR과 별빛 스도쿠의 상세·랜딩 페이지는 각 프로젝트 전용 아이콘을 파비콘으로 사용한다.
- 별빛 스도쿠 랜딩 상단 `TYCHE SPARK · PROJECT 01` 링크는 최종적으로 흰색을 사용하고 hover에서만
  별빛 골드가 나타난다. 운영 CSS 캐시 기준은 `landing.css?v=20260903-4`다.
- 서버 상태 화면은 SPARK 홈, 별빛 스도쿠 상세, 별빛 스도쿠 랜딩을 별도 점검하고 LOOP는 독립 앱
  라인으로 유지한다.

### DNS 장애 원인과 복구

가비아 도메인의 네임서버 목록에 Vultr의 `ns1.vultr.com`, `ns2.vultr.com`과 가비아의
`ns.gabia.net`이 함께 등록되면서, 조회된 권한 DNS에 따라 정상 응답과 `NXDOMAIN`이 교대로 발생했다.
가비아 네임서버를 제거하고 아래 두 Vultr 네임서버만 남겨 복구했다.

- `ns1.vultr.com`
- `ns2.vultr.com`

Google Search Console 소유권 확인 TXT는 Vultr DNS의 `tycheworks.com` 루트에 TTL 3600초로 추가했고,
사용자 화면에서 인증 완료를 확인했다. 최종 점검에서는 Google Public DNS가 위 두 Vultr 네임서버를
응답했으며 `spark.tycheworks.com`과 `starlight-sudoku.tycheworks.com`이 모두
`158.247.238.180`으로 연결됐다.

### 최종 배포와 검증

- 메인 최종 콘텐츠 기준: `main@383ce6f9c964892b4c7b464c6606e98930150d23`
- 운영 최종 콘텐츠 기준:
  `production/spark-starlight-20260903@f4bdaaa6d1f1e5ed13a6b4f1fc37b35027fcaccd`
- 메인 브랜치 자동 테스트 74개 통과
- 운영 브랜치 자동 테스트 73개 통과
- 운영 Nginx 설정 검사 통과
- PM2 `tyche-safety-training-server` 상태 `online`, 불안정 재시작 0회
- SPARK 홈, 별빛 스도쿠 상세, 별빛 스도쿠 랜딩 모두 HTTP `200`
- 운영 랜딩 HTML이 `landing.css?v=20260903-4`를 참조하고 공개 CSS가 흰색 링크 규칙
  `.project-label{color:#fff;text-shadow:none}`을 제공하는 것을 확인했다.
- 운영 상세 HTML이 `detail.css?v=20260903-4`와 `i18n.js?v=20260903-3`을 참조하며 2단 상단 네비게이션과 언어 전환을 제공하고,
  끊김 없는 남색 별밤 배경 위에서 실제 반복 카드만 아이보리 표면을 사용하는 것을 확인했다.
- IMMERSA·SPARK·LOOP 운영 홈은 공용 개인정보처리방침 링크를 각각 한 번 제공하고,
  공용 정책 URL은 HTTP `200`으로 응답한다.
- DB 마이그레이션, 운영 DB와 사용자 데이터 변경은 수행하지 않았다.

## 2026-09-04 별빛 스도쿠 웹 체험판 운영 배포

별빛 스도쿠 전용 랜딩에 설치 없이 실행하는 쉬움 스테이지 1 체험판과 Google Play 전환 영역을
추가했다.

- 기능 브랜치 기준: `feature/starlight-web-demo@ea9497f5a37b6db08ab088fa20c45c8192d0f7e6`
- 운영 콘텐츠 기준: `production/spark-starlight-20260903@0679898d7150331c515284eeb1c2e790dabab4b6`
- 공개 주소: `https://starlight-sudoku.tycheworks.com/`
- 적용 내용: 쉬움 스테이지 1 스도쿠, 메모·지우기·재시작, BGM 재생 고지와 토글, 선택 셀
  노란색 강조, 완료 모달과 게임 초기 화면 복귀를 제공한다.
- 전환 요소: 상단 입점 준비 상태와 게임 조작 패널 하단·완료 모달의 Google Play 배지를
  제공한다. 입점 준비 상태와 게임 문구는 한국어·영어·일본어·중국어 간체·번체를 지원한다.
- 시각 연출: 산발적으로 배치한 고정 별과 금빛·아이보리 반짝임, 스크롤 진입 시 암부 해제,
  플레이 유도 버튼과 완료 배지 글로우를 적용했다. 모션 감소 설정에서는 반복 애니메이션을
  비활성화한다.

완료 검증은 다음과 같다.

- 기능 브랜치와 운영 브랜치 자동 테스트 각각 74개 통과, `git diff --check` 통과
- 운영 서버 fast-forward 반영 후 자동 테스트 74개와 `nginx -t` 통과
- 공개 랜딩 HTML과 `landing.css?v=20260904-31`, `landing-game.js?v=20260904-29`,
  `landing-i18n.js?v=20260904-30`이 HTTP `200`으로 응답
- BGM `level_starfall_grid.ogg`가 `audio/ogg`, 1,765,842바이트와 HTTP `200`으로 응답
- 공개 HTML과 JavaScript에서 한국어 `GOOGLE PLAY · 입점 준비 중`과 게임 초기화 함수를 확인
- 정적 파일을 Nginx가 직접 제공하므로 PM2와 Nginx를 재시작하지 않았다. DB 마이그레이션,
  운영 DB·환경 변수와 사용자 데이터도 변경하지 않았다.

### 후속 랜딩·GitHub Pages 전환

- 내부 1판 플레이 랜딩은
  `archive/1판플레이-랜딩-보존@757b3fa8d2c74181a019819132ab4f18e0d9eba0`에 보존했다.
- 상세 페이지 버튼과 GitHub Pages 팝업을 함께 제공한 랜딩은
  `archive/깃페이지스-팝업-랜딩-보존@9ab91a0cc287a72adc95ab1438a77a9e9753e0c2`에 보존했다.
- 운영 랜딩 기준은
  `production/spark-starlight-20260903@37804c1483975f59d88f91f8793ddd48b27a5a1e`이며,
  상세 페이지 버튼 없이 중앙 `지금 플레이해보세요` 버튼만 제공한다.
- 플레이 버튼은 `https://softcastella.github.io/Starlight-Sudoku/`를 데스크톱에서 최대
  `430x900` 크기의 별도 창으로 열고, 모바일에서는 새 탭으로 연다.
- 공개 게임 기준은 `softCastella/Starlight-Sudoku@253982fd4493006150ea12d8b8192640e67e06f0`이다.
  웹 브라우저의 자동재생 제한을 준수하도록 스플래시 뒤 `BGM ON` 입력에서 타이틀 음원을
  시작한다. Android 등 비웹 실행 흐름은 변경하지 않았다.
- 공개 게임의 언어는 브라우저·기기 선호 언어를 기준으로 한국어·영어·일본어·중국어 간체·번체를
  선택하며 지원하지 않는 언어는 한국어를 사용한다.
- 서버 자동 테스트 74개, Flutter 테스트 60개 통과와 1개 조건부 스킵, Flutter Pages release
  빌드, GitHub Pages 배포 작업, 운영 Nginx 설정 검사를 확인했다. 공개 랜딩·Pages·타이틀 BGM은
  모두 HTTP `200`으로 응답했다.

#### 후속 작업(미적용)

- 별빛 스도쿠 랜딩의 `지금 플레이해보세요` CTA 버튼을 현재 위치보다 조금 위로 조정한다.
- CTA의 외곽선, 글로우, 색상 대비와 모션을 보강해 더 눈에 띄고 화려한 핵심 전환 요소로
  개선한다. 모션 감소 환경과 모바일 레이아웃은 별도로 확인한다.
- Threads에 Tyche Spark 브랜드 계정을 개설하고 프로필·브랜드 정보를 정리한 뒤, 별빛 스도쿠
  랜딩과 웹 체험판을 소개하는 첫 게시물을 게시한다. 실제 게시 전 문안·이미지·연결 URL과
  계정 인증 상태를 최종 확인한다.
- 별빛 스도쿠 플레이 영상을 녹화하고 GPT와 Higgsfield를 활용해 트레일러를 제작한다. 원본
  플레이 영상, 생성에 사용한 프롬프트·소스와 최종 영상의 게임 화면·문구·음원·권리 관계를
  확인한 뒤 공개 채널에 사용한다.

## 2026-09-04 별빛 스도쿠 GitHub Pages 체험판 연결

랜딩 내부에 구현했던 쉬움 스테이지 1 체험판은 보존 브랜치로 분리하고, 운영 랜딩의
`지금 플레이해보세요` 버튼은 별빛 스도쿠 클라이언트 저장소가 배포하는 기존 GitHub Pages
체험판을 실행하도록 전환했다.

- 1판 플레이 랜딩 보존 기준:
  `archive/1판플레이-랜딩-보존@757b3fa8d2c74181a019819132ab4f18e0d9eba0`
- 운영 콘텐츠 기준:
  `production/spark-starlight-20260903@a7b835efc99ee7b28194b6b522663ab23b3e0989`
- 운영 랜딩: `https://starlight-sudoku.tycheworks.com/`
- 웹 체험판: `https://softcastella.github.io/Starlight-Sudoku/`
- 데스크톱에서는 웹 체험판을 가운데 정렬된 최대 `430×900` 팝업 창으로 열고, 화면이 작으면
  사용 가능한 영역에 맞춰 줄인다. 모바일에서는 브라우저의 일반 새 탭으로 연다.
- 랜딩 내부 게임 마크업과 게임 스크립트 참조는 제거했으며, 기존 산발형 고정 별과
  금빛·아이보리 반짝임은 `landing-launch.js`에서 유지한다.

완료 검증은 다음과 같다.

- 로컬과 운영 서버 자동 테스트 각각 74개 통과, JavaScript 구문 검사와 `git diff --check` 통과
- 운영 서버 fast-forward 반영 후 `nginx -t` 통과
- 공개 랜딩과 `landing-launch.js?v=20260904-32`가 HTTP `200`으로 응답
- 공개 랜딩 HTML에서 GitHub Pages 주소와 새 실행 스크립트 참조를 확인하고, 내부
  `play-demo`와 `landing-game.js` 참조가 제거된 것을 확인
- GitHub Pages 체험판이 HTTP `200`, `text/html`로 응답하는 것을 확인
- PM2와 Nginx를 재시작하지 않았고 DB 마이그레이션, 운영 DB·환경 변수와 사용자 데이터도
  변경하지 않았다.
