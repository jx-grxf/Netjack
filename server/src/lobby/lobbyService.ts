import { createDeck, shuffleDeck } from '../game/deck';
import {
  calculateHandValue,
  dealerPlay,
  determineOutcome,
  isBust,
  isNaturalBlackjack
} from '../game/engine';
import {
  ChatMessage,
  EventLogEntry,
  LobbyState,
  PlayerHandState,
  PlayerState,
  RoundResult
} from '../types';
import { LobbyStore } from './lobbyStore';

const LOBBY_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_CHAT_HISTORY = 100;
const MAX_EVENT_LOG = 100;

const STARTING_CHIPS = 1000;
const DEFAULT_BET = 50;
const MIN_BET = 10;
const MAX_BET = 500;
const BOT_ID_PREFIX = 'bot-';
const BOT_NAME = 'Dealer Bot';

interface LobbyServiceOptions {
  maxPlayers: number;
}

export class LobbyService {
  constructor(
    private readonly store: LobbyStore,
    private readonly options: LobbyServiceOptions
  ) {}

  createLobby(hostId: string, hostName: string): LobbyState {
    const code = this.generateUniqueCode();
    const host: PlayerState = {
      id: hostId,
      name: hostName,
      isBot: false,
      ready: false,
      chips: STARTING_CHIPS,
      bet: DEFAULT_BET,
      hands: [],
      activeHandIndex: 0,
      stats: {
        rounds: 0,
        wins: 0,
        losses: 0,
        pushes: 0
      },
      connected: true
    };

    const lobby: LobbyState = {
      code,
      hostId,
      players: [host],
      chatHistory: [],
      eventLog: [],
      gameState: {
        phase: 'waiting',
        round: 0,
        dealerHand: [],
        deck: [],
        currentTurnPlayerId: null,
        currentTurnHandIndex: null,
        results: []
      }
    };

    this.addEventLog(lobby, 'lobby', `${host.name} created lobby ${code}`);
    this.store.set(lobby);
    return lobby;
  }

  createBotGame(hostId: string, hostName: string): LobbyState {
    const lobby = this.createLobby(hostId, hostName);
    const bot: PlayerState = {
      id: this.makeBotId(),
      name: BOT_NAME,
      isBot: true,
      ready: true,
      chips: STARTING_CHIPS,
      bet: DEFAULT_BET,
      hands: [],
      activeHandIndex: 0,
      stats: {
        rounds: 0,
        wins: 0,
        losses: 0,
        pushes: 0
      },
      connected: true
    };

    const host = this.requirePlayer(lobby, hostId);
    host.ready = true;

    lobby.players.push(bot);
    this.addEventLog(lobby, 'lobby', `${bot.name} joined the lobby`);

    this.startNextRoundInternal(lobby);
    this.runBotTurns(lobby);
    this.store.set(lobby);

    return lobby;
  }

  joinLobby(code: string, playerId: string, playerName: string): LobbyState {
    const lobby = this.requireLobby(code);

    if (lobby.players.some((player) => player.id === playerId)) {
      throw new Error('Player is already in this lobby');
    }
    if (lobby.players.length >= this.options.maxPlayers) {
      throw new Error('Lobby is full');
    }

    const player: PlayerState = {
      id: playerId,
      name: playerName,
      isBot: false,
      ready: false,
      chips: STARTING_CHIPS,
      bet: DEFAULT_BET,
      hands: [],
      activeHandIndex: 0,
      stats: {
        rounds: 0,
        wins: 0,
        losses: 0,
        pushes: 0
      },
      connected: true
    };

    lobby.players.push(player);
    this.addEventLog(lobby, 'lobby', `${player.name} joined the lobby`);
    this.store.set(lobby);

    return lobby;
  }

