import { useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { StopArrival } from "@/lib/bus-realtime-client";

type Alarm = { line: string | "any"; minutes: number };

function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch {
    /* ignore */
  }
}

export function ArrivalAlarm({
  arrivals,
  stopName,
  availableLines,
}: {
  arrivals: StopArrival[];
  stopName: string;
  availableLines: string[];
}) {
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const [line, setLine] = useState<string>("any");
  const [minutes, setMinutes] = useState<number>(5);
  const triggered = useRef(false);

  useEffect(() => {
    triggered.current = false;
  }, [alarm]);

  useEffect(() => {
    if (!alarm || triggered.current) return;
    const match = arrivals.find(
      (a) =>
        (alarm.line === "any" || a.line === alarm.line) && a.etaMin <= alarm.minutes,
    );
    if (!match) return;
    triggered.current = true;
    beep();
    const title = `Bus L${match.line} a ${match.etaMin} min`;
    const body = `${stopName} → ${match.destination}`;
    if (permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        /* ignore */
      }
    }
    toast(title, { description: body });
    setAlarm(null);
  }, [arrivals, alarm, permission, stopName]);

  const enable = async () => {
    let perm = permission;
    if (typeof Notification !== "undefined" && perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    setAlarm({ line, minutes });
    toast.success(
      line === "any"
        ? `Aviso activo: cualquier bus a ${minutes} min`
        : `Aviso activo: línea ${line} a ${minutes} min`,
    );
  };

  if (alarm) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <span>
            Aviso {alarm.line === "any" ? "cualquier línea" : `L${alarm.line}`} ≤ {alarm.minutes} min
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAlarm(null)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Bell className="h-3.5 w-3.5" /> Avísame
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={line} onValueChange={setLine}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Cualquiera</SelectItem>
            {availableLines.map((l) => (
              <SelectItem key={l} value={l}>
                Línea {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 5, 7, 10].map((m) => (
              <SelectItem key={m} value={String(m)}>
                ≤ {m} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={enable} className="ml-auto h-8">
          Activar
        </Button>
      </div>
      {permission === "denied" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Las notificaciones del navegador están bloqueadas. Te avisaremos con sonido y un toast.
        </p>
      )}
    </div>
  );
}
