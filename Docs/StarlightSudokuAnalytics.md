# 별빛 스도쿠 Analytics 1차 구현

## 1. 목적과 현재 상태

별빛 스도쿠 랜딩과 웹 체험판의 익명 이용 흐름, 퍼즐 행동, 화면별 포인터 좌표를 한곳에서 분석하기 위한 1차 구현이다. 서버의 기존 Express 5, MySQL migration, 서버 관리자 세션 구조를 그대로 사용하고 별도 대형 프레임워크는 추가하지 않았다.

2026-09-10 현재 상태는 다음과 같다.

- 서버 수집 API, MySQL 저장소, 집계 계층과 관리자용 대시보드는 구현되었다.
- 대시보드는 실데이터가 한 건도 없을 때만 `샘플 데이터`를 명시해 표시한다. 실데이터가 존재한 뒤 선택한 필터 결과가 비어 있으면 샘플로 대체하지 않는다.
- 사용자가 제공한 웹 체험판 실제 화면 16장을 화면 순서와 상태별로 배치하고 Canvas 밀도 히트맵 배경으로 사용한다.
- Android는 화면과 필터 자리만 준비하고 `데이터 없음`으로 표시한다.
- 서버 랜딩은 Threads 등에서 들어온 UTM을 웹 체험판 링크까지 전달한다.
- 수집 기능은 기본 비활성화 상태다. migration 적용, 운영 환경 설정, 도메인/Nginx 결정과 배포는 수행하지 않았다.

## 2. 분석한 기존 구조

### 서버

- `src/app.js`가 기능 플래그에 따라 API와 정적 화면을 조립한다.
- `src/modules/server-admin`의 `tyche_admin_session` 쿠키와 `requireAdmin` 미들웨어가 기존 관리자 인증 경계다.
- `src/db/migrate.js`와 `db/migrations`가 순번 migration을 관리한다.
- `public/site/starlight-sudoku-landing`이 현재 별빛 스도쿠 전용 랜딩 원본이다.
- 기존 PPE 대시보드와 VR 텔레메트리는 별도 모듈이므로 수정하거나 결합하지 않았다.

### Flutter 앱과 WebDemo

- `Starlight-Sudoku`는 Android 앱 원본이며 이번 1차 서버 작업에서는 앱 수집을 연결하지 않았다.
- `Starlight-Sudoku-WebDemo`는 Flutter Web 화면을 사용한다. 별도 기능 브랜치의 실패 격리형 `StarlightAnalytics`, 웹 전송 계층과 `web/analytics.js`가 화면·오버레이·퍼즐 행동 이벤트를 만든다.
- 웹 런타임은 `localStorage` 익명 사용자 ID, `sessionStorage` 세션 ID와 UTM을 사용하고, 네트워크 실패가 게임 진행을 막지 않도록 전송을 기다리지 않는다.
- 고빈도 좌표는 자체 수집기로 보내고 GA4에는 주요 퍼널 이벤트만 보낼 수 있도록 분리되어 있다.

## 3. 구성과 경로

```text
별빛 랜딩 / Flutter WebDemo
  -> POST /api/starlight-analytics/events/batch
  -> starlight_analytics_events
  -> 서버 집계 계층
  -> GET /api/starlight-analytics/dashboard
  -> /starlight-analytics/
```

- 수집 API: `POST /api/starlight-analytics/events/batch`
- 집계 API: `GET /api/starlight-analytics/dashboard`
- 관리자 화면: `GET /starlight-analytics/`
- 관리자 화면과 하위 정적 자산, 집계 API는 기존 서버 관리자 세션이 필요하다.
- 수집 API는 기능 플래그, Origin 허용 목록, IP별 시간당 요청 제한, 1~100개 배치, 최대 256 KiB를 적용한다.
- `event_id` 고유 키와 `INSERT IGNORE`로 안전한 재전송을 허용한다.

집계 API 필터는 `from`, `to`, `platform`, `locale`, `source`, `campaign`, `stage`다. 날짜는 실제로 존재하는 `YYYY-MM-DD`만 허용하고 `stage`는 1~5만 허용한다.

## 4. 이벤트 규격

### 퍼널과 화면

- `landing_view`, `landing_cta_click`
- `game_open`, `game_ready`, `puzzle_start`
- `stage_1_start` ~ `stage_5_start`
- `stage_1_clear` ~ `stage_5_clear`
- `demo_complete`, `store_cta_click`
- `screen_view`, `screen_exit`, `session_end`, `game_exit`

### 게임 상호작용

