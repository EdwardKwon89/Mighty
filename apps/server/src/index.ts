import Fastify from "fastify";
import { Server, Socket } from "socket.io";
import cors from "@fastify/cors";
import jwt from "jsonwebtoken";
import { GameRoom, GameState } from "./game-room.js";
import { authenticatePlayer, updateGameResult, getPlayerStats } from "@mighty/database";
import { calculateScore } from "@mighty/engine";

const JWT_SECRET = process.env.JWT_SECRET || "mighty-prime-secret-key-2026";
const SERVER_INSTANCE_ID = Date.now().toString(36); // 서버 실행 시마다 고유 ID 생성


const fastify = Fastify({ logger: true });

// Health check endpoint for Render/Cron-job wake-up
fastify.get("/health", async () => {
  return { status: "OK", timestamp: new Date().toISOString() };
});

await fastify.register(cors, { 
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"] 
});

const io = new Server(fastify.server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});

// 소켓 인증 미들웨어
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    // get-stats 등 인증이 필요 없는 초기 접근 허용을 위해 에러를 던지지 않고 
    // socket.data.user를 선택적으로 설정
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // ERR-05: 서버 인스턴스 ID가 일치하지 않으면 세션 만료로 처리
    if (decoded.instanceId !== SERVER_INSTANCE_ID) {
      console.log(`[AUTH_REJECT] Instance mismatch. Token: ${decoded.instanceId}, Server: ${SERVER_INSTANCE_ID}`);
      return next(new Error("SESSION_EXPIRED"));
    }

    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error("INVALID_TOKEN"));
  }
});

// 활성화된 게임 룸 관리
const rooms = new Map<string, GameRoom>();

// [Cleanup] 상위 테스트 방 완전 박멸 (사용자 요청)
// 1초마다 PRIME_FIELD_TEST_ 접두사 방이 있으면 삭제
const cleanupInterval = setInterval(() => {
  const testRoomPrefix = "prime_field_test_";
  let deleted = false;
  
  for (const roomId of rooms.keys()) {
    const lowerRoomId = roomId.toLowerCase();
    if (lowerRoomId.startsWith(testRoomPrefix) || lowerRoomId === "lobby") {
      rooms.delete(roomId);
      deleted = true;
      console.log(`[NUCLEAR_CLEANUP] Deleted ghost room: ${roomId}`);
    }
  }
  if (deleted) broadcastRoomsList();
}, 1000);

// 서버 시작 직후 강제 전체 초기화 (1회성)
const initialCleanupTimeout = setTimeout(() => {
  console.log("[INITIAL_CLEANUP] Clearing all rooms to ensure clean slate.");
  rooms.clear();
  broadcastRoomsList();
}, 3000);

