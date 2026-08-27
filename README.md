# Tyche Chemical Safety Training VR Server

Tyche 화학 안전 교육 VR을 위한 Express API 서버, 정적 브랜드 웹사이트와 PPE 훈련 데이터 대시보드를 관리하는 비공개 저장소입니다.

Unity XR 클라이언트와 전체 프로젝트 문서는 별도 비공개 저장소 `softCastella/chemical-safety-vr-client`에서 관리합니다. 서버 작업에 필요한 공용 문서만 `Docs/SharedDocumentManifest.md`에 따라 이 저장소에 미러링합니다.

## 주요 기능

- 서버 상태 확인 API
- 사용자 CRUD API
- Unity 훈련 등록 데이터 수신 및 조회
- Unity 로컬 텔레메트리 세션 조회
- PPE 훈련 데이터 대시보드 제공
- Tyche Works 브랜드 및 VR 상세 웹페이지 제공
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
- 대시보드: `/dashboard/`
- 정적 사이트: `/`

사용자 CRUD, 로컬 훈련 등록과 텔레메트리 조회는 환경 변수로 활성화 여부를 제어합니다. 운영 적용 전 인증·권한, HTTPS, DB 마이그레이션과 데이터 보관 정책을 별도로 검증해야 합니다.

## 검증

기본 회귀 테스트는 다음 명령으로 실행합니다.

```bash
npm test
```

정적 테스트 통과를 운영 DB, 실제 Unity 전송 또는 배포 성공으로 확대 해석하지 않습니다. 최종 문서와 보고자료에는 서버와 클라이언트 저장소의 기준 커밋, 실제 원본 이벤트와 완료한 검증 범위를 함께 기록합니다.