- `cell_select`, `number_input`, `wrong_input`, `erase`
- `memo_toggle`, `memo_input`
- `hint_open`, `hint_used`, `restart`
- `pause`, `resume`, `settings_open`
- `language_open`, `language_change`
- `home_click`, `next_stage_click`, `village_click`

### 포인터

- `pointer_tap`
- 좌표는 `x_ratio`, `y_ratio` 0~1 값으로 저장한다.
- 함께 저장 가능한 문맥은 `screen_id`, `overlay_id`, `stage_id`, `puzzle_id`, `target_id`, `target_type`, `is_interactive`, viewport 크기, 화면/플레이 경과시간이다.
- 입력한 숫자나 메모 문자열 같은 사용자 입력 원문은 받지 않는다. `properties`도 서버 허용 목록의 문자열·숫자·불리언만 보존한다.

공통 문맥은 `event_id`, 익명 사용자 ID, 세션 ID, 플랫폼, locale, UTM source/medium/campaign/content/term과 발생 시각이다.

## 5. DB와 집계

`017_create_starlight_analytics_events.sql`은 원본 이벤트 테이블 하나를 추가한다. 퍼널·플레이 시간·단계 병목·히트맵은 원본 이벤트에서 조회 시 계산하므로 대시보드 UI와 저장 구조가 직접 결합되지 않는다.

제공 집계는 다음과 같다.

- Overview: 사용자, 세션, 게임 열기, 퍼즐 시작, 데모 완료, 전환율, 실제 플레이 시간
- Acquisition: UTM source/medium/campaign별 사용자·시작률·완료율
- Funnel: 각 단계 사용자, 이전/랜딩 대비 전환, 이탈, 다음 단계까지 평균 시간
- Play: session, active engagement, game screen, active play, clear, first action, first hint, exit 시간의 평균·중앙값·P75·P90
- Stage Analysis: 1~5단계의 시작·완료·이탈·재시작·시간·실수·힌트·메모·지우기·시도·다음 단계 전환
- Interaction과 Expectation Click
- Retention: 첫 방문일 기준 D1, D7, D30
- Web/Android 상태 비교

병목 점수는 `starlightBottleneckScore` 독립 함수다. 낮은 완료율, 높은 이탈/재시작/실수/힌트 비율과 긴 P90을 가중 합산하며 추후 실제 분포를 보고 가중치를 바꿀 수 있다.

## 6. 실제 화면 히트맵

웹 화면은 등장 순서와 비교 단위에 맞춰 다음처럼 나열한다.

1. 타이틀: BGM 선택 → 타이틀 → 타이틀 설정
2. 마을: 마을 보기 → 미션
3. 인트로: 인트로 1 → 인트로 2 → 인트로 3
4. 퍼즐 선택: 난이도 → 스테이지
5. 게임: 게임 → 일시정지 → 다시 풀기 → 게임 설정 → 게임 나가기
6. 데모 완료

같은 카테고리의 상태는 가로로, 카테고리는 세로로 배치한다. 각 캡처의 브라우저 상단 65px 아래 게임 영역에 정규화 좌표를 투영한다. 상세 화면과 모든 축소 화면에 Canvas radial gradient를 겹쳐 개별 점이 아닌 밀도 열로 표시한다.

유형 필터는 전체, 비기능 요소, 반복 클릭, 실수, 힌트 관련, 오래 머문 뒤 클릭이다. 게임 화면에는 단계 1~5 필터를 추가한다. 밀집 영역을 선택하면 이벤트 수, 익명 사용자 수, 화면 이벤트 비중, 대상 요소, 기능 여부와 평균 경과시간을 표시한다.

현재 `반복 클릭`은 같은 익명 사용자·화면·대상을 2초 안에 다시 누른 경우의 1차 휴리스틱이다. `오래 머문 뒤 클릭`은 클릭 시점의 `elapsed_screen_time` 가중치이며 시선 추적이나 실제 Attention 측정이 아니다.

## 7. 샘플과 실제 데이터 전환

- 전체 DB에 별빛 이벤트가 없으면 내장 샘플을 표시하고 화면 상단에 `샘플 데이터` 배지를 붙인다.
- 하나라도 실데이터가 생기면 집계 API 응답만 사용하며 `실시간 데이터` 배지를 붙인다.
- 이후 특정 기간이나 필터에 결과가 없으면 빈 상태를 표시한다. 샘플로 되돌아가지 않는다.
- Android는 별도로 실제 이벤트가 들어오기 전까지 항상 준비/No Data 상태다.

## 8. 환경변수

```dotenv
ENABLE_STARLIGHT_ANALYTICS_INGEST=false
STARLIGHT_ANALYTICS_ALLOWED_ORIGINS=https://softcastella.github.io
STARLIGHT_ANALYTICS_RATE_LIMIT_PER_HOUR=1200
```

