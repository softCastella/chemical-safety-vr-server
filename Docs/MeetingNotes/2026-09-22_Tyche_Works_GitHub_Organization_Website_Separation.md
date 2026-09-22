# Tyche Works GitHub 조직 전환 및 홈페이지 저장소 분리 회의록

- 일자: 2026-09-22
- 요청 유형: 구조 결정 및 이전 계획
- 현재 서버 저장소: `softCastella/chemical-safety-vr-server`
- 확인 브랜치와 기준 커밋: `main@82b649dd2c3e380511914df3ce6153177e84f92d`
- 현재 단계: GitHub 조직·홈페이지 저장소 생성, 로컬 1차 복사와 독립 테스트 커밋·푸시 완료, 배포 설정은 로컬 준비 중이며 운영 전환은 미수행

## 1. 배경과 목적

Tyche Works의 홈페이지, 화학물질 안전훈련 VR, 별빛 스도쿠와 Memoring을 개인 프로젝트가 아니라 Tyche Works의 자산으로 관리한다. 기존 개인 계정 저장소는 기업 PT와 기존 링크의 근거 자료로 남기고, 새 GitHub Organization에 독립된 저장소를 복사해 이후 개발과 배포의 공식 기준본으로 사용한다.

현재 서버 저장소에는 Express API, DB 마이그레이션, 텔레메트리와 함께 홈페이지·랜딩·대시보드 정적 파일이 포함되어 있다. 홈페이지 변경과 서버 변경의 배포 경계를 분리하기 위해 홈페이지 계열을 별도 비공개 저장소로 분리한다.

## 2. 확정한 GitHub 소유 구조

Tyche Works는 현재 법인 또는 사업자 등록이 없는 1인 프로젝트이므로 GitHub Organization 생성 화면의 소유 유형은 `My personal account`를 선택했다. 조직은 현재 개인 계정에 속하지만, Tyche Works의 제품과 브랜드 자산을 저장소 단위로 분리해 관리하는 공간으로 사용한다.

- 생성한 Organization: `Tyche-works`
- 생성한 홈페이지 저장소: `Tyche-works/tycheworks-website` (`Private`)
- 로컬 클론 경로: `C:\Users\lanoc\OneDrive\문서\Workspace\tycheworks-website`
- 홈페이지 저장소 기준 커밋: `main@19a41493ff07342391e3570ae066bc827b123a67`

권장 저장소 구조는 다음과 같다.

| 구분 | 저장소 역할 | 상태 |
|---|---|---|
| 홈페이지 계열 | 회사·브랜드·제품 홈페이지, 랜딩, 대시보드 UI와 공용 정적 자산 | `Tyche-works/tycheworks-website` 생성 및 1차 복사 완료 |
| 화학물질 안전훈련 VR 서버 | API, 인증, DB, 텔레메트리와 VR 대시보드 데이터 제공 | 기존 `softCastella/chemical-safety-vr-server`를 기준으로 조직에 독립 복사 예정 |
| 화학물질 안전훈련 VR 클라이언트 | Unity XR 클라이언트 | 기존 `softCastella/chemical-safety-vr-client`를 기준으로 조직에 독립 복사 예정 |
| 별빛 스도쿠 | 게임 프로젝트와 제품별 자산 | 현재 기준 저장소 확인 후 조직에 독립 복사 예정 |
| Memoring | 앱 프로젝트와 제품별 자산 | 현재 기준 저장소 확인 후 조직에 독립 복사 예정 |
| 공용 백엔드 | 문의, 분석, 푸시 등 비VR 공용 기능 | 홈페이지 분리 안정화 후 별도 분리 여부 결정 |

개인 계정의 기존 저장소는 삭제하거나 소유권 이전하지 않는다. 조직 저장소를 만든 뒤에는 조직 저장소를 공식 기준본으로 지정하고, 개인 계정 저장소는 PT와 기존 링크 보존본으로 유지한다. 두 저장소는 자동 동기화되지 않으므로 공식 기준본 전환 시점과 기준 커밋을 문서에 남긴다.

## 3. 홈페이지 계열 분리 범위

다음 화면과 정적 자산을 홈페이지 저장소의 관리 범위로 본다.

