# Technical Specification: Mighty Game

## 1. System Architecture
The project is organized as a **Turborepo Monorepo** for optimal separation of concerns and shared logic.

- **`apps/web`**: Next.js 14+ (App Router). Client-side UI, state management, and asset handling.
- **`apps/server`**: Node.js/Express with Socket.io. Game engine coordination, real-time message broadcasting.
- **`packages/engine`**: Shared TypeScript logic for Mighty rules, card evaluation, and bot AI.
- **`packages/database`**: Prisma-based persistence layer for authentication, player stats, and board history.

## 2. Real-time Communication (WebSockets)
We use **Socket.io** for bidirectional, event-driven state synchronization.

### 2.1 Key Events
- `join-room`: Player joins a room and initializes state.
- `game-state`: Server broadcasts the full game state to all players in a room.
- `bid`: Player sends a bid amount and suit.
- `play-card`: Player submits a card for the current trick.
- `receive-message`: Real-time chat integration.

### 2.2 Phase Synchronization
Each game phase transition (e.g., BIDDING -> EXCHANGING) is controlled by the server's `GameRoom` state machine. Clients reflect this state by hiding/showing specific UI modules.

## 3. Data Persistence (Database)
We use **PostgreSQL** or **SQLite** (via Prisma) for long-term storage.

### 3.1 Schema Overview
- **User**: Profile, hashed password, level, points.
- **GameRecord**: History of finished games, final scores, and participant lists.
- **RoomConfig**: (Optional) Persistent custom room settings.

## 4. API & Authentication
- **JWT (JSON Web Tokens)**: Used for stateless session management.
- **HTTP/REST**: Auth endpoints (login, register) and lobby data fetching.
- **Socket Middleware**: Verifies the JWT before allowing a user to join a room.

## 5. Deployment & Scaling
- **Docker**: Containerized deployment for consistent environment setup.
- **Environment Variables**: Managed via `.env` files for secrets like `JWT_SECRET` and `DATABASE_URL`.
