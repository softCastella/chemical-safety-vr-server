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
| `https://immersa.tycheworks.com/` | `public/site/immersa/index.html` |
| `https://immersa.tycheworks.com/chemical-safety-training` | `public/site/immersa/chemical-safety-training/index.html` |
| `https://spark.tycheworks.com/` | `public/site/spark/index.html` |
| `https://loop.tycheworks.com/` | `public/site/loop/index.html` |

사이트 내부 링크는 위 정식 HTTPS URL을 사용한다. `#contact`와 `#featured-releases`처럼 `#`이 붙은 값은 API가 아니라 같은 HTML 문서 안의 요소로 이동하는 앵커다.

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

문의 UI는 현재 표시되지만 제출 버튼은 `문의 폼 준비 중` 상태로 비활성화되어 있다. `/api/contact` 메일 전송 기능, SMTP/API 자격 증명과 운영 메일 연동은 적용하지 않았다. 기능을 다시 열 때에는 다음 항목을 함께 구현하고 검증해야 한다.

- 서버 측 길이·형식 검증과 허용 필드 목록
- 요청 속도 제한
- 허니팟 및 Cloudflare Turnstile 같은 스팸봇 방어
- CSRF와 Origin 정책 검토
- 로그에 이름, 이메일, 문의 본문을 불필요하게 남기지 않는 정책
- 운영 메일 공급자와 비밀정보의 저장소 외부 관리

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

이 검증은 정적 웹사이트, 서버 상태 대시보드와 현재 서버 회귀 테스트의 결과다. 실제 Unity 전송, VR 데이터 대시보드 운영 공개와 문의 메일 전송 성공을 의미하지 않는다.

## 배포에서 제외하거나 보류한 항목

- VR 데이터용 `/dashboard/`는 공개하지 않았다.
- 문의 폼 메일 전송은 보류했다.
- 서버 대시보드는 `VULTR_API_KEY`가 설정된 경우 Vultr Account API에서 최근 결제일을 조회하고, Vultr의 월별 청구 기준에 따라 다음 달 1일을 다음 청구서 발행 예정일로 표시한다. 운영 API 키는 저장소에 기록하지 않는다. API 키가 없거나 호출에 실패하면 대시보드에 실패 지점을 표시한다.
- OTP, Android 웹 푸시와 이메일 알림은 연결하지 않았다. 이메일 알림을 도입할 때에는 관리자 로그인 실패, 해외 IP 접속 시도, 서버 이상과 인증서 만료 임박을 우선 대상으로 삼고, 동일 IP·사유에 대한 발송 간격 제한과 중복 억제를 적용해 메일 폭주를 방지해야 한다. SMTP 자격 증명과 수신 주소는 저장소가 아닌 운영 환경 변수로 관리한다.
- 비정상 접속 이력의 국가 조회는 연결하지 않았다. 현재 감사 로그에는 발생 시각, IP 주소와 이벤트 종류만 저장하며 화면에는 `국가 조회 미연동`으로 표시한다. 향후 적용 시 접속 IP를 외부 업체로 전송하지 않는 MaxMind GeoLite2 Country 로컬 데이터베이스 방식을 우선 검토하고, 데이터베이스 정기 갱신과 조회 실패 처리를 포함한다. VPN·프록시 사용 시 실제 사용자 위치가 아니라 출구 IP의 국가로 판정되므로 국가 정보만으로 접속 원인이나 사용자 위치를 확정하지 않는다.
- 운영 비밀번호와 API 키는 저장소에 기록하지 않았다.
- 웹사이트 변경 사항은 현재 서버 작업 트리에 있으며, 커밋·푸시는 별도 확인 후 수행해야 한다.

## 관리자 대시보드 접근 정책

서버 상태 대시보드는 `admin.tycheworks.com`을 사용한다. 집과 학원 IP는 강제 허용목록이 아니라 신뢰 위치 판별에 사용한다. Android 휴대전화와 국내 이동 접속의 공인 IP가 바뀔 수 있으므로 국내 미등록 IP를 IP만으로 차단하지 않고 새 위치 접속으로 기록한다. 해외 접속 제한, OTP와 웹 푸시는 관리자 로그인과 상태 API가 안정화된 뒤 단계적으로 적용한다.

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
- 경고 배너의 `×` 또는 `상세 확인`을 누르면 현재 표시된 경고를 건별로 확인 처리한다. 비정상 접속은 DB 이벤트 ID, 서버 이상은 메모리·디스크·서비스·부하별 고정 ID로 구분하며, 확인한 동일 건은 다시 표시하지 않고 새로운 건만 배너로 알린다. 확인 상태는 브라우저 로컬 저장소에 보관한다.
- 서버 관리자 화면의 파비콘은 `/server-status/favicon.svg?v=2` 절대 경로로 제공해 상대 경로와 기존 브라우저 캐시 영향을 줄였다.
- Vultr Account API 연결은 운영 서버 공인 IP `158.247.238.180/32`만 허용하고, API 키는 운영 `.env`에서만 읽는다.