| 화면군 | 현재 서버 저장소 위치 또는 공개 기준 |
|---|---|
| Tyche Works 홈페이지 | `public/site/index.html` |
| 브랜드 페이지 | `public/site/brand` |
| IMMERSA | `public/site/immersa` |
| VR 상세페이지 | `public/site/immersa/chemical-safety-training` |
| SPARK | `public/site/spark` |
| 별빛 스도쿠 게임 상세 | `public/site/spark/starlight-sudoku` |
| LOOP | `https://loop.tycheworks.com/`에 대응하는 정적 파일 |
| Memoring 앱 상세 | `https://loop.tycheworks.com/memoring`에 대응할 페이지 |
| VR 랜딩 | `public/site/chemical-safety-vr-landing` |
| VR 대시보드 UI | `public/dashboard` |
| 별빛 스도쿠 대시보드 UI | `public/starlight-analytics` |
| 별빛 스도쿠 랜딩·웹 데모 | `public/site/starlight-sudoku-landing` |
| 서버 대시보드 UI | `public/server-status` |
| VR 상세기획서 홈페이지 | `public/site/immersa/chemical-safety-training/plan` |
| 공용 정적 자산 | `public/site/assets`, 공용 CSS·JavaScript, 개인정보처리방침, robots와 sitemap |

현재 `public/site/app/index.html`은 LOOP로 이동시키는 호환용 페이지이므로 Memoring 상세페이지의 기준 구현으로 확정하지 않는다. Memoring의 실제 페이지와 원본 위치는 이전 전에 별도로 확인한다.

## 4. 서버와 홈페이지의 경계

홈페이지 저장소에는 화면 파일을 두고, 기존 서버에는 데이터와 운영 기능을 유지한다.

### 홈페이지 저장소

- 공개 홈페이지, 브랜드와 제품 상세페이지
- 랜딩페이지와 공용 정적 자산
- VR·별빛 스도쿠·서버 대시보드의 HTML, CSS와 브라우저 JavaScript
- 홈페이지 정적 검사와 화면 계약 테스트
- 공개 사이트용 Nginx 설정 템플릿과 배포 문서

### 서버 저장소

- Express API와 관리자 인증·세션
- MySQL 연결과 마이그레이션
- VR 텔레메트리 수집·조회
- 문의, 별빛 스도쿠 분석, 출시 푸시와 공개 설정 API
- PM2와 API 프로세스 운영 설정

대시보드 UI를 홈페이지 저장소로 옮겨도 데이터 API는 기존 서버를 사용한다. `/api/training-telemetry`, `/api/starlight-analytics`, `/api/server-status` 등 현재 상대 경로와 동일 Origin 구조를 보존해 인증 쿠키와 API 연결이 끊기지 않도록 한다.

## 5. 로컬과 Linux 운영 배치

초기 분리 단계에서는 서버를 다른 장비로 옮기지 않고, 같은 Linux 서버에서 저장소와 배포 경로만 분리한다.

```text
/home/linuxuser/workspace/
├─ chemical-safety-vr/       # 기존 API 서버 저장소
└─ tycheworks-website/       # 새 홈페이지·대시보드 UI 저장소
```

공개 정적 사이트는 Nginx가 새 홈페이지 경로에서 제공하고, API 요청은 계속 `127.0.0.1:3000`의 Express로 프록시한다. 인증이 필요한 대시보드는 Express의 관리자 인증을 유지한 채 새 홈페이지 배포 경로의 화면 파일을 제공하도록 연결한다.

기존 사이트를 유지하면서 새 경로를 검증한 뒤 Nginx 루트만 전환한다. 정상 확인 전에는 기존 서버 저장소의 홈페이지 파일을 삭제하지 않으며, 별도의 공사중 페이지를 기본 전환 절차로 사용하지 않는다.

## 6. 용량과 무료 조직 적용 판단

2026-09-22 로컬 확인 기준 `public/site`는 228개 파일, 약 185.25MB이고 가장 큰 단일 파일은 약 6.95MB다. 현재 홈페이지 계열은 GitHub의 일반 Git 단일 객체 제한 100MB보다 작으므로 무료 조직의 비공개 저장소로 우선 분리할 수 있다.

프로젝트 저장소 이전 전에는 다음을 별도로 확인한다.

- 저장소별 `.git` 크기와 전체 Git 객체 크기
- 100MB 이상 단일 파일 존재 여부
- Git LFS 사용 파일과 저장·다운로드 사용량
- Unity의 `Library`, `Temp`, `Logs`, 빌드 산출물 제외 여부
- 대형 영상, 음원, FBX와 PSD의 관리 방식

GitHub Free for organizations의 Git LFS 무료 제공량은 저장공간 10GiB와 월 다운로드 대역폭 10GiB다. private 저장소용 GitHub Actions 제공량은 조직 기준 월 2,000분이며, Actions 산출물과 Packages 공용 저장공간은 500MB다. 이 500MB는 일반 Git 소스 저장소의 전체 용량 제한을 뜻하지 않는다.

