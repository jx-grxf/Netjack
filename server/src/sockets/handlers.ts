import { Server, Socket } from 'socket.io';
import { LobbyService } from '../lobby/lobbyService';

const CHAT_WINDOW_MS = 2000;
const CHAT_MAX_MESSAGES = 3;
const PLAYER_NAME_MAX_LENGTH = 20;

interface JoinPayload {
  code: string;
  name: string;
}

interface CreatePayload {
  name: string;
}

interface CreateBotPayload {
  name: string;
}

interface ReadyPayload {
  ready: boolean;
}

interface ChatPayload {
  message: string;
}

interface SetBetPayload {
  amount: number;
}

interface ClientSession {
  lobbyCode: string;
  playerName: string;
  joinedAt: number;
  ip: string;
}

interface AdminActivePlayer {
  socketId: string;
  name: string;
  lobbyCode: string;
  ip: string;
  joinedAt: number;
  playSeconds: number;
  ready: boolean;
  chips: number;
  phase: string;
}

export interface AdminStatsSnapshot {
  connectedSockets: number;
  activeLobbies: number;
  activePlayers: number;
  players: AdminActivePlayer[];
}

export interface SocketHandlersRuntime {
  getAdminStatsSnapshot: () => AdminStatsSnapshot;
}

function normalizeIp(raw: string | undefined): string {
  if (!raw) return 'unknown';
  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }
  return raw;
}

