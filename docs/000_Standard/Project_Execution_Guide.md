# Mighty Game: Master Project Execution Guide (v2.0)

본 문서는 마이티 프로젝트의 기술적 안정성과 품질을 보장하기 위한 표준 수행 가이드입니다. 모든 팀원(인간 및 AI)은 개발 및 검증 시 다음 절차를 엄격히 준수해야 합니다.

---

## 🏗️ 1. GSD (Get Stuff Done) 표준 워크플로우

GSD는 프로젝트의 요구사항을 명확히 하고, 계획에 따라 효율적으로 구현하는 기본 프레임워크입니다.

### 1단계: Discovery & Requirements
- **Goal**: 요구사항의 모호함을 제거하고 목표를 정립합니다.
- **Action**: `gsd-map-codebase`를 실행하여 현재 구조를 파악하고 `Requirement.md`를 최신화합니다.

### 2단계: Phased Planning
- **Goal**: 큰 작업을 수행 가능한 단위(Phase)로 쪼갭니다.
- **Action**: `PROJECT.md` 로드맵을 작성하고, 각 단계별 `PLAN.md`를 생성하여 검증 기준을 정의합니다.

### 3단계: Wave-based Execution
- **Goal**: 테스트 주도 개발(TDD)을 통해 기능을 구현합니다.
- **Action**: `gsd-execute-phase`를 통해 독립적인 작업들을 병렬로 처리하고, 원자적 커밋(Atomic Commits)을 유지합니다.

---

## 🛡️ 2. NPP (Nyquist Precision Protocol) 고도화 검증

NPP는 단순한 구현을 넘어, 시스템의 무결성을 보장하기 위한 **A++++급 심층 검토 프로토콜**입니다.

### [NPP-01] Deep Semantic Audit (DSA)
- **정의**: 코드의 실제 로직과 자연어로 작성된 요구사항 간의 '의미론적 일치'를 전수 조사합니다.
- **체크포인트**: 
    - 예: "조커 콜 조건(C3/S3)"이 단순한 코드 구현을 넘어, 특수 상황(조커가 이미 나옴 등)에서도 스펙대로 동작하는가?

### [NPP-02] Structural Integrity Sync (SIS)
- **정의**: 기술 아키텍처(Monorepo)와 디자인 시스템(Design Tokens)이 코드와 문서 간에 실시간으로 동기화되었는지 검증합니다.
- **체크포인트**:
    - `globals.css`의 Hex Code가 `UI_UX_Spec.md`와 100% 일치하는가?
    - `package.json`의 의존성이 `Technical_Spec.md`의 아키텍처 설명과 부합하는가?

### [NPP-03] Active Simulation Verification (ASV)
- **정의**: 실제 서비스 환경과 동일한 부하 및 시나리오에서 시스템의 한계를 테스트합니다.
- **체크포인트**:
    - **5-bot Full Play**: 봇들끼리 100판 이상의 게임을 완주하며 단 한 번의 'Stall(멈춤)'도 발생하는지 확인.
    - **E2E Browser Test**: 브라우저 서브에이전트를 활용한 실제 클라이언트 UI 흐름 검증.

### [NPP-04] Learning Assetization Loop (LAL)
- **정의**: 발생한 모든 오류를 문서화하고, 이를 방어 체계(Checklist)로 변환하여 시스템을 '자가 학습'시킵니다.
- **체크포인트**:
    - `Audit_Report.md` 작성 -> 해당 원인을 `Development_Checklist.md`에 반영 -> 다음 개발 시 자동 필터링.

---

## 🚦 3. 품질 게이트 및 필수 종료 프로토콜 (MANDATORY)

모든 작업 완료 및 PR 제출 전 다음 게이트를 통과해야 하며, 이는 **강제 규정**입니다.

1.  **Issue Documentation**: `docs/020_Report/detailed/`에 이번 작업과 관련된 오류 보고서를 작성하거나 기존 문서를 갱신했는가?
2.  **Checklist Update**: `docs/030_Checklist/Development_Checklist.md`에 새로운 기술적 발견이나 방어 로직을 반영했는가?
3.  **Full Audit Pass**: `docs/030_Checklist/audit_logs/`에 마스터 체크리스트의 모든 항목(CHK-01 ~ CHK-XX)을 전수 체크하고 PASS 결과를 기록했는가?
4.  **Final Verification**: 봇 시뮬레이션 또는 E2E 테스트를 통해 기능의 최종 무결성을 확인했는가?

> [!IMPORTANT]
> 위 4가지 단계가 완료되지 않은 상태에서의 작업 완료 선언은 규정 위반으로 간주됩니다.

---
*Created by Antigravity - Powered by Google DeepMind*
