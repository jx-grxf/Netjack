import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel } from "@/components/admin-panel";
import { ChatPanel } from "@/components/chat-panel";
import { ConnectionPill } from "@/components/connection-pill";
import { EventLogPanel } from "@/components/event-log-panel";
import { GameTableView } from "@/components/game-table-view";
import { HomeView } from "@/components/home-view";
import { LobbyView } from "@/components/lobby-view";
import { ToastViewport } from "@/components/toast-viewport";
import { useToast } from "@/hooks/use-toast";
import { ensureConnected, socket, type ClientToServerEvents } from "@/lib/socket";
import type { Card, ChatMessage, ConnectionStatus, EventLogItem, GameState, LobbyState, PlayerState } from "@/types/game";

function safeId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeLog(message: string, type: EventLogItem["type"] = "info"): EventLogItem {
  return {
    id: safeId(),
    message,
    type,
    timestamp: Date.now(),
  };
}

const ACTION_TIMEOUT_MS = 10_000;

type PendingAction = "create" | "createBot" | "join" | "start";

function normalizeChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.filter((item): item is ChatMessage => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Partial<ChatMessage>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.playerId === "string" &&
      typeof candidate.playerName === "string" &&
      typeof candidate.message === "string" &&
      typeof candidate.timestamp === "number"
    );
  });
}

function normalizeEventLog(logs: unknown): EventLogItem[] {
  if (!Array.isArray(logs)) {
    return [];
  }
  return logs.filter((item): item is EventLogItem => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Partial<EventLogItem>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.message === "string" &&
      typeof candidate.type === "string" &&
      typeof candidate.timestamp === "number"
    );
  });
}

function normalizeGameState(game: unknown): GameState | undefined {
  if (!game || typeof game !== "object") {
    return undefined;
  }
  const candidate = game as Partial<GameState>;
  if (candidate.phase !== "waiting" && candidate.phase !== "in_round" && candidate.phase !== "round_over") {
    return undefined;
  }
  if (
    typeof candidate.round !== "number" ||
    !Array.isArray(candidate.dealerHand) ||
    !Array.isArray(candidate.deck) ||
    !Array.isArray(candidate.results)
  ) {
    return undefined;
  }
  return {
    phase: candidate.phase,
    round: candidate.round,
    dealerHand: candidate.dealerHand,
    deck: candidate.deck,
    currentTurnPlayerId: typeof candidate.currentTurnPlayerId === "string" ? candidate.currentTurnPlayerId : null,
    currentTurnHandIndex:
      typeof candidate.currentTurnHandIndex === "number" ? candidate.currentTurnHandIndex : null,
    results: candidate.results,
  };
}

