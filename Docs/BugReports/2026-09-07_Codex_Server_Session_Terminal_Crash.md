# Codex 서버 작업 세션 터미널 반복 종료 버그 리포트

## 상태

- 직접 종료 원인 확인 완료
- 근본 원인 후보 식별 완료
- Windows, Windows Terminal과 Fasoo DRM 업데이트 후 재현 검증 필요
- 운영 서버, 운영 DB, 배포와 저장소의 서버 코드는 변경하지 않음

## 현상

로컬 Windows PC에서 이 저장소의 서버 작업에 사용하던 터미널 창이 예고 없이 닫히고,
같은 창에서 실행 중이던 Codex 세션도 중단된다. `npm run dev`로 실행한 개발 서버는
PM2가 `--no-daemon` 모드로 터미널에 붙어 있으므로 터미널 종료의 영향을 함께 받는다.

저장소의 `npm run codex:session:find`로 같은 작업 경로의 이전 세션을 확인한 결과,
직전 작업은 정상 완료가 아니라 `turn_aborted` 상태로 기록되어 있었다. 개인 세션 ID와
대화 원문은 이 문서에 기록하지 않는다.

## 확인된 직접 원인

Windows 이벤트 로그의 `Application Error` 이벤트 ID `1000`과 Windows Error Reporting
이벤트 ID `1001`에서 `conhost.exe` 충돌이 반복 확인됐다. 최근 충돌은 모두 같은 실행 파일
버전과 같은 예외 오프셋을 사용한다.

- 오류 응용 프로그램과 모듈: `C:\Windows\System32\conhost.exe`
- 파일 버전: `10.0.22621.5415`
- 1차 예외: `0xc0000005` 접근 위반
- 후속 예외: `0xc000041d`
- 공통 예외 오프셋: `0x0000000000026eb8`
- 로컬 덤프 위치: `%LOCALAPPDATA%\CrashDumps\conhost.exe*.dmp`
- WER 보고서 위치: `%ProgramData%\Microsoft\Windows\WER\ReportArchive\AppCrash_conhost.exe_*`

최근 7일의 확인 시각은 다음과 같다. 각 시각 묶음에서 접근 위반과 후속 종료가 연속으로
기록됐다.

| 날짜 | 접근 위반 | 후속 종료 |
| --- | --- | --- |
| 2026-09-04 | 21:56:28 | 21:56:30 |
| 2026-09-05 | 00:01:17 | 00:01:20 |
| 2026-09-05 | 00:23:33 | 00:23:36 |
| 2026-09-07 | 17:06:04 | 17:06:08 |
| 2026-09-07 | 17:47:45 | 17:47:58 |
| 2026-09-07 | 18:38:00 | 18:39:01 |

2026-09-07 18:39의 `conhost.exe` 충돌과 직전 Codex 세션의 마지막 갱신 및
`turn_aborted` 기록이 같은 시간대에 일치한다. 같은 시간대의 PM2 애플리케이션 오류나
Express 예외는 확인되지 않았다. 따라서 현재 증거에서 직접 종료 주체는 서버 코드가 아니라
로컬 Windows 콘솔 호스트이다.

## 근본 원인 평가

### 강한 원인 후보: Fasoo DRM 콘솔 프로세스 주입

모든 보관된 `conhost.exe` WER 보고서에서 다음 Fasoo DRM 모듈이 로드된 상태가 확인됐다.
확인 범위는 2026-07-01부터 2026-09-07까지이며, 조사한 모든 보고서에서 두 모듈이 모두
존재했다.

- `C:\Program Files\Fasoo DRM\f_nxa.dll`
  - 파일 버전 `3.1.0.21`
  - 파일 수정 시각 `2021-07-09`
- `C:\Program Files\Fasoo DRM\f_sps.dll`
  - 파일 버전 `2.8.3.24`
  - 파일 수정 시각 `2021-09-01`
- 실행 중인 관련 프로세스: 32비트와 64비트 `fph.exe`

두 제3자 DLL이 콘솔 호스트에 주입되어 있고 파일이 2021년 버전이며, 반복된 모든 충돌
보고서에서 동일하게 발견됐다는 점 때문에 Fasoo DRM과 현재 Windows 콘솔 구성의 호환성
문제가 가장 강한 근본 원인 후보이다.

다만 WER의 오류 모듈 표시는 `conhost.exe`이며, 현재 PC에는 덤프 호출 스택을 분석할
Windows 디버거가 설치되어 있지 않았다. 그러므로 Fasoo DRM의 특정 함수가 직접 접근 위반을
발생시켰다고 아직 확정하지 않는다. 업데이트 전후 비교 또는 덤프 스택 분석이 필요하다.

### 환경 요인

- 운영체제: Windows 11 Pro 23H2, OS 빌드 `22631.5415`
- 해당 빌드 기준 업데이트: 2025-05-31 `KB5062170`
- Windows 11 Home/Pro 23H2 지원 종료: 2025-11-11
- 2026-09-07 기준 Microsoft가 안내하는 최신 일반 버전: Windows 11 25H2
- 설치된 Windows Terminal 패키지: `1.6.10571.0`, `1.12.10983.0`
- 확인 당시 Windows Terminal 안정판: `1.24` 계열
- 기본 터미널 위임 설정: `Automatic selection`

현재 Windows와 Windows Terminal이 장기간 업데이트되지 않은 상태이므로, 최신 콘솔 수정이
반영되지 않은 환경에서 구형 Fasoo DRM 모듈이 함께 로드되는 조합이 충돌 가능성을 높인다.

관련 공식 자료:

