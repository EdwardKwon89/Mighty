"use client";

import React, { useState, useEffect, useRef, use, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useGame, GameState } from "@/hooks/useGame";
import { Suit, Rank, getJokerCallCardId, getMightyCardId, canPlayCard, validateBid } from "@mighty/engine";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [nickname, setNickname] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");

  // Rules of Hooks: All hooks must be defined at the top
  const [selectedBidAmount, setSelectedBidAmount] = useState<number>(13);
  const [selectedBidSuit, setSelectedBidSuit] = useState<Suit | "NO_TRUMP">("NO_TRUMP");
  const [pendingCard, setPendingCard] = useState<any>(null);
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);
  const [selectedTrump, setSelectedTrump] = useState<Suit | "NO_TRUMP">("NO_TRUMP");
  const [showJokerCallModal, setShowJokerCallModal] = useState(false);
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedFriendType, setSelectedFriendType] = useState<string>("CARD");
  const [selectedFriendCard, setSelectedFriendCard] = useState<{suit: Suit, rank: number}>({suit: Suit.SPADE, rank: 14});
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const radius = useMemo(() => {
    if (viewport.width === 0) return 240;
    // Scale radius based on viewport, min 160, max 240
    // Adjust logic to be more aggressive on small screens
    const base = Math.min(viewport.width * 0.28, viewport.height * 0.22);
    return Math.max(160, Math.min(base, 240));
  }, [viewport]);

  const {
    gameState,
    messages,
    result,
    error,
    sendBid,
    sendExchange,
    sendSelectFriend,
    sendPlayCard,
    sendMessage,
    sendAddBot,
    leaveRoom,
    sendStartGame,
    restartGame,
    clearError,
    socket,
    lastTrickResult
  } = useGame(resolvedParams.id, nickname || "");

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (lastTrickResult) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 2000);
      return () => {
        clearTimeout(timer);
        setIsAnimating(false);
      };
    } else {
      setIsAnimating(false);
    }
  }, [lastTrickResult]);

  const isMyTurn = useMemo(() => {
    if (!gameState || !socket?.id) return false;
    // 룸 ID 불일치 시 턴 무시 (잔상 방지)
    if (gameState.id !== resolvedParams.id && gameState.roomID !== resolvedParams.id) return false;
    
    // 서버에서 이미 계산해서 내려주는 isTurn 플래그를 사용 (가장 확실함)
    const me = gameState.players.find((p: any) => p.id === socket.id || (nickname && p.nickname === nickname));
    return me?.isTurn || false;
  }, [gameState, nickname, socket?.id, resolvedParams.id]);

  const currentTurnPlayer = useMemo(() => {
    if (!gameState) return null;
    if (gameState.state === GameState.BIDDING) {
      return gameState.players[gameState.currentBidderIndex] || null;
    }
    return gameState.players[gameState.turnIndex] || null;
  }, [gameState?.state, gameState?.currentBidderIndex, gameState?.turnIndex, gameState?.players]);

  const isDeclarer = useMemo(() => {
    if (!gameState || !socket) return false;
    const byIndex = gameState.highBidderIndex !== -1 && 
                    gameState.players[gameState.highBidderIndex]?.id === socket.id;
    const byNickname = gameState.players.find((p: any) => p.nickname === nickname)?.isDeclarer;
    return byIndex || byNickname;
  }, [gameState, socket, nickname]);

  const isMyFriendSelect = useMemo(() => {
    return gameState?.state === GameState.SELECTING_FRIEND && isDeclarer;
  }, [gameState?.state, isDeclarer]);

  const showExchangePopup = useMemo(() => {
    return gameState?.state === GameState.EXCHANGING && isDeclarer;
  }, [gameState?.state, isDeclarer]);

  const isHost = useMemo(() => {
    if (!gameState?.players[0] || !socket) return false;
    return gameState.players[0].id === socket.id;
  }, [gameState?.players, socket]);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("mighty_nickname");
    if (saved) {
      setNickname(saved);
    } else {
      window.location.href = "/";
    }
  }, []);

  // Auto-update state defaults when gameState changes
  useEffect(() => {
    if (gameState?.highBidAmount !== undefined) {
      const nextBid = gameState.highBidAmount + 1;
      setSelectedBidAmount(nextBid > 13 ? nextBid : 13);
    }
    if (gameState?.highBidSuit) {
      setSelectedBidSuit(gameState.highBidSuit as any);
      setSelectedTrump(gameState.highBidSuit as any);
    }
  }, [gameState?.highBidAmount, gameState?.highBidSuit]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Moved useEffect above early returns to follow Rules of Hooks
  useEffect(() => {
    if (gameState?.state === GameState.EXCHANGING) {
      setSelectedDiscards([]);
      setSelectedTrump(gameState.highBidSuit || "NO_TRUMP");
    }
    
    // 게임 리스타트 혹은 새 게임 시작 시 로컬 선택 상태 초기화
    if (gameState?.state === GameState.READY || gameState?.state === GameState.BIDDING) {
      setSelectedCardId(null);
      setViewingCardId(null);
      setSelectedDiscards([]);
    }
  }, [gameState?.state, gameState?.highBidSuit]);

  // 권한 오류 또는 세션 만료 시 리다이렉트 처리
  useEffect(() => {
    if (error) {
      if (error === "INVALID_TOKEN" || error.includes("존재하지 않는 방")) {
        setGameError(`접근 오류: ${error}`);
        setShowErrorModal(true);
        // 리다이렉트는 모달 닫을 때 하도록 변경하거나, 심각한 오류만 타이머로 처리
        setTimeout(() => {
          window.location.href = "/";
        }, 3000);
      } else {
        setGameError(`게임 알림: ${error}`);
        setShowErrorModal(true);
      }
    }
  }, [error]);
  
  const isMyBid = useMemo(() => {
    if (!gameState || !socket) return false;
    return gameState.state === GameState.BIDDING && isMyTurn;
  }, [gameState?.state, isMyTurn, socket]);

  const isPlayingState = useMemo(() => 
    (gameState?.roomID === resolvedParams.id || gameState?.id === resolvedParams.id) && gameState?.state === GameState.PLAYING
  , [gameState?.id, gameState?.roomID, gameState?.state, resolvedParams.id]);

  const isBiddingState = useMemo(() => 
    (gameState?.roomID === resolvedParams.id || gameState?.id === resolvedParams.id) && gameState?.state === GameState.BIDDING
  , [gameState?.id, gameState?.roomID, gameState?.state, resolvedParams.id]);

  const isExchangingState = useMemo(() => 
    (gameState?.roomID === resolvedParams.id || gameState?.id === resolvedParams.id) && gameState?.state === GameState.EXCHANGING
  , [gameState?.id, gameState?.roomID, gameState?.state, resolvedParams.id]);

  const isFriendSelectState = useMemo(() => 
    (gameState?.roomID === resolvedParams.id || gameState?.id === resolvedParams.id) && gameState?.state === GameState.SELECTING_FRIEND
  , [gameState?.id, gameState?.roomID, gameState?.state, resolvedParams.id]);

  const toggleDiscard = (cardId: string) => {
    setSelectedDiscards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : prev.length < 3 ? [...prev, cardId] : prev
    );
  };

  const handleExchangeConfirm = () => {
    console.log("[ACTION] Attempting Exchange Confirm...");
    if (!gameState || selectedDiscards.length !== 3) {
      console.warn("[ACTION] Exchange Canceled: Condition not met.", { 
        gameStateExist: !!gameState, 
        selectedCount: selectedDiscards.length 
      });
      return;
    }
    
    // Get full card objects from IDs (explicit typing for lint)
    const cardsToDiscard = (gameState.myCards as any[]).filter((c: any) => selectedDiscards.includes(c.id));
    console.log("[ACTION] Discarding Cards:", cardsToDiscard.map((c: any) => `${c.suit} ${c.rank}`));
    console.log("[ACTION] Using Trump Suit:", selectedTrump);
    
    // Send to server (Card array expected by hook)
    sendExchange(cardsToDiscard, selectedTrump);
  };

  const handleCardPlay = (card: any) => {
    console.log(`[DEBUG] Attempting to play card: ${card.suit} ${card.rank} (ID: ${card.id})`);
    if (!gameState || gameState.state !== GameState.PLAYING || !isMyTurn || isAnimating) {
      console.warn("[DEBUG] Play rejected: Phase check failed.", { state: gameState?.state, isMyTurn, isAnimating });
      return;
    }
    const isFirstCardOfTrick = gameState.currentTrick.length === 0;
    const trump = gameState.trumpSuit === "NO_TRUMP" ? Suit.NONE : (gameState.trumpSuit as Suit);
    const jokerCallId = getJokerCallCardId(trump);
    if (isFirstCardOfTrick && card.id === jokerCallId) {
      console.log("[DEBUG] Joker Call detected, showing modal.");
      setPendingCard(card);
      setShowJokerCallModal(true);
    } else {
      console.log("[DEBUG] Sending play card action to server.");
      sendPlayCard(card);
    }
  };

  const handleJokerCallResponse = (isJokerCall: boolean) => {
    if (pendingCard) {
      sendPlayCard(pendingCard, isJokerCall);
      setPendingCard(null);
      setShowJokerCallModal(false);
    }
  };

  // --- Early Returns ---
  if (!isMounted) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-black tracking-widest uppercase text-[10px]">Initiating Core...</div>;
  }

  if (!nickname || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-6 text-zinc-500">
        <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="font-black tracking-[0.3em] uppercase text-[10px]">Syncing Protocol...</span>
      </div>
    );
  }

  // --- Rendering Constants ---

  // Suit Symbols & Themes
  const getSuitSymbol = (suit: string) => {
    switch(suit) {
      case Suit.SPADE: return '♠';
      case Suit.HEART: return '♥';
      case Suit.DIAMOND: return '♦';
      case Suit.CLOVER: return '♣';
      default: return '★';
    }
  };

  const getSuitTheme = (suit: string) => {
    switch(suit) {
      case Suit.SPADE: return 'suit-glow-spade text-blue-400';
      case Suit.HEART: return 'suit-glow-heart text-red-500';
      case Suit.DIAMOND: return 'suit-glow-diamond text-amber-500';
      case Suit.CLOVER: return 'suit-glow-clover text-emerald-500';
      default: return 'suit-glow-notrump text-purple-500';
    }
  };

  const currentThemeClass = getSuitTheme(gameState.trumpSuit || "NO_TRUMP").split(' ')[0];

  return (
    <div className={`relative min-h-screen bg-[var(--color-surface)] overflow-x-hidden overflow-y-auto lg:overflow-hidden font-sans flex flex-col lg:flex-row text-white transition-colors duration-1000 ${currentThemeClass}`}>
      {/* Dynamic Background Glow sync with Trump */}
      <div className="absolute inset-x-0 bottom-0 top-1/4 bg-[var(--theme-glow)] rounded-t-[50%] blur-[120px] opacity-20 pointer-events-none transition-all duration-1000" />
      
      {/* MAIN GAME AREA */}
      <div className="flex-1 relative flex flex-col">
        {/* Header (Top Info) */}
        <header className="flex justify-between items-start px-6 sm:px-12 py-6 sm:py-8 relative z-20">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-6">
              <div className={`w-3 h-3 rounded-full ${socket?.connected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500 animate-pulse"} transition-all`} />
              <div>
                <h1 className="text-3xl font-black italic tracking-tighter text-white">MIGHTY<span className="text-primary not-italic tracking-normal ml-3 text-sm opacity-50 font-medium">BETA 0.1</span></h1>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mt-1">Room <span className="text-white">#{resolvedParams.id}</span></p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="glass px-5 py-2 rounded-xl border-white/5 flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  gameState.state === 'WAITING' ? 'bg-amber-400' :
                  gameState.state === 'READY' ? 'bg-green-400' : 'bg-blue-400'
                }`} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">
                   <span className="text-white">{
                    gameState.state === 'WAITING' ? 'Waiting' :
                    gameState.state === 'READY' ? 'Ready' : gameState.state
                  }</span>
                </span>
              </div>
              {gameState.trumpSuit && gameState.trumpSuit !== "NONE" && (
                <div className={`glass px-5 py-2 rounded-xl text-[10px] font-black border-white/10 ${getSuitTheme(gameState.trumpSuit)} shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)] flex items-center gap-2`}>
                  <span className="opacity-50 uppercase tracking-widest text-[8px]">Trump</span>
                  <span className="text-sm">{getSuitSymbol(gameState.trumpSuit)}</span>
                </div>
              )}
              {gameState.state !== 'WAITING' && (
                <div className="glass px-5 py-2 rounded-xl text-[10px] font-black tracking-widest border-white/5 bg-white/5 flex items-center gap-2">
                  <span className="opacity-50 uppercase tracking-widest text-[8px]">Goal</span>
                  <span className="text-primary text-sm">{gameState.highBidAmount}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-1">
            <div className="flex items-center gap-4 ml-2 mr-4 h-10 px-6 glass rounded-2xl border-white/5">
               <div className={`w-2 h-2 rounded-full blur-[1px] animate-pulse ${currentTurnPlayer ? 'bg-primary shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.8)]' : 'bg-zinc-800'}`} />
               <div className="flex flex-col justify-center">
                  <span className="text-[11px] font-black uppercase text-white tracking-widest leading-none">
                   {gameState.state === GameState.BIDDING 
                     ? (isMyBid ? "Your Turn to Bid" : `Waiting for ${gameState.players[gameState.currentBidderIndex]?.nickname || 'next'}`)
                     : gameState.state === GameState.EXCHANGING 
                       ? (isDeclarer ? "Discard 3 Cards" : `Discarding...`)
                       : gameState.state === GameState.SELECTING_FRIEND
                         ? (isDeclarer ? "Select Friend" : `Selecting Friend...`)
                         : currentTurnPlayer 
                           ? (currentTurnPlayer.id === socket?.id ? "Your Turn" : `${currentTurnPlayer.nickname}'s Turn`)
                           : "Syncing..."
                   }
                  </span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              {gameState.state === GameState.WAITING && gameState.players.length < 5 && (
                <button 
                  onClick={sendAddBot}
                  className="glass px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/5 hover:bg-blue-500/20 hover:text-blue-500 hover:border-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Bot
                </button>
              )}
              {gameState.state === 'READY' && isHost && (
                <button 
                  onClick={() => sendStartGame()}
                  className="glass px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Start Game
                </button>
              )}
              <button 
                disabled={gameState.state !== 'WAITING' && gameState.state !== 'READY' && gameState.state !== 'RESULT'}
                onClick={async () => {
                  await leaveRoom();
                  localStorage.setItem("mighty_last_location", JSON.stringify({ type: 'LOBBY' }));
                  window.location.href = "/lobby";
                }}
                className={`glass px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/5 transition-all active:scale-95 flex items-center gap-2 group ${
                  (gameState.state === 'WAITING' || gameState.state === 'READY' || gameState.state === 'RESULT') 
                    ? 'hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/20' 
                    : 'opacity-30 cursor-not-allowed grayscale'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100 transition-opacity"><path d="m15 18-6-6 6-6"/></svg>
                Leave
              </button>

              {/* Chat Toggle (Small screens only) */}
              <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`lg:hidden glass px-4 py-2.5 rounded-xl border-white/5 transition-all active:scale-95 flex items-center justify-center p-2.5 ${isChatOpen ? 'bg-primary text-white border-primary/50' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
                </svg>
              </button>
            </div>
          </div>
        </header>


        {/* Players Circle */}
        <div className="flex-1 relative flex items-center justify-center mt-2 sm:mt-6 overflow-visible">
          <div className="relative w-full max-w-5xl h-[400px] sm:h-[500px] md:h-[550px]">
            {/* Table Surface Visual */}
            <div className={`absolute inset-0 m-auto border border-white/5 bg-white/[0.02] rounded-[50%] blur-sm pointer-events-none transition-all duration-700`}
                 style={{ width: `${radius * 2.5}px`, height: `${radius * 1.5}px` }} 
            />
            
            {gameState.players.map((p: any, idx: number) => {
              const myIdx = gameState.players.findIndex((pl: any) => pl.nickname === nickname);
              const relativeIdx = (idx - myIdx + 5) % 5;
              const angles = [90, 162, 234, 306, 18]; 
              const angle = angles[relativeIdx];
              const radius = 240;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;
              const isDeclarerPlayer = idx === gameState.highBidderIndex;

              return (
                <div 
                  key={p.id} 
                  className="absolute transition-all duration-500" 
                  style={{ 
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` 
                  }}
                >
                  <div className="relative group">
                    {(() => {
                      const isTurn = gameState.turnIndex === idx;
                      return (
                        <div className={`rounded-full border-2 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                          viewport.width < 640 ? "w-16 h-16" : viewport.width < 768 ? "w-20 h-20" : "w-24 h-24"
                        } ${
                          isTurn 
                            ? "border-primary shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.5)] scale-105" 
                            : "border-white/10 group-hover:border-primary/50"
                        }`}>
                          <span className={`font-black uppercase tracking-tighter text-center leading-tight ${
                            viewport.width < 640 ? "text-[8px]" : "text-[10px]"
                          } ${isTurn ? "text-primary" : "text-white/80"}`}>{p.nickname}</span>
                            <div className="flex flex-col gap-0.5 scale-75 sm:scale-100">
                              <div className="flex gap-1.5 items-center justify-center">
                                <div className="text-[9px] font-bold text-zinc-500 whitespace-nowrap">{p.cardCount}</div>
                                <div className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/10 text-[8px] font-black text-primary uppercase tracking-tighter">S:{p.score || 0}</div>
                              </div>
                              <div className="text-[8px] font-black text-zinc-400 italic text-center whitespace-nowrap">
                                {Number(p.points || 0).toLocaleString()}P
                              </div>
                            </div>
                          
                          {isDeclarerPlayer && (
                            <div className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-500 rounded-lg text-[9px] font-black text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] border border-white/20 z-10 italic">DEC</div>
                          )}

                          {isTurn && (
                            <motion.div 
                              className="absolute -inset-1 rounded-full border border-primary/30"
                              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Table Center (Played Cards) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-72 h-72 flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                  {gameState.currentTrick.length > 0 ? (
                    gameState.currentTrick.map((t: any, i: number) => {
                      const pIdx = gameState.players.findIndex((p: any) => p.id === t.playerId);
                      const myIdx = gameState.players.findIndex((pl: any) => pl.nickname === nickname);
                      const relativeIdx = (pIdx - myIdx + 5) % 5;
                      const angles = [90, 162, 234, 306, 18]; 
                      const angle = angles[relativeIdx];
                      const dist = 75;
                      const tx = Math.cos((angle * Math.PI) / 180) * dist;
                      const ty = Math.sin((angle * Math.PI) / 180) * dist;
                      const isRed = t.card.suit === Suit.HEART || t.card.suit === Suit.DIAMOND;
                      const trump = gameState.trumpSuit === "NO_TRUMP" ? Suit.NONE : (gameState.trumpSuit as Suit);
                      const mightyId = getMightyCardId(trump);
                      const isMighty = t.card.id === mightyId;
                      const isJoker = t.card.suit === Suit.JOKER;
                      const isJokerCall = t.isJokerCall;

                      return (
                        <motion.div
                          key={`current-${t.playerId}-${i}`}
                          className={`absolute card-glass p-2 sm:p-3 flex flex-col premium-shadow transition-all duration-300 ${
                            viewport.width < 640 ? "w-16 h-24" : viewport.width < 768 ? "w-20 h-30" : "w-24 h-36"
                          } ${
                            isRed ? 'text-red-500' : 'text-zinc-100'
                          } ${
                            isMighty ? 'ring-2 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)] z-50' : 
                            isJoker ? 'ring-2 ring-purple-400 shadow-[0_0_25px_rgba(192,132,252,0.6)] z-50' : ''
                          }`}
                          initial={{ scale: 0.5, x: tx * 2.5, y: ty * 2.5, opacity: 0, rotate: 45 }}
                          animate={{ scale: 1, x: tx, y: ty, opacity: 1, rotate: (relativeIdx - 2) * 8 }}
                          exit={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
                          transition={{ type: "spring", damping: 12, stiffness: 100 }}
                        >
                           <div className="flex justify-between items-start">
                             <div className="text-sm font-black italic">{t.card.rank === 14 ? 'A' : t.card.rank === 13 ? 'K' : t.card.rank === 12 ? 'Q' : t.card.rank === 11 ? 'J' : t.card.rank}</div>
                             {isMighty && <div className="text-[7px] font-black bg-yellow-400 text-black px-1 rounded-sm tracking-tighter">MIGHTY</div>}
                             {isJoker && <div className="text-[7px] font-black bg-purple-500 text-white px-1 rounded-sm tracking-tighter">JOKER</div>}
                           </div>
                           <div className="text-3xl self-center my-auto drop-shadow-lg">{getSuitSymbol(t.card.suit)}</div>
                           {isJokerCall && <div className="mt-auto text-[6px] font-black text-center bg-red-600 text-white py-0.5 rounded-full uppercase">Joker Call</div>}
                        </motion.div>
                      );
                    })
                  ) : (
                    gameState.lastCompletedTrick?.map((t: any, i: number) => {
                      const pIdx = gameState.players.findIndex((p: any) => p.id === t.playerId);
                      const myIdx = gameState.players.findIndex((pl: any) => pl.nickname === nickname);
                      const relativeIdx = (pIdx - myIdx + 5) % 5;
                      const angles = [90, 162, 234, 306, 18]; 
                      const angle = angles[relativeIdx];
                      const dist = 75;
                      const tx = Math.cos((angle * Math.PI) / 180) * dist;
                      const ty = Math.sin((angle * Math.PI) / 180) * dist;
                      const isRed = t.card.suit === Suit.HEART || t.card.suit === Suit.DIAMOND;

                      return (() => {
                        const isMighty = t.card.suit === (gameState.trumpSuit === 'SPADE' ? 'DIAMOND' : 'SPADE') && t.card.rank === 14;
                        const isJoker = t.card.suit === 'JOKER';
                        const suitColor = t.card.suit === 'HEART' || t.card.suit === 'DIAMOND' ? 'text-red-500' : 'text-zinc-100';
                        
                        return (
                          <motion.div
                            key={`last-${t.playerId}-${i}`}
                            className={`absolute card-glass p-2 sm:p-3 flex flex-col premium-shadow opacity-60 grayscale-[0.5] border-2 ${
                              viewport.width < 640 ? "w-16 h-24" : viewport.width < 768 ? "w-20 h-30" : "w-24 h-36"
                            } ${
                              isMighty ? "border-yellow-400/40 shadow-[0_0_15px_rgba(250,204,21,0.3)]" : 
                              isJoker ? "border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]" : "border-white/5"
                            } ${suitColor}`}
                            initial={{ opacity: 0 }}
                            animate={{ x: tx, y: ty, opacity: 0.6, rotate: (relativeIdx - 2) * 8 }}
                            exit={{ opacity: 0 }}
                          >
                             <div className="text-sm font-black italic">{t.card.rank === 14 ? 'A' : t.card.rank === 13 ? 'K' : t.card.rank === 12 ? 'Q' : t.card.rank === 11 ? 'J' : t.card.rank}</div>
                             <div className="text-3xl self-center my-auto drop-shadow-lg">{getSuitSymbol(t.card.suit)}</div>
                             {isMighty && <div className="absolute top-1 right-2 text-[8px] font-black text-yellow-400 uppercase italic">Mighty</div>}
                          </motion.div>
                        );
                      })();
                    })
                  )}
                </AnimatePresence>
                {gameState.currentTrick.length === 0 && gameState.lastWinnerId && !lastTrickResult && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                    <div className="text-primary text-[10px] font-black uppercase tracking-[0.2em] italic bg-primary/10 py-1 px-3 rounded-full border border-primary/20">
                      Last Trick Winner
                    </div>
                    <div className="text-white text-sm font-black uppercase tracking-widest drop-shadow-lg">
                      {gameState.players.find((p: any) => p.id === gameState.lastWinnerId)?.nickname || "Winner"}
                    </div>
                  </motion.div>
                )}

                {/* Trick Result Message */}
                <AnimatePresence>
                  {lastTrickResult && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0, y: -50 }}
                      className="absolute z-[1000] flex flex-col items-center justify-center gap-2"
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/60">Trick Winner</div>
                      <div className="text-4xl font-black italic text-white drop-shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.8)]">
                        {gameState.players.find((p: any) => p.id === lastTrickResult.winnerId)?.nickname}
                      </div>
                      {lastTrickResult.isJokerCalled && (
                        <div className="px-4 py-1 bg-red-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-xl">Joker Called!</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* My Hand */}
        <div className="px-6 sm:px-12 pb-10 sm:pb-20 flex justify-center h-[180px] sm:h-[240px] md:h-[300px] relative z-30 perspective-1000">
          <div className={`flex relative items-end preserve-3d ${viewport.width < 640 ? "-space-x-8" : "-space-x-12"}`}>
            <AnimatePresence>
              {gameState.myCards?.map((card: any, idx: number) => {
                const isSelected = selectedDiscards.includes(card.id);
                const canDiscard = gameState.state === GameState.EXCHANGING && isDeclarer;
                const canPlayByState = gameState.state === GameState.PLAYING && isMyTurn;
                const isBiddingState = gameState.state === GameState.BIDDING;
                
                let isPlayable = true;
                if (canPlayByState) {
                  const trump = gameState.trumpSuit === "NO_TRUMP" ? Suit.NONE : (gameState.trumpSuit as Suit);
                  const validation = canPlayCard(gameState.myCards, gameState.leadSuit, {
                    trumpSuit: trump,
                    mightyCardId: getMightyCardId(trump),
                    jokerCallCardId: getJokerCallCardId(trump),
                    isFirstTrick: gameState.trickCount === 1,
                    isLastTrick: gameState.trickCount === 10,
                  }, card);
                  isPlayable = validation.canPlay;
                }

                const isViewing = viewingCardId === card.id;
                const isSelectedToPlay = selectedCardId === card.id;
                
                return (
                  <motion.div
                    key={card.id || idx}
                    className="relative cursor-pointer group"
                    initial={{ y: 200, opacity: 0, scale: 0.8 }}
                    animate={{ 
                      y: isSelected || isViewing || isSelectedToPlay ? -80 : (canPlayByState && isPlayable) ? -30 : -20, 
                      opacity: (canPlayByState && !isPlayable) ? 0.3 : 1,
                      rotate: (isViewing || isSelectedToPlay) ? 0 : (idx - (gameState.myCards.length / 2)) * 3,
                      rotateX: isViewing || isSelectedToPlay ? 0 : 10,
                      translateZ: isViewing || isSelectedToPlay ? 50 : 0,
                      zIndex: (isViewing || isSelectedToPlay) ? 1000 : (10 + idx)
                    }}
                    whileHover={{ 
                      y: isSelected || isViewing || isSelectedToPlay ? -120 : -95, 
                      scale: 1.15,
                      rotate: 0,
                      rotateX: 0,
                      translateZ: 100,
                      zIndex: 2000
                    }}
                    onClick={() => {
                      if (canDiscard) {
                        toggleDiscard(card.id);
                      } else if (gameState.state === GameState.PLAYING) {
                        if (isMyTurn) {
                          if (isPlayable) {
                            setSelectedCardId(selectedCardId === card.id ? null : card.id);
                          } else {
                            setSelectedCardId(selectedCardId === card.id ? null : card.id);
                            setViewingCardId(card.id);
                          }
                        } else {
                          setViewingCardId(viewingCardId === card.id ? null : card.id);
                        }
                      } else {
                        setViewingCardId(viewingCardId === card.id ? null : card.id);
                        setSelectedCardId(null);
                      }
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {isSelectedToPlay && gameState.state === GameState.PLAYING && (
                        <motion.div
                          key="play-btn-container"
                          initial={{ opacity: 0, y: 10, x: "-50%" }}
                          animate={{ opacity: 1, y: -85, x: "-50%" }}
                          exit={{ opacity: 0, scale: 0.8, x: "-50%" }}
                          className="absolute left-1/2 z-[10000] pointer-events-auto flex flex-col items-center gap-3"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMyTurn) {
                                handleCardPlay(card);
                                setSelectedCardId(null);
                              }
                            }}
                            className={`px-10 py-3.5 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl transition-all duration-300 ${
                              (!isMyTurn) 
                                ? "bg-gray-800/80 cursor-not-allowed opacity-50 backdrop-blur-md border border-white/5 text-gray-400" 
                                : "bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:scale-110 hover:shadow-violet-600/50 active:scale-95 border border-white/20 text-white"
                            }`}
                          >
                            {!isPlayable && isMyTurn ? "Invalid Move" : "Play Card Now"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {(() => {
                      const isMighty = card.suit === (gameState.trumpSuit === 'SPADE' ? 'DIAMOND' : 'SPADE') && card.rank === 14;
                      const isJoker = card.suit === 'JOKER';
                      const suitColor = card.suit === 'HEART' || card.suit === 'DIAMOND' ? 'text-red-500' : 'text-zinc-100';
                      
                      return (
                        <div className={`card-glass border flex flex-col p-2.5 sm:p-4 shadow-2xl transition-all relative overflow-hidden preserve-3d ${
                          viewport.width < 640 ? "w-[80px] h-[120px]" : viewport.width < 768 ? "w-[110px] h-[160px]" : "w-[130px] h-[190px]"
                        } ${
                          (canPlayByState && isPlayable && !isAnimating) || canDiscard || isViewing || isSelectedToPlay 
                            ? isMighty ? "border-yellow-400/60 ring-1 ring-yellow-400/20 group-hover:border-yellow-400" :
                              isJoker ? "border-purple-400/60 ring-1 ring-purple-400/20 group-hover:border-purple-400" :
                              "border-white/10 group-hover:border-primary group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer" 
                            : "border-white/5 opacity-40 cursor-not-allowed"
                        } ${isSelected || isSelectedToPlay ? "border-accent ring-2 ring-accent/30 shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.6)]" : ""} ${suitColor}`}>
                           
                           {/* 3D Lighting Layer */}
                           <div className="card-3d-effect" />
                           
                           {/* Background Glow for Special Cards */}
                           {isMighty && <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent pointer-events-none" />}
                           {isJoker && <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />}

                           <div className="flex justify-between items-start">
                             <span className="text-2xl font-black italic select-none leading-none">{card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank}</span>
                             {isMighty && <span className="text-[9px] font-black text-yellow-400 uppercase italic tracking-tighter">Mighty</span>}
                             {isJoker && <span className="text-[9px] font-black text-purple-400 uppercase italic tracking-tighter">Joker</span>}
                           </div>
                           
                           <span className="text-5xl mt-3 select-none self-center drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                             {getSuitSymbol(card.suit)}
                           </span>
                           
                           {/* Center Graphic for high ranks */}
                           <div className="mt-auto flex justify-end">
                              <span className="text-2xl opacity-20 font-black italic leading-none">{card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : ''}</span>
                           </div>

                           {isSelected && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest text-white shadow-lg">Discard</div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* MODALS (Enhanced Designs) */}
        <AnimatePresence mode="wait">
          {isBiddingState && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
              {isMyTurn ? (
                <motion.div className="glass p-8 rounded-[2rem] w-[400px] flex flex-col gap-6 border-white/10 premium-shadow" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                  <div className="text-center">
                    <h2 className="text-3xl font-black italic tracking-tighter text-primary">PLACE YOUR BID</h2>
                    <p className="text-[10px] font-black text-zinc-500 mt-2 uppercase tracking-[0.2em]">Highest: <span className="text-white">{gameState.highBidAmount} {getSuitSymbol(gameState.highBidSuit || "")}</span></p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-2">Quantity</label>
                      <div className="grid grid-cols-4 gap-2.5">
                        {[13, 14, 15, 16, 17, 18, 19, 20].map(num => (
                          <button key={num} onClick={() => setSelectedBidAmount(num)} className={`py-3 rounded-2xl font-black transition-all border-2 ${selectedBidAmount === num ? "bg-primary border-primary shadow-lg shadow-primary/20 text-white" : "bg-white/5 border-white/10 hover:border-white/30 text-zinc-400"}`}>{num}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-2">Trump Suit</label>
                      <div className="grid grid-cols-5 gap-2.5">
                        {[Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER, "NO_TRUMP"].map((s: any) => (
                          <button key={s} onClick={() => setSelectedBidSuit(s)} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center ${selectedBidSuit === s ? "bg-primary border-primary shadow-lg shadow-primary/20 text-white" : "bg-white/5 border-white/10 hover:border-white/30 text-zinc-400"}`}>
                            <span className="text-xl">{getSuitSymbol(s)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => {
                      console.log(`[ACTION] sendBid: pass=true`);
                      sendBid(true);
                    }} className="flex-1 bg-zinc-900 py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10 hover:bg-zinc-800 transition-all text-zinc-400">PASS</button>
                    <button 
                      disabled={!validateBid(gameState.highBidAmount, gameState.highBidSuit, selectedBidAmount, selectedBidSuit)}
                      onClick={() => {
                        console.log(`[ACTION] sendBid: pass=false, amount=${selectedBidAmount}, suit=${selectedBidSuit}`);
                        sendBid(false, selectedBidAmount, selectedBidSuit);
                      }}
                      className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${validateBid(gameState.highBidAmount, gameState.highBidSuit, selectedBidAmount, selectedBidSuit) ? "bg-white text-black shadow-xl" : "bg-zinc-900 text-zinc-700 opacity-50 cursor-not-allowed"}`}
                    >
                      CONFIRM {selectedBidAmount}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <span className="text-xl font-black text-primary italic">B</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black italic tracking-tight mb-1">BIDDING IN PROGRESS</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Waiting for {gameState.players[gameState.currentBidderIndex]?.nickname || "Other Player"}...</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border-white/5 flex items-center gap-4">
                     <span className="text-[10px] font-black text-zinc-600 uppercase">Current High</span>
                     <span className="font-black text-white">{gameState.highBidAmount} {getSuitSymbol(gameState.highBidSuit || "")}</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          {/* In-game Error/Alert Modal */}
          {showErrorModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md px-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="relative w-full max-w-[320px] p-7 bg-black/80 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-red-600 to-rose-500 blur-[4px] opacity-70" />
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-red-500/15 border border-red-500/20 rounded-full flex items-center justify-center mb-5 animate-pulse">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  
                  <h2 className="text-lg font-black italic tracking-tight mb-2 uppercase text-white">System <span className="text-red-500">Alert</span></h2>
                  <p className="text-xs text-zinc-400 font-bold leading-relaxed mb-7 whitespace-pre-wrap">
                    {gameError}
                  </p>

                  <button 
                    onClick={() => {
                      setShowErrorModal(false);
                      setGameError(null);
                      clearError();
                    }}
                    className="w-full py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.15)] group relative overflow-hidden"
                  >
                    <span className="relative z-10">Confirm</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-300/0 via-black/5 to-zinc-300/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isMyFriendSelect && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl pointer-events-auto">
              <motion.div 
                className="glass p-10 rounded-[3rem] w-[500px] flex flex-col gap-8 border-white/10 premium-shadow pointer-events-auto"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <div className="text-center font-black">
                  <h2 className="text-3xl tracking-tighter uppercase italic text-primary">Select Your Friend</h2>
                  <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.3em]">Declare the card of the player who will be your ally</p>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {[Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER].map(suit => (
                    <div key={suit} className="flex flex-col gap-2">
                      <div className="text-center text-lg">{getSuitSymbol(suit)}</div>
                      {([14, 13, 12] as any).map((rank: number) => (
                        <button
                          key={`${suit}-${rank}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(`[ACTION] Select Friend Card: Suit=${suit}, Rank=${rank}`);
                            sendSelectFriend({ suit, rank, id: "" } as any);
                          }}
                          className="py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-primary hover:border-primary font-black transition-all text-xs active:scale-95"
                        >
                          {rank === 14 ? 'A' : rank === 13 ? 'K' : 'Q'}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="flex flex-col gap-2">
                    <div className="text-center text-lg">✨</div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("[ACTION] Select MIGHTY Friend");
                        sendSelectFriend({ suit: Suit.SPADE, rank: 14, id: "" } as any);
                      }}
                      className="py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600 font-bold transition-all text-[10px] active:scale-95"
                    >MIGHTY</button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("[ACTION] Select JOKER Friend");
                        sendSelectFriend({ suit: Suit.JOKER, rank: 0, id: "" } as any);
                      }}
                      className="py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600 font-bold transition-all text-[10px] active:scale-95"
                    >JOKER</button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("[ACTION] Select SOLO (None)");
                        sendSelectFriend("NONE" as any);
                      }}
                      className="py-2.5 rounded-xl bg-zinc-800 border border-white/10 hover:bg-zinc-700 font-bold transition-all text-[10px] active:scale-95"
                    >SOLO</button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-5 text-center">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    프렌드 카드를 가진 플레이어와 같은 편이 됩니다. <br/>
                    지목한 카드가 본인한테 있거나 아무도 없으면 <br/>
                    <span className="text-primary font-black">SOLO(노프렌드)</span>로 간주됩니다.
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {showExchangePopup && (
            <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 pointer-events-none">
              <motion.div 
                className="glass p-8 rounded-[2.5rem] w-[400px] flex flex-col gap-6 border-white/10 premium-shadow pointer-events-auto relative" 
                initial={{ y: -50, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-[2.5rem] pointer-events-none" />
                <div className="relative text-center">
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic text-primary">Finalize Contract</h2>
                  <p className="text-[10px] font-black text-zinc-300 mt-1 uppercase tracking-[0.2em] bg-white/5 py-2 px-4 rounded-full inline-block">
                    Selected: <span className="text-primary font-black">{selectedDiscards.length} / 3</span>
                  </p>
                  <p className="text-[11px] font-bold text-zinc-500 mt-3 uppercase tracking-tighter">Discard 3 cards from your hand</p>
                </div>
                
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2 text-center block">Change Trump Suit (Optional)</label>
                   <div className="grid grid-cols-5 gap-2">
                      {[Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER, "NO_TRUMP"].map((s) => (
                        <button 
                          key={s} 
                          onClick={() => setSelectedTrump(s as any)} 
                          className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center ${selectedTrump === s ? "border-primary bg-primary/20 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]" : "border-white/5 bg-white/5 hover:bg-white/10"}`}
                        >
                          <span className="text-xl">{getSuitSymbol(s as string)}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="mt-4">
                   <button 
                     disabled={selectedDiscards.length !== 3}
                     onClick={(e) => {
                       e.stopPropagation();
                       handleExchangeConfirm();
                     }}
                     className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all pointer-events-auto relative z-[9999] ${
                       selectedDiscards.length === 3 
                       ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-[0.95]" 
                       : "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                     }`}
                   >
                     {selectedDiscards.length === 3 ? "CONFIRM & START GAME" : `SELECT ${3 - selectedDiscards.length} MORE`}
                   </button>
                 </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* CHATTING SIDEBAR (Premium Polishing) - Desktop */}
      <div className="hidden lg:flex w-72 h-screen sticky top-0 border-l border-white/5 bg-black/40 backdrop-blur-[40px] flex flex-col relative z-50">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <span className="font-black text-[11px] uppercase tracking-[0.4em] text-zinc-400 italic">Comms Link</span>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-primary" />
              <div className="w-1 h-1 rounded-full bg-primary/50" />
              <div className="w-1 h-1 rounded-full bg-primary/20" />
            </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {messages.map((msg, i) => {
            const isSystem = msg.sender === "SYSTEM";
            const isMe = msg.sender === nickname;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`flex flex-col ${isSystem ? "items-center" : isMe ? "items-end" : "items-start"}`}>
                {!isSystem && <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1.5 mr-1">{msg.sender}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-[12px] leading-relaxed max-w-[95%] font-medium ${
                  isSystem ? "bg-white/[0.03] border border-white/5 text-zinc-500 text-[9px] italic py-2" :
                  isMe ? "bg-primary text-white premium-shadow" : "bg-white/5 border border-white/5 text-zinc-300"
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            );
          })}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if(chatInput.trim()) { sendMessage(chatInput); setChatInput(""); } }} className="p-4 bg-white/[0.02]">
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Comms message..." className="w-full bg-black/60 border border-white/5 rounded-2xl px-5 py-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold placeholder:text-zinc-700" />
        </form>
      </div>

      {/* MOBILE CHAT OVERLAY */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 right-0 w-[85%] max-w-[320px] bg-zinc-950/90 backdrop-blur-[40px] border-l border-white/10 z-[101] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <span className="font-black text-[11px] uppercase tracking-[0.4em] text-zinc-400 italic">Mobile Comms</span>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === "SYSTEM" ? "items-center" : msg.sender === nickname ? "items-end" : "items-start"}`}>
                    {msg.sender !== "SYSTEM" && <span className="text-[8px] font-black text-zinc-600 uppercase mb-1">{msg.sender}</span>}
                    <div className={`px-4 py-2 rounded-2xl text-[13px] ${
                      msg.sender === "SYSTEM" ? "bg-white/5 text-zinc-500 text-[10px] italic" :
                      msg.sender === nickname ? "bg-primary text-white" : "bg-white/10 text-zinc-300"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if(chatInput.trim()) { sendMessage(chatInput); setChatInput(""); } }} className="p-4 bg-black/40 border-t border-white/5">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* RESULT OVERLAY */}
      <AnimatePresence>
        {gameState.state === GameState.RESULT && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6"
          >
              <motion.div 
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="max-w-xl w-full max-h-[95vh] glass rounded-[2.5rem] md:rounded-[3rem] border-white/10 flex flex-col relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-600/10 pointer-events-none" />
                
                <div className="flex-1 overflow-y-auto w-full p-6 md:p-10 flex flex-col items-center custom-scrollbar">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 border-4 ${
                    result?.isWin ? "bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_50px_rgba(34,197,94,0.4)]" : "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_50px_rgba(239,68,68,0.4)]"
                  }`}
                >
                  <span className="text-3xl md:text-4xl font-black">{result?.isWin ? "W" : "L"}</span>
                </motion.div>

                <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase mb-1 text-center leading-none">
                  {result?.isWin ? "Victory Reached" : "Mission Failed"}
                </h1>
                <div className="flex flex-col items-center gap-1 mb-6 md:mb-8">
                  <p className="text-zinc-500 font-black tracking-[0.4em] uppercase text-[10px]">System Final Settlement</p>
                  {!result?.isWin && (
                    <p className="text-red-400/80 font-bold text-[9px] uppercase tracking-tighter">
                      Contract of {gameState.highBidAmount} cards not met (Deficit: {gameState.highBidAmount - (result?.actualScore || 0)})
                    </p>
                  )}
                  {result?.isWin && (
                    <p className="text-green-400/80 font-bold text-[9px] uppercase tracking-tighter">
                      Contract of {gameState.highBidAmount} cards fulfilled successfully
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 w-full mb-6 md:mb-8">
                  <div className="glass p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-white/5 flex flex-col items-center">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Contract Status</span>
                    <span className="text-lg md:text-xl font-black">{gameState.highBidAmount} {getSuitSymbol(gameState.highBidSuit || "")}</span>
                  </div>
                  <div className="glass p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-white/5 flex flex-col items-center bg-white/5">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Final Score</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-2xl md:text-3xl font-black ${result?.isWin ? "text-green-400" : "text-red-400"}`}>
                        {result?.actualScore} / 20
                      </span>
                      {result?.trickScore !== undefined && result?.floorScore !== undefined && (
                        <span className="text-[8px] font-bold text-zinc-500 mt-0.5 uppercase">
                          Tricks: {result.trickScore} + K: {result.floorScore}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="glass p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-white/5 flex flex-col items-center">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Result</span>
                    <span className="text-lg md:text-xl font-black uppercase tracking-wider">{result?.isWin ? "Success" : "Failure"}</span>
                  </div>
                </div>

                <div className="w-full flex flex-col md:flex-row gap-6 md:gap-0 mb-6 md:mb-8 items-stretch">
                   {/* Declarer Side */}
                   <div className="flex-1 space-y-2">
                     <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] text-center">Declarer Side</h3>
                     <div className="flex flex-wrap justify-center gap-4">
                        {gameState.players.filter((p: any) => p.id === result?.bidderId || p.id === result?.friendId).map((p: any) => (
                           <ResultPlayerItem key={p.id} p={p} result={result} isAlly={true} currentNickname={nickname} />
                        ))}
                     </div>
                   </div>

                   <div className="hidden md:block w-px bg-white/5 mx-4 self-stretch" />

                   {/* Opposition Side */}
                   <div className="flex-1 space-y-2">
                     <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Opposition Side</h3>
                     <div className="flex flex-wrap justify-center gap-4">
                        {gameState.players.filter((p: any) => p.id !== result?.bidderId && p.id !== result?.friendId).map((p: any) => (
                           <ResultPlayerItem key={p.id} p={p} result={result} isAlly={false} currentNickname={nickname} />
                        ))}
                     </div>
                   </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full mt-2">
                  <button 
                    onClick={async () => {
                      await leaveRoom();
                      window.location.href = "/lobby";
                    }}
                    className="flex-1 py-3 md:py-4 rounded-[1rem] md:rounded-[1.25rem] bg-white text-black text-xs md:text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                    Return to Hub
                  </button>
                  <button 
                    onClick={() => {
                      if (isHost) {
                        restartGame();
                      }
                    }}
                    className={`flex-1 py-3 md:py-4 rounded-[1rem] md:rounded-[1.25rem] ${isHost ? "bg-indigo-600 shadow-indigo-500/20" : "bg-indigo-600/50 cursor-not-allowed"} text-white text-xs md:text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl`}
                    disabled={!isHost}
                  >
                    {isHost ? "Next Mission" : "Waiting for Host"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerCard({ player: p, x, y, isDeclarerPlayer, timeoutMs }: any) {
  const [diff, setDiff] = useState<number | null>(null);
  const prevPoints = useRef(p.points);

  useEffect(() => {
    if (prevPoints.current !== undefined && prevPoints.current !== p.points) {
      setDiff(Number(p.points) - Number(prevPoints.current));
      const timer = setTimeout(() => setDiff(null), 3000);
      prevPoints.current = p.points;
      return () => clearTimeout(timer);
    }
    prevPoints.current = p.points;
  }, [p.points]);

  return (
    <motion.div
      className={`absolute w-36 h-40 glass rounded-[2.5rem] flex flex-col items-center justify-center border-2 transition-all duration-500 ${
        p.isTurn || p.isBidding ? "border-primary shadow-[0_0_40px_rgba(var(--color-primary-rgb),0.4)] bg-primary/5 scale-105" : "border-white/5 bg-white/[0.02]"
      }`}
      style={{ left: `calc(50% + ${x}px - 72px)`, top: `calc(50% + ${y}px - 80px)` }}
      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
    >
      <AnimatePresence>
        {diff !== null && (
          <motion.div key={Date.now()} initial={{ y: 0, opacity: 1, scale: 0.5 }} animate={{ y: -100, opacity: 0, scale: 2 }} className={`absolute font-black text-3xl z-[100] drop-shadow-2xl ${diff >= 0 ? "text-green-400" : "text-red-500"}`}>
            {diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
          </motion.div>
        )}
      </AnimatePresence>

      {isDeclarerPlayer && (
        <div className="absolute -top-3.5 bg-accent text-white text-[9px] font-black px-3 py-1 rounded-full shadow-xl tracking-tighter uppercase">Declarer</div>
      )}
      
      <div className="relative mb-3">
        <div className={`w-14 h-14 rounded-[1.25rem] bg-zinc-900 border-2 flex items-center justify-center relative overflow-hidden ${p.isTurn ? 'border-primary' : 'border-white/10'}`}>
          <span className="text-xl font-black text-white italic">{p.nickname[0]}</span>
          {p.isFriend && <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center text-[9px] font-black uppercase text-white tracking-widest leading-none">Ally</div>}
        </div>
        {p.isTurn && <motion.div className="absolute inset-[-4px] rounded-[1.5rem] border-2 border-primary/50" animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />}
      </div>

      <div className="text-[11px] font-black text-zinc-100 truncate w-28 text-center tracking-tight mb-1">{p.nickname}</div>
      <div className={`text-[12px] font-black tracking-tighter ${p.points < 0 ? "text-red-500" : "text-primary"}`}>₩{Number(p.points)?.toLocaleString()}</div>
      
      <div className="flex gap-2 mt-2">
        <div className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">{p.cardCount} Cards</div>
        <div className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/5 text-[8px] font-black text-primary uppercase tracking-tighter">S: {p.score || 0}</div>
      </div>

      {(p.isTurn || p.isBidding) && (
        <div className="absolute -bottom-3 inset-x-6 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <motion.div className="h-full bg-linear-to-r from-primary to-accent" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: timeoutMs / 1000, ease: "linear" }} />
        </div>
      )}
    </motion.div>
  );
}
function ResultPlayerItem({ p, result, isAlly, currentNickname }: any) {
  const isBidder = p.id === result?.bidderId;
  const isFriend = p.id === result?.friendId;

  return (
    <div className="flex flex-col items-center gap-1 md:gap-2 group relative">
       <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[1rem] md:rounded-[1.25rem] flex flex-col items-center justify-center border-2 bg-black/40 relative ${p.nickname === currentNickname ? "border-primary" : isAlly ? "border-primary/40" : "border-white/5"}`}>
          <span className="text-lg md:text-xl font-black italic leading-none">{p.nickname[0]}</span>
          {isAlly && (
            <div className={`absolute -top-1.5 -right-1.5 ${isBidder ? 'bg-accent' : 'bg-primary'} text-[6px] md:text-[7px] font-black px-1 md:px-1.5 py-0.2 md:py-0.5 rounded-sm uppercase tracking-tighter shadow-lg`}>
              {isBidder ? 'M' : 'A'}
            </div>
          )}
          <div className="mt-0.5 px-1 md:px-1.5 py-0.2 md:py-0.5 rounded-sm bg-white/5 border border-white/5 text-[7px] md:text-[8px] font-black text-white/80">
             {p.score || 0}
          </div>
       </div>
       <div className="flex flex-col items-center overflow-hidden w-full">
         <span className={`text-[8px] md:text-[9px] font-black truncate w-full text-center ${p.nickname === currentNickname ? "text-primary" : "text-zinc-600"}`}>{p.nickname}</span>
       </div>
    </div>
  );
}
