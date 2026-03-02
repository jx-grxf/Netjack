import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "@/types/game";

const toneByStatus: Record<ConnectionStatus, "default" | "ok" | "warn" | "danger"> = {
  connected: "ok",
  connecting: "warn",
  disconnected: "danger",
};

export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  return <Badge tone={toneByStatus[status]}>{status.toUpperCase()}</Badge>;
}
