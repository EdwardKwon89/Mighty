export enum Suit {
  SPADE = 'SPADE',
  DIAMOND = 'DIAMOND',
  HEART = 'HEART',
  CLOVER = 'CLOVER',
  JOKER = 'JOKER',
  NONE = 'NONE', // 노트럼프(No-Trump)용
}

export enum Rank {
  JOKER = 0,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // "S1", "H13", "J0" 등
}

export const ALL_SUITS = [Suit.SPADE, Suit.DIAMOND, Suit.HEART, Suit.CLOVER];

export function getCardId(suit: Suit, rank: Rank): string {
  if (suit === Suit.JOKER) return 'J0';
  const prefix = suit[0];
  return `${prefix}${rank}`;
}

export function isSameSuit(suitA: Suit | string | null, suitB: Suit | string | null): boolean {
  if (!suitA || !suitB) return suitA === suitB;
  if (suitA === suitB) return true;
  return suitA[0] === suitB[0];
}

/**
 * 전용 마이티 규칙 상수 정의
 */
export const MIGHTY_CONSTANTS = {
  PLAYERS_COUNT: 5,
  INITIAL_CARDS_PER_PLAYER: 10,
  HIDDEN_CARDS_COUNT: 3,
  TOTAL_CARDS: 53, // 13 * 4 + 1 (Joker)
};

export enum FriendType {
  CARD = 'CARD',               // 특정 카드 (예: 스페이드 에이스)
  PLAYER = 'PLAYER',           // 특정 플레이어 지명
  JOKER = 'JOKER',             // 조커 가진 사람
  NONE = 'NONE',               // 프렌드 없음 (독식)
  FIRST_TRICK = 'FIRST_TRICK', // 첫 트릭 승자
}

export * from './deck.js';
export * from './rules.js';
