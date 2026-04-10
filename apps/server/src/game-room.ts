import { EventEmitter } from "events";
import { Card, Suit, Rank, evaluateTrick, dealCards, getMightyCardId, getJokerCallCardId, validateBid, canPlayCard, calculateScore, calculateSettlement, generateBotBid, generateBotPlayCard } from "@mighty/engine";
import { updateGameResult } from "@mighty/database";

export enum GameState {
  WAITING = "WAITING",
  BIDDING = "BIDDING",
  EXCHANGING = "EXCHANGING",
  SELECTING_FRIEND = "SELECTING_FRIEND",
  PLAYING = "PLAYING",
  RESULT = "RESULT",
  READY = "READY",
}

export interface Player {
  id: string;
  nickname: string;
  cards: Card[];
  isJoined: boolean;
  isPassed: boolean;
  bidAmount: number;
  collectedTricks: Card[][];
  points: number; // DB에서 조회한 포인트
  isBot?: boolean; // AI 봇 여부
}

export class GameRoom extends EventEmitter {
  public id: string;
  public players: Player[] = [];
  public state: GameState = GameState.WAITING;
  public currentBidderIndex: number = 0;
  public highBidderIndex: number = -1;
  public highBidAmount: number = 12;
  public highBidSuit: Suit | "NO_TRUMP" = "NO_TRUMP";
  
  public trumpSuit: Suit | "NO_TRUMP" = "NO_TRUMP";
  public friendCard: Card | null = null;
  public friendPlayerId: string | null = null;
  
  public floorCards: Card[] = [];
  public currentTrick: { playerId: string; card: Card }[] = [];
  public trickCount: number = 1; // 1~10 트릭 추적
  public leadSuit: Suit | null = null;
  
  public turnIndex: number = 0;
  private lastCompletedTrick: { playerId: string; card: Card }[] = [];
  private lastWinnerId: string | null = null;
  public isJokerCalledInCurrentTrick: boolean = false;
  public hasSeenHidden: boolean = false;
  public timeoutDuration: number = 60000; // 60s (Increased for verification)
  private timer: NodeJS.Timeout | null = null;
  private botActionTimeout: NodeJS.Timeout | null = null;
  private lastProcessedTurnKey: string = "";

  constructor(id: string) {
    super();
    this.id = id;
  }

  public async addPlayer(id: string, nickname: string, initialPoints: number = 0, isBot: boolean = false) {
    const existingIndex = this.players.findIndex(p => p.nickname === nickname);
    if (existingIndex !== -1) {
      // 재접속 시: 소켓 ID 교체 및 봇 상태 해제 (인간 플레이어 복귀)
      this.players[existingIndex].id = id;
      this.players[existingIndex].isJoined = true;
      this.players[existingIndex].isBot = false; // 봇에서 인간으로 복구
      
      // 포인트 최신화
      if (initialPoints !== undefined) {
        this.players[existingIndex].points = initialPoints;
      }
      return true;
    }

    if (this.players.length >= 5) return false;
    this.players.push({
      id,
      nickname,
      cards: [],
      isJoined: true,
      isPassed: false,
      bidAmount: 0,
      collectedTricks: [],
      points: initialPoints,
      isBot,
    });

    if (this.players.length === 5) {
      // 인원이 다 차면 READY 상태로 변경 (자동 시작 방지)
      if (this.state === GameState.WAITING) {
        this.state = GameState.READY;
      }
    }
    return true;
  }

  public async addBot() {
    if (this.players.length >= 5) return false;
    
    const botIdx = this.players.length + 1;
    const botId = `bot-${this.id}-${Date.now()}-${botIdx}`;
    const botName = `BOT_${botIdx}`;
    
    await this.addPlayer(botId, botName, 100000, true);
    return true;
  }

  public canJoin(nickname: string): { allowed: boolean; reason?: string } {
    const existingPlayer = this.players.find(p => p.nickname === nickname);
    
    // 이미 참여 중인 플레이어라면 무조건 허용 (재접속)
    if (existingPlayer) {
      return { allowed: true };
    }

    if (this.players.length >= 5) {
      return { allowed: false, reason: "FULL_ROOM" };
    }

    if (this.state !== GameState.WAITING && this.state !== GameState.READY) {
      return { allowed: false, reason: "GAME_IN_PROGRESS" };
    }

    return { allowed: true };
  }

