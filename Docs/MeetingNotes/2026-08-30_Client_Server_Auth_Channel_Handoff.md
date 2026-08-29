# 클라이언트-서버 인증·채널·텔레메트리 인수인계 회의록

- 일자: 2026-08-30
- 클라이언트 저장소: `softCastella/chemical-safety-vr-client`
- 클라이언트 브랜치: `main`
- 클라이언트 UI 반영 커밋: `b25814a018fb2c5a3c98b77e56385ca889abd35b`
- 서버 저장소: `softCastella/chemical-safety-vr-server`
- 서버 확인 브랜치: `main`
- 서버 검증 기준 커밋: `6512f0c8e65401e5e32b88c971961cf6aea90f22`
- 서버 미러·검증 결과 커밋: `5adc9ef647fd786f918db33ba1f698e61a5ce5b3`
- 서버 작업 트리: 기존 수정 파일이 남아 있어 clean 상태가 아님
- 동기화 상태: 서버 런처 문서 보강 완료 / 클라이언트 기준본 재동기화 필요 / 통합 검증 대기

## 목적

클라이언트와 서버 대화 채널의 자동 공유를 전제로 하지 않고, 현재 확인된 인증·로컬 서버·텔레메트리
상태와 서버 확인 요청을 파일 기준으로 인수인계한다. 이 문서의 기준본은 클라이언트 저장소에 두며,
서버 담당자는 같은 상대 경로로 미러링한 뒤 서버 브랜치와 커밋 SHA를 채운다.

## 현재 상태 요약

| 구분 | 상태 | 근거 또는 제한 |
|---|---|---|
| 클라이언트 로컬 텔레메트리 기록 | 확인 | 2026-08-29 Unity Editor 로그에 PPE 이벤트 JSONL 기록이 남음 |
| Meta 앱 범위 사용자 ID | 이번 실행에서 미확인 | 로컬 등록이 Meta ID 또는 활성 PPE 세션을 제한 시간 안에 확인하지 못하고 종료됨 |
| 로컬 Express 실행 | 확인 | 2026-08-30 현재 TCP 3000 listen 및 `GET /` HTTP 200 확인 |
| 로컬 등록 API | 서버 구현 확인 / 왕복 미검증 | 서버 라우트·테스트는 존재하지만 이번 Unity POST/GET 성공 근거가 없음 |
| 텔레메트리 업로드 API | 서버 구현·설정 확인 / 통합 미검증 | ingest 활성화와 서버용 token 설정은 확인했지만 Unity 수신·DB 적재 근거가 없음 |
| 대화 채널·큐 전달 | 로컬 런처 구현 확인 / 이번 전달 미검증 | `CodexPairLauncher`는 존재하지만 클라이언트 코드·Unity 로그나 대화 표시만으로 특정 메시지의 큐 전달 성공을 판단할 수 없음 |
| 출시 Player 업로드 | 미구현 | 현재 업로더는 Editor만 허용하고 Player에서는 업로드를 시작하지 않음 |

## 로컬 Codex Pair Launcher

### 위치와 역할

- 이 PC의 런처 경로는 `C:\Users\lanoc\Tools\CodexPairLauncher`다.
- 런처는 클라이언트·서버 저장소 밖에 있는 Windows용 로컬 도구이며, 확인 시점에는 별도 Git 저장소가 아니다.
- 같은 PC에서 Codex CLI 세션 두 개를 로컬 app-server에 연결하고 사용자가 명시적으로 요청할 때만 상대 세션에 메시지를 전달한다.
- 통신 대상은 `ws://127.0.0.1`뿐이다. `--remote`는 이 구성에서 외부 서버가 아니라 같은 PC의 Codex CLI 연결을 뜻한다.
- 자동 답장이나 무한 대화 루프를 만들지 않으며 프로젝트 파일 또는 Git 저장소를 자동 수정하지 않는다.

### 주요 명령

- `Setup.cmd`: 클라이언트·서버 저장소 경로와 로컬 릴레이 설정을 작성한다.
- `Self-Test.cmd`: 모델 턴을 시작하지 않고 런처 호환성과 임시 검사 세션을 확인한다.
- `Start-CodexPair.cmd`: 숨겨진 로컬 app-server와 클라이언트·서버 Codex 창을 시작하고, 호환되는 기존 중계기와 저장 세션이 있으면 재사용한다.
- `Start-Fresh-CodexPair.cmd`: 기존 세션을 재사용할 수 없을 때 새 세션 두 개를 만든다.
- `Send-ToClient.cmd`, `Send-ToServer.cmd`: 사용자가 입력한 메시지를 상대 세션의 새 턴으로 전달한다.
- `Open-SessionManager.cmd`: 세션 관리 화면을 연다.
- `Stop-CodexPair.cmd`: 런처가 시작한 로컬 app-server만 종료한다.
- `Logout-Codex.cmd`: 공용 PC 사용 후 Codex 인증정보를 제거한다. GitHub 인증정보는 별도로 관리한다.
- `Build-Zip.cmd`: 로컬 설정과 실행 로그를 제외한 배포 ZIP을 만든다.

