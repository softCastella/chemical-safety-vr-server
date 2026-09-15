# Tyche Chemical Safety Training VR Server

Tyche 화학 안전 교육 VR을 위한 Express API 서버, 정적 브랜드 웹사이트와 PPE 훈련 데이터 대시보드를 관리하는 비공개 저장소입니다.

Unity XR 클라이언트와 전체 프로젝트 문서는 별도 비공개 저장소 `softCastella/chemical-safety-vr-client`에서 관리합니다. 서버 작업에 필요한 공용 문서만 `Docs/SharedDocumentManifest.md`에 따라 이 저장소에 미러링합니다.

## 주요 기능

- 서버 상태 확인 API
- 사용자 CRUD API
- Unity 훈련 등록 데이터 수신 및 조회
- Unity 로컬 텔레메트리 세션 조회
- PPE 훈련 데이터 대시보드 제공
- 별빛 스도쿠 익명 이벤트 수집·집계와 화면별 UX 히트맵 대시보드
- Tyche Works 브랜드 및 VR 상세 웹페이지 제공
- Resend 기반 웹사이트 문의 메일 API
- MySQL 사용자 데이터 저장과 SQL 마이그레이션
- PM2 기반 개발·운영 프로세스 실행

## 저장소 구성

- 애플리케이션 진입점: `src/server.js`, `src/app.js`
- 환경 설정: `src/config`
- DB 연결과 마이그레이션: `src/db`, `db/migrations`
- API 모듈: `src/modules`
- 정적 사이트와 대시보드: `public`
- 테스트: `test`, `test-support`
- 교차 저장소 공용 문서: `Docs`
- 운영 배포 구성과 검증 범위: `Docs/ProductionDeployment.md`
- 별빛 스도쿠 Analytics 계약과 운영 전 체크리스트: `Docs/StarlightSudokuAnalytics.md`
- Codex 작업 지침: `AGENTS.md`

## 개발 환경

- Node.js 20 이상
- Express 5.x
- MySQL 및 `mysql2`
- PM2
- npm

## 로컬 실행

```bash
npm ci
cp .env.example .env
npm test
npm run dev
```

`.env.example`의 값은 개발용 예시입니다. 실제 DB 비밀번호, 운영 자격 증명과 개인키는 Git에 커밋하지 않습니다.

## 주요 경로

- 상태 확인: `GET /api/health`
- 사용자: `/api/users`
- 훈련 등록: `/api/training-registrations`
- 로컬 텔레메트리: `/api/local-telemetry`
- 문의 메일: `POST /api/contact` (`ENABLE_CONTACT_FORM=true`일 때만 활성화)
- 대시보드: `/dashboard/`
- 별빛 스도쿠 분석 수집: `POST /api/starlight-analytics/events/batch` (`ENABLE_STARLIGHT_ANALYTICS_INGEST=true`일 때만 활성화)
- 별빛 스도쿠 관리자 집계: `GET /api/starlight-analytics/dashboard`
- 별빛 스도쿠 관리자 대시보드: `/starlight-analytics/`
- 정적 사이트: `/`

사용자 CRUD, 로컬 훈련 등록, 텔레메트리 조회와 문의 메일은 환경 변수로 활성화 여부를 제어합니다. 문의 메일을 켤 때에는 `RESEND_API_KEY`, Resend에서 인증한 `CONTACT_FROM_EMAIL`과 `CONTACT_TO_EMAIL`을 모두 설정해야 합니다. 운영 적용 전 인증·권한, HTTPS, DB 마이그레이션과 데이터 보관 정책을 별도로 검증해야 합니다.

## 검증

기본 회귀 테스트는 다음 명령으로 실행합니다.

```bash
npm test
```

정적 테스트 통과를 운영 DB, 실제 Unity 전송 또는 배포 성공으로 확대 해석하지 않습니다. 최종 문서와 보고자료에는 서버와 클라이언트 저장소의 기준 커밋, 실제 원본 이벤트와 완료한 검증 범위를 함께 기록합니다.