  public startGame() {
    if (this.players.length < 5) return false;
    const { hands, floor } = dealCards();
    this.players.forEach((p: Player, i: number) => {
      p.cards = hands[i];
      p.isPassed = false;
    });
    this.floorCards = floor;
    this.state = GameState.BIDDING;
    this.currentBidderIndex = 0;
    this.startTimer();
    return true;
  }

  public removePlayer(id: string) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) {
      const p = this.players[idx];
      const removedNickname = p.nickname;
      
      // 게임 진행 중이면 봇으로 대체하여 인덱스 유지
      if (this.state !== GameState.WAITING && this.state !== GameState.READY && this.state !== GameState.RESULT) {
        console.log(`[ROOM] Player ${removedNickname} left. Replacing with BOT for consistency.`);
        p.isBot = true;
        p.id = `BOT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // 만약 이 플레이어의 턴이면 즉시 봇 플레이 시도
        if ((this.state === GameState.BIDDING && this.currentBidderIndex === idx) || 
            (this.state === GameState.PLAYING && this.turnIndex === idx)) {
          this.startTimer();
        }
        this.emit("update");
        return true;
      }
      
      this.players.splice(idx, 1);
      
      // READY 상태에서 인원이 줄면 다시 WAITING으로 변경
      if (this.state === GameState.READY && this.players.length < 5) {
        this.state = GameState.WAITING;
      }
      
      console.log(`[ROOM] Player ${removedNickname} (${id}) removed. Room size: ${this.players.length}`);
      this.emit("update");
      return true;
    }
    return false;
  }

  private startTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutDuration);

    // 상태 변화를 소켓에 알림
    this.emit("update");
    
    // 봇의 차례라면 봇 행동 개시
    this.checkBotTurn();
  }

  private checkBotTurn() {
    let currentPlayer: Player | null = null;
    let currentKey = "";

    if (this.state === GameState.BIDDING) {
      currentPlayer = this.players[this.currentBidderIndex] || null;
      currentKey = `BID-${this.currentBidderIndex}-${this.players.filter(p => p.isPassed).length}`;
    } else if (this.state === GameState.EXCHANGING || this.state === GameState.SELECTING_FRIEND) {
      currentPlayer = this.players[this.highBidderIndex] || null;
      currentKey = `${this.state}-${this.highBidderIndex}`;
    } else if (this.state === GameState.PLAYING) {
      currentPlayer = this.players[this.turnIndex] || null;
      currentKey = `PLAY-${this.trickCount}-${this.turnIndex}-${this.currentTrick.length}`;
    }

    // 이미 처리 중인 턴이거나, 다음 턴으로 넘어갔다면 중복 실행 방지
    if (this.lastProcessedTurnKey === currentKey) {
      console.log(`[BOT_TURN_SKIP] Key ${currentKey} already processed.`);
      return;
    }

    if (currentPlayer && currentPlayer.isBot) {
      console.log(`[BOT_TURN_DETECTED] Player: ${currentPlayer.nickname}, State: ${this.state}, Key: ${currentKey}`);
      this.lastProcessedTurnKey = currentKey;
      const isBidding = this.state === GameState.BIDDING;
      const delay = isBidding ? 400 + Math.random() * 400 : 500 + Math.random() * 500;

      if (this.botActionTimeout) clearTimeout(this.botActionTimeout);
      this.botActionTimeout = setTimeout(() => {
        try {
          // 실행 시점에 현재 플레이어와 상태가 여전히 유효한지 재확인
          const nowPlayer = this.state === GameState.BIDDING ? (this.players[this.currentBidderIndex] || null) :
                           this.state === GameState.PLAYING ? (this.players[this.turnIndex] || null) :
                           (this.state === GameState.EXCHANGING || this.state === GameState.SELECTING_FRIEND) ? (this.players[this.highBidderIndex] || null) : null;

          if (nowPlayer && currentPlayer && nowPlayer.id === currentPlayer.id && nowPlayer.isBot) {
            this.executeBotAction(nowPlayer);
          }
        } catch (err) {
          console.error(`[BOT_CRASH] Critical error during bot action for ${currentPlayer?.nickname}:`, err);
        }
      }, delay);
    }
  }

  private executeBotAction(player: Player) {
    if (this.state === GameState.BIDDING) {
      console.log(`[BOT_THINK] ${player.nickname} (Bot) is calculating bid...`);
      const bid = generateBotBid({
        hand: player.cards,
        currentHighBid: this.highBidAmount,
        currentHighSuit: this.highBidSuit,
        hasPassed: this.players.map(p => p.isPassed),
        playerIndex: this.currentBidderIndex
      });

      if (bid) {
        console.log(`[BOT_ACTION] ${player.nickname} bids ${bid.amount} ${bid.suit}`);
        this.handleBid(player.id, false, bid.amount, bid.suit);
      } else {
        console.log(`[BOT_ACTION] ${player.nickname} passed`);
        this.handleBid(player.id, true);
      }
    } else if (this.state === GameState.EXCHANGING) {
      const discards = player.cards.slice(-3);
      this.handleExchange(player.id, discards, this.highBidSuit as Suit);
    } else if (this.state === GameState.SELECTING_FRIEND) {
      // 봇 전략: 마이티나 조커가 없으면 프렌드로 호출
      const trump = this.trumpSuit === "NO_TRUMP" ? Suit.SPADE : this.trumpSuit as Suit; // 기본은 스페이드로 가정
      const mightyId = getMightyCardId(trump);
      const hasMighty = player.cards.some(c => c.id === mightyId);
      
      if (!hasMighty) {
        // 마이티 호출
        const mightySuit = mightyId.startsWith('S') ? Suit.SPADE : Suit.DIAMOND;
        this.handleSelectFriend(player.id, { suit: mightySuit, rank: Rank.ACE, id: mightyId });
      } else {
        const hasJoker = player.cards.some(c => c.suit === Suit.JOKER);
        if (!hasJoker) {
          // 조커 호출
          this.handleSelectFriend(player.id, { suit: Suit.JOKER, rank: Rank.JOKER, id: 'J0' });
        } else {
          // 마이티와 조커 둘 다 있으면 독식(NONE)
          this.handleSelectFriend(player.id, "NONE");
        }
      }
    } else if (this.state === GameState.PLAYING) {
      const trump = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;
      const mightyCardId = getMightyCardId(trump);
      const jokerCallCardId = getJokerCallCardId(trump);
      
      const cardToPlay = generateBotPlayCard({
        hand: player.cards,
        leadSuit: this.leadSuit,
        context: {
          trumpSuit: trump,
          mightyCardId,
          jokerCallCardId,
          isFirstTrick: this.trickCount === 1,
          isLastTrick: this.trickCount === 10,
          isJokerCalled: this.isJokerCalledInCurrentTrick
        }
      });

      console.log(`[BOT_THINK] ${player.nickname} chose ${cardToPlay.suit}${cardToPlay.rank}`);
      
      const success = this.handlePlayCard(player.id, cardToPlay);
      
      if (!success) {
        console.warn(`[BOT_RETRY] Card ${cardToPlay.suit}${cardToPlay.rank} rejected. Finding failsafe card...`);
        // Failsafe: Find ANY playable card using server's own rules
        const trumpSuitForCheck = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;
        const playable = player.cards.filter(card => 
          canPlayCard(player.cards, this.leadSuit, {
            trumpSuit: trumpSuitForCheck,
            mightyCardId: getMightyCardId(trumpSuitForCheck),
            jokerCallCardId: getJokerCallCardId(trumpSuitForCheck),
            isFirstTrick: this.trickCount === 1,
            isLastTrick: this.trickCount === 10,
          }, card).canPlay
        );
        
        if (playable.length > 0) {
          console.log(`[BOT_RETRY] Playing failsafe card: ${playable[0].suit}${playable[0].rank}`);
          this.handlePlayCard(player.id, playable[0]);
        } else if (player.cards.length > 0) {
          // If no card is playable (logic error), force play the first card to avoid stall
          console.error(`[BOT_FATAL] No cards deemed playable for ${player.nickname}! Forcing first card.`);
          const card = player.cards[0];
          player.cards = player.cards.filter(c => c.id !== card.id);
          this.currentTrick.push({ playerId: player.id, card });
          console.log(`[BOT_FATAL] Forced card: ${card.id}`);
          if (this.currentTrick.length === 5) {
            this.finishTrick();
          } else {
            this.turnIndex = (this.turnIndex + 1) % 5;
            this.startTimer();
          }
          this.emit("update");
        }
      }
    }
  }

  private handleTimeout() {
    const currentState = this.state;
    // BIDDING/PLAYING Index calculation
    const activeIndex = (currentState === GameState.PLAYING) ? this.turnIndex : (currentState === GameState.BIDDING ? this.currentBidderIndex : this.highBidderIndex);
    
    console.log(`[TIMEOUT] State: ${currentState}, Room: ${this.id}, ActiveIndex: ${activeIndex}`);
    
    const player = this.players[activeIndex];
    if (!player) {
      console.error(`[TIMEOUT_ERROR] No player at index ${activeIndex}. Advancing turn.`);
      if (currentState === GameState.PLAYING) this.turnIndex = (this.turnIndex + 1) % this.players.length;
      else if (currentState === GameState.BIDDING) this.currentBidderIndex = (this.currentBidderIndex + 1) % this.players.length;
      this.startTimer();
      this.emit("update");
      return;
    }

    if (currentState === GameState.BIDDING) {
      console.log(`[TIMEOUT_ACTION] Auto-pass for ${player.nickname}`);
      this.handleBid(player.id, true);
    } else if (currentState === GameState.EXCHANGING) {
      console.log(`[TIMEOUT_ACTION] Auto-exchange for ${player.nickname}`);
      const discards = player.cards.slice(-3);
      this.handleExchange(player.id, discards, this.highBidSuit as Suit);
    } else if (currentState === GameState.SELECTING_FRIEND) {
      console.log(`[TIMEOUT_ACTION] Auto-select NONE for ${player.nickname}`);
      this.handleSelectFriend(player.id, "NONE");
    } else if (currentState === GameState.PLAYING) {
      if (player.cards.length > 0) {
        console.log(`[TIMEOUT_ACTION] Auto-play for ${player.nickname}`);
        const trump = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;
        const playable = player.cards.filter(card => 
          canPlayCard(player.cards, this.leadSuit, {
            trumpSuit: trump,
            mightyCardId: getMightyCardId(trump),
            jokerCallCardId: getJokerCallCardId(trump),
            isFirstTrick: this.trickCount === 1,
            isLastTrick: this.trickCount === 10,
          }, card).canPlay
        );
        const cardToPlay = playable.length > 0 ? playable[0] : player.cards[0];
        const success = this.handlePlayCard(player.id, cardToPlay);
        
        if (!success) {
          console.error(`[TIMEOUT_FATAL] Timeout auto-play failed for ${player.nickname}! Forcing turn advance.`);
          this.turnIndex = (this.turnIndex + 1) % this.players.length;
          this.startTimer();
          this.emit("update");
        }
      }
    }
  }

  public handleBid(playerId: string, pass: boolean, amount?: number, suit?: Suit | "NO_TRUMP") {
    const pIdx = this.players.findIndex(p => p.id === playerId);
    if (pIdx !== this.currentBidderIndex || this.state !== GameState.BIDDING) return false;

    if (pass) {
      this.players[pIdx].isPassed = true;
    } else if (amount && suit) {
      const isValid = validateBid(this.highBidAmount, this.highBidSuit, amount, suit, this.hasSeenHidden);
      if (!isValid) return false;

      this.highBidAmount = amount;
      this.highBidSuit = suit;
      this.highBidderIndex = pIdx;
    }

    // Next bidder (Robust search)
    let nextIdx = (pIdx + 1) % 5;
    let safeGuard = 0;
    while (this.players[nextIdx].isPassed && this.players.filter(p => !p.isPassed).length > 1 && safeGuard < 5) {
      nextIdx = (nextIdx + 1) % 5;
      safeGuard++;
    }

    if (this.players.filter(p => !p.isPassed).length <= 1) {
      console.log(`[PHASE_TRANSITION] Bidding finished. High Bidder: ${this.highBidderIndex !== -1 ? this.players[this.highBidderIndex].nickname : 'None'}`);
      this.finishBidding();
    } else {
      this.currentBidderIndex = nextIdx;
      console.log(`[BIDDING_TURN] Next: ${this.players[this.currentBidderIndex].nickname}`);
      this.startTimer();
    }
    return true;
  }

  private finishBidding() {
    if (this.timer) clearTimeout(this.timer);
    if (this.highBidderIndex === -1) {
      this.highBidderIndex = 0;
      this.highBidAmount = 13;
      this.highBidSuit = "NO_TRUMP";
    }
    this.state = GameState.EXCHANGING;
    console.log(`[PHASE_TRANSITION] Switched to EXCHANGING. Floor cards given to ${this.players[this.highBidderIndex].nickname}`);
    this.players[this.highBidderIndex].cards.push(...this.floorCards);
    this.hasSeenHidden = true;
    this.startTimer();
  }

  public handleExchange(playerId: string, discards: Card[], trump: Suit | "NO_TRUMP") {
    if (this.state !== GameState.EXCHANGING || playerId !== this.players[this.highBidderIndex].id) return false;
    
    const player = this.players[this.highBidderIndex];
    
    // 3장 버리기 검증
    if (discards.length !== 3) return false;

    // 플레이어가 실제로 그 카드들을 가지고 있는지 확인 (ID 비교)
    const hasAll = discards.every(d => player.cards.some(c => c.id === d.id));
    if (!hasAll) {
      console.log(`[ROOM ${this.id}] Exchange failed: Player ${player.nickname} does not have assigned cards.`);
      return false;
    }

    player.cards = player.cards.filter(c => !discards.some(d => d.id === c.id));
    
    // 버린 카드를 기루(floorCards)로 저장하여 나중에 점수 계산에 사용
    this.floorCards = discards;
    
    // 무늬 변경 여부 확인 (비딩 시와 다를 경우 비용 검증 필요할 수 있으나 현재는 exchange에서 최종 확정)
    this.trumpSuit = trump;
    
    this.state = GameState.SELECTING_FRIEND;
    this.startTimer();
    return true;
  }

  public handleSelectFriend(playerId: string, card: Card | "NONE") {
    if (this.state !== GameState.SELECTING_FRIEND || playerId !== this.players[this.highBidderIndex].id) return false;
    
    if (card === "NONE") {
      this.friendCard = null;
      this.friendPlayerId = null;
    } else {
      this.friendCard = card;
      // Find who has the friend card
      const fIdx = this.players.findIndex(p => p.cards.find(c => c.suit === card.suit && c.rank === card.rank));
      if (fIdx !== -1) {
        this.friendPlayerId = this.players[fIdx].id;
      }
    }
    
    this.state = GameState.PLAYING;
    this.turnIndex = (this.highBidderIndex) % 5; // 주공부터 시작 (혹은 규칙에 따라 다를 수 있음)
    this.startTimer();
    return true;
  }

  public handlePlayCard(playerId: string, card: Card, isJokerCall: boolean = false) {
    console.log(`[ACTION] handlePlayCard request: Player=${playerId}, Card=${card.suit}${card.rank}, JokerCall=${isJokerCall}`);
    if (this.state !== GameState.PLAYING || playerId !== this.players[this.turnIndex].id) {
      console.log(`[REJECT] Not your turn or wrong state. State=${this.state}, TurnIndex=${this.turnIndex}`);
      return false;
    }
    
    const player = this.players[this.turnIndex];
    
    // 엔진 규칙 적용
    const trump = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;
    const mightyCardId = getMightyCardId(trump);
    const jokerCallCardId = getJokerCallCardId(trump);
    
    const validation = canPlayCard(player.cards, this.leadSuit, {
      trumpSuit: trump,
      mightyCardId,
      jokerCallCardId,
      isFirstTrick: this.trickCount === 1,
      isLastTrick: this.trickCount === 10,
    }, card);

    if (!validation.canPlay) {
      console.log(`[REJECT] canPlayCard failed: Reason=${validation.reason}, Card=${card.suit}${card.rank}, Lead=${this.leadSuit}, Trick=${this.trickCount}`);
      return false;
    }

    player.cards = player.cards.filter(c => c.id !== card.id);
    this.currentTrick.push({ playerId, card });

    if (this.currentTrick.length === 1) {
      this.isJokerCalledInCurrentTrick = isJokerCall;
      this.leadSuit = card.suit === Suit.JOKER ? null : card.suit;
    } else if (this.leadSuit === null && this.currentTrick.length > 1) {
      // 조커 리드 시 다음 카드가 리드 슈트 결정
      this.leadSuit = card.suit === Suit.JOKER ? null : card.suit;
    }

    if (this.currentTrick.length === 5) {
      // 1.5초 후 트릭 정산 (UX를 위한 지연)
      this.emit("update");
      
      setTimeout(() => {
        const result = this.finishTrick();
        // 트릭 정산 결과를 클라이언트에 명시적으로 알림 (애니메이션 동기화용)
        this.emit("trick-result", { 
          winnerId: result.winner.playerId, 
          isJokerCalled: result.isJokerCalled 
        });
        this.emit("update");
      }, 1500);
    } else {
      this.turnIndex = (this.turnIndex + 1) % 5;
      this.startTimer();
      this.emit("update");
    }
    return true;
  }

  private finishTrick() {
    const cardsInTrick = this.currentTrick.map(t => ({
      playerId: t.playerId,
      card: t.card
    }));

    const trump = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;

    const result = evaluateTrick(this.currentTrick, {
      trumpSuit: trump,
      mightyCardId: getMightyCardId(trump),
      jokerCallCardId: getJokerCallCardId(trump),
      isFirstTrick: this.trickCount === 1,
      isLastTrick: this.trickCount === 10,
      isJokerCalled: this.isJokerCalledInCurrentTrick
    });
    
    const { winner, isJokerCalled } = result;
    
    let winnerPIdx = this.players.findIndex(p => p.id === winner.playerId);
    
    // 만약 플레이어가 나갔거나 해서 ID가 없으면, 닉네임으로라도 찾거나 lead를 준 사람이 승리하는 걸로 방어
    if (winnerPIdx === -1) {
      console.warn(`[TRICK] Winner ID ${winner.playerId} not found in current players list. Using lead as winner fallback.`);
      winnerPIdx = this.players.findIndex(p => p.id === this.currentTrick[0].playerId);
      if (winnerPIdx === -1) winnerPIdx = (this.highBidderIndex) % 5; // 최후의 보루
    }
    console.log(`[TRICK_DONE] Winner: ${winner.playerId}, Cards: ${cardsInTrick.map(c => c.card.id).join(',')}`);
    
    // 이전을 저장
    this.lastCompletedTrick = [...this.currentTrick];
    this.lastWinnerId = winner.playerId;

    const cardsGot = this.currentTrick.map(t => t.card);
    this.players[winnerPIdx].collectedTricks.push(cardsGot);
    
    this.currentTrick = [];
    this.leadSuit = null;
    this.isJokerCalledInCurrentTrick = false;
    this.trickCount++;
    this.turnIndex = winnerPIdx;

    if (this.trickCount > 10) {
      this.finishGame();
    } else {
      this.startTimer();
    }
    
    return result;
  }

  private async finishGame() {
    this.state = GameState.RESULT;
    if (this.timer) clearTimeout(this.timer);
    
    // 즉시 상태 변경 알림
    this.emit("update");
    
    console.log(`[GAME_END] Room ${this.id} finished. Bidding index: ${this.highBidderIndex}`);

    // 점수 계산 (엔진의 calculateScore 사용)
    const bidder = this.players[this.highBidderIndex];
    if (!bidder) return;

    const gitCards = bidder.collectedTricks.flat();
    const friend = this.friendPlayerId ? this.players.find(p => p.id === this.friendPlayerId) : null;
    const friendCards = friend ? friend.collectedTricks.flat() : [];
    
    // 트릭으로 획득한 점수
    const trickScore = calculateScore([...gitCards, ...friendCards]);
    
    // 기루 점수 (마지막 트릭 승자가 주공 측인 경우에만 합산)
    const isMasterSideWinner = this.lastWinnerId === bidder.id || (this.friendPlayerId && this.lastWinnerId === this.friendPlayerId);
    const floorScore = isMasterSideWinner ? calculateScore(this.floorCards) : 0;
    
    const totalScore = trickScore + floorScore;
    const isWin = totalScore >= this.highBidAmount;

    console.log(`[GAME_RESULT] Trick: ${trickScore}, Floor: ${floorScore}, Total: ${totalScore}/${this.highBidAmount}, Win: ${isWin}`);

    const isNoTrump = this.trumpSuit === "NO_TRUMP";
    const isSolo = !this.friendPlayerId;

    const settlement = calculateSettlement({
      bidAmount: this.highBidAmount,
      actualScore: totalScore,
      isNoTrump,
      isSolo,
      totalScore: 20
    });

    // Database update (Parallel)
    await Promise.all(this.players.map(async (p) => {
      const isBidder = p.id === bidder.id;
      const isFriend = !!(this.friendPlayerId && p.id === this.friendPlayerId);
      const isTeam = isBidder || isFriend;
      // isPlayerWin will be computed below
      
      // 정산 로직: 판돈 흐름
      let change = 0;
      if (settlement.isWin) {
        if (isTeam) {
            // 이겼을 때: 야당 3명으로부터 판돈을 받음
            // 솔로인 경우 주공이 4배, 프렌드 있는 경우 주공 2배 프렌드 1배 등 관례 적용
            const opponentCount = isSolo ? 4 : 3;
            if (isSolo) change = settlement.totalAmount * 4;
            else if (isBidder) change = settlement.totalAmount * 2;
            else if (isFriend) change = settlement.totalAmount;
        } else {
            // 졌을 때 (야당): 판돈 1배 지불
            change = -settlement.totalAmount;
        }
      } else {
        if (isTeam) {
            // 졌을 때 (주공/프렌드): 야당에게 지불
            if (isSolo) change = -(settlement.totalAmount * 4);
            else if (isBidder) change = -(settlement.totalAmount * 2);
            else if (isFriend) change = -settlement.totalAmount;
        } else {
            // 이겼을 때 (야당): 판돈 1배 받음
            change = settlement.totalAmount;
        }
      }
      
      const isWinValue: boolean = !!settlement.isWin;
      const isPlayerWin: boolean = !!isWinValue ? isTeam : !isTeam;
      
      // 봇은 통계 업데이트를 건너뜀
      if (p.isBot) return;

      try {
        const updated = await updateGameResult(
          p.nickname, 
          change, 
          isPlayerWin, 
          `Room: ${this.id}, ${isWin ? 'Win' : 'Loss'} (${totalScore}/${this.highBidAmount})`
        );
        if (updated) {
          p.points = Number(updated.points);
        }
      } catch (err) {
        console.error(`Failed to update stats for ${p.nickname}:`, err);
      }
    }));

    // 최종 포인트 반영 후 다시 한번 알림 및 게임 종료 이벤트 송신
    this.emit("update");
    
    this.emit("game-over", {
      isWin: !!settlement.isWin,
      actualScore: totalScore,
      trickScore,
      floorScore,
      totalScore,
      highBidAmount: this.highBidAmount,
      highBidSuit: this.highBidSuit,
      highBidderNickname: bidder.nickname,
      bidderId: bidder.id,
      friendNickname: friend?.nickname || "없음",
      friendId: this.friendPlayerId,
      players: this.players.map(p => ({
        nickname: p.nickname,
        points: p.points,
        collectedTricksCount: p.collectedTricks.length
      }))
    });
  }

  public setTurnTimeout(ms: number) {
    if (ms >= 30000 && ms <= 120000) {
      this.timeoutDuration = ms;
    }
  }

  public reset() {
    console.log(`[ROOM_RESET] Resetting room ${this.id}`);
    if (this.timer) clearTimeout(this.timer);
    if (this.botActionTimeout) clearTimeout(this.botActionTimeout);
    
    this.state = (this.players.length === 5) ? GameState.READY : GameState.WAITING;
    this.currentBidderIndex = 0;
    this.highBidderIndex = -1;
    this.highBidAmount = 12;
    this.highBidSuit = "NO_TRUMP";
    this.trumpSuit = "NO_TRUMP";
    this.friendCard = null;
    this.friendPlayerId = null;
    this.floorCards = [];
    this.turnIndex = 0;
    this.hasSeenHidden = false;
    this.lastProcessedTurnKey = "";
    this.lastCompletedTrick = [];
    this.lastWinnerId = null;
    this.currentTrick = [];
    this.trickCount = 1;
    this.leadSuit = null;
    this.isJokerCalledInCurrentTrick = false;
    
    this.players.forEach(p => {
      p.cards = [];
      p.isPassed = false;
      p.bidAmount = 0;
      p.collectedTricks = [];
    });
    
    this.emit("update");
  }
}