export function registerSocketHandlers(io: Server, lobbyService: LobbyService): SocketHandlersRuntime {
  const sessions = new Map<string, ClientSession>();
  const spamTracker = new Map<string, number[]>();

  const emitLobbyState = (lobbyCode: string): void => {
    const lobby = lobbyService.getLobby(lobbyCode);
    if (!lobby) return;

    io.to(lobbyCode).emit('lobby:update', lobby);
    io.to(lobbyCode).emit('game:state', lobby.gameState);
  };

  io.on('connection', (socket: Socket) => {
    const ip = normalizeIp(socket.handshake.address);

    const sendError = (message: string): void => {
      socket.emit('error', { message });
    };

    const getSessionLobbyCode = (): string | null => {
      const session = sessions.get(socket.id);
      return session?.lobbyCode ?? null;
    };

    const requireSession = (): string => {
      const code = getSessionLobbyCode();
      if (!code) {
        throw new Error('You are not in a lobby');
      }
      return code;
    };

    socket.on('lobby:create', (payload: CreatePayload) => {
      try {
        const name = payload?.name?.trim();
        if (!name) throw new Error('Name is required');
        if (name.length < 2) throw new Error('Name must be at least 2 characters');
        if (name.length > PLAYER_NAME_MAX_LENGTH) {
          throw new Error(`Name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`);
        }

        const lobby = lobbyService.createLobby(socket.id, name);
        socket.join(lobby.code);
        sessions.set(socket.id, {
          lobbyCode: lobby.code,
          playerName: name,
          joinedAt: Date.now(),
          ip
        });

        socket.emit('lobby:joined', lobby);
        emitLobbyState(lobby.code);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('lobby:createBot', (payload: CreateBotPayload) => {
      try {
        const name = payload?.name?.trim();
        if (!name) throw new Error('Name is required');
        if (name.length < 2) throw new Error('Name must be at least 2 characters');
        if (name.length > PLAYER_NAME_MAX_LENGTH) {
          throw new Error(`Name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`);
        }

        const lobby = lobbyService.createBotGame(socket.id, name);
        socket.join(lobby.code);
        sessions.set(socket.id, {
          lobbyCode: lobby.code,
          playerName: name,
          joinedAt: Date.now(),
          ip
        });

        socket.emit('lobby:joined', lobby);
        emitLobbyState(lobby.code);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('lobby:join', (payload: JoinPayload) => {
      try {
        const code = payload?.code?.trim().toUpperCase();
        const name = payload?.name?.trim();

        if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
          throw new Error('Invalid lobby code');
        }
        if (!name) {
          throw new Error('Name is required');
        }
        if (name.length < 2) throw new Error('Name must be at least 2 characters');
        if (name.length > PLAYER_NAME_MAX_LENGTH) {
          throw new Error(`Name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`);
        }

        const lobby = lobbyService.joinLobby(code, socket.id, name);
        socket.join(code);
        sessions.set(socket.id, {
          lobbyCode: code,
          playerName: name,
          joinedAt: Date.now(),
          ip
        });

        socket.emit('lobby:joined', lobby);
        emitLobbyState(code);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('lobby:leave', () => {
      try {
        const lobbyCode = requireSession();
        const lobby = lobbyService.leaveLobby(lobbyCode, socket.id);

        socket.leave(lobbyCode);
        sessions.delete(socket.id);
        spamTracker.delete(socket.id);

        if (lobby) {
          emitLobbyState(lobbyCode);
        }
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('lobby:ready', (payload: ReadyPayload) => {
      try {
        const lobbyCode = requireSession();
        const ready = Boolean(payload?.ready);

        lobbyService.setReady(lobbyCode, socket.id, ready);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('lobby:start', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.startGame(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('chat:send', (payload: ChatPayload) => {
      try {
        const lobbyCode = requireSession();
        const message = payload?.message?.trim();

        if (!message) {
          throw new Error('Message cannot be empty');
        }
        if (message.length > 300) {
          throw new Error('Message too long');
        }

        const now = Date.now();
        const entries = spamTracker.get(socket.id) ?? [];
        const freshEntries = entries.filter((time) => now - time < CHAT_WINDOW_MS);

        if (freshEntries.length >= CHAT_MAX_MESSAGES) {
          sendError('Chat rate limit exceeded, please slow down');
          spamTracker.set(socket.id, freshEntries);
          return;
        }

        freshEntries.push(now);
        spamTracker.set(socket.id, freshEntries);

        const chatMessage = lobbyService.addChatMessage(lobbyCode, socket.id, message);
        io.to(lobbyCode).emit('chat:new', chatMessage);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:hit', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.hit(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:stand', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.stand(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:double', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.doubleDown(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:split', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.split(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:nextRound', () => {
      try {
        const lobbyCode = requireSession();
        lobbyService.nextRound(lobbyCode, socket.id);
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('game:setBet', (payload: SetBetPayload) => {
      try {
        const lobbyCode = requireSession();
        lobbyService.setBet(lobbyCode, socket.id, Number(payload?.amount));
        emitLobbyState(lobbyCode);
      } catch (error) {
        sendError((error as Error).message);
      }
    });

    socket.on('disconnect', () => {
      const session = sessions.get(socket.id);
      if (!session) return;

      try {
        const lobby = lobbyService.leaveLobby(session.lobbyCode, socket.id);
        if (lobby) {
          emitLobbyState(session.lobbyCode);
        }
      } catch {
        // Lobby may already be removed; no-op on disconnect.
      } finally {
        sessions.delete(socket.id);
        spamTracker.delete(socket.id);
      }
    });
  });

  return {
    getAdminStatsSnapshot: () => {
      const now = Date.now();
      const lobbies = lobbyService.getAllLobbies();

      const players: AdminActivePlayer[] = [];
      for (const lobby of lobbies) {
        for (const player of lobby.players) {
          if (player.isBot) continue;
          if (!player.connected) continue;
          const session = sessions.get(player.id);
          players.push({
            socketId: player.id,
            name: player.name,
            lobbyCode: lobby.code,
            ip: session?.ip ?? 'unknown',
            joinedAt: session?.joinedAt ?? now,
            playSeconds: Math.max(0, Math.floor((now - (session?.joinedAt ?? now)) / 1000)),
            ready: player.ready,
            chips: player.chips,
            phase: lobby.gameState.phase
          });
        }
      }

      return {
        connectedSockets: io.engine.clientsCount,
        activeLobbies: lobbies.length,
        activePlayers: players.length,
        players
      };
    }
  };
}
