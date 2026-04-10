# Audit Report: [ERR-06] 마지막 카드 가독성 저하 (Trick Visibility)

## 1. 개요
트릭의 마지막(5번째) 카드가 제출된 직후, 트릭 승자가 결정되고 테이블의 카드들이 즉시 사라져 다른 플레이어들이 누가 어떤 카드를 냈는지 확인하기 어려운 현상.

## 2. 원인 분석
- **Instant Finalization**: `apps/server/src/game-room.ts`의 `handlePlayCard` 로직에서 `currentTrick.length === 5`인 경우 즉시 `finishTrick()`을 호출함.
- **State Switch**: `finishTrick()` 내부에서 `currentTrick` 배열을 비우고 트릭 카운트를 올리기 때문에, 클라이언트는 5번째 카드가 렌더링되기도 전에 비어있는 트릭 상태를 수신하게 됨.
- **Visual Feedback Gap**: 사용자는 자신의 턴이 넘어가는 속도보다 카드가 사라지는 속도가 빨라 게임의 흐름을 놓치는 UX 저하를 경험함.

## 3. 조치 방법
- **Server-side Delay (Breathing Room)**: 5번째 카드가 제출되었을 때, 트릭 정산(`finishTrick`)을 수행하기 전 **1.5초의 지연 시간**(`setTimeout`)을 도입함.
- **Immediate Broadcast**: 5번째 카드가 나간 상태를 즉시 클라이언트에 알리기 위해 지연 시간 시작 전 `emit("update")`를 수행하여 마지막 카드가 테이블에 놓인 상태를 유지함.
- **Sequential Update**: 지연 시간이 종료된 후 트릭을 정산하고, 다시 한 번 상태를 브로드캐스트하여 정산된 결과(승자의 트릭 획득 등)를 반영함.

## 4. 검증 결과
- **카드 잔류 확인**: 5번째 카드가 테이블에 놓인 후 약 1.5초간 유지됨을 확인.
- **게임 흐름 안정성**: 지연 시간 동안에도 클라이언트-서버 간의 소켓 연결 및 상태 동기화가 정상 유지됨을 확인.
- **UX 만족도**: 트릭의 승패 결과를 육안으로 충분히 파악한 후 다음 트릭으로 넘어가는 부드러운 전환을 달성함.
