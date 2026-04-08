# Mighty Game Development Checklist

이 체크리스트는 과거에 발생한 오류(ERR-01~04)를 기반으로 작성되었습니다. 새로운 기능을 구현하거나 기존 코드를 수정할 때 반드시 다음 항목을 검토하십시오.

---

## 1. Phase Management & Turn Control (ERR-01 방지)
- [ ] **State Transition**: 상태가 변경(Bidding -> Exchanging 등)될 때 타이머가 적절히 클리어되고 재시작되는가?
- [ ] **Turn Sync**: `turnIndex` 또는 `currentBidderIndex` 변경 시 해당 플레이어가 존재하고 데이터가 유효한지 검증하는가?
- [ ] **Loop Safety**: 다음 턴 대상을 찾는 `while` 루프 등에 무한 루프 방지를 위한 `safeGuard` 또는 최대 반복 횟수가 설정되어 있는가?
- [ ] **Timeout Handling**: 모든 게임 상태(State)에 대해 타임아웃 발생 시 '자동 행동(Auto-action)' 로직이 구현되어 있는가?

## 2. Bot AI & Failsafe Strategy (ERR-02 방지)
- [ ] **Rule Alignment**: 봇이 선택한 카드가 엔진의 `canPlayCard` 유효성 검사를 통과하는가?
- [ ] **3-Tier Failsafe**: 봇 행동 로직에 다음 3단계 보호망이 구축되었는가?
    1. 전략적 행동 (Primary)
    2. 유효한 아무 카드 제출 (Failsafe)
    3. 강제 턴 넘김 / 강제 카드 제출 (Fatal Fallback)
- [ ] **Bot Delay**: 봇 행동 시 사용자 경험을 위해 적절한 인공 지능 딜레이(`setTimeout`)가 적용되었는가?

## 3. Session & Reconnection (ERR-03 방지)
- [ ] **Permanent ID**: 소켓 기반 식별이 아닌 레벨에서 플레이어를 식별(예: Nickname, Account ID)하고 있는가?
- [ ] **State Sync**: 소켓 연결 시 및 룸 입장 시 `game-state` API/Event를 통해 클라이언트의 상태를 최신으로 동기화하는가?
- [ ] **Graceful Rejoin**: 게임 진행 중 재접속 시 기존의 카드 덱, 비딩 정보, 트릭 획득 정보를 그대로 유지하는가?

## 4. Resource & Housekeeping (ERR-04 방지)
- [ ] **Data Cleanup**: 시뮬레이션이나 테스트 목적으로 생성된 데이터/방이 완료 후 자동으로 삭제되는 로직이 있는가?
- [ ] **Visibility Filtering**: 테스트용 데이터가 일반 사용자의 UI(예: 로비 목록)에 노출되지 않도록 필터링 처리되었는가?
- [ ] **Memory Management**: 사용되지 않는 룸(`GameRoom`) 인스턴스가 Map 또는 메모리 상에서 해제되는가?

## 5. UI/UX Consistency (Spec 불일치 방지)
- [ ] **Token Usage**: 새로운 컴포넌트 추가 시 아카이브된 `UI_UX_Spec.md`의 컬러 팔레트와 디자인 토큰을 따르고 있는가?
- [ ] **Responsive check**: 모바일 및 다양한 화면 크기에서 글래스모피즘(Glassmorphism) 효과와 레이아웃이 깨지지 않는가?
- [ ] **State Feedback**: 플레이어의 행동(비딩, 카드 제출) 결과가 실시간으로 시각적 피드백(애니메이션, 텍스트)을 주는가?

---

> [!TIP]
> **검증 방법**: 새로운 기능을 추가한 후 반드시 `npm run test`를 수행하고, 수동으로 5인 봇 시뮬레이션을 돌려 트릭 완료 및 게임 정산까지 'Stall' 없이 완주되는지 확인하십시오.