## Codex 이전 세션 복구

업데이트나 창 종료로 Codex 작업이 중단되면 저장소 루트에서 다음 하네스를 실행합니다.

```bash
npm run codex:session:find
```

하네스는 `$CODEX_HOME/sessions` 또는 기본 경로 `~/.codex/sessions`에서 현재 저장소와 작업 경로가 같은 세션만 찾습니다. Codex 안에서 실행할 때는 `CODEX_SESSION_ID`와 `CODEX_THREAD_ID`의 현재 세션을 자동 제외하며, 개인 대화 원문이나 세션 ID를 저장소에 복사하지 않습니다.

찾은 최신 이전 세션을 현재 터미널에서 이어가려면 다음 명령을 사용합니다.

```bash
npm run codex:session:resume
```

Windows에서 새 PowerShell 창으로 바로 열려면 다음 명령을 사용합니다.

```bash
npm run codex:session:open
```

다른 저장소의 동시 작업 세션은 작업 경로 비교에서 제외됩니다. 후보를 더 확인해야 하면 `npm run codex:session:find -- --limit 5`를 사용합니다.

선택 규칙 자체는 다음 명령으로 개인 세션을 읽지 않고 검증할 수 있습니다.

```bash
node Tools/CodexSessionRecoveryHarness.mjs --self-test
```

## 대시보드 명칭 변경 이력

- 핵심 현황: **훈련 개요 · 유입 현황**
- 병목 분석: **단계별 병목 분석**
- 사용자 메뉴·페이지: **유저 데이터**
- 커밋 `609afce`에서 반영하고 운영 서버 PM2 재시작까지 완료했다.

## 훈련 텔레메트리 DB 적재 확인

훈련 텔레메트리 수집 API는 기본적으로 비활성화되어 있다. 별도 테스트 DB에 `009`~`012` 훈련 텔레메트리 migration을 적용하고 다음 설정을 명시한 경우에만 API와 개발 확인 화면이 열린다.

```dotenv
ENABLE_TRAINING_TELEMETRY_INGEST=true
TRAINING_TELEMETRY_UPLOAD_TOKEN=replace-with-16-plus-ascii-token
```

- 개발 확인 화면: `/telemetry-ingest-test/`
- 세션 시작: `POST /api/training-telemetry/sessions`
- 이벤트 배치: `POST /api/training-telemetry/sessions/{sessionId}/events`
- 세션 완료: `POST /api/training-telemetry/sessions/{sessionId}/complete`
- 원본 조회: `GET /api/training-telemetry/sessions`, `GET /api/training-telemetry/sessions/{sessionId}`
- 자체 ID 인원 조회: `GET /api/training-telemetry/participants`, `GET /api/training-telemetry/participants/{participantId}`
- 자체 ID별 세션 조회: `GET /api/training-telemetry/sessions?participantId={participantId}`

현재 임시 Bearer 토큰은 로컬·통합 테스트용이며 출시 APK 인증 계약이 아니다. 출시 전 Meta User Proof를 서버에서 검증해 발급하는 단기 토큰으로 교체해야 한다. 실제 수집 출처는 새 클라이언트 저장소를 나타내는 `sourceProject=chemical-safety-vr-client`만 허용하며 이전 모노리포 JSONL은 DB 적재 대상으로 사용하지 않는다.

세션 시작 요청에는 새 클라이언트가 로컬에 보존하는 32자리 `clientInstanceId`가 항상 필요하다. Meta 테스트 ID가 있으면 숫자 문자열 `metaUserId`를 함께 보내고, 없으면 생략한다. 서버는 두 경우 모두 별도의 숫자형 `participantId`를 발급한다. 같은 Meta ID는 기기가 달라도 같은 `participantId`로, Meta ID가 없는 경우에는 같은 `clientInstanceId`가 같은 `participantId`로 묶인다. 공유 기기에서 서로 다른 사용자를 잘못 합치지 않기 위해 익명 ID와 나중에 확인된 Meta ID는 자동 병합하지 않는다.
