import { describe, it, expect } from 'vitest';
import { Suit, Rank, Card } from './index.js';
import { evaluateTrick, TrickContext, getMightyCardId, getJokerCallCardId, PlayedCard, validateBid, canPlayCard, calculateScore, calculateSettlement, SETTLEMENT_CONSTANTS } from './rules.js';

describe('Mighty Rules - Trick Evaluation', () => {
  const mightyS14 = getMightyCardId(Suit.DIAMOND); // S14 (Spade Ace)
  const jokerCallC3 = getJokerCallCardId(Suit.DIAMOND); // C3
  
  const ctx: TrickContext = {
    trumpSuit: Suit.DIAMOND,
    mightyCardId: mightyS14,
    jokerCallCardId: jokerCallC3,
    isFirstTrick: false,
    isLastTrick: false
  };

  it('마이티는 조커를 이겨야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card },
      { playerId: 'p2', card: { suit: Suit.SPADE, rank: Rank.ACE, id: 'S14' } as Card } // Mighty
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p2');
  });

  it('조커는 기루다를 이겨야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.DIAMOND, rank: Rank.ACE, id: 'D14' } as Card }, // Trump Ace
      { playerId: 'p2', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card }
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p2');
  });

  it('기루다는 선 문양을 이겨야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.HEART, rank: Rank.ACE, id: 'H14' } as Card }, // Lead Suit
      { playerId: 'p2', card: { suit: Suit.DIAMOND, rank: Rank.TWO, id: 'D2' } as Card } // Trump 2
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p2');
  });

  it('조커 콜 명령 시 조커는 힘을 잃어야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.CLOVER, rank: Rank.THREE, id: 'C3' } as Card }, // Joker Call Leader
      { playerId: 'p2', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card },
      { playerId: 'p3', card: { suit: Suit.CLOVER, rank: Rank.FOUR, id: 'C4' } as Card }
    ];
    const { winner, isJokerCalled } = evaluateTrick(played, ctx);
    expect(isJokerCalled).toBe(true);
    expect(winner.playerId).toBe('p3'); // C4 wins because J0 is 0 and C3 is lead (but C4 is higher)
  });

  it('첫 트릭에서 조커는 힘을 잃어야 함', () => {
    const firstTrickCtx = { ...ctx, isFirstTrick: true };
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' } as Card },
      { playerId: 'p2', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card }
    ];
    const { winner } = evaluateTrick(played, firstTrickCtx);
    expect(winner.playerId).toBe('p1');
  });

  it('마지막 트릭에서 조커는 힘을 잃어야 함', () => {
    const lastTrickCtx = { ...ctx, isLastTrick: true };
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' } as Card },
      { playerId: 'p2', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card }
    ];
    const { winner } = evaluateTrick(played, lastTrickCtx);
    expect(winner.playerId).toBe('p1');
  });

  it('같은 점수일 경우 먼저 낸 사람이 이겨야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' } as Card },
      { playerId: 'p2', card: { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' } as Card } // 동일 카드 (실제 게임에선 불가능하나 로직 검증용)
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p1');
  });

  it('기루다보다 높은 무늬라도 선 무늬가 아니면 점수가 없어야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' } as Card }, // Lead
      { playerId: 'p2', card: { suit: Suit.HEART, rank: Rank.ACE, id: 'H14' } as Card }  // Higher rank but wrong suit
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p1');
  });

  it('조커 콜 상황에서 마이티가 나오면 마이티가 이겨야 함', () => {
    const played: PlayedCard[] = [
      { playerId: 'p1', card: { suit: Suit.CLOVER, rank: Rank.THREE, id: 'C3' } as Card }, // Joker Call
      { playerId: 'p2', card: { suit: Suit.JOKER, rank: 0, id: 'J0' } as Card },
      { playerId: 'p3', card: { suit: Suit.SPADE, rank: Rank.ACE, id: 'S14' } as Card }  // Mighty
    ];
    const { winner } = evaluateTrick(played, ctx);
    expect(winner.playerId).toBe('p3');
  });
});

