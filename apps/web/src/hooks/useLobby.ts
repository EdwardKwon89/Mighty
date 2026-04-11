"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface RoomInfo {
  id: string;
  players: number;
  maxPlayers: number;
  state: string;
  highBidAmount?: number;
  highBidSuit?: string;
}

export interface LobbyInfo {
  onlineCount: number;
  players: { nickname: string; id: string; status: string; points: string; roomId?: string }[];
}

export function useLobby() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo>({ onlineCount: 0, players: [] });
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("mighty_token") : null;
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const s = io(serverUrl, {
      auth: { token }
    });

    s.on("connect", () => {
      console.log("Connected to lobby");
      s.emit("get-rooms");
      
      // 토큰에서 닉네임 추출 (디코딩 라이브러리 없이 간단하게 로컬 스토리지 활용)
      const storedNickname = localStorage.getItem("mighty_nickname");
      setMyNickname(storedNickname);
    });

    s.on("rooms-list", (roomList: RoomInfo[]) => {
      setRooms(roomList);
    });

    s.on("lobby-info", (info: LobbyInfo) => {
      setLobbyInfo(info);
    });

    s.on("room-created", ({ roomId }: { roomId: string }) => {
      window.location.href = `/game/${roomId}`;
    });

    s.on("authenticated", ({ token, isAdmin, points }: { token: string; isAdmin: boolean; points: string }) => {
      localStorage.setItem("mighty_token", token);
      if (points) localStorage.setItem("mighty_points", points);
      setIsAdmin(isAdmin);
    });

    s.on("duplicate-login", (data: { message: string }) => {
      alert(data.message);
      localStorage.removeItem("mighty_token");
      localStorage.removeItem("mighty_nickname");
      window.location.href = "/";
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

    s.on("error", (err: { message: string; code?: string }) => {
      console.error("Lobby error:", err.message);
      setError(err.message);
      
      // 인증 실패 관련 에러인 경우 로그인 페이지로 튕겨내기
      if (err.code === "AUTH_FAILED" || 
          err.message.includes("INVALID_TOKEN") || 
          err.message === "SESSION_EXPIRED") {
        localStorage.removeItem("mighty_token");
        window.location.href = "/";
      }
    });


    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const createRoom = (roomId: string) => {
    if (socket) {
      socket.emit("create-room", { roomId });
    }
  };

  const refreshRooms = () => {
    if (socket) {
      socket.emit("get-rooms");
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem("mighty_token");
    localStorage.removeItem("mighty_nickname");
    localStorage.removeItem("mighty_last_location");
    socket?.disconnect();
    window.location.href = "/";
  }, [socket]);

  return {
    rooms,
    lobbyInfo,
    isAdmin,
    myNickname,
    createRoom,
    refreshRooms,
    logout,
    error
  };
}
