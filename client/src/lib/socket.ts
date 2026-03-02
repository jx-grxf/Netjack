import { io, type Socket } from "socket.io-client";
import type {
  ChatMessage,
  LobbyState,
  GameState,
} from "@/types/game";

export interface ClientToServerEvents {
  "lobby:create": (payload: { name: string }) => void;
  "lobby:createBot": (payload: { name: string }) => void;
  "lobby:join": (payload: { name: string; code: string }) => void;
  "lobby:leave": () => void;
  "lobby:ready": (payload: { ready: boolean }) => void;
  "lobby:start": () => void;
  "game:hit": () => void;
  "game:stand": () => void;
  "game:double": () => void;
  "game:split": () => void;
  "game:nextRound": () => void;
  "game:setBet": (payload: { amount: number }) => void;
  "chat:send": (payload: { message: string }) => void;
}

export interface ServerToClientEvents {
  "lobby:joined": (payload: LobbyState) => void;
  "lobby:update": (payload: LobbyState) => void;
  "game:state": (payload: GameState) => void;
  "chat:new": (message: ChatMessage) => void;
  error: (payload: { message: string }) => void;
}

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export function ensureConnected() {
  if (!socket.connected) {
    socket.connect();
  }
}
