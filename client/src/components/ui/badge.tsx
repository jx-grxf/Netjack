import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
  className?: string;
}

const toneClass = {
  default: "bg-white/10 text-slate-200 border-white/20",
  ok: "bg-emerald-900/40 text-emerald-300 border-emerald-500/35",
  warn: "bg-yellow-900/40 text-yellow-300 border-yellow-500/35",
  danger: "bg-red-900/40 text-red-300 border-red-500/35",
};

export function Badge({ children, tone = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}
