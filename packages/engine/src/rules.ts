import { Card, Suit, Rank, getCardId, isSameSuit } from './index.js';

export interface PlayedCard {
  playerId: string;
  card: Card;
}

export interface TrickContext {
  trumpSuit: Suit; // 기루다
  mightyCardId: string; // 현재 게임의 마이티 (S14 또는 D14)
  jokerCallCardId: string; // 조커콜 카드 (C3 또는 S3)
  isFirstTrick: boolean;
  isLastTrick: boolean;
  isJokerCalled?: boolean; // 수동으로 조커콜을 선언했는지 여부
}

/**
 * 정산 규칙 상수
 */
export const SETTLEMENT_CONSTANTS = {
  BASE_AMOUNT: 1000,
  NO_TRUMP_MULTIPLIER: 2,
  SOLO_MULTIPLIER: 2,
};

/**
 * 비딩 유효성 검사
 */
export function validateBid(
  currentHighBid: number,
  currentHighSuit: Suit | "NO_TRUMP",
  newBid: number,
  newSuit: Suit | "NO_TRUMP",
  hasSeenHidden: boolean = false
): boolean {
  if (newBid < 13 || newBid > 20) return false;

  // 히든카드를 보지 않았을 때: 무늬 변경 시 +1 필요 (Requirement.md 25번)
  // 히든카드를 보았을 때: 무늬 변경 시 +2 필요
  const minDiffForSuitChange = hasSeenHidden ? 2 : 1;

  if (newSuit === currentHighSuit) {
    return newBid > currentHighBid;
  }

  // 노카(No Trump) <-> 일반 무늬 변경
  if (currentHighSuit === "NO_TRUMP" && newSuit !== "NO_TRUMP") {
    return newBid >= currentHighBid + minDiffForSuitChange;
  }
  if (currentHighSuit !== "NO_TRUMP" && newSuit === "NO_TRUMP") {
    // 일반 무늬에서 노카로 갈 때도 차이가 있어야 함
    return newBid >= currentHighBid + (minDiffForSuitChange - 1); // 노카는 보통 가중치가 낮으므로 -1 보정 (필요시 조정)
  }
  
  // 일반 무늬 간 변경
  return newBid >= currentHighBid + minDiffForSuitChange;
}

/**
 * 최종 정산 금액 계산
 * @param result 게임 결과 (획득 장수, 비딩 정보, 프렌드 여부 등)
 */
export function calculateSettlement(params: {
  bidAmount: number;
  actualScore: number;
  isNoTrump: boolean;
  isSolo: boolean;
  totalScore: number; // 전체 그림카드 수 (20장)
}) {
  const { bidAmount, actualScore, isNoTrump, isSolo } = params;
  const isWin = actualScore >= bidAmount;
  
  // 기본 장수 차이 계산
  // 승리 시: (실제 점수 - 비딩 점수) -> 런(Run) 포함
  // 패배 시: (비딩 점수 - 실제 점수) -> 백런(Back-run) 포함
  const diff = isWin ? (actualScore - bidAmount + 1) : (bidAmount - actualScore);
  
  let multiplier = 1;
  if (isNoTrump) multiplier *= SETTLEMENT_CONSTANTS.NO_TRUMP_MULTIPLIER;
  if (isSolo) multiplier *= SETTLEMENT_CONSTANTS.SOLO_MULTIPLIER;

  const totalAmount = diff * SETTLEMENT_CONSTANTS.BASE_AMOUNT * multiplier;
  
  return {
    isWin,
    diff,
    multiplier,
    totalAmount
  };
}

/**
 * 플레이 가능한 카드인지 검사 (유효성 체크)
 */
export function canPlayCard(
  hand: Card[],
  leadSuit: Suit | null,
  context: TrickContext,
  card: Card
): { canPlay: boolean; reason?: string } {
  const cardId = getCardId(card.suit, card.rank);
  const isMighty = cardId === context.mightyCardId;
  const isJoker = card.suit === Suit.JOKER;

  if (!hand.find(c => c.id === card.id)) {
    return { canPlay: false, reason: "Card not in hand" };
  }

  if (isMighty) {
    // 1트릭 마이티 리드는 금지가 일반적이지만 여기서는 따르는 경우엔 항상 허용
    return { canPlay: true };
  }

  if (isJoker) {
    if (context.isFirstTrick || context.isLastTrick) {
      if (!leadSuit) return { canPlay: false, reason: "Joker cannot be led in first/last trick" };
    }
    return { canPlay: true };
  }

  // 조커콜 처리: 조커가 있고 조커콜이 불렸으면 조커부터 내야 함 (마이티 제외)
  if (context.isJokerCalled) {
    const hasJoker = hand.some(c => c.suit === Suit.JOKER);
    if (hasJoker && card.suit !== Suit.JOKER) {
      // 마이티는 조커콜보다 우선권이 있으므로 낼 수 있음
      if (!isMighty) {
        return { canPlay: false, reason: "Must play Joker on Joker Call" };
      }
    }
  }

  if (leadSuit && !isSameSuit(card.suit, leadSuit)) {
    // Suit mismatch check - ensure we are actually comparing the same representation
    const hasLeadSuit = hand.some(c => isSameSuit(c.suit, leadSuit));
    if (hasLeadSuit) {
      return { canPlay: false, reason: `Must follow lead suit: ${leadSuit}` };
    }
  }

  return { canPlay: true };
}

