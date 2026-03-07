import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LobbyState } from "@/types/game";

const MIN_BET = 10;
const MAX_BET = 500;

interface LobbyViewProps {
  lobby: LobbyState;
  selfId: string;
  isConnected: boolean;
  loading: boolean;
  onToggleReady: (ready: boolean) => void;
  onSetBet: (amount: number) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export function LobbyView({ lobby, selfId, isConnected, loading, onToggleReady, onSetBet, onStartGame, onLeave }: LobbyViewProps) {
  const players = Array.isArray(lobby.players) ? lobby.players : [];
  const me = players.find((player) => player.id === selfId);
  const isHost = lobby.hostId === selfId;
  const readyPlayers = players.filter((player) => player.connected);
  const playersWhoMustBet = readyPlayers.filter((player) => player.chips >= MIN_BET);
  const allRequiredBetsValid = playersWhoMustBet.every(
    (player) => Number.isInteger(player.bet) && player.bet >= MIN_BET && player.bet <= MAX_BET && player.bet <= player.chips,
  );
  const canStart =
    isConnected && isHost && readyPlayers.length > 1 && readyPlayers.every((player) => player.ready) && allRequiredBetsValid;
  const readyCount = players.filter((player) => player.ready).length;
  const [betInput, setBetInput] = useState(String(me?.bet ?? MIN_BET));

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
    <section className="glass-panel animate-fadeInUp p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🂡</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Lobby Code</p>
            <h2 className="font-mono text-2xl font-black tracking-widest text-yellow-300">{lobby.code}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 text-right text-xs text-white/45">
            <p>
              {players.length} players
            </p>
            <p>
              {readyCount} ready
            </p>
          </div>
          <Button
            variant={me?.ready ? "ghost" : "success"}
            onClick={() => onToggleReady(!Boolean(me?.ready))}
            disabled={!isConnected}
          >
            {me?.ready ? "Unready" : "Ready"}
          </Button>
          {isHost ? (
            <Button variant="primary" onClick={onStartGame} disabled={loading || !canStart}>
              {loading ? "Starting..." : "Start Game"}
            </Button>
          ) : null}
          <Button variant="danger" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {players.map((player) => (
          <article
            key={player.id}
            className={`rounded-xl border px-3 py-3 transition-all ${
              player.id === selfId
                ? "player-glow border-yellow-500/40 bg-yellow-900/20"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-100">
                {player.name}
                {player.id === selfId ? <span className="ml-1 text-xs text-yellow-300/80">(you)</span> : null}
              </p>
              <div className="flex items-center gap-1.5">
                {player.id === lobby.hostId ? <Badge tone="warn">Host</Badge> : null}
                {player.isBot ? <Badge tone="default">Bot</Badge> : null}
                <Badge tone={player.ready ? "ok" : "default"}>{player.ready ? "Ready" : "Waiting"}</Badge>
                {!player.connected ? <Badge tone="danger">Offline</Badge> : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">Chips: {player.chips}</p>
            <p className="mt-1 text-xs text-slate-400">Bet: {player.bet || 0}</p>
          </article>
        ))}
      </div>

      {me && !me.isBot ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Your Bet</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={MIN_BET}
              max={Math.max(MIN_BET, Math.min(MAX_BET, me.chips))}
              step={1}
              value={betInput}
              onChange={(event) => setBetInput(event.target.value)}
              className="w-40"
            />
            <Button
              variant="ghost"
              onClick={applyBet}
              disabled={!isConnected || me.chips < MIN_BET}
            >
              Set Bet
            </Button>
            <p className="text-xs text-white/55">
              Limits: {MIN_BET}-{Math.max(MIN_BET, Math.min(MAX_BET, me.chips))} (chips: {me.chips})
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">How To Play</h3>
        {!isConnected ? (
          <p className="mb-2 rounded-md border border-red-500/35 bg-red-900/25 px-2 py-1 text-xs text-red-300">
            You are offline. Reconnect to change ready state, bets, or start the game.
          </p>
        ) : null}
        <ul className="space-y-1 text-xs text-white/50">
          <li>All players ready up, then host starts the round.</li>
          <li>Hit or stand to get close to 21 without busting.</li>
          <li>Dealer resolves the table after all turns complete.</li>
        </ul>
      </div>
    </section>
  );
}
