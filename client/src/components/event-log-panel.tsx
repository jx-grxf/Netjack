import { formatTime } from "@/lib/utils";
import type { EventLogItem } from "@/types/game";

const toneByType: Record<string, string> = {
  info: "text-slate-200",
  action: "text-accent-cyan",
  system: "text-accent-green",
  error: "text-accent-red",
  lobby: "text-accent-cyan",
  ready: "text-accent-amber",
  game: "text-accent-green",
  result: "text-slate-100",
};

export function EventLogPanel({ logs }: { logs: EventLogItem[] }) {
  return (
    <section className="glass-panel min-h-[250px] overflow-hidden p-0">
      <div className="border-b border-white/10 bg-black/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">Event Log</h3>
      </div>
      <div className="subtle-scrollbar max-h-72 space-y-2 overflow-y-auto p-3 pr-2">
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-400">No game events yet.</div>
        ) : null}
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-white/10 bg-black/35 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-xs font-medium ${toneByType[log.type] ?? "text-slate-200"}`}>{log.message}</p>
              <p className="shrink-0 text-[10px] text-slate-500">{formatTime(log.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