function normalizePlayers(players: unknown): PlayerState[] {
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .map((item): PlayerState | undefined => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const candidate = item as Partial<PlayerState>;
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
        return undefined;
      }

      return {
        id: candidate.id,
        name: candidate.name,
        isBot: Boolean(candidate.isBot),
        ready: Boolean(candidate.ready),
        chips: typeof candidate.chips === "number" ? candidate.chips : 0,
        bet: typeof candidate.bet === "number" ? candidate.bet : 0,
        hands: Array.isArray(candidate.hands)
          ? candidate.hands
              .filter((hand) => hand && typeof hand === "object")
              .map((hand) => {
                const next = hand as {
                  cards?: unknown[];
                  bet?: number;
                  standing?: boolean;
                  busted?: boolean;
                  doubled?: boolean;
                  fromSplit?: boolean;
                };
                return {
                  cards: Array.isArray(next.cards)
                    ? next.cards
                        .filter((card): card is Card => {
                          if (!card || typeof card !== "object") {
                            return false;
                          }
                          const candidate = card as Partial<Card>;
                          return typeof candidate.rank === "string" && typeof candidate.suit === "string";
                        })
                    : [],
                  bet: typeof next.bet === "number" ? next.bet : 0,
                  standing: Boolean(next.standing),
                  busted: Boolean(next.busted),
                  doubled: Boolean(next.doubled),
                  fromSplit: Boolean(next.fromSplit),
                };
              })
          : [],
        activeHandIndex: typeof candidate.activeHandIndex === "number" ? candidate.activeHandIndex : 0,
        stats:
          candidate.stats && typeof candidate.stats === "object"
            ? {
                rounds:
                  typeof (candidate.stats as { rounds?: number }).rounds === "number"
                    ? (candidate.stats as { rounds: number }).rounds
                    : 0,
                wins:
                  typeof (candidate.stats as { wins?: number }).wins === "number"
                    ? (candidate.stats as { wins: number }).wins
                    : 0,
                losses:
                  typeof (candidate.stats as { losses?: number }).losses === "number"
                    ? (candidate.stats as { losses: number }).losses
                    : 0,
                pushes:
                  typeof (candidate.stats as { pushes?: number }).pushes === "number"
                    ? (candidate.stats as { pushes: number }).pushes
                    : 0,
              }
            : { rounds: 0, wins: 0, losses: 0, pushes: 0 },
        connected: candidate.connected !== false,
      };
    })
    .filter((player): player is PlayerState => Boolean(player));
}

function normalizeLobbyState(payload: unknown): LobbyState | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const candidate = payload as Partial<LobbyState>;
  if (typeof candidate.code !== "string" || typeof candidate.hostId !== "string" || !Array.isArray(candidate.players)) {
    return undefined;
  }

  const gameState = normalizeGameState(candidate.gameState);
  if (!gameState) {
    return undefined;
  }

  return {
    code: candidate.code,
    hostId: candidate.hostId,
    players: normalizePlayers(candidate.players),
    chatHistory: normalizeChatMessages(candidate.chatHistory),
    eventLog: normalizeEventLog(candidate.eventLog),
    gameState,
  };
}

