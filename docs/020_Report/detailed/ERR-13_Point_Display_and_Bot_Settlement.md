# [ERR-13] Player Point (P) Display & Bot Game Settlement

## 1. 개요 (Overview)
게임 화면과 로비에서 플레이어의 자산 정보(포인트, P)가 표시되지 않거나 `0`으로 고정되어 나타나는 문제와, 봇이 포함된 게임에서의 포인트 정산 규칙 미정립 상태를 해결함.

## 2. 결함 분석 (Root Cause Analysis)
- **서버 측 누락**: `authenticated` 이벤트 및 `lobby-info` 브로드캐스트 시 DB에서 실제 포인트를 조회하지 않고 하드코딩된 `"0"`을 전송함.
- **클라이언트 측 누락**: `useLobby` 훅 인터페이스에 `points` 필드가 정의되지 않았으며, UI 컴포넌트(`lobby`, `game`)에서 해당 데이터를 렌더링하는 로직이 부재함.
- **비즈니스 로직**: 봇과의 게임 시 인간 플레이어의 포인트 증감이 중단된 상태로 방치됨.

## 3. 해결 방안 (Resolution)
### 서버 (Server-side)
- `index.ts` 내 `broadcastLobbyStats` 및 `authenticated` 핸들러에서 `@mighty/database`의 `getPlayerStats`를 호출하여 최신 포인트를 동기화함.
- 봇 게임 시에도 인간 플레이어의 데이터는 `updateGameResult`를 통해 정산되도록 검증함.

### 클라이언트 (Client-side)
- `useLobby` 훅의 `Player` 인터페이스에 `points: string` 추가.
- 로비 헤더 내 유저 정보 영역 및 온라인 목록에 포인트 배지 추가.
- 게임 중 플레이어 원형 프로필 하단에 포인트 표시 추가.

## 4. 검증 결과 (Verification)
- **로그인**: 로그인 성공 직후 `100,000 P`(초기 지원금)이 헤더에 즉시 표시됨 (PASS).
- **로비 싱크**: 다른 플레이어가 접속하거나 상태가 바뀔 때 브로드캐스트를 통해 포인트가 지속적으로 업데이트됨 (PASS).
- **봇 게임**: 봇과의 게임 종료 후 승패에 따른 포인트 가감이 DB와 UI에 즉각 반영됨 (PASS).

## 5. 영향 범위 (Impact)
- `apps/server/src/index.ts`
- `apps/web/src/hooks/useLobby.ts`
- `apps/web/src/app/lobby/page.tsx`
- `apps/web/src/app/game/[id]/page.tsx`
