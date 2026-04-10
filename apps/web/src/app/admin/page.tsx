"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface PlayerStats {
  nickname: string;
  points: string;
  totalGames: number;
  totalWins: number;
  winRate: string;
  isRestricted: boolean;
  isAdmin: boolean;
  lastSeen: string;
}

export default function AdminPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");

  // 로그 조회를 위한 상태 추가
  const [logViewPlayer, setLogViewPlayer] = useState<string | null>(null);
  const [playerLogs, setPlayerLogs] = useState<any[]>([]);
  const [logPageInfo, setLogPageInfo] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });

  // 삭제 확인을 위한 상태 추가
  const [deleteConfirmPlayer, setDeleteConfirmPlayer] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mighty_token");
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const s = io(serverUrl, {
      auth: { token }
    });

    s.on("connect", () => {
      s.emit("admin:get-players");
    });

    s.on("authenticated", ({ isAdmin }) => {
      setIsAdmin(isAdmin);
      if (!isAdmin) {
        window.location.href = "/lobby";
      }
    });

    s.on("admin:players-list", (list: PlayerStats[]) => {
      setPlayers(list);
      setLoading(false);
    });

    s.on("admin:player-logs", (data: any) => {
      setPlayerLogs(data.logs);
      setLogPageInfo({
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalCount: data.totalCount
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const handleAdjustPoints = () => {
    if (!selectedPlayer || !socket) return;
    socket.emit("admin:adjust-points", {
      nickname: selectedPlayer.nickname,
      amount: adjustAmount,
      reason: adjustReason
    });
    setSelectedPlayer(null);
    setAdjustAmount(0);
    setAdjustReason("");
  };

  const handleToggleRestriction = (player: PlayerStats) => {
    if (!socket) return;
    socket.emit("admin:restrict-player", {
      nickname: player.nickname,
      isRestricted: !player.isRestricted,
      reason: "관리자 수동 제어"
    });
  };

  const handleDeletePlayer = (nickname: string) => {
    setDeleteConfirmPlayer(nickname);
  };

  const confirmDelete = () => {
    if (!socket || !deleteConfirmPlayer) return;
    socket.emit("admin:delete-player", { nickname: deleteConfirmPlayer });
    setDeleteConfirmPlayer(null);
  };

  const fetchLogs = (nickname: string, page: number = 1) => {
    if (!socket) return;
    setLogViewPlayer(nickname);
    socket.emit("admin:get-logs", { nickname, page, limit: 15 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-[family-name:var(--font-suit)]">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-12">
          <div>
            <Link href="/lobby" className="text-blue-500 flex items-center gap-2 mb-4 hover:underline">
              ← 로비로 돌아가기
            </Link>
            <h1 className="text-5xl font-black tracking-tighter decoration-red-500 decoration-8 underline-offset-8">
              SYSTEM <span className="text-red-500">ADMIN</span>
            </h1>
            <p className="text-gray-400 mt-4">마이티 프라임 플레이어 및 시스템 관리 대시보드</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-3xl backdrop-blur-xl">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Total Players</div>
            <div className="text-3xl font-black">{players.length}</div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Players Table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-[40px] overflow-hidden backdrop-blur-2xl">
            <div className="p-8 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Player Management</h2>
              <button 
                onClick={() => socket?.emit("admin:get-players")}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-widest">
                    <th className="px-8 py-4">Nickname</th>
                    <th className="px-8 py-4">Points</th>
                    <th className="px-8 py-4">Record</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {players.map((player) => (
                    <tr key={player.nickname} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${player.isAdmin ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                            {player.nickname[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-lg flex items-center gap-2">
                              {player.nickname}
                              {player.isAdmin && <span className="px-2 py-0.5 bg-red-500 text-[10px] rounded-md text-white">ADMIN</span>}
                            </div>
                            <div className="text-xs text-gray-500">Last: {new Date(player.lastSeen).toLocaleString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`font-mono font-bold text-xl ${Number(player.points) < 0 ? 'text-red-500' : 'text-green-400'}`}>
                          {Number(player.points).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold">{player.winRate}</div>
                        <div className="text-xs text-gray-500">{player.totalWins}W / {player.totalGames}G</div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => handleToggleRestriction(player)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            player.isRestricted 
                              ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' 
                              : 'bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500 hover:text-white'
                          }`}
                        >
                          {player.isRestricted ? 'Restricted' : 'Active'}
                        </button>
                      </td>
                      <td className="px-8 py-6 text-right space-x-2">
                        <button 
                          onClick={() => fetchLogs(player.nickname)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-sm"
                        >
                          이력 보기
                        </button>
                        <button 
                          onClick={() => setSelectedPlayer(player)}
                          className="px-4 py-2 bg-white/5 hover:bg-blue-600 rounded-xl font-bold transition-all text-sm"
                        >
                          포인트 조정
                        </button>
                        <button 
                          onClick={() => handleDeletePlayer(player.nickname)}
                          className="px-4 py-2 bg-white/5 hover:bg-red-600 rounded-xl font-bold transition-all text-sm opacity-50 hover:opacity-100"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Points Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md p-8 bg-[#0a0a0a] border border-white/10 rounded-[40px] shadow-2xl"
            >
              <h2 className="text-3xl font-black mb-2 lowercase tracking-tighter">Point <span className="text-blue-500">Adjustment</span></h2>
              <p className="text-gray-500 mb-8 font-bold">{selectedPlayer.nickname}님에게 부여할 포인트를 입력하세요.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Amount (+/-)</label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 focus:border-blue-500 outline-none transition-all font-mono text-3xl font-black"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    {[10000, 50000, 100000, -10000].map(val => (
                      <button 
                        key={val}
                        onClick={() => setAdjustAmount(prev => prev + val)}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold"
                      >
                        {val > 0 ? `+${val/1000}k` : `${val/1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Reason</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="이유를 입력하세요..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleAdjustPoints}
                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                  >
                    반영하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Logs Modal */}
      <AnimatePresence>
        {logViewPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLogViewPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl p-8 bg-[#0a0a0a] border border-white/10 rounded-[40px] shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black mb-1 lowercase tracking-tighter">Activity <span className="text-red-500">Logs</span></h2>
                  <p className="text-gray-500 font-bold">{logViewPlayer}님의 포인트 변동 이력입니다.</p>
                </div>
                <button 
                  onClick={() => setLogViewPlayer(null)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {playerLogs.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 font-bold">기록된 활동이 없습니다.</div>
                ) : (
                  playerLogs.map((log) => (
                    <div key={log.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 flex items-center justify-between group hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-black ${
                          log.amount > 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                          {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-white/10 rounded-md text-gray-400">{log.type}</span>
                            {log.reason || "상세 사유 없음"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination Controls */}
              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="text-sm text-gray-500 font-bold">
                  Total <span className="text-white">{logPageInfo.totalCount}</span> logs
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    disabled={logPageInfo.currentPage === 1}
                    onClick={() => fetchLogs(logViewPlayer, logPageInfo.currentPage - 1)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="font-mono font-bold text-lg">
                    {logPageInfo.currentPage} <span className="text-gray-600">/</span> {logPageInfo.totalPages}
                  </span>
                  <button 
                    disabled={logPageInfo.currentPage === logPageInfo.totalPages}
                    onClick={() => fetchLogs(logViewPlayer, logPageInfo.currentPage + 1)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmPlayer(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[320px] p-8 bg-[#0a0a0a]/80 border border-white/10 rounded-[40px] shadow-2xl backdrop-blur-3xl overflow-hidden"
            >
              {/* Decorative Red Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-red-600 blur-lg opacity-50" />
              
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-red-500/20 border border-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h2 className="text-xl font-black mb-3 lowercase tracking-tight">Warning <span className="text-red-500">Notice</span></h2>
                <p className="text-sm text-gray-400 font-bold leading-relaxed mb-8">
                  <span className="text-white">@{deleteConfirmPlayer}</span> 플레이어를 영구 삭제하시겠습니까? 
                  모든 데이터가 <span className="text-red-400">즉시 소멸</span>됩니다.
                </p>

                <div className="flex flex-col w-full gap-2.5">
                  <button 
                    onClick={confirmDelete}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] group overflow-hidden relative"
                  >
                    <span className="relative z-10">플레이어 영구 삭제</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-red-400/0 via-white/20 to-red-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmPlayer(null)}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl font-bold text-sm transition-all border border-white/5"
                  >
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
