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
- `npm test`: 13개 통과, 실패 0개
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
- Vultr 결제 일정 API, OTP와 Android 웹 푸시는 연결하지 않았다.
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

대시보드는 메모리, SSD, 시스템 가동시간, 시스템 부하, 공개 서비스별 HTTPS 응답·응답시간, Nginx·Express·MySQL 포트 구분, 인증서 대상·등록일·만료일, 신뢰 IP와 로그인 실패 이력을 표시한다. 인증서나 개별 서비스 조회가 실패해도 전체 상태 API가 종료되지 않도록 실패를 별도 상태로 반환한다.

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
