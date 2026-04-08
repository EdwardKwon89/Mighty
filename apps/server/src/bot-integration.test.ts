import { describe, it, expect, vi } from 'vitest';
import { GameRoom, GameState } from './game-room.js';
import { Suit } from '@mighty/engine';

describe('Bot Integration Tests', () => {
    it('봇을 추가하면 플레이어 목록에 포함되어야 함', async () => {
        const room = new GameRoom('test-bot-room');
        await room.addPlayer('human-id', 'Human', 1000);
        
        expect(room.players.length).toBe(1);
        
        await room.addBot();
        expect(room.players.length).toBe(2);
        expect(room.players[1].isBot).toBe(true);
        expect(room.players[1].nickname).toBe('BOT_2');
    });

    it('5명이 채워지면 게임이 BIDDING 상태로 시작되어야 함', async () => {
        const room = new GameRoom('start-room');
        await room.addPlayer('h1', 'H1', 1000);
        await room.addBot();
        await room.addBot();
        await room.addBot();
        await room.addBot(); // 총 5명

        expect(room.players.length).toBe(5);
        // addPlayer 내부의 setTimeout(startGame)을 고려하여 잠시 대기하거나 직접 호출
        room.startGame(); 
        expect(room.state).toBe(GameState.BIDDING);
    });

    it('봇의 차례가 되면 자동으로 비딩(패스)이 이루어져야 함', async () => {
        vi.useFakeTimers();
        const room = new GameRoom('bid-room');
        
        // 1번(Human), 2번(Bot) 설정
        await room.addPlayer('h1', 'Human', 1000, false);
        await room.addBot(); // BOT_2 (index 1)
        await room.addBot(); // BOT_3 (index 2)
        await room.addBot(); // BOT_4 (index 3)
        await room.addBot(); // BOT_5 (index 4)
        
        room.startGame(); // 내부에서 startTimer() 호출 -> checkBotTurn() 스케줄링
        
        // --- 1. Human 차례 (index 0) ---
        expect(room.currentBidderIndex).toBe(0);
        room.handleBid('h1', true); // index 0 패스 -> index 1로 변경 & startTimer() 호출
        
        // --- 2. Bot 차례 (index 1) ---
        expect(room.currentBidderIndex).toBe(1);
        
        // 봇의 행동 지연(0.5초) 대기
        vi.advanceTimersByTime(600);
        await Promise.resolve(); // 봇의 handleBid 호출이 CPU 큐에서 처리되도록 함
        
        // 봇이 handleBid를 호출했으므로 index가 2로 넘어갔어야 함
        expect(room.currentBidderIndex).toBe(2);
        
        vi.useRealTimers();
    });
});
