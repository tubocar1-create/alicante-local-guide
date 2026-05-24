import { MapPin, Mic, Bell, Camera } from "lucide-react";
import { usePermission, type BrowserPermission } from "@/hooks/usePermissions";

const COPY: Record<
  BrowserPermission,
  { title: string; description: string; Icon: typeof MapPin; emoji: string }
> = {
  geolocation: {
    title: "Activar ubicación",
    description: "Para mostrarte lugares cercanos, rutas y transporte en tu contexto.",
    Icon: MapPin,
    emoji: "📍",
  },
  microphone: {
    title: "Activar micrófono",
    description: "El micrófono permite hablar con el asistente.",
    Icon: Mic,
    emoji: "🎤",
  },
  notifications: {
    title: "Activar notificaciones",
    description: "Te avisamos de cambios relevantes (vuelos, citas, llegadas).",
    Icon: Bell,
    emoji: "🔔",
  },
  camera: {
    title: "Activar cámara",
    description: "Para escanear códigos QR de partners.",
    Icon: Camera,
    emoji: "📷",
  },
};

export function PermissionPrompt({
  permission,
  className,
}: {
  permission: BrowserPermission;
  className?: string;
}) {
  const { state, request, dismiss } = usePermission(permission);
  const { title, description, Icon, emoji } = COPY[permission];

  if (state === "granted" || state === "unsupported" || state === "denied") return null;

  return (
    <div
      className={
        "rounded-2xl border border-border bg-card p-4 shadow-sm " + (className ?? "")
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {emoji} {title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void request()}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
            >
              Permitir
            </button>
            <button
              onClick={dismiss}
              className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground active:scale-95"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
