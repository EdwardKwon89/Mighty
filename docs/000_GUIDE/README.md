# 🎯 Claude Code 개발 환경 가이드

> 소프트웨어 개발 프로젝트를 위한 실무 설정 및 운영 가이드 모음

**최종 업데이트:** 2026-04-06

---

## 📚 Guide 문서 목록

### 1. **SMALL_TEAM_SETUP-EVALUATION.md**
**대상:** 1~5명 팀 소프트웨어 개발 프로젝트

```
내용:
  ├─ A++++ vs GSD+A++++ 설정 상세 비교
  ├─ 각 설정의 장점/문제점/보완안
  ├─ 1명/2~3명/4~5명 팀별 분석
  ├─ 하이브리드 설정 권장 (최적화)
  └─ 즉시 적용 가능한 체크리스트

추천 대상:
  ✅ 일반 소프트웨어 개발 팀
  ✅ MVP/프로토타입 프로젝트
  ✅ 설정 선택에 고민하는 팀
  ✅ 1~5명 규모 프로젝트

핵심 결론:
  → **하이브리드 설정 권장** (A++++ 기본 + GSD 선택적)
```

**파일 위치:**
```
docs/000_GUIDE/SMALL_TEAM_SETUP-EVALUATION.md
```

**빠른 시작:**
```bash
# 1. 문서 읽기
cat docs/000_GUIDE/SMALL_TEAM_SETUP-EVALUATION.md

# 2. 팀 규모 확인
# → 1~2명: A++++ 선택
# → 3명+: 하이브리드 선택

# 3. 설정 적용
# → .claude/settings.json 참고
```

---

### 2. **MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md**
**대상:** MLFF BOS Phase 3 구현 프로젝트 (190개 기능, GSD 기반)

```
내용:
  ├─ 개요: GSD + A++++ 오케스트레이션 전략
  ├─ 사전 준비: 환경 구성 체크리스트
  ├─ 설정 파일 생성: settings.json & CONTEXT.md
  ├─ 단계별 실행: Phase 3 시작부터 완료까지
  ├─ Wave별 절차: 190개 기능 추적 방법
  ├─ 모니터링: 진행 상황 추적
  ├─ 트러블슈팅: 일반적인 문제 해결
  └─ 체크리스트: 단계별 확인 사항

추천 대상:
  ✅ 대규모 구현 프로젝트 (100+ 기능)
  ✅ 장기 프로젝트 (3개월+)
  ✅ 팀 협업이 중요한 경우
  ✅ 기능 추적이 필수인 경우
  ✅ GSD 기반 감사 후 구현 단계

핵심 구조:
  → GSD Framework (메타 레벨)
  → A++++ Orchestration (실행 레벨)
  → Wave별 병렬 실행
```

**파일 위치:**
```
../MLFF_BOS/docs/000_GUIDE/MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md
```

**빠른 시작:**
```bash
# 1. MLFF_BOS 워크스페이스로 이동
cd c:/WorkSpaces/MLFF_BOS

# 2. 가이드 문서 확인
cat docs/000_GUIDE/MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md

# 3. Phase 3 시작
/gsd-new-project

# 4. 설정 적용
# → .claude/settings.json 생성 완료
# → .planning/CONTEXT_PHASE3.md 생성
```

---

## 🎯 설정 선택 플로우

```
┌─────────────────────────────────────┐
│  팀 규모 & 프로젝트 규모?           │
└─────────────────────────────────────┘
    │
    ├─ 1~2명 + MVP (1~3개월)
    │  └─ A++++
    │     → SMALL_TEAM_SETUP-EVALUATION.md 참고
    │
    ├─ 2~3명 + 중간 규모 (3~6개월)
    │  └─ 하이브리드 (A++++ + 경량 GSD)
    │     → SMALL_TEAM_SETUP-EVALUATION.md 참고
    │
    ├─ 3~5명 + 장기 (6개월+)
    │  └─ GSD+A++++
    │     → SMALL_TEAM_SETUP-EVALUATION.md 참고
    │
    └─ 대규모 (190+ 기능, 감사 기반)
       └─ GSD+A++++ (최적화)
          → MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md 참고
```

