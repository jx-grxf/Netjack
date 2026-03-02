import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-gold-light to-gold text-black shadow-lg shadow-yellow-900/45 hover:from-yellow-300 hover:to-yellow-500 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-200",
  ghost: "bg-white/5 text-slate-100 hover:bg-white/10 border border-white/20",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/30",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
