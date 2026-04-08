const { io } = require("socket.io-client");
const { Suit, Rank, canPlayCard, validateBid, getJokerCallCardId } = require("../packages/engine/dist/index");

interface GameState {
  roomID: string;
  state: string;
  players: any[];
  myCards: any[];
  highBidAmount: number;
  highBidSuit: any;
  currentTrick: any[];
  trumpSuit: any;
  leadSuit: any;
}

class PlayAgent {
  private socket: any;
  private nickname: string;
  private roomId: string;
  private gameState: GameState | null = null;
  private bidPassword: string = "password123";

  constructor(nickname: string, roomId: string) {
    this.nickname = nickname;
    this.roomId = roomId;
    this.socket = io("http://localhost:4000");

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on("connect", () => {
      console.log(`[${this.nickname}] Connected to server`);
      this.socket.emit("join-room", { 
        roomId: this.roomId, 
        nickname: this.nickname,
        password: this.bidPassword
      });
    });

    this.socket.on("game-state", (state: GameState) => {
      this.gameState = state;
      this.handleAction();
    });

    this.socket.on("error", (err: any) => {
      console.error(`[${this.nickname}] SERVER ERROR:`, err.message || err);
    });

    this.socket.on("receive-message", (msg: any) => {
      if (msg.sender === "SYSTEM") {
         // console.log(`[${this.nickname}] SYSTEM: ${msg.text}`);
      }
    });
  }

  private handleAction() {
    if (!this.gameState) return;

    const me = this.gameState.players.find(p => p.nickname === this.nickname);
    if (!me) return;

    switch (this.gameState.state) {
      case "BIDDING":
        if (me.isBidding) this.makeBid();
        break;
      case "EXCHANGING":
        if (this.isMyDeclarer() && me.isTurn) this.makeExchange();
        break;
      case "SELECTING_FRIEND":
        if (this.isMyDeclarer() && me.isTurn) this.makeFriendSelection();
        break;
      case "PLAYING":
        if (me.isTurn) this.playCard();
        break;
    }
  }

  private isMyDeclarer() {
    if (!this.gameState) return false;
    // During exchanging, highBidder becomes declarer
    const myPlayer = this.gameState.players.find(p => p.nickname === this.nickname);
    return myPlayer && (this.gameState.players.findIndex(p => p.nickname === this.nickname) === this.getHighBidderIndex());
  }

  private getHighBidderIndex() {
    if (!this.gameState) return -1;
    // In our simplified state, look for who has the high bid
    return this.gameState.players.findIndex(p => !p.isPassed && p.bidAmount === this.gameState!.highBidAmount);
  }

  private makeBid() {
    const shouldPass = Math.random() > 0.7;
    if (shouldPass || this.gameState!.highBidAmount >= 20) {
      this.socket.emit("bid", { roomId: this.roomId, pass: true });
    } else {
      const nextAmount = (this.gameState!.highBidAmount || 12) + 1;
      const suits = [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER, "NO_TRUMP"];
      const nextSuit = suits[Math.floor(Math.random() * suits.length)];
      this.socket.emit("bid", { 
        roomId: this.roomId, 
        pass: false, 
        amount: nextAmount, 
        suit: nextSuit 
      });
    }
  }

  private makeExchange() {
    // ID가 포함된 실제 객체 3개를 전송
    const discards = this.gameState!.myCards.slice(0, 3);
    const trump = [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLOVER, "NO_TRUMP"][Math.floor(Math.random() * 5)];
    this.socket.emit("exchange", { roomId: this.roomId, discards, trump });
  }

  private makeFriendSelection() {
    this.socket.emit("select-friend", { roomId: this.roomId, card: "NONE" });
  }

  private playCard() {
    const trump = this.gameState!.trumpSuit === "NO_TRUMP" ? Suit.NONE : (this.gameState!.trumpSuit);
    const leadSuit = this.gameState!.leadSuit;

    // Simple rule-aware selection (canPlayCard)
    for (const card of this.gameState!.myCards) {
      const validation = canPlayCard(this.gameState!.myCards, leadSuit, {
        trumpSuit: trump,
        mightyCardId: "any", // Simplified for bot
        jokerCallCardId: "any",
        isFirstTrick: this.gameState!.myCards.length === 10,
        isLastTrick: this.gameState!.myCards.length === 1,
      }, card);

      if (validation.canPlay) {
        process.stdout.write(`[${this.nickname}] Playing: ${card.suit} ${card.rank}\n`);
        this.socket.emit("play-card", { roomId: this.roomId, card });
        return;
      }
    }
    
    // Fallback: Play first card
    this.socket.emit("play-card", { roomId: this.roomId, card: this.gameState!.myCards[0] });
  }
}

const args = process.argv.slice(2);
const botName = args[0];
const roomId = args[1];

if (!botName || !roomId) process.exit(1);

new PlayAgent(botName, roomId);
