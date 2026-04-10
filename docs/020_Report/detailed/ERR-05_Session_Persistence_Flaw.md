# Audit Report: [ERR-05] Session Persistence Flaw (Unauthorized Auto-login)

## 1. 개요
시스템 재시작(`npm run dev`) 후 접속 시, 기존의 로그인 정보가 남아 있어 별도의 인증 절차 없이 즉시 로비(Lobby)로 이동하는 현상.

## 2. 원인 분석
- **Client-side Blind Trust**: `apps/web/src/app/page.tsx`에서 `localStorage`에 `mighty_token`이 존재하면 즉시 로비로 이동하는 로직이 포함되어 있음.
- **Server-side State Loss**: 서버 재시작 시 메모리 내의 세션 정보는 증발하지만, 클라이언트의 브라우저 저장소(`localStorage`)는 유지됨.
- **Validation Bypass**: 클라이언트가 서버와의 핸드셰이크 과정에서 토큰의 유효성을 최종 확인하기 전에 페이지 이동(Redirect)을 수행하므로, 서버가 재시작되었거나 토큰이 만료되어도 로비 화면에 진입하게 됨.

## 3. 조치 방법
- **Socket Handshake Auth**: 소켓 초기화(`io()`) 시 `auth` 필드에 토큰을 포함하여 전송하고, 서버의 미들웨어에서 이를 검증하도록 강제.
- **Verification Wait**: `LandingPage`에서 토큰 존재 시 즉시 이동하는 대신, 서버로부터 `authenticated` 이벤트를 받을 때까지 대기(Wait) 상태를 유지.
- **Invalid Token Cleanup**: 서버가 `INVALID_TOKEN` 또는 인증 에러를 응답할 경우, 클라이언트의 `localStorage`를 즉시 삭제하고 로그인 폼을 표시.

## 4. 검증 결과
- **'VERIFYING...' 상태 노출**: 페이지 로드 시 기존 토큰이 있으면 서버 검증 전까지 버튼에 상태가 표시됨을 확인.
- **서버 재시작 대응**: 서버 재시작 후 기존 토큰으로 접속 시 `INVALID_TOKEN` 에러를 수신하며 로비로 자동 진입하지 않고 로그인 페이지를 유지함. (Browser Logging으로 검증)
- **인증 실패 시 클린업**: 인증 실패 시 `localStorage`의 `mighty_token`이 자동 삭제되어 보안 홀을 차단함.
- **정상 로그인**: 유효한 계정 정보 입력 시 `authenticated` 이벤트를 통해 정상적으로 로비 진입 확인.
