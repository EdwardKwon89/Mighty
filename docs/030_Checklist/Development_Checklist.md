# Master Development Checklist

이 문서는 시스템의 품질을 유지하기 위한 **기술 상세 체크리스트**입니다.

> [!IMPORTANT]
> **필수 수행 규정 (Mandatory Procedure)**
> 모든 코드 수정 및 기능 구현 완료 전, 다음 절차를 반드시 수동으로 수행해야 합니다:
> 1. **오류 보고서 업데이트**: `docs/020_Report/detailed/`에 관련 보고서 작성
> 2. **체크리스트 업데이트**: 수정 과정에서 발견된 예외 상황을 본 문서에 반영
> 3. **전수 체크 및 로그 기록**: `audit_logs/`에 본 체크리스트의 모든 항목에 대한 검증 결과(PASS) 기록
> 
> 위 절차를 모두 통과한 후에만 작업을 '완료'할 수 있습니다.

| ID | Category | Description | Technical Criteria (Audit Point) |
|:---|:---|:---|:---|
| **CHK-01** | Phase | 타이머 생명주기 관리 | `transitState` 호출 시 `clearTimeout(this.timer)`가 반드시 선행되며, 새 상태 진입 직후 새로운 `setTimeout`이 할당되는가? |
| **CHK-02** | Phase | 인덱스 범위 안정성 | `turnIndex` 및 `bidderIndex`가 `0~4` 내에 있으며, 플레이어 제거 시 `isBot` 교체를 통해 배열 크기가 `5`로 유지되는가? |
| **CHK-03** | Phase | 루프 가드 구현 | `findNextPlayer` 등 재귀/반복 로직에 `safeGuard < 5` 또는 `while` 탈출 조건이 명시적으로 존재하는가? |
| **CHK-04** | Phase | 타임아웃 자동 행동 | 모든 `GameState`에 대해 `handleTimeout` 내에 유효한 기본 분기 로직(Auto-Pass, Auto-Play 등)이 구현되어 있는가? |
| **CHK-05** | Bot | 카드 유효성 검증 | 봇이 카드를 제출하기 전 `canPlayCard` 함수를 호출하여 리드 슈트 및 규칙 위반 여부를 서버 사이드에서 선검증하는가? |
| **CHK-06** | Bot | 3단계 Failsafe | 전략 AI 실패 시 -> 유효 카드 필터링 -> 최악의 경우 첫 번째 카드 강제 제출 로직이 계층적으로 설계되었는가? |
| **CHK-07** | Bot | 행동 지연 (UX) | `checkBotTurn` 시 400ms~1000ms 사이의 `setTimeout` 지연을 주어 인간 플레이어가 상황을 인지할 수 있는가? |
| **CHK-08** | Session | 탈취 방지 (Persistent) | 소켓 재연결 시 `socket.id`가 아닌 JWT 내의 `nickname` 혹은 `id`를 고유 키로 사용하여 상태를 복구하는가? |
| **CHK-09** | Session | 상태 동기화 (Join) | `join-room` 성공 직후 `broadcastGameState`를 통해 전체 플레이어 엔티티의 최신 스냅샷이 즉시 전송되는가? |
| **CHK-10** | Session | 정보 복구 (Rejoin) | 재입장 시 `this.players` 배열에서 기존 닉네임을 찾아 `cards`, `points` 등 핵심 데이터가 보존됨을 확인하는가? |
| **CHK-11** | Auth | 핸드셰이크 토큰 검증 | `io.use` 미들웨어에서 JWT 유효성 및 `SERVER_INSTANCE_ID` 정합성을 체킹하여 세션 오염을 방지하는가? |
| **CHK-12** | Resource | 테스트 방 자동 정리 | `cleanupInterval`이 가동 중이며, `PRIME_FIELD_TEST_` 접두사가 붙은 방이 12시간 이상 방치되지 않는가? |
| **CHK-13** | Resource | 로비 표시 필터링 | `broadcastRoomsList` 호출 시 테스트용 방 아이디가 일반 사용자 목록에 노출되지 않도록 필터링 처리되었는가? |
| **CHK-14** | Resource | 메모리 릭 방지 | 모든 플레이어가 방을 나갈 때(`length === 0`) `rooms.delete(roomId)`가 수행되어 인스턴스가 해제되는가? |
| **CHK-15** | Design | 글래스모피즘 표준 | `backdrop-filter: blur`, `border: 1px solid rgba(255,255,255,0.1)` 등 지정된 디자인 토큰이 CSS에 반영되었는가? |
| **CHK-16** | Design | 반응형 레이아웃 | `@media` 쿼리를 통해 모바일 해상도에서 카드 배열 및 액션 버튼이 겹침 없이 표시되는가? |
| **CHK-17** | UX | 실시간 피드백 | 버튼 클릭(`onClick`) 시 로컬 `isLoading` 상태 변화 혹은 스피너를 통해 즉각적인 인터랙션을 체감할 수 있는가? |
| **CHK-18** | UX | 트릭 지연 시간 가독성 | 트릭 마지막 카드 제출 후 서버에서 `1500ms` 지연 후 승자를 정산하여 시각적 흐름이 끊기지 않는가? |
| **CHK-19** | UX | 부드러운 에러 핸들링 | 비치명적 에러(규칙 위반 등) 발생 시 `redirect` 대신 `toast` 혹은 알림 문구를 사용하여 사용자 이탈을 방지하는가? |
| **CHK-20** | Engine | 슈트 비교 일관성 | 조커 리드 혹은 조커콜 상황에서 `leadSuit` 설정 로직이 `engine.canPlayCard`와 비즈니스적으로 일치하는가? |
| **CHK-21** | Engine | 게임 재시작 안정성 | `restart-game` 호출 시 `reset()` 메서드가 모든 타이머를 해제하고 게임 점수/상태를 깨끗하게 초기화하는가? |
| **CHK-22** | Engine | 점수 동기화 및 필드 고정 | `index.ts`의 `score` 필드와 `game-over` 이벤트의 `actualScore` 필드가 엔진의 `calculateScore` 결과와 정합성을 유지하는가? |
| **CHK-23** | Auth | 포인트 실시간 동기화 | 로비 접속 및 게임 종료 시 `getPlayerStats`를 통해 최신 포인트를 비동기로 호출하고 전역 배지에 반영하는가? |
| **CHK-24** | UX | 하이드레이션 안정성 | `localStorage` 등 브라우저 전용 API를 사용하는 UI는 `useEffect` 마운트 이후에 렌더링되도록 설계되어 SSR 결과와 충돌이 없는가? |
| **CHK-25** | Engine | 기루(Kitty) 점수 정산 | `finishGame` 시 마지막 트릭 승자가 주공 측일 경우 `floorCards` 내의 점수 카드가 최종 점수에 정확히 가산되는가? |
| **CHK-26** | UX | 팀별 결과 분류 | 결과 화면에서 주공/프렌드(Declarer Side)와 야당(Opposition Side)이 가시적으로 분리되어 표시되는가? |
| **CHK-27** | Deployment | 환경 변수 범용성 | 소켓 URL 주소가 `NEXT_PUBLIC_SOCKET_URL` 등 환경 변수로 관리되어 개발/운영 환경 가변성이 보장되는가? |
| **CHK-28** | Deployment | 서버 가용성 (Wake-up) | Render Free Tier 진입 시 `health` 체크 호출을 통한 자동 깨우기 로직이 프론트엔드 진입점에 존재하는가? |

---

> [!NOTE]
> 매 수정 시 모든 항목을 위 기술 기준에 따라 전수 검증하고, 감사 로그(`audit_logs/`)에 구체적인 근거와 함께 기록하십시오.
