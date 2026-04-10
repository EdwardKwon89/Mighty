# Audit Report: [ERR-12] Real-time Score Sync & Contract UI Visibility

## 1. 개요
게임 진행 중 각 플레이어가 획득한 점수 카드 개수(S)가 실시간으로 업데이트되지 않고 항상 0으로 표시되는 현상. 또한, 현재 게임의 으뜸패(Trump)와 목표 점수(Goal) 등 핵심 계약 정보가 화면 상단에서 명확하게 식별되지 않아 사용자가 게임 상황을 파악하기 어려운 문제.

## 2. 원인 분석
- **Score Data Mapping Omission**: 서버(`apps/server/src/index.ts`)의 `broadcastGameState` 함수 내에서 `score` 필드가 누락되어 실시간 점수 동기화가 이루어지지 않았음.
- **Settlement Field Mismatch**: 게임 종료 시 서버(`game-room.ts`)가 전송하는 필드명(`totalScore`)과 클라이언트 UI가 요구하는 필드명(`actualScore`)이 서로 달라, 최종 정산 화면에서 획득 점수가 표시되지 않는 문제가 식별됨.
- **UI Information Density**: 기존 UI 헤더에서 으뜸패와 계약 정보가 일반 텍스트 위주로 작게 표시되어 사용자가 상황을 파악하기 어려웠음.

## 3. 조치 방법
- **Score Synchronization Fix**:
    - 서버 브로드캐스트 로직에 `score: calculateScore(...)`를 적용하여 실시간 동기화 구현.
    - 서버의 `game-over` 이벤트 전송 데이터에 `actualScore` 필드를 추가하여 클라이언트 HUD와의 호환성 확보.
- **UI/UX Infrastructure Upgrade**:
    - **Header Restructuring**: 상단 헤더 영역에 `Trump`와 `Goal` 정보를 별도의 글래스모피즘 카드로 분리하고 아이콘 및 전용 컬러 테마를 적용.
    - **Visual Hierarchy**: 으뜸패 무늬의 크기를 키우고, 목표 점수를 강조하여 승리 조건을 상시 노출.

## 4. 검증 결과
- **실시간 및 최종 점수 노출 확인**: 트릭 종료 시 'S: {숫자}' 업데이트 및 최종 정산 화면의 'XX / 20' 표시가 정상 작동함을 확인.
- **엔진 계산 로직 검증**: 엔진의 `calculateScore` 함수가 10, J, Q, K, A 카드를 정확히 식별하여 점수를 가산함을 테스트를 통해 확증.

---
*Created by Antigravity at 2026-04-09*