export default function App() {
  const { pushToast } = useToast();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [selfId, setSelfId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [loading, setLoading] = useState(false);

  const [lobby, setLobby] = useState<LobbyState | undefined>(undefined);
  const [game, setGame] = useState<GameState | undefined>(undefined);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<EventLogItem[]>([]);
  const lastSeenGameRef = useRef<GameState | undefined>(undefined);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSocketReady = () => socket.connected && connectionStatus === "connected";

  const emitOrNotify = <K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => {
    if (!isSocketReady()) {
      pushToast({
        title: "Offline",
        message: "Action blocked while disconnected. Please reconnect first.",
        variant: "error",
      });
      setLogs((prev) => [...prev, makeLog(`Blocked ${event} while disconnected`, "warning")]);
      return false;
    }

    socket.emit(event, ...args);
    return true;
  };

  useEffect(() => {
    ensureConnected();

    const clearActionTimeout = () => {
      if (!actionTimeoutRef.current) {
        return;
      }
      clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    };

    const clearPendingAction = () => {
      pendingActionRef.current = null;
      clearActionTimeout();
      setLoading(false);
    };

    const onConnect = () => {
      setConnectionStatus("connected");
      setSelfId(socket.id ?? "");
    };

    const onDisconnect = () => {
      setConnectionStatus("disconnected");
      clearPendingAction();
    };

    const onConnectError = () => {
      setConnectionStatus("disconnected");
      clearPendingAction();
      pushToast({ title: "Connection failed", message: "Server is unreachable.", variant: "error" });
    };

    const syncLobby = (payload: unknown) => {
      const nextLobby = normalizeLobbyState(payload);
      if (!nextLobby) {
        setLoading(false);
        setLogs((prev) => [...prev, makeLog("Received invalid lobby payload from server", "error")]);
        return false;
      }

      setLobby(nextLobby);
      setGame(nextLobby.gameState);
      lastSeenGameRef.current = nextLobby.gameState;
      setChat(nextLobby.chatHistory);
      setLogs(nextLobby.eventLog);
      return true;
    };

    const onLobbyJoined = (payload: LobbyState) => {
      const synced = syncLobby(payload);
      if (!synced) {
        return;
      }
      clearPendingAction();
      setLogs((prev) => [...prev, makeLog(`Joined lobby ${payload.code}`, "system")]);
    };

    const onLobbyUpdated = (payload: LobbyState) => {
      const synced = syncLobby(payload);
      if (!synced) {
        return;
      }

      if (pendingActionRef.current === "start" && payload.gameState.phase !== "waiting") {
        clearPendingAction();
      }
    };

    const onGameState = (payload: GameState) => {
      const nextGame = normalizeGameState(payload);
      if (!nextGame) {
        setLogs((prev) => [...prev, makeLog("Received invalid game payload from server", "error")]);
        return;
      }

      setGame(nextGame);
      setLobby((prev) => (prev ? { ...prev, gameState: nextGame } : prev));
      const previousGame = lastSeenGameRef.current;
      const startedNewRound =
        nextGame.phase === "in_round" &&
        (!previousGame || previousGame.phase !== "in_round" || previousGame.round !== nextGame.round);
      if (startedNewRound) {
        setLogs((prev) => [...prev, makeLog(`Round ${nextGame.round} started`, "system")]);
      }
      if (pendingActionRef.current === "start" && nextGame.phase !== "waiting") {
        clearPendingAction();
      }
      lastSeenGameRef.current = nextGame;
    };

    const onChat = (message: ChatMessage) => {
      const next = normalizeChatMessages([message]);
      if (next.length === 0) {
        return;
      }
      setChat((prev) => [...prev, next[0]]);
    };

    const onErrorEvent = (payload: { message: string }) => {
      clearPendingAction();
      pushToast({ title: "Action failed", message: payload.message, variant: "error" });
      setLogs((prev) => [...prev, makeLog(payload.message, "error")]);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("lobby:joined", onLobbyJoined);
    socket.on("lobby:update", onLobbyUpdated);
    socket.on("game:state", onGameState);
    socket.on("chat:new", onChat);
    socket.on("error", onErrorEvent);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("lobby:joined", onLobbyJoined);
      socket.off("lobby:update", onLobbyUpdated);
      socket.off("game:state", onGameState);
      socket.off("chat:new", onChat);
      socket.off("error", onErrorEvent);
      clearActionTimeout();
    };
  }, [pushToast]);

  const screen = useMemo<"home" | "lobby" | "game">(() => {
    if (game && game.phase !== "waiting") {
      return "game";
    }
    if (lobby) {
      return "lobby";
    }
    return "home";
  }, [game, lobby]);

  const validateName = () => {
    const value = playerName.trim();
    if (!value || value.length < 2) {
      pushToast({ title: "Invalid name", message: "Use at least 2 characters.", variant: "error" });
      return "";
    }
    return value;
  };

  const beginPendingAction = (action: PendingAction) => {
    pendingActionRef.current = action;
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }
    setLoading(true);
    actionTimeoutRef.current = setTimeout(() => {
      if (pendingActionRef.current !== action) {
        return;
      }
      pendingActionRef.current = null;
      actionTimeoutRef.current = null;
      setLoading(false);
      pushToast({
        title: "Request timed out",
        message: "No server response. Please try again.",
        variant: "error",
      });
      setLogs((prev) => [...prev, makeLog(`${action} request timed out`, "error")]);
    }, ACTION_TIMEOUT_MS);
  };

  const createLobby = () => {
    const name = validateName();
    if (!name) {
      return;
    }

    if (!socket.connected) {
      ensureConnected();
    }
    if (emitOrNotify("lobby:create", { name })) {
      beginPendingAction("create");
    }
  };

  const createBotGame = () => {
    const name = validateName();
    if (!name) {
      return;
    }

    if (!socket.connected) {
      ensureConnected();
    }
    if (emitOrNotify("lobby:createBot", { name })) {
      beginPendingAction("createBot");
    }
  };

  const joinLobby = () => {
    const name = validateName();
    if (!name) {
      return;
    }

    const code = lobbyCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      pushToast({ title: "Lobby code required", message: "Use a valid code.", variant: "error" });
      return;
    }

    if (!socket.connected) {
      ensureConnected();
    }
    if (emitOrNotify("lobby:join", { name, code })) {
      beginPendingAction("join");
    }
  };

  const startGame = () => {
    if (!socket.connected) {
      ensureConnected();
    }
    if (emitOrNotify("lobby:start")) {
      beginPendingAction("start");
    }
  };

  const leaveLobby = () => {
    pendingActionRef.current = null;
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    }
    setLoading(false);
    emitOrNotify("lobby:leave");
    setLobby(undefined);
    setGame(undefined);
    setChat([]);
    setLogs((prev) => [...prev, makeLog("Left lobby", "system")]);
  };

  const outOfSyncState =
    (screen === "lobby" && !lobby) || (screen === "game" && (!lobby || !game));

  const layout =
    screen === "home" ? (
      <HomeView
        playerName={playerName}
        lobbyCode={lobbyCode}
        connectionStatus={connectionStatus}
        loading={loading}
        onPlayerNameChange={setPlayerName}
        onLobbyCodeChange={setLobbyCode}
        onCreate={createLobby}
        onCreateBotGame={createBotGame}
        onJoin={joinLobby}
      />
    ) : outOfSyncState ? (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5">
        <section className="glass-panel animate-fadeInUp space-y-3 p-5">
          <h2 className="text-lg font-bold text-white">Reconnecting game state…</h2>
          <p className="text-sm text-slate-300">
            The latest lobby/game event was incomplete. You can retry from home without reloading the page.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
              onClick={leaveLobby}
            >
              Return Home
            </button>
          </div>
        </section>
      </main>
    ) : (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr] lg:gap-4">
          {screen === "lobby" && lobby ? (
            <LobbyView
              lobby={lobby}
              selfId={selfId}
              loading={loading}
              onToggleReady={(ready) => emitOrNotify("lobby:ready", { ready })}
              onSetBet={(amount) => emitOrNotify("game:setBet", { amount })}
              onStartGame={startGame}
              onLeave={leaveLobby}
            />
          ) : null}
          {screen === "game" && game ? (
            <GameTableView
              lobbyCode={lobby?.code ?? ""}
              players={lobby?.players ?? []}
              table={game}
              selfId={selfId}
              hostId={lobby?.hostId ?? ""}
              onHit={() => emitOrNotify("game:hit")}
              onStand={() => emitOrNotify("game:stand")}
              onDouble={() => emitOrNotify("game:double")}
              onSplit={() => emitOrNotify("game:split")}
              onSetBet={(amount) => emitOrNotify("game:setBet", { amount })}
              onNextRound={() => emitOrNotify("game:nextRound")}
              onLeave={leaveLobby}
            />
          ) : null}

          <div className="grid gap-3 lg:grid-rows-[1fr_1fr]">
            <ChatPanel
              selfId={selfId}
              messages={chat}
              onSend={(message) => {
                if (!message.trim()) {
                  return;
                }
                emitOrNotify("chat:send", { message });
              }}
            />
            <EventLogPanel logs={logs} />
          </div>
        </div>
      </main>
    );

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-accent-cyan" />
            <p className="text-sm font-semibold tracking-wide text-slate-100">Netjack</p>
          </div>
          <div className="relative flex items-center gap-2">
            <ConnectionPill status={connectionStatus} />
            <AdminPanel />
          </div>
        </div>
      </header>
      {layout}
      <ToastViewport />
    </div>
  );
}
