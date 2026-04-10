import { Prisma } from '@prisma/client';
import prisma from './client.js';
import bcrypt from 'bcrypt';

/**
 * 플레이어 인증 및 정보 조회 (비밀번호 확인 포함)
 * 1. 닉네임이 없으면: 비밀번호와 함께 신규 가입
 * 2. 닉네임이 있으면: 비밀번호 대조 후 로그인
 */
export async function authenticatePlayer(nickname: string, password?: string) {
  const existingPlayer = await prisma.player.findUnique({
    where: { nickname },
  });

  if (!existingPlayer) {
    if (!password) {
      throw new Error("PASSWORD_REQUIRED_FOR_REGISTRATION");
    }
    // 신규 가입
    const hashedPassword = await bcrypt.hash(password, 10);
    const newPlayer = await prisma.player.create({
      data: {
        nickname,
        password: hashedPassword,
        points: 100000n, // BigInt 사용
        pointLogs: {
          create: {
            amount: 100000,
            type: "INITIAL",
            reason: "신규 가입 초기 지원금",
          },
        },
      },
    });

    return {
      id: newPlayer.id,
      nickname: newPlayer.nickname,
      points: newPlayer.points.toString(),
      isRestricted: false,
      isNewPlayer: true,
    };
  }

  // 기존 유저 로그인 시도
  if (!password) {
    throw new Error("PASSWORD_REQUIRED");
  }

  const isPasswordMatch = await bcrypt.compare(password, (existingPlayer as any).password);
  console.log(`[AUTH_DEBUG] Nickname: ${nickname}, Match: ${isPasswordMatch}`);
  
  if (!isPasswordMatch) {
    throw new Error("INVALID_PASSWORD");
  }

  return {
    id: existingPlayer.id,
    nickname: existingPlayer.nickname,
    points: existingPlayer.points.toString(),
    isRestricted: existingPlayer.isRestricted || existingPlayer.points < 0n,
    isAdmin: existingPlayer.isAdmin,
    isNewPlayer: false,
  };
}

/**
 * 모든 플레이어 통계 조회 (관리자용)
 */
export async function getAllPlayersStats() {
  const players = await prisma.player.findMany({
    orderBy: { nickname: "asc" },
    include: {
      pointLogs: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  return players.map(p => ({
    nickname: p.nickname,
    points: p.points.toString(),
    totalGames: p.totalGames,
    totalWins: p.totalWins,
    winRate: p.totalGames > 0 ? ((p.totalWins / p.totalGames) * 100).toFixed(1) + "%" : "0%",
    isRestricted: p.isRestricted || p.points < 0n,
    isAdmin: p.isAdmin,
    lastSeen: p.updatedAt,
  }));
}

/**
 * 계정 활동 제한 업데이트 (관리자용)
 */
export async function updatePlayerRestriction(nickname: string, isRestricted: boolean, adminId: string, reason: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const player = await tx.player.findUnique({ where: { nickname } });
    if (!player) throw new Error("Player not found");

    const updated = await tx.player.update({
      where: { nickname },
      data: { isRestricted },
    });

    await tx.adminLog.create({
      data: {
        adminId,
        targetPlayerId: player.id,
        action: isRestricted ? "ACCOUNT_LOCK" : "ACCOUNT_UNLOCK",
        reason,
      },
    });

    return updated;
  });
}

/**
 * 포인트 보충 (BigInt 대응)
 */
export async function replenishPoints(nickname: string, amount: number, adminReason: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const player = await tx.player.findUnique({ where: { nickname } });
    if (!player) throw new Error("Player not found");

    const updatedPlayer = await tx.player.update({
      where: { nickname },
      data: {
        points: { increment: BigInt(amount) },
      },
    });

    await tx.pointLog.create({
      data: {
        playerId: player.id,
        amount: amount,
        type: "ADMIN_CREDIT",
        reason: `[ADMIN] ${adminReason}`,
      },
    });

    return updatedPlayer;
  });
}

/**
 * 게임 결과 반영 (BigInt 대응)
 */
export async function updateGameResult(nickname: string, pointChange: number, isWin: boolean, reason: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const player = await tx.player.findUnique({ where: { nickname } });
    if (!player) throw new Error("Player not found");

    const updatedPlayer = await tx.player.update({
      where: { nickname },
      data: {
        points: { increment: BigInt(pointChange) },
        totalGames: { increment: 1 },
        totalWins: isWin ? { increment: 1 } : undefined,
      },
    });

    await tx.pointLog.create({
      data: {
        playerId: player.id,
        amount: pointChange,
        type: pointChange >= 0 ? "GAME_WIN" : "GAME_LOSS",
        reason: reason,
      },
    });

    return updatedPlayer;
  });
}

/**
 * 플레이어 전적 및 승률 조회 (BigInt 통계 대응)
 */
export async function getPlayerStats(nickname: string) {
  const player = await prisma.player.findUnique({
    where: { nickname },
    include: {
      pointLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!player) return null;

  const winRate = player.totalGames > 0 ? (player.totalWins / player.totalGames) * 100 : 0;

  return {
    nickname: player.nickname,
    points: player.points.toString(),
    totalGames: player.totalGames,
    totalWins: player.totalWins,
    winRate: winRate.toFixed(1) + "%",
    isRestricted: player.points < 0n,
    recentLogs: player.pointLogs.map((log: any) => ({
      amount: log.amount.toString(),
      type: log.type,
      reason: log.reason,
      at: log.createdAt,
    })),
  };
}

/**
 * 플레이어 완전 삭제 (Admin 전용)
 */
export async function deletePlayer(nickname: string) {
  return prisma.player.delete({
    where: { nickname },
  });
}

/**
 * 특정 플레이어의 모든 포인트 로그 조회 (페이징 적용)
 */
export async function getPlayerPointLogs(nickname: string, page: number = 1, limit: number = 20) {
  const player = await prisma.player.findUnique({
    where: { nickname },
    select: { id: true }
  });

  if (!player) throw new Error("Player not found");

  const skip = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    prisma.pointLog.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.pointLog.count({
      where: { playerId: player.id }
    })
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      amount: log.amount,
      type: log.type,
      reason: log.reason,
      createdAt: log.createdAt,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
}
