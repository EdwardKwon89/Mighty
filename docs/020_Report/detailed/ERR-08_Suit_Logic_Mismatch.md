# Audit Report: [ERR-08] 마이티/조커콜 플레이 불가 (Suit Logic Mismatch)

## 1. 개요
조커콜이 되었는데 선구 패(Lead Suit)를 내지 못하거나, 마이티(Mighty) 카드를 낼 수 있는 상황임에도 "슈트를 따라야 함"이라는 오류가 나오며 플레이가 가로막히는 현상.

## 2. 원인 분석
- **String Representation Heterogeneity**: 슈트(Suit) 정보가 클라이언트에서는 약어(`S`, `H`, `D`, `C`)로, 엔진 및 서버에서는 전체 이름(`SPADE`, `HEART` 등)으로 취급되는 경우가 있음.
- **Strict Equality Pitfall**: `packages/engine/src/rules.ts`에서 슈트 일치 여부를 단순히 `card.suit === leadSuit`와 같은 엄격한 비교 연산자를 통해 확인하려 함.
- **Identity Mismatch**: 'S' 문자와 'SPADE' 문자열은 사람이 보기엔 같으나 코드 상에서는 다르므로, 플레이어가 올바른 카드를 제출했음에도 엔진은 이를 다른 슈트의 카드로 잘못 판단하여 제출을 차단함.

## 3. 조치 방법
- **Robust Helper Introduction**: 슈트의 표현 방식에 구애받지 않고 실제 의미가 같은지 판단하는 `isSameSuit` 헬퍼 함수를 `@mighty/engine`에 구현함.
- **Normalized Comparison**: 모든 `rules.ts`의 슈트 비교 로직(특히 `canPlayCard`와 `evaluateTrick`)에서 기존의 `===` 연산자를 `isSameSuit()` 함수 호출로 대체함. 이 함수는 문자열의 첫 글자가 일치하는 경우(예: 'S' vs 'SPADE') 동일한 슈트로 인식함.
- **Consistent ID Logic**: `getCardId`의 로직과 `isSameSuit`의 로직을 동기화하여 시스템 전반에서 카드의 아이덴티티가 일관되게 유지되도록 보장함.

## 4. 검증 결과
- **마이티 플레이 성공**: 다른 슈트가 선구로 나왔으나 마이티 카드(스페이드 에이스 등)를 냈을 때, 규칙 위반 알림 없이 정상적으로 트릭에 제출됨을 확인.
- **조커콜 정상 작동**: 선구 패가 슈트 표기 형식에 상관없이 동일한 패로 인식되어 조커콜 트릭이 올바르게 정산됨을 확인.
- **데이터 일관성**: 클라이언트와 서버 간의 데이터 포맷 차이에도 불구하고 게임 로직이 뒤틀리지 않는 견고한 아키텍처를 확보함.
