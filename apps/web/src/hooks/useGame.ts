"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Card, Suit } from "@mighty/engine";

export enum GameState {
  WAITING = "WAITING",
  BIDDING = "BIDDING",
  EXCHANGING = "EXCHANGING",
  SELECTING_FRIEND = "SELECTING_FRIEND",
  PLAYING = "PLAYING",
  RESULT = "RESULT",
  READY = "READY",
}

export interface ChatMessage {
  sender: string;
  text: string;
  at: Date;
}

export const useGame = (roomId: string, nickname: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTrickResult, setLastTrickResult] = useState<any>(null);

  useEffect(() => {
    // 룸이 변경되거나 닉네임이 바뀔 때 이전 상태 초기화
    setGameState(null);
    setMessages([]);
    setResult(null);
    setError(null);
    setLastTrickResult(null);
    
    if (!nickname || nickname === "익명") return;

    const token = localStorage.getItem("mighty_token");
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const s = io(serverUrl, {
      auth: { token }
    });

    s.on("connect", () => {
      const password = localStorage.getItem("mighty_password");
      console.log("Connected to server as:", nickname);
      s.emit("join-room", { roomId, nickname, password, token });
    });

    s.on("authenticated", ({ token: newToken }: { token: string }) => {
      localStorage.setItem("mighty_token", newToken);
    });

    s.on("trick-result", (res: any) => {
      setLastTrickResult(res);
      // 3초 후 결과 메시지 제거
      setTimeout(() => setLastTrickResult(null), 3000);
    });

    s.on("game-state", (state: any) => {
      setGameState(state);
      if (state.state !== GameState.RESULT) {
        setResult(null);
      }
    });

    s.on("game-over", (res: any) => {
      setResult(res);
    });

    s.on("receive-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    s.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      
      // ERR-05: 세션 만료 혹은 유효하지 않은 토큰인 경우 즉시 리다이렉트
      if (err.message === "SESSION_EXPIRED" || err.message === "INVALID_TOKEN") {
        console.warn("Session expired or invalid. Redirecting to login...");
        localStorage.removeItem("mighty_token");
        window.location.href = "/";
      } else {
        setError(`서버 연결 실패: ${err.message}`);
      }
    });

    s.on("error", (err: { message: string }) => {
      setError(err.message);
      if (err.message === "INVALID_TOKEN" || err.message === "SESSION_EXPIRED") {
        localStorage.removeItem("mighty_token");
        window.location.href = "/";
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [roomId, nickname]);

  const sendBid = useCallback((pass: boolean, amount?: number, suit?: Suit | "NO_TRUMP") => {
    socket?.emit("bid", { roomId, pass, amount, suit });
  }, [socket, roomId]);

  const sendExchange = useCallback((discards: Card[], trump: Suit | "NO_TRUMP") => {
    socket?.emit("exchange", { roomId, discards, trump });
  }, [socket, roomId]);

  const sendSelectFriend = useCallback((card: Card | "NONE") => {
    socket?.emit("select-friend", { roomId, card });
  }, [socket, roomId]);

  const sendPlayCard = useCallback((card: Card, isJokerCall?: boolean) => {
    socket?.emit("play-card", { roomId, card, isJokerCall });
  }, [socket, roomId]);

  const sendMessage = useCallback((text: string) => {
    socket?.emit("send-message", { roomId, nickname, text });
  }, [socket, roomId, nickname]);

  const sendAddBot = useCallback(() => {
    socket?.emit("add-bot", { roomId });
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (socket) {
        socket.emit("leave-room", { roomId }, () => {
          resolve();
        });
        // 만약 서버 응답이 너무 늦을 경우를 대비한 타임아웃
        setTimeout(resolve, 500);
      } else {
        resolve();
      }
    });
  }, [socket, roomId]);

  const sendStartGame = useCallback(() => {
    socket?.emit("start-game", { roomId });
  }, [socket, roomId]);

  const restartGame = useCallback(() => {
    socket?.emit("restart-game", { roomId });
  }, [socket, roomId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    gameState,
    messages,
    result,
    error,
    lastTrickResult,
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
    socket
  };
};
