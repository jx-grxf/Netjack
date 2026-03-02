import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/types/game";

interface ChatPanelProps {
  selfId: string;
  messages: ChatMessage[];
  onSend: (message: string) => void;
}

const MAX_MESSAGE = 220;

export function ChatPanel({ selfId, messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const trimmed = useMemo(() => draft.trim(), [draft]);

  const submit = () => {
    if (!trimmed || trimmed.length > MAX_MESSAGE) {
      return;
    }
    onSend(trimmed);
    setDraft("");
  };

  return (
    <section className="glass-panel flex min-h-[280px] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">Chat</h3>
        <span className="text-xs text-slate-400">{messages.length} messages</span>
      </div>

      <div ref={listRef} className="subtle-scrollbar flex max-h-72 flex-1 flex-col gap-2 overflow-y-auto p-3 pr-2">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-400">No messages yet.</div>
        ) : null}

        {messages.map((message) => {
          const isSelf = message.playerId === selfId;
          return (
            <article key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  isSelf
                    ? "rounded-br-sm bg-accent-cyan/20 text-slate-100"
                    : "rounded-bl-sm border border-white/10 bg-slate-900/70 text-slate-200"
                }`}
              >
                {!isSelf ? <p className="mb-1 text-[11px] font-semibold text-accent-cyan">{message.playerName}</p> : null}
                <p className="break-words">{message.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{formatTime(message.timestamp)}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-black/25 px-3 py-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          maxLength={MAX_MESSAGE}
          placeholder="Write a message"
        />
        <Button variant="ghost" onClick={submit} disabled={!trimmed || trimmed.length > MAX_MESSAGE}>
          Send
        </Button>
      </div>
      <p className="px-3 pb-3 text-right text-[11px] text-slate-500">{draft.length}/{MAX_MESSAGE}</p>
    </section>
  );
}
