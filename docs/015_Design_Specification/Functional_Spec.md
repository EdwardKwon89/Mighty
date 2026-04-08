# Functional Specification: Mighty Game

## 1. Game Overview
Mighty is a 5-player strategic trick-taking card game. The objective is for the "Master" (주공) and their "Friend" (프렌드) to collect a target number of "Point Cards" (10, J, Q, K, A) against the "Opposition" (야당).

## 2. Gameplay Phases

### 2.1 Lobby & Room Management
- **Lobby**: Players can see active rooms, current online players, and global statistics.
- **Room Creation**: Host sets room name, (optional) password, and game settings.
- **Bot Addition**: Hosts can add up to 4 AI bots to fill the table.
- **Authentication**: Players must be logged in (JWT) to join or create rooms.

### 2.2 Bidding Phase (공약)
- **Starting Bid**: Minimum 13 point cards.
- **Bidding Order**: Clockwise from the dealer.
- **Validity Rules**: 
  - Subsequent bids must be higher in number.
  - Suit changes require +1 (if hidden cards not seen) or +2 (if seen).
  - No-Trump bids have priority over same-number suit bids.
- **The Master (주공)**: The player with the highest bid becomes the Master.

### 2.3 Exchange & Friend Selection (교체 및 프렌드)
- **Hidden Cards**: 3 cards are dealt face-down. The Master picks them up and discards 3 cards of their choice.
- **Friend Selection**: The Master designates a "Friend" by calling a specific card (e.g., "Mighty Friend", "Joker Friend") or specific nickname.
- **Solo Play (노프렌드)**: The Master can choose to play alone (Solo) to double the settlement stakes.

### 2.4 Playing Phase (플레이)
- **Trick-Taking**: 10 tricks in total.
- **Lead Suit**: The first player in a trick sets the lead suit. Others must follow if they have it.
- **Mighty Card**: The strongest card in the game (typically Spades Ace).
- **Joker**: The second strongest card, but weakened in the 1st and 10th tricks.
- **Joker Call**: A specific card (typically Clover 3) that forces the Joker to be played.

### 2.5 Settlement (정산)
- **Winning**: Master + Friend score >= Bid amount.
- **Losing**: Score < Bid amount.
- **Points**: Calculation based on (Actual Score - Bid Amount) * Multipliers (No-Trump, Solo, Run).

## 3. Bot AI Specification

### 3.1 Strategic Bidding
- Bots analyze their starting hand's "Power" (High cards + suit length).
- Bots calculate appropriate bid amounts and pass if their hand is weak.

### 3.2 Strategic Playing
- **Card Selection**: Bots aim to lead with low cards or follow with the lowest necessary card to preserve high cards for critical tricks.
- **Mighty/Joker Usage**: Bots attempt to save Mighty/Joker for late-game captures or to stop a run.

### 3.3 Robustness & Failsafes
- **Decision Timeout**: Bots have a 1-2 second synthetic delay for a "human-like" feel.
- **Selection Failsafe**: If strategic logic fails, bots carry a secondary rule-check to find *any* valid card to prevent game stalls.
- **FATAL Fallback**: As a last resort, the server selects the first card in the bot's hand to ensure the game never hangs.
