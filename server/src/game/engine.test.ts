import { describe, expect, it } from 'vitest';
import { calculateHandValue, dealerPlay, determineOutcome, isBust, isNaturalBlackjack } from './engine';
import { Card } from '../types';

describe('calculateHandValue', () => {
  it('handles ace as 11 when safe', () => {
    const hand: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: '6', suit: 'H' }
    ];

    expect(calculateHandValue(hand)).toBe(17);
  });

  it('downgrades ace to 1 when needed', () => {
    const hand: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: '9', suit: 'H' },
      { rank: '8', suit: 'D' }
    ];

    expect(calculateHandValue(hand)).toBe(18);
    expect(isBust(hand)).toBe(false);
  });

  it('handles multiple aces correctly', () => {
    const hand: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: 'A', suit: 'H' },
      { rank: '9', suit: 'D' }
    ];

    expect(calculateHandValue(hand)).toBe(21);
  });
});

describe('dealerPlay', () => {
  it('dealer stands on soft 17', () => {
    const dealerHand: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: '6', suit: 'D' }
    ];
    const deck: Card[] = [{ rank: '5', suit: 'H' }];

    const result = dealerPlay(deck, dealerHand);
    expect(result.dealerHand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it('dealer hits below 17 and then stops', () => {
    const dealerHand: Card[] = [
      { rank: '9', suit: 'S' },
      { rank: '6', suit: 'D' }
    ];
    const deck: Card[] = [
      { rank: '2', suit: 'H' },
      { rank: 'A', suit: 'C' }
    ];

    const result = dealerPlay(deck, dealerHand);
    expect(result.dealerHand).toHaveLength(3);
    expect(result.dealerHand[2]).toEqual({ rank: '2', suit: 'H' });
    expect(result.deck).toHaveLength(1);
  });
});

describe('determineOutcome', () => {
  it('returns push on equal totals', () => {
    const player: Card[] = [
      { rank: '10', suit: 'S' },
      { rank: '7', suit: 'H' }
    ];
    const dealer: Card[] = [
      { rank: '9', suit: 'D' },
      { rank: '8', suit: 'C' }
    ];

    expect(determineOutcome(player, dealer)).toBe('push');
  });

  it('handles natural blackjack priority correctly', () => {
    const player: Card[] = [
      { rank: 'A', suit: 'S' },
      { rank: 'K', suit: 'H' }
    ];
    const dealer: Card[] = [
      { rank: '10', suit: 'D' },
      { rank: '8', suit: 'C' }
    ];

    expect(isNaturalBlackjack(player, false)).toBe(true);
    expect(determineOutcome(player, dealer, { playerNaturalBlackjack: true })).toBe('win');
    expect(
      determineOutcome(player, player, {
        playerNaturalBlackjack: true,
        dealerNaturalBlackjack: true
      })
    ).toBe('push');
  });
});
