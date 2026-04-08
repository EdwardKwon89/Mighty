# 하이브리드 (A++++ + GSD 경량화) 설정 가이드

> PJT_2026_010 팀용 실전 가이드

**설정 완료일:** 2026-04-06  
**적용 대상:** 1~5명 팀  
**예상 효과:** 빠른 개발 + 팀 협업 동시 달성

---

## 📋 빠른 시작 (10분)

### 현재 상태
- ✅ `.claude/settings.json` — A++++ (Base) + GSD (Conditional) 설정 완료
- ✅ `.planning/CONTEXT.md` — 프로젝트 정보 템플릿 생성
- ✅ `.planning/DECISIONS.md` — 의사결정 기록 템플릿 생성

### 해야 할 일

**1단계: 팀 규모 확인**
```
□ 팀이 1명인가?     → A++++ 만 사용, 이 문서 끝
□ 팀이 2~3명인가?   → A++++ + 간단한 CONTEXT.md (30줄)
□ 팀이 4~5명인가?   → A++++ + GSD Plan + CONTEXT.md (100줄)
```

**2단계: CONTEXT.md 작성 (3~5분)**
```bash
# 파일 열기
cat .planning/CONTEXT.md

# 템플릿 채우기:
# 1. 프로젝트 개요
# 2. 팀 정보
# 3. 기술 스택
# 4. 주요 결정사항
```

**3단계: 첫 번째 기능 구현**
```bash
# A++++ 자동화 테스트
# (settings.json이 이미 모든 훅을 설정함)
code my-feature.js
# → PreToolUse hooks 자동 실행
# → 기능 구현
# → PostToolUse hooks 자동 리뷰
# → git commit
# → Stop hooks 최종 검증
```

---

## 🎯 팀 규모별 상세 가이드

### 👤 1명 팀

```
설정: A++++ 만 사용
비용: 거의 없음
프로세스: 자동화된 리뷰만

실행:
  1. 코드 작성
  2. A++++ 자동 리뷰 (PostToolUse)
  3. Commit
  4. 최종 검증 (Stop)
```

**체크리스트**
```
□ .claude/settings.json (A++++ 활성화됨)
□ 첫 기능 구현 시작
```

---

### 👥 2~3명 팀

```
설정: A++++ + 간단한 CONTEXT.md
비용: 1주일에 1시간
프로세스: 자동화 + 월 1회 의사결정 기록

실행:
  1. 코드 작성 (A++++ 자동화)
  2. 주요 결정사항 기록 (DECISIONS.md)
  3. 월 1회 팀 회의
  4. CONTEXT.md 업데이트 (분기별)
```

**체크리스트**
```
□ .planning/CONTEXT.md 작성 (30줄)
□ 팀 회의 일정 정하기
□ DECISIONS.md에 주요 결정 기록
□ 월 1회 코드 리뷰 미팅
```

**예시 워크플로우**
```bash
# Week 1: 초기 설정
cat .planning/CONTEXT.md
# 프로젝트 개요, 팀 정보, 기술 스택 작성

# Weekly: 결정 기록
echo "### [기술 선택] (2026-04-10)" >> .planning/DECISIONS.md
echo "**결정:** PostgreSQL 선택" >> .planning/DECISIONS.md

# Monthly: 팀 회의
# → 아키텍처 리뷰
# → CONTEXT.md 업데이트
```

---

### 👥👥 4~5명 팀

```
설정: A++++ + GSD Plan + 상세 CONTEXT.md
비용: 1주일에 1-2시간
프로세스: 자동화 + 주간 계획 + 팀 협업

실행:
  1. 코드 작성 (A++++ 자동화)
  2. 주간 계획 (GSD Plan, 15분)
  3. 팀 의사결정 기록 (DECISIONS.md)
  4. 주 1회 기술 의사결정 미팅
  5. CONTEXT.md 유지 (100줄)
```

**체크리스트**
```
□ .planning/CONTEXT.md 작성 (100줄)
□ 주간 계획 프로세스 설정
□ /gsd-plan-phase 학습 (필요시)
□ 주 1회 기술 의사결정 미팅
□ DECISIONS.md 활용
```

**예시 워크플로우**
```bash
# Monday: 주간 계획 (15분)
/gsd-plan-phase
# → 이번 주 기능 목록
# → 위험요소
# → 의존성

# Throughout week: 개발
# → A++++ 자동화

# Thursday: 기술 미팅
# → 진행 상황 검토
# → DECISIONS.md 업데이트
# → 예상 위험 논의

# Friday: 주간 정리
# → CONTEXT.md 업데이트
# → 다음주 계획 미리보기
```

---

## ⚙️ GSD 언제 사용할까?

### ✅ GSD 필수