/**
 * 획득한 카드들의 점수 계산
 */
export function calculateScore(cards: Card[]): number {
  const pointRanks = [Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE];
  return cards.filter(c => pointRanks.includes(c.rank)).length;
}

/**
 * 한 트릭의 승리자를 결정하는 핵심 함수
 */
export function evaluateTrick(
  playedCards: PlayedCard[],
  context: TrickContext
): { winner: PlayedCard; isJokerCalled: boolean } {
  if (playedCards.length === 0) throw new Error('No cards played');

  const leadPC = playedCards[0];
  const leadSuit = leadPC.card.suit;
  
  const isJokerCalled = context.isJokerCalled ?? (getCardId(leadPC.card.suit, leadPC.card.rank) === context.jokerCallCardId && leadPC.card.suit !== context.trumpSuit);

  const scoredCards = playedCards.map((pc, index) => {
    const cardId = getCardId(pc.card.suit, pc.card.rank);
    let score = pc.card.rank as number;

    if (cardId === context.mightyCardId) {
      score = 30000;
    }
    else if (pc.card.suit === Suit.JOKER) {
      if (isJokerCalled || context.isFirstTrick || context.isLastTrick) {
        score = 0;
      } else {
        score = 20000;
      }
    }
    else if (isSameSuit(pc.card.suit, context.trumpSuit)) {
      score += 10000;
    }
    else if (isSameSuit(pc.card.suit, leadSuit)) {
      score += 1000;
    }
    else {
      score = 0;
    }

    score -= index * 0.1;
    return { ...pc, score };
  });

  const winnerNode = scoredCards.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
  const { score, ...winner } = winnerNode as any;
  return { winner, isJokerCalled };
}

export function getMightyCardId(trumpSuit: Suit): string {
  return trumpSuit === Suit.SPADE ? 'D14' : 'S14';
}

export function getJokerCallCardId(trumpSuit: Suit): string {
  return trumpSuit === Suit.CLOVER ? 'S3' : 'C3';
}

/**
 * 봇의 비딩(공약) 생성 로직
 */
export function generateBotBid(params: {
  hand: Card[];
  currentHighBid: number;
  currentHighSuit: Suit | "NO_TRUMP";
  hasPassed: boolean[];
  playerIndex: number;
}): { amount: number; suit: Suit | "NO_TRUMP" } | null {
  const { hand, currentHighBid, currentHighSuit } = params;
  
  // 무늬별 개수 및 점수(상위 카드) 계산
  const suitStats = [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER].map(s => {
    const cards = hand.filter(c => c.suit === s);
    const power = cards.filter(c => c.rank >= Rank.JACK).length * 2 + cards.length;
    return { suit: s, count: cards.length, power };
  });

  const bestSuit = suitStats.reduce((prev, curr) => (curr.power > prev.power ? curr : prev));
  const hasJoker = hand.some(c => c.suit === Suit.JOKER);
  
  // 봇의 예상 적정 공약수 계산 (매우 단순화된 버전)
  let predictedScore = Math.floor(bestSuit.power / 2) + (hasJoker ? 2 : 0) + 11;
  predictedScore = Math.min(predictedScore, 20);

  // 현재 최고 공약보다 높게 부를 수 있는지 확인
  const suits: (Suit | "NO_TRUMP")[] = [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER, "NO_TRUMP"];
  
  for (let amount = currentHighBid; amount <= predictedScore; amount++) {
    for (const suit of suits) {
      if (validateBid(currentHighBid, currentHighSuit, amount, suit)) {
        return { amount, suit };
      }
    }
  }

  return null; // Pass
}

/**
 * 봇의 카드 플레이 생성 로직
 */
export function generateBotPlayCard(params: {
  hand: Card[];
  leadSuit: Suit | null;
  context: TrickContext;
}): Card {
  const { hand, leadSuit, context } = params;

  // 1. 낼 수 있는 모든 카드 필터링
  const playableCards = hand.filter(c => canPlayCard(hand, leadSuit, context, c).canPlay);

  if (playableCards.length === 0) {
    console.warn(`[BOT_RULES] No playable cards for bot! Hand: ${hand.map(c => c.id).join(',')}`);
    return hand[0];
  }

  // 2. 리드 무늬가 있는 경우: 가장 낮은 카드 내기 (단순 전략)
  if (leadSuit) {
    const sameSuitCards = playableCards.filter(c => c.suit === leadSuit);
    if (sameSuitCards.length > 0) {
      return sameSuitCards.reduce((prev, curr) => (curr.rank < prev.rank ? curr : prev));
    }
  }

  // 3. 리드 무늬가 없거나, 따를 수 없는 경우
  const normalCards = playableCards.filter(c => 
    c.suit !== Suit.JOKER && 
    getCardId(c.suit, c.rank) !== context.mightyCardId
  );

  if (normalCards.length > 0) {
    return normalCards.reduce((prev, curr) => (curr.rank < prev.rank ? curr : prev));
  }

  return playableCards[0];
}