### 설정과 보안 제한

- PC별 경로 설정은 `relay.local.json`에 저장되며 `.gitignore`와 배포 ZIP에서 제외된다.
- `relay.local.json`에는 저장소 경로, `listenHost`, port와 세션 재사용 여부만 두고 로그인 token이나 API key를 저장하지 않는다.
- `listenHost`는 반드시 `127.0.0.1`이어야 한다. `0.0.0.0`으로 열거나 집·학원 PC를 직접 연결하지 않는다.
- 로그인 token, API key, DB 비밀번호와 실제 사용자 데이터를 전달 메시지에 넣지 않는다.
- app-server 포트를 다른 프로세스가 사용하면 해당 프로세스에 임의 연결하거나 종료하지 않고 중단한다.
- 런처는 Codex CLI의 실험적 `app-server`, `--remote`, `queue`와 세션 프로토콜을 사용하므로 CLI 업데이트 뒤에는 `Self-Test.cmd` 통과 전 사용하지 않는다.

### 기록과 검증 경계

- 런처의 `queue`는 일시적인 대화 전달 수단이며 영구 작업 기록이 아니다. 완료 사실은 코드, 테스트 결과, Git 커밋과 `Docs/SharedDocumentManifest.md`의 공용 문서로 남긴다.
- 대화가 상대 Codex 화면에 보였다는 사실은 Unity 등록·텔레메트리 API 수신, Express 로그, MariaDB 적재 또는 대시보드 조회 성공을 의미하지 않는다.
- 이번 서버 문서 보강에서는 README, 명령 파일, PowerShell 스크립트 목록, `.gitignore`와 `relay.example.json`을 정적으로 확인했다. `Self-Test.cmd` 실행과 실제 양방향 메시지 전달은 이번 검증 범위에 포함하지 않았다.

## 클라이언트에서 확인된 계약

### Meta 계정 식별

- `Assets/Scenes/0_App.unity`의 `MetaPlatformIdentityProbe`는 `runOnStart=1`,
  `useMetaPlatformSdkInEditor=1`로 작성되어 있다.
- 식별 순서는 Platform SDK 초기화 → 앱 entitlement 확인 → `Users.GetLoggedInUser()` →
  앱 범위 사용자 ID 조회다.
- Editor 테스트 계정이든 일반 계정이든 현재 앱 ID에 대한 entitlement와 Meta Platform SDK 로그인
  컨텍스트가 유효해야 앱 범위 사용자 ID를 받을 수 있다.
- Editor 업로드용 Bearer token은 Meta 사용자 인증을 대체하지 않는다. 두 인증 경로는 분리해서
  검증해야 한다.

### 개발용 로컬 등록

- `TycheLocalTrainingRegistrationClient`는 `UNITY_EDITOR` 또는 `DEVELOPMENT_BUILD`에서만 설치된다.
- 기본 서버 주소는 `http://127.0.0.1:3000`이다.
- 전송 전제는 유효한 Meta 앱 범위 사용자 ID와 활성 PPE 모드 세션이다.
- 호출 계약은 다음과 같다.
  - `POST /api/training-registrations`
  - `GET /api/training-registrations/{sessionId}`
- POST 응답과 GET 재조회 결과의 `metaUserId`, `sessionId`가 클라이언트 요청과 일치해야 성공으로
  판단한다.

### Editor 텔레메트리 업로드

- `Assets/Scenes/0_App.unity`의 `TycheTrainingTelemetryUploader`는
  `enableEditorTestUpload=1`, `serverBaseUrl=http://127.0.0.1:3000`으로 작성되어 있다.
- 업로드 주소는 loopback만 허용한다.
- `TYCHE_TELEMETRY_UPLOAD_TOKEN`을 `Authorization: Bearer ...`로 전송한다. token 값은 문서나
  저장소에 기록하지 않는다.
- 호출 계약은 다음과 같다.
  - `POST /api/training-telemetry/sessions`
  - `POST /api/training-telemetry/sessions/{sessionId}/events`
  - `POST /api/training-telemetry/sessions/{sessionId}/complete`
- 현재 코드에서 Editor가 아닌 Player는 `출시 Player 인증은 아직 연결되지 않아 업로드를 시작하지
  않습니다.`를 기록하고 종료한다.

## 서버 저장소에서 확인된 상태

- 서버 검증 시작 기준은 `main@6512f0c8e65401e5e32b88c971961cf6aea90f22`이며, 미러와 검증
  결과는 `main@5adc9ef647fd786f918db33ba1f698e61a5ce5b3`에 푸시됐다.
- 서버 결과 커밋 뒤에도
  `Docs/MeetingNotes/2026-08-25_Production_Server_Meta_Horizon_Release_Plan.md`의 기존 수정은
  별도 미커밋 상태로 남아 있다.