  leaveLobby(code: string, playerId: string): LobbyState | null {
    const lobby = this.requireLobby(code);
    const player = lobby.players.find((item) => item.id === playerId);

    if (!player) {
      throw new Error('Player not found in lobby');
    }

    lobby.players = lobby.players.filter((item) => item.id !== playerId);
    this.addEventLog(lobby, 'lobby', `${player.name} left the lobby`);

    const humanPlayers = lobby.players.filter((item) => !item.isBot);
    if (humanPlayers.length === 0) {
      this.store.delete(code);
      return null;
    }

    if (lobby.hostId === playerId) {
      const nextHost = lobby.players.find((item) => !item.isBot) ?? lobby.players[0];
      lobby.hostId = nextHost.id;
      this.addEventLog(lobby, 'lobby', `${nextHost.name} is now host`);
    }

    if (lobby.gameState.phase === 'in_round' && lobby.gameState.currentTurnPlayerId === playerId) {
      this.advanceTurn(lobby, true);
    }

    this.store.set(lobby);
    return lobby;
  }

  markConnected(code: string, playerId: string, connected: boolean): LobbyState {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);

    player.connected = connected;
    if (!connected) {
      player.ready = false;
    }
    this.store.set(lobby);
    return lobby;
  }

  setReady(code: string, playerId: string, ready: boolean): LobbyState {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);

    if (player.isBot) {
      throw new Error('Bots are always ready');
    }
    if (!player.connected) {
      throw new Error('Disconnected players cannot change readiness');
    }
    if (lobby.gameState.phase !== 'waiting') {
      throw new Error('Cannot change readiness during a round');
    }

    player.ready = ready;
    this.addEventLog(lobby, 'ready', `${player.name} is ${ready ? 'ready' : 'not ready'}`);
    this.store.set(lobby);

    return lobby;
  }

  setBet(code: string, playerId: string, amount: number): LobbyState {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);

    if (player.isBot) {
      throw new Error('Bot bets are managed automatically');
    }
    if (lobby.gameState.phase !== 'waiting' && lobby.gameState.phase !== 'round_over') {
      throw new Error('Bets can only be changed before a round starts');
    }
    if (!player.connected) {
      throw new Error('Disconnected players cannot change bets');
    }
    if (player.chips < MIN_BET) {
      throw new Error(`You need at least ${MIN_BET} chips to place a bet`);
    }
    if (!Number.isInteger(amount)) {
      throw new Error('Bet must be a whole number');
    }
    if (amount < MIN_BET) {
      throw new Error(`Minimum bet is ${MIN_BET}`);
    }
    if (amount > MAX_BET) {
      throw new Error(`Maximum bet is ${MAX_BET}`);
    }
    if (amount > player.chips) {
      throw new Error('Bet cannot exceed available chips');
    }

    player.bet = amount;
    this.addEventLog(lobby, 'bet', `${player.name} set bet to ${amount}`);
    this.store.set(lobby);
    return lobby;
  }

  startGame(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);

    if (lobby.hostId !== playerId) {
      throw new Error('Only host can start the game');
    }

    if (lobby.gameState.phase !== 'waiting') {
      throw new Error('Round already in progress');
    }

    const connectedPlayers = lobby.players.filter((player) => player.connected);
    if (connectedPlayers.length < 2) {
      throw new Error('At least 2 connected players are required');
    }
    if (!connectedPlayers.every((player) => player.ready)) {
      throw new Error('All connected players must be ready');
    }

    this.startNextRoundInternal(lobby);
    this.runBotTurns(lobby);
    this.store.set(lobby);

    return lobby;
  }

  nextRound(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);

    if (lobby.hostId !== playerId) {
      throw new Error('Only host can start the next round');
    }

    if (lobby.gameState.phase !== 'round_over') {
      throw new Error('Round is not over yet');
    }
    const connectedPlayers = lobby.players.filter((player) => player.connected);
    if (connectedPlayers.length < 2) {
      throw new Error('At least 2 connected players are required');
    }

    this.startNextRoundInternal(lobby);
    this.runBotTurns(lobby);
    this.store.set(lobby);
    return lobby;
  }

  hit(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);
    const hand = this.requireCurrentPlayerHand(lobby, playerId);

    if (isNaturalBlackjack(hand.cards, hand.fromSplit)) {
      throw new Error('Natural blackjack resolves automatically');
    }

    if (hand.standing || hand.busted) {
      throw new Error('Player hand already completed');
    }

    const card = lobby.gameState.deck.shift();
    if (!card) {
      throw new Error('Deck is empty');
    }

    hand.cards.push(card);
    hand.busted = isBust(hand.cards);

    const player = this.requirePlayer(lobby, playerId);
    this.addEventLog(lobby, 'game', `${player.name} hit hand ${player.activeHandIndex + 1}`);

    if (hand.busted) {
      hand.standing = true;
      this.addEventLog(lobby, 'game', `${player.name} busted hand ${player.activeHandIndex + 1}`);
      this.advanceTurn(lobby, false);
    }

    this.runBotTurns(lobby);
    this.store.set(lobby);
    return lobby;
  }

  stand(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);
    const hand = this.requireCurrentPlayerHand(lobby, playerId);

    if (isNaturalBlackjack(hand.cards, hand.fromSplit)) {
      throw new Error('Natural blackjack resolves automatically');
    }

    if (hand.standing) {
      throw new Error('Player already stood');
    }

    hand.standing = true;
    const player = this.requirePlayer(lobby, playerId);
    this.addEventLog(lobby, 'game', `${player.name} stood hand ${player.activeHandIndex + 1}`);
    this.advanceTurn(lobby, false);

    this.runBotTurns(lobby);
    this.store.set(lobby);
    return lobby;
  }

  doubleDown(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);
    const hand = this.requireCurrentPlayerHand(lobby, playerId);

    if (isNaturalBlackjack(hand.cards, hand.fromSplit)) {
      throw new Error('Natural blackjack resolves automatically');
    }

    if (!this.canDouble(player, hand, lobby.gameState.phase === 'in_round')) {
      throw new Error('Double down is not allowed right now');
    }

    if (player.chips < hand.bet) {
      throw new Error('Not enough chips to double down');
    }
    if (lobby.gameState.deck.length < 1) {
      throw new Error('Deck is empty');
    }

    player.chips -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;

    const card = lobby.gameState.deck.shift();
    if (!card) {
      throw new Error('Deck is empty');
    }

    hand.cards.push(card);
    hand.busted = isBust(hand.cards);
    hand.standing = true;

    this.addEventLog(lobby, 'game', `${player.name} doubled down on hand ${player.activeHandIndex + 1}`);
    if (hand.busted) {
      this.addEventLog(lobby, 'game', `${player.name} busted hand ${player.activeHandIndex + 1}`);
    }

    this.advanceTurn(lobby, false);
    this.runBotTurns(lobby);
    this.store.set(lobby);
    return lobby;
  }

  split(code: string, playerId: string): LobbyState {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);
    const hand = this.requireCurrentPlayerHand(lobby, playerId);

    if (isNaturalBlackjack(hand.cards, hand.fromSplit)) {
      throw new Error('Natural blackjack resolves automatically');
    }

    if (!this.canSplit(player, hand, lobby.gameState.phase === 'in_round')) {
      throw new Error('Split is not allowed right now');
    }

    if (player.chips < hand.bet) {
      throw new Error('Not enough chips to split');
    }
    if (lobby.gameState.deck.length < 2) {
      throw new Error('Deck is empty');
    }

    player.chips -= hand.bet;

    const [firstCard, secondCard] = hand.cards;
    const firstDraw = lobby.gameState.deck.shift();
    const secondDraw = lobby.gameState.deck.shift();

    if (!firstDraw || !secondDraw) {
      throw new Error('Deck is empty');
    }

    const splitBet = hand.bet;
    player.hands = [
      {
        cards: [firstCard, firstDraw],
        bet: splitBet,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: true
      },
      {
        cards: [secondCard, secondDraw],
        bet: splitBet,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: true
      }
    ];
    player.activeHandIndex = 0;

    this.addEventLog(lobby, 'game', `${player.name} split hand into two hands`);

    this.runBotTurns(lobby);
    this.store.set(lobby);
    return lobby;
  }

  addChatMessage(code: string, playerId: string, message: string): ChatMessage {
    const lobby = this.requireLobby(code);
    const player = this.requirePlayer(lobby, playerId);

    const chatMessage: ChatMessage = {
      id: this.makeId(),
      playerId,
      playerName: player.name,
      message,
      timestamp: Date.now()
    };

    lobby.chatHistory.push(chatMessage);
    if (lobby.chatHistory.length > MAX_CHAT_HISTORY) {
      lobby.chatHistory = lobby.chatHistory.slice(-MAX_CHAT_HISTORY);
    }

    this.store.set(lobby);
    return chatMessage;
  }

  getLobby(code: string): LobbyState | undefined {
    return this.store.get(code);
  }

  getAllLobbies(): LobbyState[] {
    return this.store.getAll();
  }

  private startNextRoundInternal(lobby: LobbyState): void {
    const deck = shuffleDeck(createDeck());
    this.configureBotBets(lobby);

    const requiredPlayers = lobby.players.filter(
      (player) => player.connected && player.chips >= MIN_BET
    );

    if (requiredPlayers.length === 0) {
      throw new Error(`No connected player has at least ${MIN_BET} chips`);
    }

    for (const player of requiredPlayers) {
      if (!this.hasValidBet(player.bet, player.chips)) {
        throw new Error(`${player.name} must set a valid bet before starting the round`);
      }
    }

    for (const player of lobby.players) {
      player.hands = [];
      player.activeHandIndex = 0;
      if (!player.connected || player.chips < MIN_BET) {
        player.bet = 0;
      }
    }

    const bettingPlayers = requiredPlayers.filter((player) =>
      this.hasValidBet(player.bet, player.chips)
    );

    if (bettingPlayers.length === 0) {
      throw new Error('No valid bets to start the round');
    }

    for (const player of bettingPlayers) {
      player.chips -= player.bet;
      player.hands = [
        {
          cards: [],
          bet: player.bet,
          standing: false,
          busted: false,
          doubled: false,
          fromSplit: false
        }
      ];
      player.activeHandIndex = 0;
    }

    for (let i = 0; i < 2; i += 1) {
      for (const player of bettingPlayers) {
        const card = deck.shift();
        if (!card) throw new Error('Deck ran out while dealing players');
        player.hands[0].cards.push(card);
      }
    }

    const dealerHand = [];
    for (let i = 0; i < 2; i += 1) {
      const card = deck.shift();
      if (!card) throw new Error('Deck ran out while dealing dealer');
      dealerHand.push(card);
    }

    lobby.gameState.phase = 'in_round';
    lobby.gameState.round += 1;
    lobby.gameState.dealerHand = dealerHand;
    lobby.gameState.deck = deck;
    lobby.gameState.results = [];
    this.resolveInitialNaturalBlackjacks(lobby);

    const firstTurn = this.findFirstTurnPlayer(lobby);
    if (!firstTurn) {
      lobby.gameState.currentTurnPlayerId = null;
      lobby.gameState.currentTurnHandIndex = null;
      this.finishRound(lobby);
      return;
    }

    lobby.gameState.currentTurnPlayerId = firstTurn.id;
    lobby.gameState.currentTurnHandIndex = firstTurn.activeHandIndex;

    this.addEventLog(lobby, 'game', `Round ${lobby.gameState.round} started`);
  }

  private advanceTurn(lobby: LobbyState, allowForceShiftFromMissingCurrent: boolean): void {
    const bettingPlayers = this.getBettingPlayers(lobby);
    if (bettingPlayers.length === 0) {
      this.finishRound(lobby);
      return;
    }

    const currentId = lobby.gameState.currentTurnPlayerId;
    const currentIdx = currentId ? bettingPlayers.findIndex((p) => p.id === currentId) : -1;

    const currentPlayer = currentIdx >= 0 ? bettingPlayers[currentIdx] : null;
    if (currentPlayer) {
      const nextHandIdx = this.findNextUnfinishedHandIndex(currentPlayer, currentPlayer.activeHandIndex + 1);
      if (nextHandIdx !== null) {
        currentPlayer.activeHandIndex = nextHandIdx;
        lobby.gameState.currentTurnPlayerId = currentPlayer.id;
        lobby.gameState.currentTurnHandIndex = nextHandIdx;
        return;
      }
    }

    const startIndex = currentIdx >= 0 ? currentIdx + 1 : 0;
    const offsetLimit = bettingPlayers.length;
    for (let offset = 0; offset < offsetLimit; offset += 1) {
      const idx = (startIndex + offset) % bettingPlayers.length;
      const candidate = bettingPlayers[idx];
      const handIdx = this.findNextUnfinishedHandIndex(candidate, 0);
      if (handIdx !== null) {
        candidate.activeHandIndex = handIdx;
        lobby.gameState.currentTurnPlayerId = candidate.id;
        lobby.gameState.currentTurnHandIndex = handIdx;
        return;
      }
    }

    if (allowForceShiftFromMissingCurrent || currentPlayer) {
      this.finishRound(lobby);
    }
  }

  private runBotTurns(lobby: LobbyState): void {
    while (lobby.gameState.phase === 'in_round') {
      const currentTurnPlayerId = lobby.gameState.currentTurnPlayerId;
      if (!currentTurnPlayerId) {
        return;
      }

      const player = lobby.players.find((item) => item.id === currentTurnPlayerId);
      if (!player || !player.isBot) {
        return;
      }

      const hand = player.hands[player.activeHandIndex];
      if (!hand || hand.standing || hand.busted || hand.bet <= 0) {
        this.advanceTurn(lobby, true);
        continue;
      }

      const roundIsActive = lobby.gameState.phase === 'in_round';

      if (this.canSplit(player, hand, roundIsActive)) {
        const value = calculateHandValue(hand.cards);
        if (value === 16 || value === 20 || hand.cards[0].rank === 'A') {
          this.performBotSplit(lobby, player, hand);
          continue;
        }
      }

      if (this.canDouble(player, hand, roundIsActive)) {
        const value = calculateHandValue(hand.cards);
        if (value === 10 || value === 11) {
          this.performBotDoubleDown(lobby, player, hand);
          continue;
        }
      }

      const handValue = calculateHandValue(hand.cards);
      if (handValue < 17) {
        const card = lobby.gameState.deck.shift();
        if (!card) {
          throw new Error('Deck is empty');
        }

        hand.cards.push(card);
        hand.busted = isBust(hand.cards);
        this.addEventLog(lobby, 'game', `${player.name} hit hand ${player.activeHandIndex + 1}`);

        if (hand.busted) {
          hand.standing = true;
          this.addEventLog(lobby, 'game', `${player.name} busted hand ${player.activeHandIndex + 1}`);
          this.advanceTurn(lobby, false);
        }
        continue;
      }

      hand.standing = true;
      this.addEventLog(lobby, 'game', `${player.name} stood hand ${player.activeHandIndex + 1}`);
      this.advanceTurn(lobby, false);
    }
  }

  private performBotDoubleDown(lobby: LobbyState, player: PlayerState, hand: PlayerHandState): void {
    if (player.chips < hand.bet) {
      return;
    }
    if (lobby.gameState.deck.length < 1) {
      return;
    }

    player.chips -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;

    const card = lobby.gameState.deck.shift();
    if (!card) {
      throw new Error('Deck is empty');
    }

    hand.cards.push(card);
    hand.busted = isBust(hand.cards);
    hand.standing = true;

    this.addEventLog(lobby, 'game', `${player.name} doubled down on hand ${player.activeHandIndex + 1}`);
    if (hand.busted) {
      this.addEventLog(lobby, 'game', `${player.name} busted hand ${player.activeHandIndex + 1}`);
    }

    this.advanceTurn(lobby, false);
  }

  private performBotSplit(lobby: LobbyState, player: PlayerState, hand: PlayerHandState): void {
    if (player.chips < hand.bet || hand.cards.length !== 2) {
      return;
    }
    if (lobby.gameState.deck.length < 2) {
      return;
    }

    player.chips -= hand.bet;

    const [firstCard, secondCard] = hand.cards;
    const firstDraw = lobby.gameState.deck.shift();
    const secondDraw = lobby.gameState.deck.shift();

    if (!firstDraw || !secondDraw) {
      throw new Error('Deck is empty');
    }

    const splitBet = hand.bet;
    player.hands = [
      {
        cards: [firstCard, firstDraw],
        bet: splitBet,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: true
      },
      {
        cards: [secondCard, secondDraw],
        bet: splitBet,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: true
      }
    ];
    player.activeHandIndex = 0;

    this.addEventLog(lobby, 'game', `${player.name} split hand into two hands`);
  }

  private finishRound(lobby: LobbyState): void {
    const dealerResult = dealerPlay(lobby.gameState.deck, lobby.gameState.dealerHand);
    lobby.gameState.deck = dealerResult.deck;
    lobby.gameState.dealerHand = dealerResult.dealerHand;

    const dealerNaturalBlackjack = isNaturalBlackjack(lobby.gameState.dealerHand, false);
    const results: RoundResult[] = [];

    for (const player of lobby.players) {
      if (player.hands.length === 0) {
        results.push({
          playerId: player.id,
          handIndex: 0,
          outcome: 'skip',
          chipsDelta: 0,
          playerValue: 0
        });
        continue;
      }

      for (let handIndex = 0; handIndex < player.hands.length; handIndex += 1) {
        const hand = player.hands[handIndex];

        if (hand.bet <= 0) {
          results.push({
            playerId: player.id,
            handIndex,
            outcome: 'skip',
            chipsDelta: 0,
            playerValue: calculateHandValue(hand.cards)
          });
          continue;
        }

        const playerNaturalBlackjack = isNaturalBlackjack(hand.cards, hand.fromSplit);
        const outcome = determineOutcome(hand.cards, lobby.gameState.dealerHand, {
          playerNaturalBlackjack,
          dealerNaturalBlackjack
        });

        let chipsDelta = 0;
        if (outcome === 'win') {
          if (playerNaturalBlackjack && !dealerNaturalBlackjack) {
            chipsDelta = hand.bet * 1.5;
            player.chips += hand.bet * 2.5;
          } else {
            chipsDelta = hand.bet;
            player.chips += hand.bet * 2;
          }
          player.stats.wins += 1;
        } else if (outcome === 'push') {
          chipsDelta = 0;
          player.chips += hand.bet;
          player.stats.pushes += 1;
        } else {
          chipsDelta = -hand.bet;
          player.stats.losses += 1;
        }

        player.stats.rounds += 1;

        results.push({
          playerId: player.id,
          handIndex,
          outcome,
          chipsDelta,
          playerValue: calculateHandValue(hand.cards),
          blackjack: playerNaturalBlackjack
        });

        this.addEventLog(
          lobby,
          'result',
          `${player.name} hand ${handIndex + 1} ${outcome} (${chipsDelta >= 0 ? '+' : ''}${chipsDelta})`
        );
      }
    }

    lobby.gameState.results = results;
    lobby.gameState.phase = 'round_over';
    lobby.gameState.currentTurnPlayerId = null;
    lobby.gameState.currentTurnHandIndex = null;
  }

  private requireLobby(code: string): LobbyState {
    const lobby = this.store.get(code);
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    return lobby;
  }

  private requirePlayer(lobby: LobbyState, playerId: string): PlayerState {
    const player = lobby.players.find((item) => item.id === playerId);
    if (!player) {
      throw new Error('Player not found in lobby');
    }
    return player;
  }

  private requireCurrentPlayerHand(lobby: LobbyState, playerId: string): PlayerHandState {
    if (lobby.gameState.phase !== 'in_round') {
      throw new Error('No active round');
    }
    if (lobby.gameState.currentTurnPlayerId !== playerId) {
      throw new Error('Not your turn');
    }

    const player = this.requirePlayer(lobby, playerId);
    const hand = player.hands[player.activeHandIndex];
    if (!hand) {
      throw new Error('No active hand');
    }

    return hand;
  }

  private findFirstTurnPlayer(lobby: LobbyState): PlayerState | null {
    for (const player of this.getBettingPlayers(lobby)) {
      const firstIndex = this.findNextUnfinishedHandIndex(player, 0);
      if (firstIndex !== null) {
        player.activeHandIndex = firstIndex;
        return player;
      }
    }
    return null;
  }

  private findNextUnfinishedHandIndex(player: PlayerState, fromIndex: number): number | null {
    for (let index = fromIndex; index < player.hands.length; index += 1) {
      const hand = player.hands[index];
      if (!hand.standing && !hand.busted && hand.bet > 0) {
        return index;
      }
    }
    return null;
  }

  private getBettingPlayers(lobby: LobbyState): PlayerState[] {
    return lobby.players.filter((player) => player.hands.some((hand) => hand.bet > 0));
  }

  private resolveInitialNaturalBlackjacks(lobby: LobbyState): void {
    for (const player of this.getBettingPlayers(lobby)) {
      const hand = player.hands[0];
      if (!hand) continue;

      if (isNaturalBlackjack(hand.cards, hand.fromSplit)) {
        hand.standing = true;
        this.addEventLog(lobby, 'game', `${player.name} has BLACKJACK`);
      }
    }
  }

  private canDouble(player: PlayerState, hand: PlayerHandState, roundIsActive: boolean): boolean {
    return (
      roundIsActive &&
      hand.bet > 0 &&
      hand.cards.length === 2 &&
      !hand.standing &&
      !hand.busted &&
      !hand.doubled &&
      player.chips >= hand.bet
    );
  }

  private canSplit(player: PlayerState, hand: PlayerHandState, roundIsActive: boolean): boolean {
    if (!roundIsActive) return false;
    if (hand.bet <= 0) return false;
    if (player.hands.length !== 1) return false;
    if (hand.cards.length !== 2) return false;
    if (hand.standing || hand.busted) return false;
    if (player.chips < hand.bet) return false;

    const [first, second] = hand.cards;
    return this.rankValue(first.rank) === this.rankValue(second.rank);
  }

  private rankValue(rank: string): number {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return Number(rank);
  }

  private generateUniqueCode(): string {
    let code = this.generateCode();

    while (this.store.has(code)) {
      code = this.generateCode();
    }

    return code;
  }

  private generateCode(): string {
    let code = '';

    for (let i = 0; i < 6; i += 1) {
      const index = Math.floor(Math.random() * LOBBY_CODE_CHARS.length);
      code += LOBBY_CODE_CHARS[index];
    }

    return code;
  }

  private makeId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private makeBotId(): string {
    return `${BOT_ID_PREFIX}${this.makeId()}`;
  }

  private addEventLog(lobby: LobbyState, type: string, message: string): EventLogEntry {
    const entry: EventLogEntry = {
      id: this.makeId(),
      type,
      message,
      timestamp: Date.now()
    };

    lobby.eventLog.push(entry);
    if (lobby.eventLog.length > MAX_EVENT_LOG) {
      lobby.eventLog = lobby.eventLog.slice(-MAX_EVENT_LOG);
    }

    return entry;
  }

  private hasValidBet(bet: number, chips: number): boolean {
    return Number.isInteger(bet) && bet >= MIN_BET && bet <= MAX_BET && bet <= chips;
  }

  private configureBotBets(lobby: LobbyState): void {
    for (const player of lobby.players) {
      if (!player.isBot || !player.connected) continue;

      if (player.chips < MIN_BET) {
        player.bet = 0;
        continue;
      }

      const targetBet = Math.min(DEFAULT_BET, MAX_BET, Math.floor(player.chips));
      player.bet = Math.max(MIN_BET, targetBet);
    }
  }
}
