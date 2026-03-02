export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type Suit = "H" | "D" | "C" | "S";

export interface Card {
  rank: string;
  suit: Suit;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot?: boolean;
  ready: boolean;
  chips: number;
  bet: number;
  hands: PlayerHandState[];
  activeHandIndex: number;
  stats: PlayerStats;
  connected: boolean;
}

export interface PlayerHandState {
  cards: Card[];
  bet: number;
  standing: boolean;
  busted: boolean;
  doubled: boolean;
  fromSplit: boolean;
}

export interface PlayerStats {
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
}

export interface RoundResult {
  playerId: string;
  handIndex: number;
  outcome: "win" | "lose" | "push" | "skip";
  chipsDelta: number;
  playerValue: number;
  blackjack?: boolean;
}

export interface GameState {
  phase: "waiting" | "in_round" | "round_over";
  round: number;
  dealerHand: Card[];
  deck: Card[];
  currentTurnPlayerId: string | null;
  currentTurnHandIndex: number | null;
  results: RoundResult[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface EventLogItem {
  id: string;
  message: string;
  type: string;
  timestamp: number;
}

export interface LobbyState {
  code: string;
  hostId: string;
  players: PlayerState[];
  chatHistory: ChatMessage[];
  eventLog: EventLogItem[];
  gameState: GameState;
}

export interface AdminPlayerStat {
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

export interface AdminStats {
  connectedSockets: number;
  activeLobbies: number;
  activePlayers: number;
  players: AdminPlayerStat[];
}
