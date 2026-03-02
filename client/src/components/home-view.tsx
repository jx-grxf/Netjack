import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionStatus } from "@/types/game";

interface HomeViewProps {
  playerName: string;
  lobbyCode: string;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  onPlayerNameChange: (value: string) => void;
  onLobbyCodeChange: (value: string) => void;
  onCreate: () => void;
  onCreateBotGame: () => void;
  onJoin: () => void;
}

export function HomeView({
  playerName,
  lobbyCode,
  connectionStatus,
  loading,
  onPlayerNameChange,
  onLobbyCodeChange,
  onCreate,
  onCreateBotGame,
  onJoin,
}: HomeViewProps) {
  const isConnected = connectionStatus === "connected";

  return (
    <main className="min-h-[calc(100vh-56px)]">
      <div className="relative mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-5xl items-center px-4 py-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[12%] top-[18%] h-64 w-64 rounded-full bg-emerald-900/20 blur-3xl" />
          <div className="absolute bottom-[12%] right-[10%] h-72 w-72 rounded-full bg-yellow-900/10 blur-3xl" />
        </div>

        <div className="relative z-10 w-full">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 table-felt shadow-2xl">
              <span className="text-4xl">🂡</span>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">LAN Blackjack</p>
            <h1 className="title-gradient mt-2 text-5xl font-black tracking-tight">Table Ready</h1>
            <p className="mt-2 max-w-lg text-sm text-white/50">
              Create a private table or join with a 6-character code.
            </p>
            <div
              className={`mt-4 rounded-full border px-3 py-1.5 text-xs ${
                isConnected
                  ? "border-emerald-500/35 bg-emerald-900/30 text-emerald-300"
                  : "border-red-500/35 bg-red-900/25 text-red-300"
              }`}
            >
              {isConnected ? "Connected to server" : "Connecting to server"}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <section className="glass-panel animate-fadeInUp p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/35 text-xl">🎰</div>
                <div>
                  <h2 className="text-lg font-bold text-white">New Lobby</h2>
                  <p className="text-xs text-white/45">Host your own table</p>
                </div>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-300">Your Name</span>
                <Input
                  value={playerName}
                  onChange={(event) => onPlayerNameChange(event.target.value)}
                  maxLength={20}
                  placeholder="e.g. CasinoKing"
                />
              </label>
              <Button onClick={onCreate} disabled={!isConnected || loading || !playerName.trim()} className="mt-4 w-full">
                Create Lobby
              </Button>
            </section>

            <section className="glass-panel animate-fadeInUp p-6 [animation-delay:80ms] shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700/30 text-xl">🎴</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Join Lobby</h2>
                  <p className="text-xs text-white/45">Use a host code</p>
                </div>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-300">Lobby Code</span>
                <Input
                  value={lobbyCode}
                  onChange={(event) => onLobbyCodeChange(event.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                />
              </label>
              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={onJoin}
                disabled={!isConnected || loading || !playerName.trim() || lobbyCode.trim().length !== 6}
              >
                Join Lobby
              </Button>

              {!isConnected ? (
                <p className="mt-4 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                  Waiting for socket connection before matchmaking.
                </p>
              ) : null}
            </section>

            <section className="glass-panel animate-fadeInUp p-6 [animation-delay:160ms] shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700/30 text-xl">🤖</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Play vs Bot</h2>
                  <p className="text-xs text-white/45">Start solo instantly</p>
                </div>
              </div>

              <p className="text-xs text-white/55">
                Creates a private game with one AI opponent. The bot hits below 17 and stands on 17+.
              </p>
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={onCreateBotGame}
                disabled={!isConnected || loading || !playerName.trim()}
              >
                Play vs Bot
              </Button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
