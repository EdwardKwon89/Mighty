# Mighty Game: Master Design Document

This document serves as the comprehensive "Source of Truth" for the Mighty online card game project. It reflects all functional, technical, and design requirements implemented to date.

## 📌 Document Map

### 0. [Standard Execution Guide (000)](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/000_Standard/Project_Execution_Guide.md)
*GSD Workflow & NPP (Nyquist Precision Protocol) validation standards.*

### 1. [Requirements (005)](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/005_Requirement/Requirement.md)
*Core game rules, card rankings, and win/loss conditions.*

### 2. [Functional Specification](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/015_Design_Specification/Functional_Spec.md)
*Game phases (Lobby -> Result), Bidding logic, and Bot AI strategic behavior.*

### 3. [Technical Specification](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/015_Design_Specification/Technical_Spec.md)
*Monorepo structure, Socket.io event maps, Prisma database schema, and project tech stack.*

### 4. [UI/UX Specification](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/015_Design_Specification/UI_UX_Spec.md)
*Design system (Glassmorphism), color palette, typography, and interactive component flows.*

### 5. [Security & Performance](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/015_Design_Specification/Security_Performance.md)
*Authentication strategy, Socket-level verification, latency targets, and scalability plan.*

### 6. [Audit Report (020)](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/020_Report/Audit_Report.md)
*Historical analysis of past errors (ERR-01~04) and their resolutions.*

### 7. [Development Checklist (030)](file:///Users/edward.kwon/WorkSpace/PJT_2026_010/docs/030_Checklist/Development_Checklist.md)
*Mandatory quality gates for future development to prevent regressions.*

---

## 🚀 Key Improvements Reflected

- **Stability**: Full null-safety in server-side turn transitions (`handleTimeout`).
- **Sync**: Correct socket-to-nickname mapping ensuring `isTurn` signals are always accurate.
- **Bot AI**: Strategic logic with a robust 3-tier fallback to prevent any game-blocking stalls.
- **Verification**: End-to-end playability verified via automated browser subagents.

---
*Last updated: 2026-04-08*