- [Windows 11 23H2 알려진 문제와 지원 상태](https://learn.microsoft.com/en-us/windows/release-health/status-windows-11-23h2)
- [Windows 11 Home/Pro 수명 주기](https://learn.microsoft.com/en-us/lifecycle/products/windows-11-home-and-pro)
- [Windows Terminal 릴리스](https://github.com/microsoft/terminal/releases)
- [Windows 콘솔 호스트와 기본 터미널 선택](https://support.microsoft.com/en-us/windows/apps/command-prompt-and-windows-powershell)
- [Codex 명령과 `codex resume`](https://learn.chatgpt.com/docs/developer-commands?surface=cli)

## 영향 범위

- Codex 대화 세션이 `turn_aborted`로 중단될 수 있다.
- 터미널 전면에서 실행한 명령과 자식 프로세스가 함께 종료될 수 있다.
- `npm run dev`는 `pm2 start ecosystem.dev.config.cjs --no-daemon`이므로 개발 서버가
  터미널과 함께 종료될 수 있다.
- SSH나 원격 서버 작업을 해당 로컬 터미널에서 수행 중이었다면 로컬 터미널 종료로 연결이
  끊길 수 있다. 이 사실만으로 원격 서버 프로세스가 종료됐다고 판단하지 않는다.
- 현재까지 API 코드, DB 연결, 텔레메트리 또는 운영 서버가 충돌의 시작점이라는 증거는 없다.

## 복구와 임시 우회

### Codex 세션 복구

같은 저장소 경로의 이전 세션을 먼저 찾고 현재 터미널에서 재개한다.

```powershell
npm run codex:session:find
npm run codex:session:resume
```

Windows 새 창 복구 명령은 다음과 같다.

```powershell
npm run codex:session:open
```

2026-09-07 조사에서는 `codex:session:open`이 `OPENED`와 PID를 출력했지만 첫 번째 실행의
부모 프로세스가 바로 종료되고 Codex 자식 프로세스가 남지 않은 사례가 있었다. 이후
`Start-Process`로 표시 창, 작업 경로와 `-NoExit`를 명시했을 때
`powershell.exe -> node.exe -> codex.exe` 프로세스 체인이 유지되고 세션이 복구됐다.
따라서 `OPENED` 출력만으로 복구 성공을 확정하지 않고 Codex 자식 프로세스 또는 실제 창을
확인한다.

### 개발 서버를 터미널과 분리

터미널 충돌을 해결하기 전 개발 PM2를 데몬 모드로 분리하면 창이 닫혀도 서버가 함께 종료될
가능성을 줄일 수 있다.

```powershell
npx pm2 start ecosystem.dev.config.cjs
npx pm2 status
```

`npm start`는 운영용 `ecosystem.config.cjs`와 `NODE_ENV=production`을 사용하므로 로컬 개발
우회 명령으로 임의 대체하지 않는다. PM2 분리는 콘솔 충돌 자체의 해결책이 아니며 개발 서버의
연쇄 종료만 줄이는 조치이다.

## 권장 해결 순서

1. 작업 파일을 저장하고 Windows Update에서 Windows 11 25H2로 업데이트한 뒤 재부팅한다.
2. Microsoft Store 또는 공식 배포 경로에서 Windows Terminal을 최신 안정판으로 업데이트한다.
3. Fasoo DRM이 조직 또는 서비스 이용에 필수라면 해당 관리자나 설치 제공처를 통해 최신
   호환 버전으로 업데이트하거나 재설치한다.
4. 정책상 허용되는 별도 검증 환경에서만 Fasoo DRM이 없는 상태와 있는 상태를 비교해
   `conhost.exe` 충돌 재현 여부를 확인한다. 필수 보안 프로그램을 임의로 제거하거나 정책을
   우회하지 않는다.
5. 업데이트 후에도 같은 오프셋으로 충돌하면 WinDbg에서 최신 덤프에 `!analyze -v`를 실행해
   예외 스레드의 호출 스택과 실제 호출 모듈을 확인한다.

## 완료된 검증

- 저장소 경로와 일치하는 중단 Codex 세션 확인
- 직전 세션의 `turn_aborted` 상태 확인
- 최근 7일 Windows Application 이벤트의 `conhost.exe` 충돌 시각, 예외 코드와 오프셋 대조
- 로컬 CrashDumps와 WER 보고서 존재 확인
- WER 보고서의 로드 모듈 목록에서 Fasoo DRM DLL 확인
- 보관된 `conhost.exe` 보고서 전체에서 두 Fasoo DLL의 반복 로드 확인
- Windows, Windows Terminal, Codex CLI와 Fasoo DLL 버전 확인
- PM2 로그와 3000 포트 상태를 대조하여 같은 시각의 서버 애플리케이션 충돌 증거가 없음을 확인
- 새 창 복구 후 PowerShell, Node와 Codex 자식 프로세스 생존 확인

## 남은 수동 검증

1. Windows 11 25H2 및 Windows Terminal 업데이트 후 최소 1시간 동안 Codex와 개발 터미널을
   함께 사용한다.
2. 같은 시간대에 새 이벤트 ID `1000`/`1001`과 `conhost.exe` 덤프가 생성되지 않는지 확인한다.
3. Fasoo DRM 업데이트 전후의 WER 로드 모듈 버전과 충돌 재현 여부를 비교한다.
4. 분리 실행한 개발 PM2의 `online` 상태, 재시작 횟수와 `/api/health` 응답을 로컬에서 확인한다.
5. 충돌이 계속되면 최신 덤프의 호출 스택을 분석하고 이 문서의 근본 원인 확정 여부를 갱신한다.