## 7. 단계별 이전 순서

1. Tyche Works GitHub Organization을 생성한다.
2. 조직 안에 홈페이지용 비공개 저장소를 생성한다.
3. 로컬에 홈페이지 저장소를 별도 클론한다.
4. 기존 서버 파일을 삭제하지 않고 홈페이지·대시보드 UI를 복사한다.
5. 정적 테스트와 API 경로 계약을 분리해 검증한다.
6. 운영 Linux에 홈페이지 저장소를 별도 클론한다.
7. Nginx 정적 루트와 인증된 대시보드 파일 경로를 전환한다.
8. 공개 URL, 관리자 로그인과 각 대시보드 API 연결을 확인한다.
9. 홈페이지 분리가 안정화된 뒤 VR·별빛 스도쿠·Memoring 저장소를 조직에 독립 복사한다.
10. 마지막으로 비VR 공용 백엔드를 VR 서버에서 별도 분리할지 결정한다.

## 8. 완료 판정과 검증 기준

다음 항목을 각각 확인하기 전에는 홈페이지 분리 또는 프로젝트 이전 완료로 보고하지 않는다.

- 조직의 대상 저장소가 `Private`인지 확인
- 로컬과 Linux 클론의 원격 URL과 기준 커밋 확인
- 홈페이지, 브랜드, IMMERSA, SPARK, LOOP와 제품 상세 URL 응답 확인
- VR·별빛 스도쿠·서버 대시보드 로그인과 정적 자산 접근 확인
- 각 대시보드가 실제 API 응답을 조회하는지 확인
- 문의, 분석 수집, 푸시와 공개 설정 API 경로 확인
- `.env`, 운영 자격 증명, 개인키와 실제 사용자 데이터가 커밋되지 않았는지 확인
- 기존 개인 계정 저장소와 PT 링크가 유지되는지 확인
- Nginx 설정 검사와 전환 후 응답 헤더 확인
- 서버 코드가 변경된 경우 `npm test` 통과 확인

## 9. 현재 미수행 항목

이 회의록 갱신 시점까지 다음 작업을 완료했다.

- `Tyche-works` GitHub Organization 생성
- `Tyche-works/tycheworks-website` 비공개 저장소 생성
- 홈페이지 저장소 로컬 클론
- `public/site`, `public/dashboard`, `public/starlight-analytics`, `public/server-status` 복사
- 홈페이지 저장소 README와 기본 `.gitignore` 작성
- 한글 커밋 `089f1ece20d7d924f259e134a50d8da7a1e909d8`을 `origin/main`에 푸시
- 원본 281개 파일의 SHA-256 일치, 100MB 이상 파일 0개와 기존 서버 회귀 테스트 121개 통과 확인
- 새 홈페이지 저장소에 Node.js 20 기준 독립 정적·SEO·API 경로 계약 테스트를 구성하고 테스트 30개 통과 확인
- 한글 커밋 `19a41493ff07342391e3570ae066bc827b123a67`을 `origin/main`에 푸시
- 새 홈페이지 저장소에 Nginx 정적 루트 조각·배포 및 복구 문서를 추가하고, 서버에 `TYCHE_WEBSITE_PUBLIC_ROOT` 외부 정적 경로 선택 기능을 로컬로 준비(아직 커밋·푸시하지 않음)
- 홈페이지 저장소 테스트 35개와 배포 설정 검사 5개, 서버 회귀 테스트 123개 통과 확인

다음 작업은 아직 수행하지 않았다.

- 개인 계정 저장소의 삭제, 이전, Archive 또는 권한 변경
- 운영 Linux 클론과 Deploy Key 설정
- Nginx 설정 변경·reload
- PM2 재시작
- DB 마이그레이션 또는 운영 데이터 변경
- 공용 백엔드 분리

현재 운영 홈페이지와 대시보드 데이터 연결은 기존 서버 저장소와 배포 구성을 그대로 사용한다.

## 10. 남은 결정

- Memoring 상세페이지의 현재 원본과 신규 URL 구현 범위
- 조직 저장소를 공식 기준본으로 전환할 날짜와 기준 커밋
- 개인 계정 보존 저장소를 계속 활성 상태로 둘지 Archive할지 여부
- 비VR 공용 백엔드의 별도 저장소와 프로세스 분리 시점

VR 상세기획서 홈페이지는 공개용으로 운영하기로 결정했다.
