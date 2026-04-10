'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export default function LandingPage() {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // [RENDER_WAKEUP] 서버가 잠들어 있을 수 있으므로 미리 한번 호출하여 깨웁니다.
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    fetch(`${serverUrl}/health`).catch(() => console.log("Server waking up..."));

    // 서버 포트 4000번(기본값) 또는 환경에 맞는 주소 설정
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem("mighty_token") : null;
    
    const s = io(serverUrl, {
      auth: { token: savedToken },
      transports: ["websocket"],
      reconnectionAttempts: 10, // 배포 환경 대응을 위해 재시도 횟수 상향
      timeout: 20000 // 서버 깨어남 대기를 위해 타임아웃 상향
    });
    
    setSocket(s);

    s.on("connect", () => {
      console.log("✅ Socket connected to server");
    });

    s.on("connect_error", (err) => {
      // 에러 메시지 추출 (Socket.io의 err 객체 구조 대응)
      const errorMsg = typeof err === 'string' ? err : err.message;
      console.warn("⚠️ Socket connection error handle:", errorMsg);
      setIsLoading(false);
      
      if (errorMsg === "SESSION_EXPIRED" || errorMsg === "INVALID_TOKEN") {
        localStorage.removeItem("mighty_token");
        // 무한 루프 방지를 위해 토큰이 있을 때만 리로드 시도
        if (savedToken) {
          window.location.href = "/?error=" + encodeURIComponent(errorMsg);
        } else {
          setErrorMessage("세션이 만료되었습니다. 다시 로그인해주세요.");
        }
      } else {
        setErrorMessage("서버 연결에 실패했습니다. (포트 4000)");
      }
    });

    const savedNick = localStorage.getItem("mighty_nickname");
    if (savedNick) {
      setNickname(savedNick);
      socket?.emit("get-stats", { nickname: savedNick }, (res: any) => {
        if (res) setStats(res);
      });

      // ERR-05: 세션 검증을 위해 즉시 리다이렉트하지 않고 대기 상태로 설정
      const savedToken = localStorage.getItem("mighty_token");
      if (savedToken) {
        setIsLoading(true);
        console.log("Verifying existing session...");
      }
    }

    // 서버 인증 성공 이벤트 핸들러
    s.on("authenticated", (data: { token: string; points: bigint; isAdmin: boolean }) => {
      console.log("Authentication successful, moving to lobby...");
      localStorage.setItem('mighty_token', data.token);
      localStorage.setItem("mighty_last_location", JSON.stringify({ type: 'LOBBY' }));
      setIsLoading(false);
      router.push('/lobby');
    });

    s.on("error", (err: { message: string; code?: string }) => {
      console.error("Authentication error:", err.message);
      setIsLoading(false);
      
      // ERR-05: 인증 실패(토큰 만료 등) 시 저장된 정보를 삭제하고 로그인 폼 표시
      if (err.code === "AUTH_FAILED" || err.message.includes("INVALID_TOKEN") || err.message === "SESSION_EXPIRED") {
        localStorage.removeItem("mighty_token");
        const msg = (err.message === "INVALID_TOKEN" || err.message === "SESSION_EXPIRED") 
          ? "세션이 만료되었습니다. 다시 로그인해주세요." 
          : err.message;
        setErrorMessage(msg);
      } else {
        setErrorMessage(err.message);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [router]);

  const fetchStats = useCallback(() => {
    if (!nickname || !socket) return;
    socket.emit("get-stats", { nickname }, (res: any) => {
      if (res) setStats(res);
    });
  }, [nickname, socket]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !password) {
      setErrorMessage("닉네임과 비밀번호를 모두 입력해주세요.");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);

    // 닉네임은 미리 저장 (UI 표시용)
    localStorage.setItem('mighty_nickname', nickname);
    
    // 서버에 방 입장을 시도하며 인증을 트리거함
    // 서버의 join-room 핸들러가 인증을 수행하고 authenticated 혹은 error를 보낼 것임
    if (socket) {
      const timeoutId = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setErrorMessage("서버 응답 시간이 초과되었습니다.");
        }
      }, 5000);

      socket.emit("join-room", { 
        roomId: "LOBBY", 
        nickname, 
        password 
      });

      // Cleanup timeout on unmount or success
      return () => clearTimeout(timeoutId);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-[family-name:var(--font-suit)] overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full animate-pulse opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block p-4 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-purple-500/10 border border-white/10 mb-6 backdrop-blur-md"
          >
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
              <span className="text-3xl font-black italic">M</span>
            </div>
          </motion.div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">
            MIGHTY <span className="text-blue-500">PRIME</span>
          </h1>
          <p className="text-gray-400 font-medium tracking-tight">The Ultimate Strategy Card Experience</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-4">PLAYER IDENTITY</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={fetchStats}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[1.5rem] px-8 py-5 focus:border-blue-500/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-xl placeholder:text-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-4">ACCESS CODE</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-[1.5rem] px-8 py-5 focus:border-blue-500/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-xl placeholder:text-white/10"
            />
          </div>

          {errorMessage && (
            <p className="text-red-500 text-sm font-bold text-center">{errorMessage}</p>
          )}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[1.5rem] text-xl transition-all shadow-[0_20px_40px_rgba(37,99,235,0.2)] mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{nickname && localStorage.getItem("mighty_token") ? "VERIFYING..." : "ENTERING..."}</span>
              </div>
            ) : "ENTER ARENA"}
          </motion.button>
        </form>

        <AnimatePresence>
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 grid grid-cols-2 gap-4"
            >
              <StatsCard label="Balance" value={`₩${Number(stats.points).toLocaleString()}`} isAlert={stats.isRestricted} />
              <StatsCard label="Win Rate" value={stats.winRate} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center px-4">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4, 5].map((v) => (
              <div key={v} className="w-8 h-8 rounded-full border-2 border-[#050505] bg-white/10 flex items-center justify-center text-[10px] font-bold">
                P{v}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ONLINE PROTOCOL ACTIVE</span>
        </div>
      </motion.div>
    </div>
  );
}

function StatsCard({ label, value, isAlert }: any) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isAlert ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/5 hover:border-white/10"}`}>
      <div className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mb-1">{label}</div>
      <div className={`text-xl font-black tracking-tighter ${isAlert ? "text-red-500" : "text-white"}`}>{value}</div>
    </div>
  );
}