- `src/app.js`에 `/api/training-registrations`와 `/api/training-telemetry` 라우터가 연결되어 있다.
- 등록·텔레메트리 라우트 구현과 관련 자동 테스트 파일이 존재한다.
- 서버 `.env` 파일이 있으며 다음 상태만 값 노출 없이 확인했다.
  - `ENABLE_LOCAL_TRAINING_REGISTRATION=true`
  - `ENABLE_TRAINING_TELEMETRY_INGEST=true`
  - `TRAINING_TELEMETRY_UPLOAD_TOKEN` 설정됨
  - DB 설정 키 5개 존재
- 2026-08-30 확인 시 Express가 TCP 3000에서 listen 중이었고 `GET /`은 HTTP 200을 반환했다.
- 위 확인은 서버 기동과 정적 구현 근거다. Unity 요청 수신, 인증 성공, DB 적재 및 재조회 성공을
  대신하지 않는다.

## 이번 클라이언트 UI 변경

- `Assets/Scripts/ScenarioDetailModal.cs`에서 시나리오 선택 화면과 모드 선택 화면을 표시할 때
  `EventSystem`의 현재 선택을 비우도록 변경했다.
- 맨 위 버튼을 자동으로 `.Select()`하던 경로를 제거해, 아무것도 선택되지 않은 상태에서 실제
  포인터 진입만 hover 색으로 보이게 했다.
- API, 데이터 계약, Meta 인증, 텔레메트리 및 서버 구현에는 영향이 없다.
- `Assembly-CSharp.csproj --no-restore` 정적 빌드는 오류 0개였고, 실제 Quest/OpenXR hover 표시는
  수동 확인이 남아 있다.
- 클라이언트 반영 커밋은 `b25814a018fb2c5a3c98b77e56385ca889abd35b`다.

## 서버 담당 확인 결과

- 등록 계약은 서버 구현과 자동 테스트 기준으로 클라이언트 계약과 일치한다.
  - `POST /api/training-registrations`는 `metaUserId`, `sessionId`를 포함한 요청을 저장한다.
  - `GET /api/training-registrations/{sessionId}`는 같은 `sessionId`의 등록을 재조회한다.
  - 자동 테스트에서 생성 응답 HTTP 201, `metaUserId`·`sessionId` 일치와 GET 재조회를 확인했다.
- 텔레메트리 계약도 서버 구현과 자동 테스트 기준으로 일치한다.
  - 세션 생성, 이벤트 적재, 완료 엔드포인트는 모두 Bearer 업로드 token을 요구한다.
  - `acceptedThroughSequence`, 중복 재전송, 완료 세션의 후속 이벤트 거부를 테스트한다.
- 2026-08-30 서버 `npm test` 결과는 34개 통과, 실패 0개다. 이는 서버 정적 계약과 격리 저장소
  동작의 회귀 확인이며 Unity 실제 요청이나 로컬 MariaDB 적재 성공을 대신하지 않는다.
- 서버 `src`와 `test`에는 대화 채널 또는 작업 큐 구현이 확인되지 않았다. 등록 저장소의 내부
  `writeQueue`와 MySQL 풀의 `queueLimit`은 대화 전달 큐가 아니다.
- Unity 요청의 HTTP 상태, 서버 수신 로그, MariaDB 적재와 같은 `sessionId` 재조회 근거가 없어
  통합 검증 상태는 계속 `대기`다.
- 위 결과는 서버 `main@5adc9ef647fd786f918db33ba1f698e61a5ce5b3`에서 확인됐고 이
  클라이언트 기준본에 반영했다.
- `로컬 Codex Pair Launcher` 절은 서버에서 후속 보강했으므로 클라이언트 기준본에 다시 동기화해야 한다. 서버 결과 커밋 SHA는 작업 결과에 별도로 기록한다.

## 다음 통합 검증 순서

1. 서버 브랜치/SHA와 로컬 서버 실행 로그를 기록한다.
2. Meta 앱 ID와 entitlement가 맞는 허용 계정으로 `0_App`부터 새 실행한다.
3. Unity 로그에서 Platform 초기화, entitlement, 앱 범위 사용자 ID 성공 단계를 구분해 확인한다.
4. PPE 모드 세션을 시작한 뒤 등록 POST와 GET 재조회를 확인한다.
5. 로컬 JSONL 생성과 텔레메트리 세션·이벤트·완료 API 수신을 대조한다.
6. 서버 DB의 `sessionId`, Meta 앱 범위 사용자 ID, 이벤트 순서가 원본 JSONL과 일치하는지 확인한다.
7. 위 증거가 모두 있을 때만 `통합 검증 완료`로 상태를 변경한다.

## 보안

- Meta 사용자 ID, 계정 ID, 비밀번호, access token, 업로드 token 원문을 이 문서에 기록하지 않는다.
- 사용자 식별이 필요한 검증 결과에는 마스킹 값 또는 일치 여부만 기록한다.
