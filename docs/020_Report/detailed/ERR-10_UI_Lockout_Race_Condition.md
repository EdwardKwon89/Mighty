# Audit Report: [ERR-10] Permanent UI Lockout during Trick Completion

## 1. 개요
트릭 종료 시 승리자 알림 애니메이션 과정에서 발생하는 레이스 컨디션으로 인해, 클라이언트의 `isAnimating` 상태가 `true`로 고착되는 현상. 이로 인해 사용자는 자신의 턴임에도 카드를 낼 수 없으며, 결국 서버의 타임아웃(60초)이 발생하여 봇으로 교체됨.

## 2. 원인 분석
- **State Race Condition**: 
    1. 트릭에 5번째 카드가 놓이면 클라이언트는 `isAnimating = true`를 설정하고 2초 타이머를 시작함.
    2. 서버는 1.5초 후 트릭을 정산하고 `currentTrick` 배열을 비움 (5 → 0장).
    3. 클라이언트의 `useEffect`는 `currentTrick.length`의 변화를 감지하고 **Cleanup** 함수 (`clearTimeout`)를 호출함.
    4. 타이머가 취소되면서 `setIsAnimating(false)`가 호출되지 못하고, 상태는 `true`에 머물게 됨.
- **Strict Turn Validation**: `handlePlayCard` 로직에서 `isAnimating`이 `true`일 경우 모든 요청을 거부하므로, 사용자는 무한 루프에 빠진 것처럼 느껴짐.

## 3. 조치 방법
- **Event-Driven Anchor**: 애니메이션 트리거를 휘발성인 `currentTrick.length`가 아닌, 명확한 정산 시점인 `lastTrickResult` 이벤트로 변경.
- **Guaranteed State Reset**: 
    - `useEffect`의 `else` 브랜치를 통해 `lastTrickResult`가 사라질(null) 때 강제로 `isAnimating`을 `false`로 리셋.
    - Cleanup 함수에서도 `setIsAnimating(false)`를 호출하여 예기치 못한 언마운트나 재진입 상황에서도 UI 락을 보장 해제.
- **Redundant Safety**: 정산 메시지가 3초 후 사라지는 시점에 한 번 더 잠금을 해제함으로써, 애니메이션 타이머와 무관하게 시스템 Interactive 상태 복구.

## 4. 검증 결과
- **정상 플레이 확인**: 트릭 종료 후 약 2초간의 알림창 노출 기간 이후, 플레이 버튼이 정상적으로 활성화됨을 확인.
- **로그 정밀 분석**: `isAnimating` 상태가 `lastTrickResult`에 따라 정확히 동기화되어 `true` → `false`로 전이되는 것을 확인.
- **무한 락 해소**: 서버 정산 지연(1.5초)과 클라이언트 애니메이션(2초) 간의 타이밍 충돌 상황에서도 턴 진행이 멈추지 않음.
