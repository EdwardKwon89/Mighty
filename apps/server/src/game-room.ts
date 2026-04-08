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
  public isJokerCalledInCurrentTrick: boolean = false;
  public hasSeenHidden: boolean = false;
  public timeoutDuration: number = 60000; // 60s (Increased for verification)
  private timer: NodeJS.Timeout | null = null;

  constructor(id: string) {
    super();
    this.id = id;
  }

  public async addPlayer(id: string, nickname: string, initialPoints: number = 0, isBot: boolean = false) {
    const existingIndex = this.players.findIndex(p => p.nickname === nickname);
    if (existingIndex !== -1) {
      // 재접속 시: 소켓 ID만 교체하고 기존 상태(isBot, cards 등) 유지
      this.players[existingIndex].id = id;
      this.players[existingIndex].isJoined = true;
      // 포인트는 DB의 최신 정보를 반영하되, 게임 내 다른 상태는 건드리지 않음
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
      const player = this.players[idx];
      
      // 봇은 절대 수동으로 삭제하지 않음 (방이 폭파될 때만 삭제)
      if (player.isBot) {
        console.log(`[SAFEGUARD] Prevented bot ${player.nickname} removal.`);
        return false;
      }

      const removedNickname = player.nickname;
      this.players.splice(idx, 1);
      
      // READY 상태에서 인원이 줄면 다시 WAITING으로 변경
      if (this.state === GameState.READY && this.players.length < 5) {
        this.state = GameState.WAITING;
      }
      
      console.log(`Player ${removedNickname} (${id}) removed from room ${this.id}`);
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
    if (this.state === GameState.BIDDING) {
      currentPlayer = this.players[this.currentBidderIndex] || null;
    } else if (this.state === GameState.EXCHANGING || this.state === GameState.SELECTING_FRIEND) {
      currentPlayer = this.players[this.highBidderIndex] || null;
    } else if (this.state === GameState.PLAYING) {
      currentPlayer = this.players[this.turnIndex] || null;
    }

    if (currentPlayer && currentPlayer.isBot) {
      const isBidding = this.state === GameState.BIDDING;
      const delay = isBidding ? 400 + Math.random() * 400 : 1200 + Math.random() * 800; // 비딩은 더 빠르게
      setTimeout(() => {
        // 비동기 실행 시점에 상태와 플레이어 존재 여부 재검증
        const nowPlayer = this.state === GameState.BIDDING ? (this.players[this.currentBidderIndex] || null) :
                         this.state === GameState.PLAYING ? (this.players[this.turnIndex] || null) :
                         (this.state === GameState.EXCHANGING || this.state === GameState.SELECTING_FRIEND) ? (this.players[this.highBidderIndex] || null) : null;
        
          if (nowPlayer && currentPlayer && nowPlayer.id === currentPlayer.id && nowPlayer.isBot) {
            try {
              this.executeBotAction(nowPlayer);
            } catch (err) {
              console.error(`[BOT_CRASH] Error in bot action for ${nowPlayer.nickname}:`, err);
              // 에러 발생 시 최소한 타임아웃 헨들러가 작동하도록 타이머는 유지
            }
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
      this.handleSelectFriend(player.id, "NONE");
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
          if (this.currentTrick.length === 5) this.finishTrick();
          else { this.turnIndex = (this.turnIndex + 1) % 5; this.startTimer(); }
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
    }

    if (this.currentTrick.length === 5) {
      this.finishTrick();
    } else {
      this.turnIndex = (this.turnIndex + 1) % 5;
      this.startTimer();
    }
    return true;
  }

  private finishTrick() {
    const cardsInTrick = this.currentTrick.map(t => ({
      playerId: t.playerId,
      card: t.card
    }));

    const trump = this.trumpSuit === "NO_TRUMP" ? Suit.NONE : this.trumpSuit;
    const mightyCardId = getMightyCardId(trump);

    const winnerResult = evaluateTrick(cardsInTrick, {
      trumpSuit: trump,
      mightyCardId: mightyCardId,
      jokerCallCardId: getJokerCallCardId(trump),
      isFirstTrick: this.players[0].cards.length === 9,
      isLastTrick: this.players[0].cards.length === 0,
      isJokerCalled: this.isJokerCalledInCurrentTrick
    });

    const winner = winnerResult.winner;
    this.isJokerCalledInCurrentTrick = false;
    const winnerId = winner.playerId;
    const winnerPIdx = this.players.findIndex(p => p.id === winnerId);

    const cardsGot = this.currentTrick.map(t => t.card);
    this.players[winnerPIdx].collectedTricks.push(cardsGot);
    
    this.currentTrick = [];
    this.leadSuit = null;
    this.trickCount++;
    this.turnIndex = winnerPIdx;

    if (this.players.every(p => p.cards.length === 0)) {
      this.finishGame();
    } else {
      this.startTimer();
    }
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
    
    const totalScore = calculateScore([...gitCards, ...friendCards]);
    const isWin = totalScore >= this.highBidAmount;

    console.log(`[GAME_RESULT] Score: ${totalScore}/${this.highBidAmount}, Win: ${isWin}`);

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

    // 최종 포인트 반영 후 다시 한번 알림
    this.emit("update");
  }

  public setTurnTimeout(ms: number) {
    if (ms >= 30000 && ms <= 120000) {
      this.timeoutDuration = ms;
    }
  }
}
