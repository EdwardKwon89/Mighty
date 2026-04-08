import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { io as Client, Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import Fastify from 'fastify';
import { authenticatePlayer, getPlayerStats } from '@mighty/database';

// 데이터베이스 레이어 목킹
vi.mock('@mighty/database', () => ({
  authenticatePlayer: vi.fn(),
  updateGameResult: vi.fn(),
  getPlayerStats: vi.fn(),
}));

describe('Socket Server Integration Tests', () => {
  let io: Server;
  let serverUrl: string;
  let fastify: any;

  beforeAll(async () => {
    // 테스트용 서버 구동 (실제 포트 4001 사용)
    fastify = Fastify();
    io = new Server(fastify.server);
    
    // 실제 서버의 로직을 간단히 재현하거나 index.ts의 로직을 테스트 환경으로 가져와야 함
    // 여기서는 메시지 브로드캐스트와 입장 제한 핵심 로직 위주로 검증
    io.on('connection', (socket) => {
      socket.on('join-room', async ({ roomId, nickname }) => {
        const playerInfo = await authenticatePlayer(nickname, 'test-password');
        if (playerInfo.isRestricted) {
          socket.emit('error', { message: '포인트가 음수입니다.' });
          return;
        }
        socket.join(roomId);
        socket.emit('joined', { roomId, nickname });
        io.to(roomId).emit('room-status', { message: `${nickname} joined` });
      });

      socket.on('send-message', ({ roomId, text, nickname }) => {
        io.to(roomId).emit('receive-message', { sender: nickname, text });
      });
    });

    await fastify.listen({ port: 4001 });
    serverUrl = 'http://localhost:4001';
  });

  afterAll(async () => {
    io.close();
    await fastify.close();
  });

  it('포인트가 부족한 유저는 입장이 거부되어야 함', async () => {
    (authenticatePlayer as any).mockResolvedValue({ points: -100, isRestricted: true });
    
    const clientSocket = Client(serverUrl);
    
    return new Promise<void>((resolve) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toContain('포인트가 음수');
        clientSocket.disconnect();
        resolve();
      });

      clientSocket.emit('join-room', { roomId: 'test-room', nickname: 'poor_user' });
    });
  });

  it('메시지 전송 시 방안의 다른 모든 클라이언트가 수신해야 함', async () => {
    (authenticatePlayer as any).mockResolvedValue({ points: 100000, isRestricted: false });

    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);

    await new Promise<void>((resolve) => {
      let joinedCount = 0;
      const checkJoined = () => {
        joinedCount++;
        if (joinedCount === 2) resolve();
      };
      client1.on('joined', checkJoined);
      client2.on('joined', checkJoined);
      
      client1.emit('join-room', { roomId: 'chat-room', nickname: 'user1' });
      client2.emit('join-room', { roomId: 'chat-room', nickname: 'user2' });
    });

    return new Promise<void>((resolve) => {
      client2.on('receive-message', (data) => {
        expect(data.sender).toBe('user1');
        expect(data.text).toBe('hello world');
        client1.disconnect();
        client2.disconnect();
        resolve();
      });

      client1.emit('send-message', { roomId: 'chat-room', nickname: 'user1', text: 'hello world' });
    });
  });
});
