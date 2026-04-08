# Security & Performance Specification: Mighty Game

## 1. Security Overview
Security is prioritized to ensure fair play, protect user data, and maintain server stability.

### 1.1 Authentication & Authorization
- **JWT (JSON Web Token)**: Used for all authed requests. Tokens are issued on login and stored securely in client cookies or local storage.
- **Password Hashing**: Passwords are never stored in plaintext. We use salt-and-hash (BCrypt or similar) for database storage.
- **Room Access Control**: Private rooms require a matching password verified on the server side before a player is admitted.

### 1.2 Socket-Level Safety
- **Handshake Verification**: Socket connections are only fully initialized if a valid JWT is provided.
- **Event Validation**: The server validates *every* incoming bid or card-play event:
  - Is it the user's turn?
  - Is the card in the player's hand?
  - Does the bid follow suit-change and increment rules?
  - **Failsafe**: Invalid actions are rejected with a specific `error` socket event.

### 1.3 Rate Limiting & DoS Protection
- **Bot Delays**: AI bot actions are limited to a minimum 1-second delay, preventing rapid-fire socket spamming.
- **Message Frequency**: Chat and other non-critical game events are rate-limited to 5 per second per socket.

## 2. Performance Specification

### 2.1 Latency Targets
- **State Sync (E2E)**: < 100ms from server state update to client UI reflecting the change.
- **Bot Decision Time**: 1000ms - 2000ms (synthetic delay for natural game feel).
- **Lobby Refresh**: < 200ms for room list and online player count.

### 2.2 Throughput & Scalability
- **Simultaneous Games**: The server architecture (Socket.io + Map-based rooms) is designed to handle up to 100 concurrent rooms (500 active players) on a single Node.js instance.
- **Engine Performance**: Card evaluation and trick resolution use O(1) or O(N) algorithms in the `@mighty/engine` package, ensuring negligible CPU overhead for each turn.

### 2.3 Reliability & Recovery
- **Reconnection Logic**: If a player's connection drops, the server preserves the player's state for up to 60 seconds.
- **State Restoration**: Upon reconnection, the client automatically re-joins the last room and receives the current `game-state`, allowing them to resume play seamlessly.
- **Null-Pointer Safety**: All game logic is built with defensive programming patterns (e.g., Optional Chaining, Null Checks) to avoid server crashes during edge cases like multi-player disconnection.
