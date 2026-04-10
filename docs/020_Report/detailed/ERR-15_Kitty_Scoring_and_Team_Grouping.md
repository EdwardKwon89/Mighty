# [ERR-15] Kitty (Floor) Scoring Omission & Team Result Display

## 1. 개요 (Overview)
게임 종료 후 최종 점수가 예상보다 낮게 표시되는 현상 (예: 5점 획득 시 7점으로 표시되어야 하나 5점으로만 정산됨)과, 결과 화면에서 동맹 관계(주공-프렌드) 및 적대 관계가 명확히 구분되지 않아 직관성이 떨어지는 문제를 해결함.

## 2. 결함 분석 (Root Cause Analysis)
- **Kitty (Floor) Score 누락**: 주공이 카드 교환 단계에서 버린 3장의 카드(Floor Cards)가 서버 메모리에 저장되지 않아 게임 종료 시 점수 합산에서 제외됨.
- **Rule Engine Omission**: 마지막 트릭 승자가 주공 측일 경우 기루 점수를 가산해야 하는 마이티 기본 규칙이 서버 로직(`finishGame`)에 반영되지 않았음.
- **UI Information Gap**: 결과 모달에서 플레이어들이 단순 나열되어 있어, 누가 같은 팀인지와 누가 프렌드인지 즉각적인 확인이 불가능함.

## 3. 해결 방안 (Resolution)
### 서버 (Server-side)
- `GameRoom` 클래스에 `floorCards` 프로필 추가 및 `handleExchange` 단계에서 버려진 카드 저장 로직 구현.
- `finishGame` 메서드 업데이트: 
    - 트릭을 통해 얻은 점수(`trickScore`)와 바닥 점수(`floorScore`)를 분리 계산.
    - 마지막 트릭 승자 ID를 추적하여 주공/프렌드일 경우에만 기루 점수 가산 로직 적용.
    - `game-over` 이벤트 페이로드에 `trickScore`, `floorScore`, `bidderId`, `friendId` 필드 추가.

### 클라이언트 (Client-side)
- 결과 모달(`Result Modal`) UI 전면 개편:
    - **Team Grouping**: "Declarer Side (Master & Friend)"와 "Opposition Side" 섹션으로 플레이어를 자동 분류.
    - **Score Breakdown**: 최종 점수 카드 하단에 `Tricks: X + Kitty: Y` 구분 표시 추가.
    - **Role Badges**: 주공과 프렌드에게 각각 'Master', 'Friend' 전용 배지 부여 및 컬러 테마(Accent/Primary) 적용.

## 4. 검증 결과 (Verification)
- **7점 미스터리 해결**: 트릭 점수 5점과 바닥 점수 2점이 있을 때, 최종 결과에 `7 / 20` 및 `Tricks: 5 + Kitty: 2`가 표시됨을 확인 (PASS).
- **팀 분류**: 주공과 프렌드가 상단 'Declarer' 섹션에, 나머지 3명이 'Opposition' 섹션에 정확히 배분됨 (PASS).
- **프렌드 식별**: 프렌드 플레이어 옆에 'Friend' 라벨이 노출되어 팀 구성을 즉각 인지할 수 있음 (PASS).

## 5. 영향 범위 (Impact)
- `apps/server/src/game-room.ts`
- `apps/web/src/app/game/[id]/page.tsx`
- `packages/engine/src/rules.ts` (간접 참조)

---
*Created by Antigravity at 2026-04-10*
