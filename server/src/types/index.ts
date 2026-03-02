export type Suit = 'H' | 'D' | 'C' | 'S';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  rank: Rank;
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

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface EventLogEntry {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

export interface RoundResult {
  playerId: string;
  handIndex: number;
  outcome: 'win' | 'lose' | 'push' | 'skip';
  chipsDelta: number;
  playerValue: number;
  blackjack?: boolean;
}

export type GamePhase = 'waiting' | 'in_round' | 'round_over';

export interface GameState {
  phase: GamePhase;
  round: number;
  dealerHand: Card[];
  deck: Card[];
  currentTurnPlayerId: string | null;
  currentTurnHandIndex: number | null;
  results: RoundResult[];
}

export interface LobbyState {
  code: string;
  hostId: string;
  players: PlayerState[];
  chatHistory: ChatMessage[];
  eventLog: EventLogEntry[];
  gameState: GameState;
}
