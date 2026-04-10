# Audit Report: [ERR-11] Game Restart Server Crash (Missing Reset Method)

## 1. 개요
게임 종료 후 결과 화면에서 'Next Mission' 버튼을 클릭하여 게임을 재시작하려 할 때, 서버 프로세스가 예외를 던지며 즉시 종료(Crash)되는 현상. 이로 인해 모든 플레이어가 소켓 연결 오류(`xhr poll error`)를 경험함.

## 2. 원인 분석
- **Unhandled Socket Event**: 클라이언트에서 `restart-game` 이벤트를 송신하면 서버(`index.ts`)의 리스너가 이를 수신하여 `room.reset()`을 호출함.
- **Reference Error**: 그러나 `GameRoom` 클래스 내에 `reset()` 메서드가 정의되어 있지 않아 `TypeError: room.reset is not a function`이 발생.
- **Process Termination**: Node.js 서버 환경에서 비동기 핸들러 내부의 예외가 적절히 캐치되지 않아 전체 서버 프로세스가 다운됨.

## 3. 조치 방법
- **Implementation of `GameRoom.reset()`**: `GameRoom` 클래스에 게임 상태를 초기화하는 전용 메서드 추가.
    - 진행 중인 모든 타이머(`this.timer`, `this.botActionTimeout`) 제거.
    - 플레이어 수에 따라 방 상태를 `READY` 또는 `WAITING`으로 전환.
    - 비딩, 트릭, 점수 등 게임 플레이 관련 모든 필드(highBid, trumpSuit, collectedTricks 등) 초기화.
    - 모든 플레이어의 손패(`cards`) 및 비딩 상태(`isPassed`) 초기화.
- **State Broadcast**: 초기화 직후 `emit("update")`를 통해 최신 방 상태를 모든 클라이언트에 브로드캐스트하여 동기화.

## 4. 검증 결과
- **정상 재시작 확인**: 'Next Mission' 버튼 클릭 시 서버가 다운되지 않고 즉시 첫 번째 비딩 단계로 진입함을 확인.
- **리소스 정리 확인**: 새 게임 시작 시 이전 게임의 봇 액션이나 타이머가 잔류하지 않고 깨끗하게 초기화됨을 로그로 검증.
- **연속 플레이 테스트**: 3회 연속 게임 완수 및 재시작 시 시나리오에서 안정적으로 동작함.

---
*Created by Antigravity at 2026-04-09*
