import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto animate-fadeInUp rounded-xl border bg-bg-panel/95 p-3 shadow-glow",
            toast.variant === "error" ? "border-accent-red/35" : "border-accent-cyan/35",
          )}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">{toast.title}</p>
              {toast.message ? <p className="mt-1 text-xs text-slate-300">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-xs text-slate-400 transition-colors hover:text-slate-100"
              aria-label="Close notification"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
