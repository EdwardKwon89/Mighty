# [ERR-14] Next.js Hydration Mismatch (localStorage)

## 1. 개요 (Overview)
로비 페이지 진입 시 "Hydration failed because the server rendered text didn't match the client" 오류가 발생하며 UI가 일시적으로 깨지거나 콘솔에 런타임 에러가 기록됨.

## 2. 결함 분석 (Root Cause Analysis)
- **SSR과 클라이언트 렌더링의 차이**: Next.js는 서버에서 컴포넌트를 사전 렌더링(Pre-render)함.
- **`window` 객체 부재**: 서버 사이드에서는 `window` 및 `localStorage`가 존재하지 않아 삼항 연산자(`typeof window !== 'undefined' ? ... : 0`)에 의해 `0`이 렌더링됨.
- **클라이언트 렌더링**: 브라우저에서는 `localStorage` 값이 존재하므로 실제 포인트(예: `212,000`)를 렌더링함.
- **React의 검증**: 서버 전송 HTML(0)과 클라이언트 초기 HTML(212,000)이 일치하지 않아 하이드레이션 경고/오류가 발생함.

## 3. 해결 방안 (Resolution)
- **Post-mount State Updates**: `localStorage` 데이터 읽기를 `useEffect` 내부로 이동시켜, 컴포넌트가 브라우저에 완전히 마운트된 이후에만 데이터를 상태(state)로 반영하도록 수정함.
- **코드 수정**:
    ```tsx
    const [clientPoints, setClientPoints] = useState<string | null>(null);
    useEffect(() => {
      setClientPoints(localStorage.getItem('mighty_points'));
    }, []);
    ```

## 4. 검증 결과 (Verification)
- **콘솔 확인**: 페이지 새로고침 후 "Hydration failed" 관련 오류 메시지가 더 이상 출력되지 않음 (PASS).
- **시각적 확인**: 서버 렌더링 시에는 자리가 비어있거나 0이다가, 마운트 직후 실제 포인트로 부드럽게 교체됨 (PASS).

## 5. 영향 범위 (Impact)
- `apps/web/src/app/lobby/page.tsx`
