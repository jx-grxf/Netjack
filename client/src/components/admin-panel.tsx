import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/utils";
import type { AdminStats } from "@/types/game";

const ADMIN_API_URL =
  import.meta.env.VITE_ADMIN_API_URL ??
  `${window.location.protocol}//${window.location.hostname}:3001/admin/stats`;
const ADMIN_UI_ENABLED = import.meta.env.VITE_ENABLE_ADMIN_UI === "true";

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function toBasicAuth(username: string, password: string): string {
  return `Basic ${toBase64Utf8(`${username}:${password}`)}`;
}

export function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authHeader, setAuthHeader] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!ADMIN_UI_ENABLED) {
    return null;
  }

  const isAuthenticated = Boolean(authHeader);

  const fetchStats = async (headerOverride?: string) => {
    const header = headerOverride ?? authHeader;
    if (!header) return;

    setLoading(true);
    try {
      const response = await fetch(ADMIN_API_URL, {
        headers: {
          Authorization: header,
        },
      });

      if (response.status === 401) {
        setAuthHeader(null);
        setStats(null);
        setError("Unauthorized");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AdminStats;
      setStats(payload);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !authHeader) return;

    fetchStats();
    const timer = window.setInterval(() => {
      fetchStats();
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open, authHeader]);

  const onLogin = async () => {
    const header = toBasicAuth(username.trim(), password);
    setAuthHeader(header);
    await fetchStats(header);
  };

  const onLogout = () => {
    setAuthHeader(null);
    setStats(null);
    setPassword("");
    setError("");
  };

  const content = useMemo(() => {
    if (!isAuthenticated) {
      return (
        <div className="space-y-3">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
          />
          <Button onClick={onLogin} className="w-full">
            Login
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
            <p className="text-slate-400">Sockets</p>
            <p className="text-sm font-semibold text-slate-100">{stats?.connectedSockets ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
            <p className="text-slate-400">Lobbies</p>
            <p className="text-sm font-semibold text-slate-100">{stats?.activeLobbies ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
            <p className="text-slate-400">Players</p>
            <p className="text-sm font-semibold text-slate-100">{stats?.activePlayers ?? 0}</p>
          </div>
        </div>

        <div className="subtle-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
          {(stats?.players ?? []).map((player) => (
            <article key={player.socketId} className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-xs">
              <p className="font-semibold text-slate-100">{player.name}</p>
              <p className="text-slate-300">Lobby: {player.lobbyCode}</p>
              <p className="text-slate-300">IP: {player.ip}</p>
              <p className="text-slate-300">Spielzeit: {player.playSeconds}s</p>
              <p className="text-slate-300">
                Ready: {player.ready ? "Yes" : "No"} | Chips: {player.chips}
              </p>
              <p className="text-slate-400">Joined: {formatTime(player.joinedAt)}</p>
            </article>
          ))}
          {(stats?.players.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400">No active players.</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => fetchStats()} disabled={loading} className="flex-1">
            Refresh
          </Button>
          <Button variant="danger" onClick={onLogout} className="flex-1">
            Logout
          </Button>
        </div>
      </div>
    );
  }, [isAuthenticated, loading, onLogin, password, stats, username]);

  return (
    <>
      <Button variant="ghost" className="h-9" onClick={() => setOpen((prev) => !prev)}>
        Admin
      </Button>
      {open ? (
        <div className="absolute right-3 top-16 z-40 w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-black/85 p-3 shadow-glow backdrop-blur-xl sm:right-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Admin Panel</p>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-100"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          {error ? <p className="mb-2 text-xs text-accent-red">{error}</p> : null}
          {content}
        </div>
      ) : null}
    </>
  );
}
