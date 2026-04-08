import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRoom, GameState } from './game-room.js';
import { Suit, Card, Rank } from '@mighty/engine';

// Mock database
vi.mock('@mighty/database', () => ({
  updateGameResult: vi.fn().mockResolvedValue({ points: 2000000 })
}));

describe('GameRoom Integration - Refined Rules', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('test-id');
    // 플레이어 5명 추가
    for (let i = 0; i < 5; i++) {
        room.addPlayer(`p${i}`, `user${i}`);
    }
    room.state = GameState.BIDDING;
  });

  it('히든카드 확인 전: 무늬 변경 시 +1 필요', () => {
    room.highBidAmount = 14;
    room.highBidSuit = Suit.SPADE;
    room.hasSeenHidden = false;
    room.currentBidderIndex = 0;

    // +1 무늬 변경 (14 Spade -> 15 Diamond)
    const success = room.handleBid('p0', false, 15, Suit.DIAMOND);
    expect(success).toBe(true);
    expect(room.highBidAmount).toBe(15);
  });

  it('히든카드 확인 후: 무늬 변경 시 +2 필요 (Requirement #25)', () => {
    room.highBidAmount = 15;
    room.highBidSuit = Suit.SPADE;
    room.hasSeenHidden = true; // 주공이 히든을 본 상태
    room.currentBidderIndex = 0;

    // +1 무늬 변경 시도 (15 Spade -> 16 Diamond) => 실패해야 함
    const fail = room.handleBid('p0', false, 16, Suit.DIAMOND);
    expect(fail).toBe(false);

    // +2 무늬 변경 시도 (15 Spade -> 17 Diamond) => 성공해야 함
    const success = room.handleBid('p0', false, 17, Suit.DIAMOND);
    expect(success).toBe(true);
    expect(room.highBidAmount).toBe(17);
  });

  it('정밀 정산: 노카(No Trump) + 노프렌드(Solo) 승리 시 4배 적용', async () => {
    const { updateGameResult } = await import('@mighty/database');
    
    room.highBidderIndex = 0; // p0가 주공
    room.highBidAmount = 13;
    room.trumpSuit = 'NO_TRUMP';
    room.friendPlayerId = null; // Solo

    // 주공이 15장을 먹었다고 가정 (diff: 15 - 13 + 1 = 3)
    const mockCollected = new Array(15).fill({ suit: Suit.SPADE, rank: Rank.ACE } as Card);
    room.players[0].collectedTricks = [mockCollected];

    // 게임 종료 처리 (내부적으로 finishGame 호출을 위해 상태 조작)
    // 실제로는 모든 카드를 소진해야 하지만, 로직 테스트를 위해 직접 호출 검증
    await (room as any).finishGame();

    // 기대 금액: 3(diff) * 1000(base) * 2(no-trump) * 2(solo) = 12,000
    // updateGameResult가 12,000으로 호출되었는지 확인
    expect(updateGameResult).toHaveBeenCalledWith(
        expect.any(String),
        12000,
        true,
        expect.stringContaining('Mult: 4x')
    );
  });
});
