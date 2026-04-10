# Audit Report: [ERR-07] 잘못된 카드 선택 시 퇴장 (Error Redirect Overkill)

## 1. 개요
플레이어가 선구 패를 따르지 않거나 낼 수 없는 카드를 냈을 때, 게임 규칙 위반 알림과 동시에 방(Room)에서 강제 퇴장되어 메인 화면으로 이동하는 현상.

## 2. 원인 분석
- **Global Error Handler**: `apps/web/src/hooks/useGame.ts` 및 이를 사용하는 `GamePage` 컴포넌트에서 소켓 `error` 이벤트를 수신할 때 일괄적으로 `window.location.href = "/"`를 실행하도록 구현됨.
- **Error Type Blindness**: 서버로부터 오는 에러가 '인증 실패(INVALID_TOKEN)'나 '방 없음(ROOM_NOT_FOUND)' 같은 치명적 오류인지, 아니면 '잘못된 카드 선택(Must follow lead suit)' 같은 단순 게임 규칙 에러인지 구분하지 못함.
- **Session Break**: 사소한 조작 실수에도 룸을 재입장해야 하는 번거로움이 발생하여 게임의 영속성(Persistence)이 깨짐.

## 3. 조치 방법
- **Error Filtering Logic**: 클라이언트의 에러 처리 `useEffect`에서 에러 메시지의 내용을 검사하는 로직을 추가함.
- **Conditional Redirect**: `INVALID_TOKEN` 또는 `존재하지 않는 방`이라는 문구를 포함한 치명적 오류인 경우에만 메인 화면으로 리다이렉트함.
- **Notice Alert**: 게임 규칙 위반 메시지의 경우, 리다이렉트를 수행하지 않고 사용자에게 경고(Alert)만 표시하여 해당 플레이어가 올바른 카드를 다시 선택할 수 있도록 개선함.

## 4. 검증 결과
- **규칙 위반 시 잔류**: 선구 패가 아닌 카드를 냈을 때 "게임 알림: Must follow lead suit" 메시지가 표시된 후에도 룸에 그대로 남아 카드를 다시 낼 수 있음을 확인.
- **치명적 오류 대응**: 존재하지 않는 방 ID로 강제 접근 시 기존처럼 "접근 오류" 메시지와 함께 메인 화면으로 정상 유도됨을 확인.
- **UX 연속성**: 단순 오류로 인해 전체 게임판이 증발하는 '방 폭발(Room Explosion)' 현상이 해결됨.