---

## 📋 문서 선택 가이드

### 질문 1: "어떤 설정을 써야 할까?"
→ **SMALL_TEAM_SETUP-EVALUATION.md** 읽기

### 질문 2: "190개 기능을 어떻게 관리할까?"
→ **MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md** 읽기

### 질문 3: "1~5명 팀에 최적인 설정은?"
→ **SMALL_TEAM_SETUP-EVALUATION.md** → 하이브리드 추천

### 질문 4: "GSD 기반으로 구현하려면?"
→ **MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md** 완독

---

## 🚀 즉시 시작하기

### **선택지 1: 현재 프로젝트 (PJT_2026_010)**
```bash
cd c:/WorkSpaces/PJT_2026_010

# 현재 A++++ 설정 사용
cat .claude/settings.json

# 가이드 참고
cat docs/000_GUIDE/SMALL_TEAM_SETUP-EVALUATION.md

# 팀 규모 확인 후:
# → 1~2명: A++++ 유지
# → 3명+: 하이브리드로 확장
```

### **선택지 2: MLFF_BOS 프로젝트**
```bash
cd c:/WorkSpaces/MLFF_BOS

# GSD+A++++ 설정 이미 구성됨
cat .claude/settings.json

# Phase 3 시작 가이드
cat docs/000_GUIDE/MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md

# Phase 3 초기화
/gsd-new-project
```

---

## 📊 설정별 특징 요약

| 항목 | A++++ | GSD+A++++ | 하이브리드 |
|------|-------|-----------|---------|
| **학습 난이도** | ⭐ 쉬움 | ⭐⭐⭐ 어려움 | ⭐⭐ 중간 |
| **초기 설정** | 30분 | 4시간 | 1시간 |
| **일일 관리** | 최소 | 3시간 | 1시간 |
| **1~2명 팀** | ⭐⭐⭐⭐⭐ | ⚠️ 과함 | ⭐⭐⭐⭐ |
| **3~5명 팀** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **빠른 개발** | ✅ 우수 | ⚠️ 느림 | ✅ 우수 |
| **팀 협업** | ⚠️ 약함 | ✅ 우수 | ✅ 좋음 |
| **장기 안정** | ⚠️ 약함 | ✅ 우수 | ✅ 우수 |

---

## 💡 권장사항

### **최고의 선택: 하이브리드**
```
A++++ 기본 + GSD 선택적 사용
→ 모든 팀 규모 대응
→ 유연한 확장
→ 오버헤드 최소화
```

### **빠른 시작을 원한다면:**
```
PJT_2026_010의 A++++ 설정 즉시 사용
→ 30분 내 프로젝트 시작 가능
→ 필요시 나중에 GSD 추가
```

### **구조화된 개발을 원한다면:**
```
MLFF_BOS의 GSD+A++++ 설정 참고
→ 체계적인 프로젝트 관리
→ 기능 추적 자동화
→ 팀 협업 명확화
```

---

## 📞 문서 피드백

각 문서에서 다루지 않은 내용이나 추가 질문이 있으면:

1. **SMALL_TEAM_SETUP-EVALUATION.md** 문서 끝의 "결론" 섹션 참고
2. **MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md** 문서 끝의 "참고 자료" 섹션 참고
3. `.claude/settings.json` 파일 직접 확인

---

## 📁 문서 구조

```
docs/000_GUIDE/
├─ README.md (본 문서)
├─ SMALL_TEAM_SETUP-EVALUATION.md (1~5명 팀 설정 가이드)
└─ MLFF_BOS-GSD-A_ORCHESTRATION-SETUP.md (190개 기능 관리 가이드)
```

---

**다음 단계:** 위 문서 중 하나를 선택하여 읽고, 팀에 맞는 설정을 적용하세요! 🚀
