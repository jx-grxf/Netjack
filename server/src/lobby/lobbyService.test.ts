import { describe, expect, it } from 'vitest';
import { calculateHandValue } from '../game/engine';
import { LobbyStore } from './lobbyStore';
import { LobbyService } from './lobbyService';

describe('LobbyService bot mode', () => {
  it('creates a bot game and starts the first round immediately', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });

    const lobby = service.createBotGame('host-1', 'Alice');

    expect(lobby.players).toHaveLength(2);
    expect(lobby.players.find((player) => player.id === 'host-1')?.ready).toBe(true);

    const bot = lobby.players.find((player) => player.isBot);
    expect(bot).toBeDefined();
    expect(bot?.connected).toBe(true);
    expect(bot?.ready).toBe(true);

    expect(['in_round', 'round_over']).toContain(lobby.gameState.phase);
    expect(lobby.gameState.round).toBe(1);
    if (lobby.gameState.phase === 'in_round') {
      expect(lobby.gameState.currentTurnPlayerId).toBe('host-1');
      expect(lobby.gameState.currentTurnHandIndex).toBe(0);
    } else {
      expect(lobby.gameState.currentTurnPlayerId).toBe(null);
      expect(lobby.gameState.currentTurnHandIndex).toBe(null);
    }
  });

  it('runs bot turns automatically after the human player stands', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createBotGame('host-2', 'Bob');

    const host = lobby.players.find((player) => player.id === 'host-2');
    const bot = lobby.players.find((player) => player.isBot);

    if (!host || !bot) {
      throw new Error('Expected host and bot players');
    }

    host.hands = [
      {
        cards: [
          { rank: '10', suit: 'S' },
          { rank: '7', suit: 'H' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    host.activeHandIndex = 0;

    bot.hands = [
      {
        cards: [
          { rank: '10', suit: 'D' },
          { rank: '2', suit: 'C' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    bot.activeHandIndex = 0;

    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.phase = 'in_round';
    lobby.gameState.deck = [
      { rank: '5', suit: 'S' },
      { rank: '9', suit: 'D' },
      { rank: '4', suit: 'H' }
    ];

    const updated = service.stand(lobby.code, host.id);
    const updatedBot = updated.players.find((player) => player.isBot);
    const updatedBotHand = updatedBot?.hands[0];

    expect(updatedBotHand).toBeDefined();
    expect(updatedBotHand?.standing).toBe(true);
    expect(calculateHandValue(updatedBotHand?.cards ?? [])).toBeGreaterThanOrEqual(17);
    expect(updated.gameState.phase).toBe('round_over');
    expect(updated.gameState.currentTurnPlayerId).toBe(null);
    expect(updated.gameState.currentTurnHandIndex).toBe(null);
  });
});

describe('LobbyService betting and actions', () => {
  it('validates bet bounds and chips authoritatively', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-3', 'Cara');

    expect(() => service.setBet(lobby.code, 'host-3', 5)).toThrowError('Minimum bet is 10');
    expect(() => service.setBet(lobby.code, 'host-3', 700)).toThrowError('Maximum bet is 500');
    expect(() => service.setBet(lobby.code, 'host-3', 300)).not.toThrow();
  });

  it('requires valid bets before starting a round', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-4', 'Dana');
    service.joinLobby(lobby.code, 'guest-4', 'Eli');
    service.setReady(lobby.code, 'host-4', true);
    service.setReady(lobby.code, 'guest-4', true);

    const guest = lobby.players.find((player) => player.id === 'guest-4');
    if (!guest) {
      throw new Error('Expected guest player');
    }

    guest.bet = 0;

    expect(() => service.startGame(lobby.code, 'host-4')).toThrowError(
      'Eli must set a valid bet before starting the round'
    );
  });

  it('deducts configured bets when a round starts', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-5', 'Fran');
    service.joinLobby(lobby.code, 'guest-5', 'Gabe');
    service.setBet(lobby.code, 'host-5', 100);
    service.setBet(lobby.code, 'guest-5', 200);
    service.setReady(lobby.code, 'host-5', true);
    service.setReady(lobby.code, 'guest-5', true);

    const started = service.startGame(lobby.code, 'host-5');
    const host = started.players.find((player) => player.id === 'host-5');
    const guest = started.players.find((player) => player.id === 'guest-5');

    expect(host?.chips).toBe(900);
    expect(guest?.chips).toBe(800);
    expect(host?.hands[0]?.bet).toBe(100);
    expect(guest?.hands[0]?.bet).toBe(200);
  });

  it('allows double down only on first decision and auto-stands after one card', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createBotGame('host-6', 'Hale');
    const host = lobby.players.find((player) => player.id === 'host-6');

    if (!host) throw new Error('Expected host player');

    host.hands = [
      {
        cards: [
          { rank: '5', suit: 'S' },
          { rank: '6', suit: 'H' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    host.activeHandIndex = 0;
    host.chips = 500;

    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.phase = 'in_round';
    lobby.gameState.deck = [{ rank: '10', suit: 'D' }, ...lobby.gameState.deck];

    const updated = service.doubleDown(lobby.code, host.id);
    const hand = updated.players.find((player) => player.id === host.id)?.hands[0];

    expect(hand?.bet).toBe(100);
    expect(hand?.cards).toHaveLength(3);
    expect(hand?.standing).toBe(true);
    expect(hand?.doubled).toBe(true);
  });

  it('splits a matching-value starting hand into two playable hands', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createBotGame('host-7', 'Ivy');
    const host = lobby.players.find((player) => player.id === 'host-7');

    if (!host) throw new Error('Expected host player');

    host.hands = [
      {
        cards: [
          { rank: '10', suit: 'S' },
          { rank: 'K', suit: 'H' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    host.activeHandIndex = 0;
    host.chips = 500;

    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.phase = 'in_round';
    lobby.gameState.deck = [
      { rank: '4', suit: 'D' },
      { rank: '7', suit: 'C' },
      ...lobby.gameState.deck
    ];

    const updated = service.split(lobby.code, host.id);
    const updatedHost = updated.players.find((player) => player.id === host.id);

    expect(updatedHost?.hands).toHaveLength(2);
    expect(updatedHost?.hands[0].cards).toHaveLength(2);
    expect(updatedHost?.hands[1].cards).toHaveLength(2);
    expect(updatedHost?.hands[0].bet).toBe(50);
    expect(updatedHost?.hands[1].bet).toBe(50);
  });

  it('pays natural blackjack at 3:2 unless dealer also has blackjack', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-8', 'Jules');
    service.joinLobby(lobby.code, 'guest-8', 'Kai');

    const host = lobby.players.find((player) => player.id === 'host-8');
    const guest = lobby.players.find((player) => player.id === 'guest-8');
    if (!host || !guest) throw new Error('Expected players');

    host.hands = [
      {
        cards: [
          { rank: 'A', suit: 'S' },
          { rank: 'K', suit: 'S' }
        ],
        bet: 50,
        standing: true,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    guest.hands = [
      {
        cards: [
          { rank: '10', suit: 'H' },
          { rank: '8', suit: 'H' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];

    host.chips = 950;
    guest.chips = 950;

    lobby.gameState.phase = 'in_round';
    lobby.gameState.currentTurnPlayerId = 'guest-8';
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.dealerHand = [
      { rank: '9', suit: 'D' },
      { rank: '8', suit: 'D' }
    ];
    lobby.gameState.deck = [];

    service.stand(lobby.code, 'guest-8');

    const updatedHost = lobby.players.find((player) => player.id === 'host-8');
    const hostResult = lobby.gameState.results.find((result) => result.playerId === 'host-8');

    expect(updatedHost?.chips).toBe(1075);
    expect(hostResult?.chipsDelta).toBe(75);
    expect(hostResult?.blackjack).toBe(true);
  });

  it('pushes when both player and dealer have natural blackjack', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-9', 'Lena');
    service.joinLobby(lobby.code, 'guest-9', 'Milo');

    const host = lobby.players.find((player) => player.id === 'host-9');
    const guest = lobby.players.find((player) => player.id === 'guest-9');
    if (!host || !guest) throw new Error('Expected players');

    host.hands = [
      {
        cards: [
          { rank: 'A', suit: 'S' },
          { rank: 'K', suit: 'H' }
        ],
        bet: 50,
        standing: true,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    guest.hands = [
      {
        cards: [
          { rank: '10', suit: 'D' },
          { rank: '7', suit: 'D' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];

    host.chips = 950;
    guest.chips = 950;

    lobby.gameState.phase = 'in_round';
    lobby.gameState.currentTurnPlayerId = 'guest-9';
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.dealerHand = [
      { rank: 'A', suit: 'C' },
      { rank: 'Q', suit: 'S' }
    ];
    lobby.gameState.deck = [{ rank: '2', suit: 'H' }];

    service.stand(lobby.code, 'guest-9');

    const updatedHost = lobby.players.find((player) => player.id === 'host-9');
    const hostResult = lobby.gameState.results.find((result) => result.playerId === 'host-9');

    expect(updatedHost?.chips).toBe(1000);
    expect(hostResult?.outcome).toBe('push');
    expect(hostResult?.chipsDelta).toBe(0);
    expect(hostResult?.blackjack).toBe(true);
  });

  it('rejects double down after the first decision card count exceeds two', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createBotGame('host-10', 'Nia');
    const host = lobby.players.find((player) => player.id === 'host-10');

    if (!host) throw new Error('Expected host player');

    host.hands = [
      {
        cards: [
          { rank: '5', suit: 'S' },
          { rank: '4', suit: 'H' },
          { rank: '2', suit: 'C' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    host.activeHandIndex = 0;
    host.chips = 500;

    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.phase = 'in_round';

    expect(() => service.doubleDown(lobby.code, host.id)).toThrowError(
      'Double down is not allowed right now'
    );
  });

  it('rejects split when initial two cards are not equal value', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createBotGame('host-11', 'Omar');
    const host = lobby.players.find((player) => player.id === 'host-11');

    if (!host) throw new Error('Expected host player');

    host.hands = [
      {
        cards: [
          { rank: '10', suit: 'S' },
          { rank: '9', suit: 'H' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    host.activeHandIndex = 0;
    host.chips = 500;

    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;
    lobby.gameState.phase = 'in_round';

    expect(() => service.split(lobby.code, host.id)).toThrowError('Split is not allowed right now');
  });

  it('does not allow actions on a natural blackjack hand', () => {
    const service = new LobbyService(new LobbyStore(), { maxPlayers: 2 });
    const lobby = service.createLobby('host-12', 'Pia');
    service.joinLobby(lobby.code, 'guest-12', 'Quinn');

    const host = lobby.players.find((player) => player.id === 'host-12');
    const guest = lobby.players.find((player) => player.id === 'guest-12');
    if (!host || !guest) throw new Error('Expected players');

    host.hands = [
      {
        cards: [
          { rank: 'A', suit: 'S' },
          { rank: 'K', suit: 'D' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];
    guest.hands = [
      {
        cards: [
          { rank: '9', suit: 'H' },
          { rank: '7', suit: 'C' }
        ],
        bet: 50,
        standing: false,
        busted: false,
        doubled: false,
        fromSplit: false
      }
    ];

    lobby.gameState.phase = 'in_round';
    lobby.gameState.currentTurnPlayerId = host.id;
    lobby.gameState.currentTurnHandIndex = 0;

    expect(() => service.hit(lobby.code, host.id)).toThrowError('Natural blackjack resolves automatically');
    expect(() => service.stand(lobby.code, host.id)).toThrowError('Natural blackjack resolves automatically');
    expect(() => service.doubleDown(lobby.code, host.id)).toThrowError('Natural blackjack resolves automatically');
    expect(() => service.split(lobby.code, host.id)).toThrowError('Natural blackjack resolves automatically');
  });
});
