import { Card, Suit, Rank, MIGHTY_CONSTANTS } from './types';

/**
 * 53장(52 + 1 Joker) 덱 생성
 */
export function createFullDeck(): Card[] {
  const deck: Card[] = [];
  const suits = [Suit.SPADE, Suit.DIAMOND, Suit.HEART, Suit.CLOVER];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${suit[0]}${rank}`
      });
    }
  }

  // 조커 추가
  deck.push({
    suit: Suit.JOKER,
    rank: 0 as Rank, // 조커의 랭크는 특수 처리 (보통 0)
    id: 'J0'
  });

  return deck;
}

/**
 * 피셔-에이츠 셔플 (Fisher-Yates Shuffle)
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 플레이어별 카드 배분 (5인 기준)
 * 덱 생성 및 셔플을 포함합니다.
 */
export function dealCards(): {
  hands: Card[][];
  floor: Card[];
} {
  const fullDeck = createFullDeck();
  const shuffledDeck = shuffleDeck(fullDeck);
  const hands: Card[][] = [[], [], [], [], []];
  
  // 50장 배분 (1인당 10장)
  for (let i = 0; i < 50; i++) {
    const playerIndex = i % 5;
    hands[playerIndex].push(shuffledDeck[i]);
  }

  // 나머지 3장 (숨김 카드/Floor)
  const floor = shuffledDeck.slice(50, 53);

  return { hands, floor };
}
