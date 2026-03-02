import { Card } from '../types';

function cardValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
  return Number(card.rank);
}

export function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    value += cardValue(card);
    if (card.rank === 'A') aces += 1;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

export function isBust(hand: Card[]): boolean {
  return calculateHandValue(hand) > 21;
}

export function isNaturalBlackjack(hand: Card[], fromSplit = false): boolean {
  if (fromSplit) return false;
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

function isSoft17(hand: Card[]): boolean {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total === 17 && aces > 0;
}

export function dealerPlay(deck: Card[], dealerHand: Card[]): { deck: Card[]; dealerHand: Card[] } {
  const nextDeck = [...deck];
  const nextDealerHand = [...dealerHand];

  while (true) {
    const value = calculateHandValue(nextDealerHand);

    if (value > 17) break;
    if (value === 17 && isSoft17(nextDealerHand)) break;
    if (value === 17) {
      break;
    }

    const card = nextDeck.shift();
    if (!card) break;
    nextDealerHand.push(card);
  }

  return { deck: nextDeck, dealerHand: nextDealerHand };
}

export function determineOutcome(
  playerHand: Card[],
  dealerHand: Card[],
  options?: {
    playerNaturalBlackjack?: boolean;
    dealerNaturalBlackjack?: boolean;
  }
): 'win' | 'lose' | 'push' {
  const playerNaturalBlackjack = options?.playerNaturalBlackjack ?? false;
  const dealerNaturalBlackjack = options?.dealerNaturalBlackjack ?? false;
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  if (playerNaturalBlackjack && dealerNaturalBlackjack) return 'push';
  if (playerNaturalBlackjack) return 'win';
  if (dealerNaturalBlackjack) return 'lose';
  if (playerValue > 21) return 'lose';
  if (dealerValue > 21) return 'win';
  if (playerValue > dealerValue) return 'win';
  if (playerValue < dealerValue) return 'lose';
  return 'push';
}
