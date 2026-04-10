-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "targetPlayerId" TEXT,
    "action" TEXT NOT NULL,
    "amount" INTEGER,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AdminLog" ("action", "adminId", "amount", "createdAt", "id", "reason", "targetPlayerId") SELECT "action", "adminId", "amount", "createdAt", "id", "reason", "targetPlayerId" FROM "AdminLog";
DROP TABLE "AdminLog";
ALTER TABLE "new_AdminLog" RENAME TO "AdminLog";
CREATE TABLE "new_GameTrick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "trickNumber" INTEGER NOT NULL,
    "cards" TEXT NOT NULL,
    "winnerId" TEXT,
    CONSTRAINT "GameTrick_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameTrick" ("cards", "id", "roomId", "trickNumber", "winnerId") SELECT "cards", "id", "roomId", "trickNumber", "winnerId" FROM "GameTrick";
DROP TABLE "GameTrick";
ALTER TABLE "new_GameTrick" RENAME TO "GameTrick";
CREATE TABLE "new_PlayerInGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resultPoints" INTEGER NOT NULL,
    CONSTRAINT "PlayerInGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerInGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameHistory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerInGame" ("gameId", "id", "playerId", "resultPoints", "role") SELECT "gameId", "id", "playerId", "resultPoints", "role" FROM "PlayerInGame";
DROP TABLE "PlayerInGame";
ALTER TABLE "new_PlayerInGame" RENAME TO "PlayerInGame";
CREATE UNIQUE INDEX "PlayerInGame_playerId_gameId_key" ON "PlayerInGame"("playerId", "gameId");
CREATE TABLE "new_PointLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PointLog" ("amount", "createdAt", "id", "playerId", "reason", "type") SELECT "amount", "createdAt", "id", "playerId", "reason", "type" FROM "PointLog";
DROP TABLE "PointLog";
ALTER TABLE "new_PointLog" RENAME TO "PointLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
