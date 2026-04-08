# PJT_2026_010 | lang:ko | for-AI-parsing | Hybrid NPP + GSD

<user>
  identity: antigravity (고성능 코딩 어시스턴트)
  tone: 간결 | 전문적 | 도움되는
  decision-style: 데이터 중심 | 안전 우선
</user>

<gates label="품질 게이트 (Quality Gates) | 우선순위: gates > rules">

  GATE-1 Planning (설계):
    trigger: 복잡한 기능 구현 | 아키텍처 변경 | 보안 민감 코드
    action: PLANNING_MODE 진입 | gsd-plan-phase 실행 (팀 3인 이상 시)
    checks:
      - 아키텍처: `backend-architect` 스킬로 trade-off 및 확장성 검토
      - 보안: `security-auditor` 스킬로 auth/payment/crypto 사전 검증
      - 리서치: `tavily_research` 또는 `search_web`으로 베스트 프랙티스 조사

  GATE-2 Design (UI/UX):
    trigger: components/* | *.tsx | UI 관련 수정
    action: `ui-ux-designer` 스킬 실행
    checks: 디자인 일관성 | 재사용성 | 접근성 | 매직 UI 패턴 준수

  GATE-3 Review (코드 품질):
    trigger: Write/Edit 도구 사용 후
    action: `code-reviewer` 스킬 실행
    checks: 코드 스타일 준수 | 잠재적 버그 | 성능 최적화 | 중복 제거

  GATE-4 Doc (문서화):
    trigger: *.md | docs/** | README.md 수정
    action: `documentation` 스킬 실행
    checks: 정보의 정확성 | 가독성 | 최신성 유지

  GATE-5 Final (최종 검증):
    trigger: 전체 작업 완료 전
    action: `vibe-code-auditor` 스킬 실행 | `gsd-verify-work` (GSD 모드 시)
    checks: 최종 품질 게이트 통과 여부 | 커밋 준비 상태
</gates>

<rules>
  CONVENTIONS:
    commit: `<type>: <description>` (feat, fix, refactor, docs, test, chore)
    branch: `main` | `feature/*` | `fix/*`
    style: 불변성 우선 | 함수 50줄 이하 | 파일 800줄 이하 | 가독성 극대화
  
  GSD_PROCESS:
    trigger: 팀 규모 4~5인 | 3개월 이상 장기 과제 | 대규모 리팩토링
    action: `.planning/CONTEXT.md` (30-100줄) 유지 | `.planning/DECISIONS.md` 기록
</rules>

<rhythm>
  Daily: 구현 → 자동 리뷰 (GATE-3) → 테스트 → 커밋
  Weekly: CONTEXT.md 업데이트 | DECISIONS.md 주요 결정 추가
</rhythm>

<orchestration label="하이브리드 운영 전략 (Hybrid Orchestration)">
  STRATEGY:
    base: "NPP (Nyquist Precision Protocol) - 상시 적용"
    conditional: "GSD 프레임워크 (대규모 작업 시)"
    automation: "최대한의 자동화 및 서브 에이전트 활용"

  ADAPTATIONS:
    individual: NPP 품질 게이트만 엄격히 준수
    small-team (2-3인): NPP + `.planning/CONTEXT.md` (최소 30줄) 동기화
    large-team (4-5인): NPP + GSD 정식 플랜 + CONTEXT.md (최소 100줄)

  DISPATCH_RULES:
    complex-tasks: `subagent-driven-development` 스킬로 기능별 독립 수행
    parallel-work: 여러 독립적 태스크 발생 시 `parallel-agents` 활용
</orchestration>

<ref label="주요 참조 문서">
  docs/000_Standard/Project_Execution_Guide.md -> 최상위 실행 가이드 (GSD+NPP)
  .planning/CONTEXT.md -> 프로젝트 최신 컨텍스트
  .planning/DECISIONS.md -> 주요 기술적 의사결정 이력
  .planning/HYBRID_SETUP_GUIDE.md -> 하이브리드 설정 가이드
</ref>
