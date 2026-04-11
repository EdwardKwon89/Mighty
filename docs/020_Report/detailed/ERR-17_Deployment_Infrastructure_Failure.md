# [오류 보고서] ERR-17: 배포 인프라 구축 및 권한 동기화 실패

## 1. 개요 (Overview)
- **ID**: ERR-17
- **오류 발생 일시**: 2026-04-11
- **분류**: 인프라 (Infrastructure / Deployment)
- **상태**: 해결 완료 (RESOLVED)

## 2. 현상 및 원인 (Symptoms & Causes)

### A. Render 서버 빌드 실패 (OOM & Version Mismatch)
- **현상**: `tsc` 컴파일 도중 `Status 2` 에러가 발생하며 빌드가 중단됨.
- **원인**: 
    1. Render Free Tier의 기본 메모리 제한으로 인해 TypeScript 컴파일 과정에서 `OUT_OF_MEMORY` 발생.
    2. Node.js 버전 미지정으로 인해 서버 환경과 로컬 환경 간의 불일치 발생.

### B. Vercel 자동 배포 차단 (Git Author Permission)
- **현상**: GitHub 푸시 후 Vercel 배포가 `Git author ... must have access to the team` 에러와 함께 중단됨.
- **원인**: 
    1. 로컬 Git 설정의 이메일 오타(`gami.com`)로 인해 Vercel 팀 멤버십 인증 실패.
    2. Vercel 팀의 엄격한 보안 정책으로 인해 신뢰할 수 없는 이메일 주소의 커밋 배포 차단.

## 3. 해결 조치 (Remediation Steps)

### A. Render 최적화
- `render.yaml` 내 `NODE_OPTIONS`에 `--max-old-space-size=2048` 추가하여 빌드 메모리 확보.
- `package.json` 및 `.node-version`에 Node.js 22(LTS) 명시적 선언.
- `apps/server/package.json`의 테스트 관련 타입 정의를 `dependencies`로 이동하여 빌드 가시성 확보.

### B. Vercel 권한 복구
- 로컬 Git 설정을 `edward2025.kwon@gmail.com`으로 수정.
- `git commit --amend --author="..."`를 통해 문제의 커밋 작성자 정보 수정 후 강제 푸시(`force push`).
- Vercel CLI 및 API를 통한 수동 재배포 트리거로 최종 연동 확인.

## 4. 검증 결과 (Verification)
- [x] Render 백엔드 서버 정상 구동 및 헬스체크 통과.
- [x] Vercel 프론트엔드 환경 변수(`NEXT_PUBLIC_SOCKET_URL`) 반영 완료.
- [x] 프론트엔드-백엔드 간 WebSocket 핸드셰이크 성공 확인.

## 5. 재발 방지 대책 (Prevention)
- 인프라 변경 시 사전에 로컬 Git `user.email` 정합성 체크 필수화.
- 모노레포 빌드 시 메모리 요구량을 고려한 프로파일링 설정 유지.