- `ENABLE_STARLIGHT_ANALYTICS_INGEST`: 공개 수집 라우트 활성화. 기본값은 `false`다.
- `STARLIGHT_ANALYTICS_ALLOWED_ORIGINS`: 쉼표로 구분한 정확한 Origin 목록이다. 최종 랜딩/게임 호스트 결정 후 갱신한다.
- `STARLIGHT_ANALYTICS_RATE_LIMIT_PER_HOUR`: 프록시를 통해 확인한 IP 기준 프로세스 내 시간당 제한이다.

랜딩과 WebDemo의 `analytics-config.js`에는 collector URL, GA Measurement ID, enabled/debug 값이 있다. 현재 저장소의 랜딩 설정은 수집이 꺼져 있고 URL/GA ID가 비어 있다. 운영 값과 식별자를 코드에 하드코딩하지 않는다.

## 9. 로컬 검증

```powershell
cd C:\Workspace\chemical-safety-vr-server
npm ci
npm test
```

로컬 DB에 migration을 적용하고 관리자 계정으로 로그인해야 실제 DB 대시보드까지 확인할 수 있다. `npm run db:migrate`는 이 저장소의 미적용 migration 전체에 영향을 줄 수 있으므로 별도 테스트 DB에서 대상 목록을 검토한 뒤 실행한다. 이번 작업에서는 migration과 서버 프로세스를 실행하지 않았다.

## 10. 운영 연결 전 결정·작업

다음 순서로 진행한다.

1. 대시보드/collector의 최종 호스트와 WebDemo를 같은 Origin 아래 둘지 결정한다.
2. 개인정보처리방침에 익명 이벤트, 좌표, 보관기간, GA4 사용 여부와 삭제 기준을 반영한다.
3. 테스트 DB 백업과 migration 목록 확인 후 `017`을 적용한다.
4. 운영 CORS 허용 Origin, rate limit, 수집 플래그를 설정한다.
5. 랜딩과 WebDemo의 collector URL을 최종 HTTPS 주소로 지정하고 수집을 켠다.
6. 관리자 로그인 후 샘플 배지, 실제 전환, 필터, 화면별 히트맵을 검증한다.
7. Threads 링크는 예를 들어 `utm_source=threads`, `utm_medium=organic_social`, `utm_campaign`, `utm_content`를 게시물별로 다르게 붙인다.
8. 보관기간/삭제 job, 모니터링과 DB 용량 경고를 추가한 뒤 제한된 트래픽부터 연다.

### 반드시 먼저 해결할 식별 연속성

현재 랜딩은 Tyche 서버, WebDemo는 `softcastella.github.io`로 Origin이 다르다. UTM은 URL로 정상 전달되지만 브라우저의 `localStorage`와 `sessionStorage`는 Origin별로 분리되므로 랜딩의 익명 사용자/세션 ID가 게임의 ID와 자동으로 이어지지 않는다.

따라서 지금 상태에서 캠페인별 유입과 각 Origin 내부 행동은 측정할 수 있지만, `landing_view → game_open`을 동일 개인 기준으로 정확히 연결한 전환율과 평균 전환시간은 확정할 수 없다. 도메인 협의 때 다음 중 하나를 결정해야 한다.

- 권장: 랜딩과 WebDemo를 같은 Origin 아래 경로로 제공한다.
- 대안: 개인정보 영향을 검토한 짧은 수명의 서명된 handoff token을 사용한다.

지속 익명 ID를 URL에 그대로 노출하는 방식은 사용하지 않는다.

## 11. 이번 1차 범위 밖

- 운영 도메인, Nginx, DNS, TLS와 실제 배포
- 운영 DB migration 적용과 기존 데이터 백필
- Android 앱 수집과 앱 화면 캡처
- GA4/Clarity 프로젝트 생성 및 Measurement ID 설정
- 개인정보처리방침 최종 개정, 동의/옵트아웃 정책과 보관기간 자동 삭제
- 여러 PM2 인스턴스에 공통 적용되는 Redis/게이트웨이 기반 rate limit
- 실제 데이터로 병목 점수 임계값과 Rage Click 기준 보정
- 시선 추적 기반 Attention 분석

## 12. 검증 결과

- `npm test`: 101개 통과, 실패 0개
- 새 수집/집계/랜딩/대시보드 테스트: 8개 통과
- 새 JavaScript 파일 `node --check`: 통과
- 실제 MySQL 연결, migration 실행, 운영 collector 전송과 배포: 미수행
