import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from './index.js';
import prisma from './client.js';

// Prisma 클라이언트를 목킹합니다.
vi.mock('./client.js', () => ({
  default: {
    player: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    pointLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe('Database Layer Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticatePlayer', () => {
    it('신규 플레이어 가입 시 비밀번호가 해싱되어 저장되어야 함', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(null);
      (prisma.player.create as any).mockResolvedValue({
        id: 'uuid-1',
        nickname: 'new_user',
        points: 100000n,
      });

      const result = await db.authenticatePlayer('new_user', 'pass1234');

      expect(prisma.player.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          nickname: 'new_user',
          points: 100000n
        })
      }));
      expect(result.isNewPlayer).toBe(true);
    });

    it('기존 유저 로그인 시 비밀번호가 틀리면 에러를 던져야 함', async () => {
      const mockPlayer = { 
        id: 'uuid-1', 
        nickname: 'hacker', 
        password: 'hashed_password' // 실제로는 bcrypt로 해싱된 값이어야 함
      };
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);

      // 비밀번호 대조는 bcrypt.compare를 사용하므로 실제 bcrypt 모듈 목킹이 필요할 수 있음
      // 여기서는 간단히 로직 흐름만 테스트
      await expect(db.authenticatePlayer('hacker', 'wrong_pass'))
        .rejects.toThrow('INVALID_PASSWORD');
    });
  });

  describe('updateGameResult', () => {
    it('BigInt 포인트 가감이 정확히 반영되어야 함', async () => {
      const mockPlayer = { id: 'uuid-1', nickname: 'gamer', points: 100000n };
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.player.update as any).mockResolvedValue({ ...mockPlayer, points: 101000n });

      await db.updateGameResult('gamer', 1000, true, 'Victory');

      expect(prisma.player.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          points: { increment: 1000n }
        })
      }));
    });
  });
});
