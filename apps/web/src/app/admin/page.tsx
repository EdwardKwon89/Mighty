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

  useEffect(() => {
    const token = localStorage.getItem("mighty_token");
    const s = io("http://localhost:4000", {
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
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => setSelectedPlayer(player)}
                          className="px-4 py-2 bg-white/5 hover:bg-blue-600 rounded-xl font-bold transition-all text-sm"
                        >
                          포인트 조정
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
    </div>
  );
}