describe('Mighty Rules - Bidding Validation', () => {
  it('최소 비딩은 13이어야 함', () => {
    expect(validateBid(12, 'NO_TRUMP', 13, 'NO_TRUMP')).toBe(true);
    expect(validateBid(12, 'NO_TRUMP', 12, 'NO_TRUMP')).toBe(false);
  });

  it('동일 무늬일 경우 장수가 더 높아야 함', () => {
    expect(validateBid(14, Suit.SPADE, 15, Suit.SPADE)).toBe(true);
    expect(validateBid(14, Suit.SPADE, 14, Suit.SPADE)).toBe(false);
  });

  it('노트럼프에서 무늬로 바꿀 때 장수가 늘어나야 함', () => {
    expect(validateBid(13, 'NO_TRUMP', 14, Suit.HEART)).toBe(true);
    expect(validateBid(13, 'NO_TRUMP', 13, Suit.HEART)).toBe(false);
  });

  it('무늬에서 노트럼프로 바꿀 때 장수가 같아도 됨', () => {
    expect(validateBid(14, Suit.HEART, 14, 'NO_TRUMP')).toBe(true);
    expect(validateBid(14, Suit.HEART, 13, 'NO_TRUMP')).toBe(false);
  });

  it('노트럼프에서 노트럼프로 바꿀 때 무조건 장수가 높아야 함', () => {
    expect(validateBid(15, 'NO_TRUMP', 16, 'NO_TRUMP')).toBe(true);
    expect(validateBid(15, 'NO_TRUMP', 15, 'NO_TRUMP')).toBe(false);
  });

  it('무늬를 바꿀 때(노트럼프 제외) 장수가 같으면 거절되어야 함', () => {
    // 마이티 룰: 무늬를 바꿀 때 장수가 같아도 되는 경우는 ONLY 무늬 -> 노트럼프
    expect(validateBid(15, Suit.SPADE, 15, Suit.DIAMOND)).toBe(false);
    expect(validateBid(15, Suit.SPADE, 16, Suit.DIAMOND)).toBe(true);
  });

  it('히든카드를 본 후(hasSeenHidden=true) 무늬 변경 시 +2 차이가 나야 함', () => {
    // 기존 SPADE 15 -> DIAMOND 16은 히든카드 전에는 가능하지만 후에는 불가능해야 함
    expect(validateBid(15, Suit.SPADE, 16, Suit.DIAMOND, true)).toBe(false);
    expect(validateBid(15, Suit.SPADE, 17, Suit.DIAMOND, true)).toBe(true);
  });

  it('히든카드를 본 후(hasSeenHidden=true) 노카(No Trump)로 변경 시 규칙 확인', () => {
    // Suit -> NO_TRUMP (+1 필요)
    expect(validateBid(15, Suit.SPADE, 16, 'NO_TRUMP', true)).toBe(true);
    expect(validateBid(15, Suit.SPADE, 15, 'NO_TRUMP', true)).toBe(false);
  });
});

describe('Mighty Rules - Settlement Calculation', () => {
  it('기본 점수 정산 (배수 없음)', () => {
    const res = calculateSettlement({
      bidAmount: 13,
      actualScore: 15, // 2장 더 먹음 (승리)
      isNoTrump: false,
      isSolo: false,
      totalScore: 20
    });
    // (15 - 13 + 1) * 1000 = 3000
    expect(res.isWin).toBe(true);
    expect(res.totalAmount).toBe(3000);
  });

  it('노카 + 노프렌드 정산 (4배)', () => {
    const res = calculateSettlement({
      bidAmount: 14,
      actualScore: 16, // 2장 더 먹음 (승리)
      isNoTrump: true,
      isSolo: true,
      totalScore: 20
    });
    // (16 - 14 + 1) * 1000 * 2(노카) * 2(솔로) = 12000
    expect(res.multiplier).toBe(4);
    expect(res.totalAmount).toBe(12000);
  });

  it('백런(Back-run) 패배 정산', () => {
    const res = calculateSettlement({
      bidAmount: 15,
      actualScore: 10, // 5장 부족 (패배)
      isNoTrump: false,
      isSolo: false,
      totalScore: 20
    });
    // (15 - 10) * 1000 = 5000
    expect(res.isWin).toBe(false);
    expect(res.totalAmount).toBe(5000);
  });
});

describe('Mighty Rules - Card Play Validation', () => {
  const mightyS14 = 'S14';
  const hand: Card[] = [
    { suit: Suit.SPADE, rank: Rank.ACE, id: 'S14' },
    { suit: Suit.SPADE, rank: Rank.TEN, id: 'S10' },
    { suit: Suit.HEART, rank: Rank.FIVE, id: 'H5' },
    { suit: Suit.JOKER, rank: 0, id: 'J0' }
  ];
  const ctx: TrickContext = {
    trumpSuit: Suit.DIAMOND,
    mightyCardId: mightyS14,
    jokerCallCardId: 'C3',
    isFirstTrick: false,
    isLastTrick: false
  };

  it('선 문양을 가지고 있으면 반드시 내야 함', () => {
    const res = canPlayCard(hand, Suit.SPADE, ctx, hand[2]); // Heart 5
    expect(res.canPlay).toBe(false);
    expect(res.reason).toContain('Must follow lead suit');
  });

  it('마이티는 선 문양을 무시하고 낼 수 있음', () => {
    const res = canPlayCard(hand, Suit.HEART, ctx, hand[0]); // Mighty S14
    expect(res.canPlay).toBe(true);
  });

  it('선 문양이 없으면 아무 카드나 낼 수 있음', () => {
    const res = canPlayCard(hand, Suit.CLOVER, ctx, hand[2]); // Heart 5
    expect(res.canPlay).toBe(true);
  });

  it('첫 트릭/마지막 트릭에서 조커는 초구(Lead)일 수 없음', () => {
    const firstTrickCtx = { ...ctx, isFirstTrick: true };
    const res = canPlayCard(hand, null, firstTrickCtx, hand[3]); // Lead Joker
    expect(res.canPlay).toBe(false);
  });
});

describe('Mighty Rules - Scoring', () => {
  it('그림 카드 개수를 정확히 세어야 함', () => {
    const cards: Card[] = [
      { suit: Suit.SPADE, rank: Rank.ACE, id: 'S14' },
      { suit: Suit.HEART, rank: Rank.TEN, id: 'H10' },
      { suit: Suit.CLOVER, rank: Rank.KING, id: 'C13' },
      { suit: Suit.DIAMOND, rank: Rank.TWO, id: 'D2' },
      { suit: Suit.SPADE, rank: Rank.FIVE, id: 'S5' }
    ];
    expect(calculateScore(cards)).toBe(3); // A, 10, K
  });
});
