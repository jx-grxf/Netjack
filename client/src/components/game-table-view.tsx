import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayingCard } from "@/components/playing-card";
import type { Card, GameState, PlayerState } from "@/types/game";

const MIN_BET = 10;
const MAX_BET = 500;

interface GameTableViewProps {
  lobbyCode: string;
  table: GameState;
  players: PlayerState[];
  selfId: string;
  hostId: string;
  isConnected: boolean;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onSetBet: (amount: number) => void;
  onNextRound: () => void;
  onLeave: () => void;
}

function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (card.rank === "K" || card.rank === "Q" || card.rank === "J") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function rankValue(rank: string): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

export function GameTableView({
  lobbyCode,
  table,
  players,
  selfId,
  hostId,
  isConnected,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onSetBet,
  onNextRound,
  onLeave,
}: GameTableViewProps) {
  const safePlayers = Array.isArray(players) ? players : [];
  const dealerHand = Array.isArray(table.dealerHand) ? table.dealerHand : [];
  const results = Array.isArray(table.results) ? table.results : [];
  const me = safePlayers.find((player) => player.id === selfId);
  const myHands = me?.hands ?? [];
  const myActiveHand = myHands[me?.activeHandIndex ?? 0];
  const isHost = hostId === selfId;
  const isTurn = table.currentTurnPlayerId === selfId;
  const roundFinished = table.phase === "round_over";
  const hasNaturalBlackjack =
    Boolean(myActiveHand) && (myActiveHand?.cards.length ?? 0) === 2 && handValue(myActiveHand?.cards ?? []) === 21 && !myActiveHand?.fromSplit;
  const canAct =
    isTurn &&
    table.phase === "in_round" &&
    Boolean(myActiveHand) &&
    !myActiveHand?.busted &&
    !myActiveHand?.standing &&
    !hasNaturalBlackjack;
  const canActOnline = isConnected && canAct;
  const canDouble = canActOnline && (myActiveHand?.cards.length ?? 0) === 2 && (me?.chips ?? 0) >= (myActiveHand?.bet ?? 0);
  const canSplit =
    canActOnline &&
    myHands.length === 1 &&
    (myActiveHand?.cards.length ?? 0) === 2 &&
    (me?.chips ?? 0) >= (myActiveHand?.bet ?? 0) &&
    rankValue(myActiveHand?.cards[0]?.rank ?? "0") === rankValue(myActiveHand?.cards[1]?.rank ?? "1");
  const playersWhoMustBet = safePlayers.filter((player) => player.connected && player.chips >= MIN_BET);
  const allRequiredBetsValid = playersWhoMustBet.every(
    (player) => Number.isInteger(player.bet) && player.bet >= MIN_BET && player.bet <= MAX_BET && player.bet <= player.chips,
  );
  const [betInput, setBetInput] = useState(String(me?.bet ?? MIN_BET));
  const dealerCards =
    roundFinished || dealerHand.length < 2
      ? dealerHand
      : ([{ ...dealerHand[0] }, { ...dealerHand[1], hidden: true }] as Array<Card & { hidden?: boolean }>);
  const dealerScore = roundFinished ? handValue(dealerHand) : handValue(dealerHand.slice(0, 1));
  const resultByHand = useMemo(
    () => new Map(results.map((result) => [`${result.playerId}:${result.handIndex}`, result])),
    [results],
  );

  const rounds = me?.stats?.rounds ?? 0;
  const wins = me?.stats?.wins ?? 0;
  const losses = me?.stats?.losses ?? 0;
  const pushes = me?.stats?.pushes ?? 0;
  const winRate = rounds > 0 ? ((wins / rounds) * 100).toFixed(1) : "0.0";

  useEffect(() => {
    setBetInput(String(me?.bet ?? MIN_BET));
  }, [me?.bet]);

  const applyBet = () => {
    const parsed = Number.parseInt(betInput, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const maxAllowed = Math.min(MAX_BET, me?.chips ?? MAX_BET);
    const normalized = Math.max(MIN_BET, Math.min(maxAllowed, parsed));
    onSetBet(normalized);
  };

  return (
    <section className="glass-panel animate-fadeInUp overflow-hidden p-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/35 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🂡</span>
          <h2 className="text-lg font-bold">Round {table.round}</h2>
          <Badge tone="warn">{lobbyCode}</Badge>
          {roundFinished ? <Badge tone="ok">Round Finished</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          {isHost && roundFinished ? (
            <Button variant="primary" onClick={onNextRound} disabled={!isConnected || !allRequiredBetsValid}>
              Next Round
            </Button>
          ) : null}
          <Button variant="danger" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </header>

      <div className="table-felt p-3 sm:p-4">
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">Dealer Hand</p>
            <Badge tone="default">Score: {dealerScore}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {dealerCards.map((card, index) => (
              <PlayingCard key={`${card.rank}${card.suit}${index}`} card={card} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {safePlayers.map((player) => {
            const playerHands = Array.isArray(player.hands) ? player.hands : [];
            const activeTurn = table.currentTurnPlayerId === player.id && !roundFinished;

            return (
              <article
                key={player.id}
                className={`rounded-xl border p-3 transition-all ${
                  activeTurn ? "animate-pulseBorder player-glow border-yellow-500/60 bg-yellow-900/20" : "border-white/10 bg-black/35"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">
                    {player.name}
                    {player.id === selfId ? <span className="ml-1 text-xs text-yellow-300/80">(you)</span> : null}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {player.id === hostId ? <Badge tone="warn">Host</Badge> : null}
                    {player.isBot ? <Badge tone="default">Bot</Badge> : null}
                    {activeTurn ? <Badge tone="ok">Turn</Badge> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {playerHands.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs text-slate-400">No hand in this round</div>
                  ) : (
                    playerHands.map((hand, handIndex) => {
                      const handCards = Array.isArray(hand.cards) ? hand.cards : [];
                      const playerScore = handValue(handCards);
                      const handResult = resultByHand.get(`${player.id}:${handIndex}`);
                      const isActiveHand = activeTurn && player.activeHandIndex === handIndex;

                      return (
                        <div
                          key={`${player.id}-hand-${handIndex}`}
                          className={`rounded-lg border px-2 py-2 ${isActiveHand ? "border-yellow-500/40 bg-yellow-900/10" : "border-white/10 bg-black/25"}`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={isActiveHand ? "warn" : "default"}>Hand {handIndex + 1}</Badge>
                            {hand.doubled ? <Badge tone="warn">Doubled</Badge> : null}
                            {hand.busted ? <Badge tone="danger">Busted</Badge> : null}
                            {hand.standing ? <Badge tone="default">Stood</Badge> : null}
                            {handResult ? (
                              <Badge tone={handResult.outcome === "win" ? "ok" : handResult.outcome === "push" ? "default" : "danger"}>
                                {handResult.blackjack ? "BLACKJACK" : handResult.outcome.toUpperCase()}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {handCards.map((card, index) => (
                              <PlayingCard key={`${player.id}-${handIndex}-${index}-${card.rank}${card.suit}`} card={card} className="h-20 w-14" />
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <div className="rounded-lg border border-white/15 bg-black/35 px-2 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Score</p>
                              <p className="mt-0.5 text-base font-bold leading-none text-slate-100 sm:text-lg">{playerScore}</p>
                            </div>
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/25 px-2 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-yellow-200/80">Bet</p>
                              <p className="mt-0.5 text-base font-bold leading-none text-yellow-100 sm:text-lg">{hand.bet || 0}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-200/80">Chips</p>
                              <p className="mt-0.5 text-base font-bold leading-none text-emerald-100 sm:text-lg">{player.chips}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/30 px-4 py-3">
        <Button variant="success" onClick={onHit} disabled={!canActOnline}>
          Hit
        </Button>
        <Button variant="ghost" onClick={onStand} disabled={!canActOnline}>
          Stand
        </Button>
        <Button variant="ghost" onClick={onDouble} disabled={!canDouble}>
          Double
        </Button>
        <Button variant="ghost" onClick={onSplit} disabled={!canSplit}>
          Split
        </Button>
        {!roundFinished && isTurn && isConnected ? (
          <p className="self-center text-xs text-slate-300">Your turn{typeof table.currentTurnHandIndex === "number" ? ` (Hand ${table.currentTurnHandIndex + 1})` : ""}</p>
        ) : null}
        {!isConnected ? <p className="self-center text-xs text-red-300">Offline: actions paused until reconnected</p> : null}
        {!isTurn && !roundFinished ? <p className="self-center text-xs text-slate-400">Waiting for other player</p> : null}
        {table.phase === "round_over" ? <p className="self-center text-xs text-slate-300">Round complete</p> : null}
      </div>

      {me && !me.isBot ? (
        <div className="border-t border-white/10 bg-black/25 px-4 py-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-2">
              <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-slate-400">Rounds</p>
                <p className="text-base font-bold text-slate-100">{rounds}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-emerald-500/35 bg-emerald-900/20 px-2 py-2">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-emerald-300">Wins</p>
                <p className="text-base font-bold text-emerald-100">{wins}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-red-500/35 bg-red-900/20 px-2 py-2">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-red-300">Losses</p>
                <p className="text-base font-bold text-red-100">{losses}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-yellow-500/35 bg-yellow-900/20 px-2 py-2">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-yellow-300">Pushes</p>
                <p className="text-base font-bold text-yellow-100">{pushes}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-slate-400">Win Rate</p>
                <p className="text-base font-bold text-slate-100">{winRate}%</p>
              </div>
            </div>

            {roundFinished ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_auto] sm:items-center xl:w-auto">
                <Input
                  type="number"
                  min={MIN_BET}
                  max={Math.max(MIN_BET, Math.min(MAX_BET, me.chips))}
                  step={1}
                  value={betInput}
                  onChange={(event) => setBetInput(event.target.value)}
                  className="w-full sm:w-40"
                />
                <Button variant="ghost" onClick={applyBet} disabled={!isConnected || me.chips < MIN_BET}>
                  Set Next Bet
                </Button>
                <p className="text-xs text-white/55 sm:col-span-2 xl:max-w-[24rem]">
                  Next-round bet limits: {MIN_BET}-{Math.max(MIN_BET, Math.min(MAX_BET, me.chips))} (chips: {me.chips})
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
