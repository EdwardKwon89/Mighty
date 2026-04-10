# Audit Report: [ERR-05/09] Session Expiry & Infinite Loading Recovery (Socket Handshake Block)

## 1. 개요
서버 재시작(`Date.now()` 기반 `SERVER_INSTANCE_ID` 갱신) 시, 기존 클라이언트가 보유한 토큰의 인스턴스 ID 불일치로 인해 `SESSION_EXPIRED` 오류가 발생하며 소켓 연결이 차단되지만, 클라이언트가 이를 감지하지 못해 '무한 대기' 혹은 '수동 세션 정리'가 필요한 현상.

## 2. 원인 분석
- **Handshake Verification Enforcement**: 서버(`index.ts`) 미들웨어에서 `SERVER_INSTANCE_ID`를 엄격히 대조하여 세션 오염을 방지하고 있으나, 이는 소켓 연결 전단계(Handshake)에서 `next(new Error("SESSION_EXPIRED"))`를 던짐.
- **Client-side Listener Gaps**: `useGame.ts` 및 `useLobby.ts` 훅에서 `error` 이벤트(연결 후 발생)는 처리하고 있었으나, 연결 커넥션 자체의 실패를 다루는 `connect_error` 리스너가 누락됨.
- **Silent Failure**: 브라우저 콘솔에는 오류가 찍히지만, UI 상에서는 아무런 반응이 없어 사용자가 서버가 죽었거나 본인의 세션이 만료되었음을 인지하기 어려움.

## 3. 조치 방법
- **Global `connect_error` Integration**: `useGame` 및 `useLobby` 훅에 `connect_error` 리스너를 통합 추가하여 핸드셰이크 단계의 오류 메시지를 명확히 수신.
- **Automatic Session Cleanup**: 수신된 에러 메시지가 `SESSION_EXPIRED` 또는 `INVALID_TOKEN`일 경우, 브라우저의 `mighty_token`을 즉시 삭제.
- **Graceful Redirection**: 토큰 삭제 후 사용자를 자동으로 메인 페이지(`/`)로 리다이렉트하여, 새로운 유효 토큰을 발급받을 수 있는 상태로 유도.
- **Credential Preservation**: 사용자의 편의를 위해 `mighty_nickname` 및 `mighty_password`는 삭제하지 않고 유지하여 '원클릭 재로그인'이 가능하도록 UX 개선.

## 4. 검증 결과
- **서버 재실행 시나리오**: `npm run dev` 재실행 후 기존에 열려있던 게임방/로비 창이 즉시 콘솔 메시지와 함께 메인 화면으로 리다이렉트됨을 확인.
- **콘솔 로그 확인**: `Session expired or invalid. Redirecting to login...` 경고 노출 및 토큰 삭제 정상 작동 확인.
- **재인증 루프**: 리다이렉트 후 저장된 닉네임/비밀번호로 즉시 재접속 시 새로운 `instanceId`가 담긴 토큰이 발급되며 정상 진입 확인.
