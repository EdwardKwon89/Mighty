"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLobby } from "../../hooks/useLobby";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type FilterStatus = "ALL" | "LOBBY" | "WAITING" | "PLAYING";

export default function LobbyPage() {
  const router = useRouter();
  const { rooms, lobbyInfo, isAdmin, myNickname, createRoom, refreshRooms, logout, error } = useLobby();
  const [newRoomId, setNewRoomId] = useState("");
  const [clientPoints, setClientPoints] = useState<string | null>(null);

  useEffect(() => {
    // Sync points from localStorage on mount to avoid hydration mismatch
    const savedPoints = localStorage.getItem('mighty_points');
    if (savedPoints) setClientPoints(savedPoints);
  }, []);
  const [isCreating, setIsCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");

  // 위치 정보 저장 및 세션 필수 체크 (ERR-05)
  useEffect(() => {
    const token = localStorage.getItem("mighty_token");
    if (!token) {
      console.warn("No token found. Unauthorized access to Lobby. Redirecting...");
      router.push("/");
      return;
    }
    localStorage.setItem("mighty_last_location", JSON.stringify({ type: 'LOBBY' }));
  }, [router]);


  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim()) return;
    createRoom(newRoomId.trim());
    setIsCreating(false);
  };

  // 방 입장 핸들러 (제한 로직 포함)
  const handleJoinRoom = useCallback((room: any) => {
    // 인원 초과 또는 게임 중인 방 체크
    const isFull = room.players >= room.maxPlayers;
    const isStarted = room.state !== "WAITING";

    if (isStarted || isFull) {
      alert("입장할 수 없읍니다.");
      return;
    }

    router.push(`/game/${room.id}`);
  }, [router]);

  // 필터링된 플레이어 목록 (대소문자 일치 확인)
  const filteredPlayers = useMemo(() => {
    if (filterStatus === "ALL") return lobbyInfo.players;
    return lobbyInfo.players.filter(p => p.status === filterStatus);
  }, [lobbyInfo.players, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "WAITING": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "PLAYING": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white p-6 font-[family-name:var(--font-suit)] overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/5 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        {/* Navigation Bar */}
        <nav className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-12 py-6 border-b border-white/5 gap-8 lg:gap-0">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 justify-center lg:justify-start"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">M</div>
            <span className="text-xl font-black tracking-tighter uppercase italic">Mighty Prime</span>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 px-6 py-2.5 rounded-full backdrop-blur-md w-full sm:w-auto justify-center sm:justify-start">
              <div className="flex flex-col items-center sm:items-end">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Logged in as</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-blue-400">{myNickname || "Guest"}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                    {Number(lobbyInfo.players.find(p => p.nickname === myNickname)?.points || clientPoints || 0).toLocaleString()} P
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/20 flex items-center justify-center text-xs font-black">
                {myNickname?.charAt(0).toUpperCase() || "?"}
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
              {isAdmin && (
                <Link 
                  href="/admin"
                  className="flex-1 sm:flex-none px-6 py-3 bg-red-600/20 text-red-400 border border-red-500/30 rounded-full font-black text-sm uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                >
                  Admin
                </Link>
              )}
              <button 
                onClick={() => setIsCreating(true)}
                className="flex-1 sm:flex-none px-6 py-3 bg-white text-black rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                create room
              </button>
              <button 
                onClick={logout}
                className="flex-1 sm:flex-none px-6 py-3 bg-zinc-800 text-zinc-400 border border-white/5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="grid grid-cols-12 gap-10">
          {/* Main: Room List */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic">Active Rooms</h2>
              <button onClick={refreshRooms} className="text-xs font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {rooms.filter(room => room.state !== "RESULT").map((room, idx) => {
                  const isJoinable = room.state === "WAITING" && room.players < room.maxPlayers;
                  
                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group cursor-pointer"
                      onClick={() => handleJoinRoom(room)}
                    >
                      <div className={`p-8 rounded-[32px] bg-white/[0.02] border transition-all duration-500 backdrop-blur-2xl relative overflow-hidden ${
                        isJoinable 
                          ? "border-white/5 group-hover:border-blue-500/40 group-hover:bg-white/[0.04]" 
                          : "border-red-500/20 grayscale opacity-60"
                      }`}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-2xl font-black truncate pr-4 tracking-tighter uppercase italic">{room.id}</h3>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Mighty Room #{idx + 1}</p>
                          </div>
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            room.state === "WAITING" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {room.state === "WAITING" ? "Waiting" : "In Progress"}
                          </span>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                            <span className="text-zinc-500">Players</span>
                            <span className="text-white">{room.players} <span className="text-zinc-600">/</span> {room.maxPlayers}</span>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(room.players / room.maxPlayers) * 100}%` }}
                              className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                            />
                          </div>
                        </div>

                        {!isJoinable && (
                          <div className="mt-4 text-[10px] font-black text-red-500 uppercase tracking-widest italic">
                            Cannot Enter: {room.state !== "WAITING" ? "GAME STARTED" : "ROOM FULL"}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar: Players List & Filters */}
          <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-6 self-start">
            <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/10 backdrop-blur-3xl shadow-2xl">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                <h2 className="text-xl font-black tracking-tighter uppercase italic">Players List</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{lobbyInfo.onlineCount} Online</span>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex gap-2 mb-8 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                {(["ALL", "LOBBY", "WAITING", "PLAYING"] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      filterStatus === status ? "bg-white text-black translate-y-[-1px] shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {filteredPlayers.map((player) => (
                    <motion.div 
                      key={player.id}
                      layout
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black">
                          {player.nickname?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-xs font-black ${player.nickname === myNickname ? "text-blue-400" : "text-white"}`}>
                            {player.nickname} 
                            {player.nickname === myNickname && <span className="ml-2 text-[8px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 uppercase tracking-widest">Me</span>}
                          </span>
                          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.2em] italic">{player.id.substring(0, 8)}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusColor(player.status)}`}>
                          {player.status === "LOBBY" ? "Lobby" : player.status === "WAITING" ? "Waiting" : "Playing"}
                        </span>
                        <span className="text-[9px] font-black text-zinc-400 italic">
                          {Number(player.points || 0).toLocaleString()} P
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredPlayers.length === 0 && (
                  <p className="text-xs text-zinc-600 italic text-center py-10 uppercase tracking-widest">No players in this category</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Creation Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md relative bg-zinc-900 border border-white/10 p-10 rounded-[40px] shadow-2xl"
            >
              <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-8">Create New Room</h2>
              <form onSubmit={handleCreate} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Room Identification</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Enter Room ID"
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500/50 transition-all font-bold text-lg"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-6 py-4 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                  >
                    Establish
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