// Graceful Shutdown 로직 개선 (Fixing Exit Code 1 & Force Killing)
let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[SHUTDOWN] Received ${signal}. Cleaning up...`);

  // 2초 후 강제 종료 (안전장치: 리소스 정리가 지연되어도 tsx의 Force kill 이전에 종료)
  const forceExit = setTimeout(() => {
    console.log("[SHUTDOWN] Fail-safe exit triggered.");
    process.exit(0);
  }, 2000);
  if (forceExit.unref) forceExit.unref();

  // 리소스 정리
  clearInterval(cleanupInterval);
  clearTimeout(initialCleanupTimeout);
  
  // 모든 재접속 타이머 정리
  if (typeof reconnectTimers !== 'undefined') {
    reconnectTimers.forEach((timer) => clearTimeout(timer));
  }
  
  try {
    io.close();
    await fastify.close();
    console.log("[SHUTDOWN] Cleanup complete. Exiting gracefully.");
    process.exit(0);
  } catch (err) {
    console.error("[SHUTDOWN] Error during cleanup:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));


// 재접속 대기 타이머 관리 (socket.id가 아닌 닉네임 기반)
const reconnectTimers = new Map<string, NodeJS.Timeout>();

// 헬퍼: 전체 로비에 룸 리스트 브로드캐스트
function broadcastRoomsList() {
  const testRoomPrefix = "PRIME_FIELD_TEST_";
  const roomList = Array.from(rooms.values())
    .filter(r => !(r as any).id.startsWith(testRoomPrefix)) // 테스트 방 필터링
    .map(r => ({
      id: (r as any).id,
      players: (r as any).players.length,
      maxPlayers: 5,
      state: (r as any).state || "WAITING",
      highBidAmount: (r as any).highBidAmount,
      highBidSuit: (r as any).highBidSuit,
    }));
  io.emit("rooms-list", roomList);
}

/**
 * 중복 로그인 세션 강제 종료 헬퍼
 */
async function kickExistingSessions(nickname: string, currentSocketId: string) {
  const sockets = await io.fetchSockets();
  for (const s of sockets) {
    if (s.data.user?.nickname === nickname && s.id !== currentSocketId) {
      console.log(`[KICK] Disconnecting duplicate session for ${nickname} (Socket: ${s.id})`);
      s.emit("duplicate-login", {
        message: "다른 기기 또는 브라우저에서 로그인하여 연결이 종료되었습니다."
      });
      // disconnect 시 타이머 유예 방지를 위해 플래그 설정
      s.data.isKicked = true;
      s.disconnect(true);
    }
  }
}

/**
 * 특정 닉네임이 현재 참여 중인 방 ID를 찾는 헬퍼
 */
function findRoomByNickname(nickname: string): string | null {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.some(p => p.nickname === nickname)) {
      return roomId;
    }
  }
  return null;
}

// 헬퍼: 로비 실시간 접속자 정보 브로드캐스트
async function broadcastLobbyStats() {
  const sockets = await io.fetchSockets();
  const playerMap = new Map<string, any>();

  // 병렬로 유저 정보(포인트 포함) 가져오기
  const userResults = await Promise.all(
    Array.from(sockets).map(async (s) => {
      const user = s.data.user;
      if (!user?.nickname) return null;
      const stats = await getPlayerStats(user.nickname);
      
      // 현재 참여 중인 방 찾기
      let status = "LOBBY";
      let currentRoomId = null;

      for (const roomId of s.rooms) {
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId)!;
          currentRoomId = roomId;
          status = room.state === "WAITING" ? "WAITING" : "PLAYING";
          break;
        }
      }

      return {
        id: user.id,
        nickname: user.nickname,
        status,
        roomId: currentRoomId,
        points: stats?.points || "0"
      };
    })
  );

  for (const res of userResults) {
    if (res) {
      playerMap.set(res.id, res);
    }
  }
    
  io.emit("lobby-info", {
    onlineCount: playerMap.size,
    players: Array.from(playerMap.values())
  });
}

function broadcastGameState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  try {
    room.players.forEach((p: any) => {
      if (p.isBot || !p.id) return;
      
      // 개별 플레이어에게 상태 전송 (존재하지 않는 소켓일 경우를 대비해 에러 방어)
      io.to(p.id).emit("game-state", {
        roomID: room.id,
        state: room.state,
        myCards: p.cards,
        trickCount: room.trickCount,
        players: room.players.map((pl: any) => ({
          id: pl.id,
          nickname: pl.nickname,
          points: pl.points,
          score: calculateScore(pl.collectedTricks.flat()),
          cardCount: Math.max(0, pl.cards?.length || 0),
          isTurn: (room.state !== GameState.WAITING && room.state !== GameState.READY) && (
                  (room.state === GameState.PLAYING && room.players[room.turnIndex]?.id === pl.id) ||
                  (room.state === GameState.BIDDING && room.players[room.currentBidderIndex]?.id === pl.id) ||
                  (room.state === GameState.EXCHANGING && room.players[room.highBidderIndex]?.id === pl.id) ||
                  (room.state === GameState.SELECTING_FRIEND && room.players[room.highBidderIndex]?.id === pl.id)
                  ),
          isPassed: pl.isPassed,
          isBot: pl.isBot,
        })),
        highBidAmount: room.highBidAmount,
        highBidSuit: room.highBidSuit,
        currentBidderIndex: room.currentBidderIndex,
        turnIndex: room.turnIndex,
        highBidderIndex: room.highBidderIndex,
        currentTrick: room.currentTrick || [],
        trumpSuit: room.trumpSuit,
        friendCard: room.friendCard,
        timeoutMs: room.timeoutDuration,
      });
    });

  } catch (err) {
    console.error(`[ERROR] broadcastGameState failed for room ${roomId}:`, err);
  }
}

io.on("connection", (socket: Socket) => {
  const user = socket.data.user;
  console.log("User connected:", socket.id, user?.nickname || "Guest");

  // 미들웨어에서 인증된 경우 클라이언트에 즉시 알림 (ERR-05 해결을 위한 조치)
  if (user && user.nickname) {
    // 닉네임으로 최신 포인트를 DB에서 조회 (getPlayerStats 사용)
    getPlayerStats(user.nickname).then(stats => {
      const rejoinRoomId = findRoomByNickname(user.nickname);
      socket.emit("authenticated", {
        token: socket.handshake.auth.token,
        points: stats?.points || "0",
        isAdmin: user.isAdmin,
        rejoinRoomId
      });
    });
  }

  socket.on("get-rooms", () => {
    broadcastRoomsList();
    broadcastLobbyStats();
  });

  socket.on("create-room", ({ roomId }) => {
    const user = socket.data.user;
    if (!user || !user.nickname) {
      console.error(`[SECURITY_ALERT] Non-authenticated create-room attempt.`);
      socket.emit("error", { message: "인증 정보가 없습니다. 다시 로그인해주세요." });
      return;
    }

    if (rooms.has(roomId)) {
      socket.emit("error", { message: "이미 존재하는 방 ID입니다." });
      return;
    }
    const newRoom = new GameRoom(roomId);
    newRoom.on("update", () => broadcastGameState(roomId));
    newRoom.on("game-over", (data) => io.to(roomId).emit("game-over", data));
    rooms.set(roomId, newRoom);
    
    broadcastRoomsList();
    socket.emit("room-created", { roomId });
  });

  socket.on("join-room", async ({ roomId, nickname, password, token }) => {
    try {
      // 0. 중복 로그인 세션 정리 (Kick-out)
      if (nickname) {
        await kickExistingSessions(nickname, socket.id);
      }

      let user = socket.data.user;
      let authenticated = false;

      // 1. 기존 소켓 세션 확인
      if (user && user.nickname === nickname) {
        authenticated = true;
      } 
      // 2. 전달받은 토큰 검증
      else if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded.nickname === nickname) {
            user = { 
              id: decoded.id, 
              nickname: decoded.nickname, 
              isAdmin: decoded.isAdmin,
              token: token 
            };
            socket.data.user = user;
            authenticated = true;
          }
        } catch (err) {
          console.log("Invalid token provided:", nickname);
          // 토큰 무효 시 아래에서 비밀번호 인증 시도
        }
      }

      // 3. 인증되지 않은 경우 비밀번호로 인증 시도
      if (!authenticated) {
        try {
          // authenticatePlayer 내부에서 예외가 발생하면 바로 catch 블록으로 이동함
          const authResult = await authenticatePlayer(nickname, password);
          
          if (!authResult || authResult.isRestricted) {
            socket.emit("error", { message: "포인트가 부족하거나 관리자에 의해 이용이 제한되었습니다." });
            return;
          }
          
          const newToken = jwt.sign(
            { 
              id: authResult.id, 
              nickname: authResult.nickname,
              isAdmin: authResult.isAdmin,
              instanceId: SERVER_INSTANCE_ID // 인스턴스 ID 포함
            }, 
            JWT_SECRET, 
            { expiresIn: "24h" }
          );
          
          user = { 
            id: authResult.id, 
            nickname: authResult.nickname, 
            isAdmin: authResult.isAdmin,
            token: newToken 
          };
          socket.data.user = user;
          const rejoinRoomId = findRoomByNickname(nickname);
          socket.emit("authenticated", { 
            token: newToken, 
            points: authResult.points,
            isAdmin: authResult.isAdmin,
            rejoinRoomId // 비밀번호 인증 시에도 힌트 제공
          });
          authenticated = true;
          console.log(`[AUTH_SUCCESS] ${nickname} authenticated via password.`);
        } catch (authErr: any) {
          console.error(`[AUTH_FAILED_REJECT] Nickname: ${nickname}, Reason: ${authErr.message}`);
          socket.emit("error", { 
            code: "AUTH_FAILED",
            message: authErr.message === "INVALID_PASSWORD" ? "비밀번호가 일치하지 않습니다." : "인증 실패: " + authErr.message
          });
          return; // 여기서 return을 빼먹으면 아래의 '방 입장' 로직이 실행됨
        }
      }

      // 최종 가드: 인증 정보(user 객체)가 없으면 절대 아래 로직을 수행하지 않음
      if (!authenticated || !user || !user.nickname) {
        console.error(`[SECURITY_ALERT] Non-authenticated access attempt: ${nickname}`);
        socket.emit("error", { message: "인증 정보가 비정상적입니다. 다시 시도해주세요." });
        return; 
      }

      // 재접속 타이머가 있다면 취소
      if (reconnectTimers.has(nickname)) {
        clearTimeout(reconnectTimers.get(nickname)!);
        reconnectTimers.delete(nickname);
        console.log(`Reconnection successful for ${nickname}`);
      }

      let room = rooms.get(roomId);
      if (!room && roomId !== "LOBBY") {
        room = new GameRoom(roomId);
        room.on("update", () => broadcastGameState(roomId));
        room.on("game-over", (data) => io.to(roomId).emit("game-over", data));
        rooms.set(roomId, room);
      }

      // LOBBY인 경우 여기서 중단 (더 이상 방 입장 로직을 타지 않음)
      if (roomId === "LOBBY") {
        if (authenticated && user) {
          // 이미 인증된 경우에도 다시 정보를 주어 클라이언트 isLoading 상태를 풀어줌
          socket.emit("authenticated", { 
            token: user.token,
            points: "0", // 초기값은 문자열 전송
            isAdmin: user.isAdmin
          });
        }
        broadcastLobbyStats();
        return;
      }

      if (!room) {
        socket.emit("error", { message: "존재하지 않는 방입니다." });
        return;
      }

      const joinCheck = room.canJoin(nickname);
      if (!joinCheck.allowed) {
        socket.emit("error", { 
          code: joinCheck.reason, 
          message: joinCheck.reason === "FULL_ROOM" ? "방이 가득 찼습니다." : "이미 게임이 시작되었습니다." 
        });
        return;
      }
      
      socket.join(roomId);

      const stats = await getPlayerStats(user.nickname);
      const points = stats ? Number(stats.points) : 0;

      if (await room.addPlayer(socket.id, user.nickname, points)) {
        broadcastGameState(roomId);

        io.to(roomId).emit("room-status", {
          players: room.players.map((p: any) => ({ id: p.id, nickname: p.nickname, isJoined: p.isJoined })),
          state: room.state,
        });

        broadcastRoomsList();
        broadcastLobbyStats();

        io.to(roomId).emit("receive-message", {
          sender: "SYSTEM",
          text: `${user.nickname}님이 ${token ? "복귀" : "입장"}하셨습니다.`,
          at: new Date(),
        });

        if (room.players.length === 5 && room.state === GameState.WAITING) {
          // 인원이 다 차면 READY 상태로 자동 전이
          broadcastGameState(roomId);
          broadcastRoomsList();
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err.message);
      socket.emit("error", { 
        message: err.message === "INVALID_PASSWORD" ? "비밀번호가 틀렸습니다." : 
                 err.message === "PASSWORD_REQUIRED" ? "비밀번호를 입력해주세요." :
                 "인증 중 오류가 발생했습니다." 
      });
    }
  });

  socket.on("start-game", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    // 방장 확인 (첫 번째 플레이어)
    if (room.players[0] && room.players[0].id === socket.id) {
      if (room.players.length === 5 && room.state === GameState.READY) {
        if (room.startGame()) {
          broadcastGameState(roomId);
          broadcastRoomsList();
          console.log(`Game started in room ${roomId} by host ${socket.id}`);
        }
      } else {
        socket.emit("error", { message: "5명이 모두 준비되어야 시작할 수 있습니다." });
      }
    } else {
      socket.emit("error", { message: "방장만 게임을 시작할 수 있습니다." });
    }
  });

  socket.on("bid", ({ roomId, pass, amount, suit }) => {
    console.log(`[SOCKET_EVENT] bid received: Room=${roomId}, PlayerID=${socket.id}, Pass=${pass}, Amount=${amount}, Suit=${suit}`);
    try {
      const room = rooms.get(roomId);
      if (!room) {
        console.warn(`[SOCKET_EVENT] bid FAILED: Room ${roomId} not found.`);
        return;
      }
      const success = room.handleBid(socket.id, pass, amount, suit);
      console.log(`[SOCKET_EVENT] bid RESULT: Success=${success}`);
      if (success) {
        const player = room.players.find(p => p.id === socket.id);
        io.to(roomId).emit("receive-message", {
          sender: "SYSTEM",
          text: `${player?.nickname || "Unknown"}님이 ${pass ? "패스" : `${amount} ${suit}`}로 비딩하셨습니다.`,
          at: new Date(),
        });
        broadcastGameState(roomId);
      } else {
        socket.emit("error", { message: "유효하지 않은 비딩입니다." });
      }
    } catch (err: any) {
      console.error(`[CRITICAL] Error in bid handler:`, err.stack || err.message);
      socket.emit("error", { message: "비딩 처리 중 서버 오류가 발생했습니다." });
    }
  });

  socket.on("exchange", ({ roomId, discards, trump }) => {
    console.log(`[SOCKET_EVENT] exchange received: Room=${roomId}, PlayerID=${socket.id}, DiscardsCount=${discards?.length}, Trump=${trump}`);
    try {
      const room = rooms.get(roomId);
      if (room && room.handleExchange(socket.id, discards, trump)) {
        console.log(`[EXCHANGE] Successfully processed for ${socket.id}`);
        broadcastGameState(roomId);
      } else {
        console.warn(`[EXCHANGE] FAILED for ${socket.id} in room ${roomId}`);
        socket.emit("error", { message: "카드 교환 처리에 실패했습니다. 카드 개수나 소유 여부를 확인하세요." });
      }
    } catch (err: any) {
      console.error(`[CRITICAL] Error in exchange handler:`, err.stack || err.message);
      socket.emit("error", { message: "카드 교환 중 서버 오류가 발생했습니다." });
    }
  });

  socket.on("leave-room", ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(roomId);
      
      if (room.players.filter(p => !p.isBot).length === 0) {
        rooms.delete(roomId);
      } else {
        broadcastGameState(roomId);
      }
      
      broadcastRoomsList();
      console.log(`User ${socket.id} left room ${roomId} (explicit)`);
    }
    
    if (typeof callback === "function") {
      callback();
    }
  });
  
  socket.on("restart-game", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.reset();
      broadcastGameState(roomId);
      broadcastRoomsList();
      console.log(`Room ${roomId} restarted by ${socket.id}`);
    }
  });

  socket.on("select-friend", ({ roomId, card }) => {
    try {
      const room = rooms.get(roomId);
      if (room && room.handleSelectFriend(socket.id, card)) {
        broadcastGameState(roomId);
      }
    } catch (err: any) {
      console.error(`[CRITICAL] Error in select-friend handler:`, err.stack || err.message);
      socket.emit("error", { message: "프렌드 지정 처리 중 서버 오류가 발생했습니다." });
    }
  });

  socket.on("play-card", ({ roomId, card, isJokerCall }) => {
    console.log(`[SOCKET_EVENT] play-card received: Room=${roomId}, PlayerID=${socket.id}, Card=${card.suit}${card.rank}`);
    try {
      const room = rooms.get(roomId);
      if (room && room.handlePlayCard(socket.id, card, isJokerCall)) {
        console.log(`[PLAY_CARD] Successfully processed for ${socket.id}`);
        broadcastGameState(roomId);
      } else {
        console.warn(`[PLAY_CARD] FAILED for ${socket.id}`);
        socket.emit("error", { message: "유효하지 않은 카드 플레이입니다." });
      }
    } catch (err: any) {
      console.error(`[CRITICAL] Error in play-card handler:`, err.stack || err.message);
      socket.emit("error", { message: "카드 플레이 중 서버 오류가 발생했습니다." });
    }
  });

  socket.on("add-bot", async ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && await room.addBot()) {
      io.to(roomId).emit("receive-message", {
        sender: "SYSTEM",
        text: "AI 봇이 방에 추가되었습니다.",
        at: new Date(),
      });
      broadcastGameState(roomId);
    }
  });

  socket.on("send-message", ({ roomId, nickname, text }) => {
    io.to(roomId).emit("receive-message", {
      sender: nickname,
      text,
      at: new Date(),
    });
  });

  socket.on("get-stats", async ({ nickname }, callback) => {
    try {
      const stats = await getPlayerStats(nickname);
      if (callback) callback(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      if (callback) callback(null);
    }
  });

  socket.on("change-timeout", ({ roomId, timeoutMs }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.setTurnTimeout(timeoutMs);
      io.to(roomId).emit("receive-message", {
        sender: "SYSTEM",
        text: `관리자에 의해 타임아웃이 ${timeoutMs / 1000}초로 변경되었습니다.`,
        at: new Date(),
      });
    }
  });

  // Admin 전용 이벤트
  socket.on("admin:get-players", async () => {
    if (!socket.data.user?.isAdmin) return;
    const { getAllPlayersStats } = await import("@mighty/database");
    const players = await getAllPlayersStats();
    socket.emit("admin:players-list", players);
  });

  socket.on("admin:adjust-points", async ({ nickname, amount, reason }) => {
    if (!socket.data.user?.isAdmin) return;
    const { replenishPoints } = await import("@mighty/database");
    try {
      await replenishPoints(nickname, amount, reason || "관리자 수동 조정");
      // 전체 플레이어 목록 다시 전송
      const { getAllPlayersStats } = await import("@mighty/database");
      const players = await getAllPlayersStats();
      io.emit("admin:players-list", players);
      
      // 해당 유저가 접속 중이라면 포인트 업데이트 알림 (구현 로직에 따라 추가 가능)
    } catch (err: any) {
      socket.emit("error", { message: "포인트 조정 실패" });
    }
  });

  socket.on("admin:restrict-player", async ({ nickname, isRestricted, reason }) => {
    if (!socket.data.user?.isAdmin) return;
    const { updatePlayerRestriction, getAllPlayersStats } = await import("@mighty/database");
    try {
      await updatePlayerRestriction(nickname, isRestricted, socket.data.user.id, reason);
      const players = await getAllPlayersStats();
      io.emit("admin:players-list", players);
    } catch (err: any) {
      socket.emit("error", { message: "계정 제한 변경 실패" });
    }
  });

  socket.on("admin:delete-player", async ({ nickname }) => {
    if (!socket.data.user?.isAdmin) return;
    const { deletePlayer, getAllPlayersStats } = await import("@mighty/database");
    try {
      await deletePlayer(nickname);
      const players = await getAllPlayersStats();
      io.emit("admin:players-list", players);
    } catch (err: any) {
      socket.emit("error", { message: "유저 삭제 실패" });
    }
  });

  socket.on("admin:get-logs", async ({ nickname, page, limit }) => {
    if (!socket.data.user?.isAdmin) return;
    const { getPlayerPointLogs } = await import("@mighty/database");
    try {
      const result = await getPlayerPointLogs(nickname, page, limit);
      socket.emit("admin:player-logs", { nickname, ...result });
    } catch (err: any) {
      socket.emit("error", { message: "로그 조회 실패" });
    }
  });

  socket.on("disconnect", () => {
    const user = socket.data.user;
    console.log("User socket disconnected:", socket.id, user?.nickname);

    if (user && user.nickname) {
      // 중복 로그인으로 인한 강제 종료(Kick)인 경우 타이머 유예 없이 즉시 종료 처리 지원
      if (socket.data.isKicked) {
        console.log(`[KICK_BYPASS] Skipping leaver timer for ${user.nickname} (New session already active)`);
        return;
      }

      // ERR-10: 기존에 해당 닉네임으로 실행 중인 타이머가 있다면 먼저 제거 (중첩 방지)
      const existingTimer = reconnectTimers.get(user.nickname);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 1분(60초) 유예 타이머 시작
      const timeout = setTimeout(() => {
        // 타이머가 실행될 시점에, 여전히 이 타이머가 최신인지 확인 (Identity Check)
        if (reconnectTimers.get(user.nickname) !== timeout) return;

        console.log(`Grace period expired for ${user.nickname}. Cleaning up...`);
        
        // 모든 방에서 이 유저를 제거
        rooms.forEach((room, roomId) => {
          const playerIdx = room.players.findIndex(p => p.nickname === user.nickname);
          if (playerIdx !== -1) {
            room.removePlayer(room.players[playerIdx].id);
            
            // 방 삭제 조건 개선: 
            // 1. 인간 플레이어가 0명이고 
            // 2. 방 상태가 대기 중(WAITING/READY)이거나 이미 끝났을(RESULT) 때만 삭제
            // 게임 진행 중(BIDDING, PLAYING 등)에는 봇으로 돌아가더라도 방을 유지하여 재접속 허용
            const humanCount = room.players.filter(p => !p.isBot).length;
            const isGameOverOrWaiting = [GameState.WAITING, GameState.READY, GameState.RESULT].includes(room.state);
            
            if (humanCount === 0 && isGameOverOrWaiting) {
              console.log(`[ROOM_CLEANUP] Deleting empty room ${roomId}`);
              rooms.delete(roomId);
            } else {
              broadcastGameState(roomId);
            }
          }
        });

        reconnectTimers.delete(user.nickname);
        broadcastRoomsList();
        broadcastLobbyStats();
      }, 60000);

      reconnectTimers.set(user.nickname, timeout);
    }
  });
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "4000", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Fastify server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
