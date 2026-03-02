import { cn } from "@/lib/utils";
import type { Card } from "@/types/game";

const suitSymbol = {
  H: "♥",
  D: "♦",
  C: "♣",
  S: "♠",
};

export function PlayingCard({ card, className }: { card: Card & { hidden?: boolean }; className?: string }) {
  const isRed = card.suit === "H" || card.suit === "D";

  if (card.hidden) {
    return (
      <div
        className={cn(
          "h-24 w-16 rounded-lg border border-accent-cyan/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-1 shadow-lg",
          className,
        )}
      >
        <div className="h-full w-full rounded-md border border-accent-blue/25 bg-[repeating-linear-gradient(45deg,rgba(55,184,255,.18),rgba(55,184,255,.18)_3px,transparent_3px,transparent_6px)]" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-24 w-16 rounded-lg border border-white/15 bg-slate-50 p-1 text-slate-900 shadow-lg transition-transform hover:-translate-y-1",
        className,
      )}
    >
      <div className={cn("text-xs font-bold leading-none", isRed && "text-red-600")}>
        <div>{card.rank}</div>
        <div>{suitSymbol[card.suit]}</div>
      </div>
      <div className={cn("absolute inset-0 flex items-center justify-center text-xl", isRed && "text-red-600")}>
        {suitSymbol[card.suit]}
      </div>
    </div>
  );
}