```
□ 새로운 아키텍처 결정 필요
  → /gsd-new-project (1-2시간)

□ 3명 이상이 함께 작업할 부분
  → /gsd-plan-phase (30분)

□ 3개월+ 장기 프로젝트
  → /gsd-discuss (1시간)

□ 시스템 리팩토링
  → /gsd-plan-phase (1시간)
```

### ❌ GSD 불필요

```
□ 버그 수정 → A++++ 만 사용
□ 간단한 기능 (1-2일) → A++++ 만 사용
□ 문서 작성 → A++++ 만 사용
□ 의존성 업데이트 → A++++ 만 사용
```

---

## 📊 주간 관리 체크리스트

### Daily (자동화됨)

```
□ 코드 작성
□ PreToolUse 자동 검증 실행
□ 구현
□ PostToolUse 자동 리뷰 실행
□ Commit
□ Stop 최종 검증 실행
```

### Weekly (팀 규모별)

**2~3명:**
```
□ 주요 결정사항 DECISIONS.md에 기록
□ 코드 리뷰 (월 1회)
```

**4~5명:**
```
□ Monday: /gsd-plan-phase (주간 계획, 15분)
□ Thursday: 기술 미팅 (1시간)
□ Friday: CONTEXT.md 업데이트 (30분)
□ Throughout: DECISIONS.md 기록
```

---

## 🔄 CONTEXT.md 유지보수

### 언제 업데이트?

```
변경: 팀 인원 변동 → 즉시
변경: 기술 스택 변경 → 즉시
변경: 아키텍처 결정 → 즉시
변경: 주요 위험 발생 → 즉시

정기: 매주 (4~5명 팀)
정기: 분기별 (2~3명 팀)
정기: 반년별 (1명 팀)
```

### 어떻게 작성?

```
팀 1명: 10~20줄 (선택사항)
팀 2~3명: 30줄 (필수)
팀 4~5명: 100줄 (상세히)

읽기 시간: 2~5분 이내
```

---

---

## 🌌 Antigravity 전용 가이드

Antigravity는 별도의 JSON 설정 없이 `CLAUDE.md`의 행동 규칙을 통해 "A++++ + GSD" 워크플로우를 실행합니다.

### 1. 설정 확인
- `CLAUDE.md` 파일에 `<gates>` 및 `<rules>` 섹션이 포함되어 있는지 확인합니다.
- Antigravity는 매 작업 단계마다 이 규칙을 참조하여 품질 게이트를 제안합니다.

### 2. Antigravity의 품질 게이트 작동 방식
- **구현 전 (GATE-1):** 복잡한 로직이나 아키텍처 변경 시, Antigravity가 자동으로 `PLANNING_MODE` 진입을 제안하거나 관련 설계 스킬(`backend-architect`) 사용을 권장합니다.
- **구현 도중 (GATE-2):** UI 작업 시 `ui-ux-designer` 스킬을 통해 디자인 시스템 준수 여부를 확인합니다.
- **구현 후 (GATE-3):** 코드 작성이 끝나면 `code-reviewer` 스킬을 사용하여 코드 품질을 자가 진단합니다.
- **완료 전 (GATE-5):** `vibe-code-auditor`를 통해 전체적인 안정성을 최종 검증합니다.

### 3. GSD 활용 (팀 프로젝트)
- 4~5인 팀의 경우, Antigravity에게 `.planning/CONTEXT.md` 업데이트를 요청하여 프로젝트의 'Single Source of Truth'를 유지하세요.
- 주요 결정 사항은 반드시 `.planning/DECISIONS.md`에 기록하도록 지시하십시오.

---

## ✨ 성공 지표

### 1주일 후

```
□ A++++ 자동화가 모든 commit에서 작동
□ CONTEXT.md 초안 완성 (30줄)
□ 첫 기능 구현 완료
□ code-reviewer 자동 검증 확인
```

### 1개월 후

```
□ 의사결정 기록 (DECISIONS.md) 5개+ 항목
□ CONTEXT.md 정기 업데이트 습관화
□ 팀 협업 효율 증대 (비교: 설정 전)
□ 콘텍스트 손실 최소화 확인
```

### 3개월 후

```
□ 장기 프로젝트 안정성 향상
□ 새로운 팀원 온보딩 시간 30% 단축
□ 아키텍처 결정 추적성 100%
```

---

## 📞 다음 단계

1. **팀 규모 확인** → 위의 해야 할 일 따라하기
2. **CONTEXT.md 작성** → 3~5분
3. **첫 기능 구현** → A++++ 테스트
4. **주간 리듬 설정** → 팀 규모에 맞는 체크리스트 사용

---

**마지막 업데이트:** 2026-04-06  
**문제 발생 시:** `.claude/settings.json` 확인 → 파일 구조 검증 → 자동화 테스트