### 근본 원인과 영향 범위

- 기존 화면은 `1280px` 콘텐츠 영역과 폭 `100%`인 목록·표가 함께 적용돼 정보량보다 가로 폭이 과도하게 늘어났다. 서버 관리자 정적 화면의 레이아웃만 조정했으며 공개 사이트와 VR 데이터 대시보드에는 영향을 주지 않는다.
- 인증서 자동 갱신 표시는 인증서의 정적 문구만 사용해 실제 Certbot 타이머 상태를 구분하지 못했다. 현재는 `certbot.timer` 조회 성공·실패를 별도 상태로 반환한다.
- Vultr 결제 정보는 API 키 미설정, 계정 API 비활성화와 허용 IP 누락 시 조회할 수 없다. 대시보드는 이 경우 임의 값을 만들지 않고 실패 지점을 표시한다.
- 국가 열은 감사 로그의 IP를 국가로 변환하는 기능이 없어 미연동 상태다. 국가 조회가 추가되기 전에는 국가를 근거로 해외 접속 여부를 확정하지 않는다.
- 기존 경고 배너는 현재 경고 전체 조합을 문자열 하나로 저장하고 `×` 동작에만 연결했다. 따라서 상세 조회는 확인 처리되지 않았고 경고 한 건이 추가·삭제되면 이미 확인한 건까지 다시 표시될 수 있었다. 이번 변경은 경고별 식별자와 확인 이력을 분리하며 서버 상태 API에 기존 `alerts` 문자열 배열을 유지한 채 `alertItems` 식별 정보를 추가한다. 공개 사이트, VR 훈련 데이터와 클라이언트 계약에는 영향이 없다.

### 완료 검증

- Vultr Account API: 운영 서버에서 HTTP `200`, `last_payment_date` 필드 확인
- PM2: `tyche-safety-training-server` 재시작 후 `online`
- 로컬 헬스체크: `/api/health` 응답 `status: ok`
- 자동 테스트: 19개 통과, 실패 0개
- 의존성 검사: 운영 의존성 취약점 0개
- JavaScript 문법 검사와 `git diff --check`: 통과
- 파비콘: 로컬 Express와 `admin.tycheworks.com` HTTPS 경로에서 HTTP `200`

### 남은 수동 검증

- 실제 관리자와 `viewer` 계정으로 데스크톱·Android 화면의 너비, 숫자 페이지 이동, 선택 삭제와 현재 IP 자동 입력을 확인한다.
- 실제 브라우저에서 같은 보안 이벤트와 서버 이상 경고가 `×` 및 `상세 확인` 뒤 재표시되지 않고, 새 이벤트 발생 또는 서버 상태 정상화 후 재발 시에만 다시 표시되는지 확인한다.
- 인증서의 다음 점검 시각이 운영 서버의 `certbot.timer` 출력과 일치하는지 갱신 실행 이후 다시 확인한다.
- 이메일·웹 푸시·국가 조회는 보류 항목이며 구현 또는 실제 수집 성공으로 표시하지 않는다.

## MySQL 운영 구성

- MySQL: `8.4.10`
- 수신 주소: `127.0.0.1:3306` 전용, 외부 미공개
- 데이터베이스: `tyche_training`
- 애플리케이션 계정: `tyche_app`
- 비밀번호 파일과 `.env`: 권한 `600`, Git 제외
- 적용 마이그레이션: `001`부터 `008`까지
- 관리자 계정, 세션, 신뢰 IP와 감사 로그 테이블을 운영 DB에 적용함

관리자·DB 비밀번호, 임시 viewer PIN과 원문 세션 토큰은 문서나 저장소에 기록하지 않는다. 임시 viewer를 다시 발급하면 기존 PIN과 만료시간을 교체한다.

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
