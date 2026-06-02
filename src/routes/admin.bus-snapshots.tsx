// Panel admin para registrar snapshots manuales del operador y ver la
// recalibración del motor predictivo (Fase 5).
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Loader2, CheckCircle2, Clock } from "lucide-react";
import { getBusEngineSnapshot } from "@/lib/bus-predict.functions";
import {
  recordBusSnapshot,
  listRecentSnapshotEvents,
} from "@/lib/bus-snapshot-learning.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bus-snapshots")({
  head: () => ({ meta: [{ title: "Snapshots de buses · Admin" }] }),
  component: BusSnapshotsPage,
});

function BusSnapshotsPage() {
  const fetchSnapshot = useServerFn(getBusEngineSnapshot);
  const fetchEvents = useServerFn(listRecentSnapshotEvents);
  const recordFn = useServerFn(recordBusSnapshot);
  const qc = useQueryClient();

  const snapQ = useQuery({
    queryKey: ["bus-engine-snapshot-admin"],
    queryFn: () => fetchSnapshot(),
    staleTime: 5 * 60 * 1000,
  });

  const [lineCode, setLineCode] = useState<string>("");
  const [direction, setDirection] = useState<number>(1);
  const [stopCode, setStopCode] = useState<string>("");
  const [etaMin, setEtaMin] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const lines = useMemo(() => {
    const set = new Set<string>();
    (snapQ.data?.stops ?? []).forEach((s) => set.add(s.line_code));
    return Array.from(set).sort();
  }, [snapQ.data]);

  const stopsForLine = useMemo(() => {
    if (!lineCode) return [];
    return (snapQ.data?.stops ?? [])
      .filter((s) => s.line_code === lineCode && s.direction === direction && s.stop_code)
      .sort((a, b) => a.seq - b.seq);
  }, [snapQ.data, lineCode, direction]);

  const eventsQ = useQuery({
    queryKey: ["bus-snapshot-events", lineCode || "all"],
    queryFn: () => fetchEvents({ data: { lineCode: lineCode || undefined, limit: 30 } }),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!lineCode || !stopCode) throw new Error("Selecciona línea y parada");
      const etaNum = etaMin === "" ? null : Number(etaMin);
      if (etaNum != null && (!Number.isFinite(etaNum) || etaNum < 0 || etaNum > 120)) {
        throw new Error("ETA fuera de rango (0..120)");
      }
      return recordFn({
        data: {
          lineCode,
          direction,
          stopCode,
          observedEtaMinutes: etaNum,
          notes: notes || null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.updatedSegmentStats
          ? `Snapshot aplicado · segmento ${res.updatedSegmentStats.fromStop}→${res.updatedSegmentStats.toStop} ahora ${res.updatedSegmentStats.avgMinutes.toFixed(2)} min`
          : "Snapshot registrado (sin recalibración de segmento)",
      );
      setEtaMin("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["bus-snapshot-events"] });
      qc.invalidateQueries({ queryKey: ["bus-engine-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bus className="h-6 w-6" /> Snapshots manuales · Motor predictivo
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada snapshot recalibra <code>bus_segment_stats</code> mediante media móvil ponderada.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar observación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Línea</label>
            <select
              className="w-full mt-1 border rounded h-9 px-2 bg-background"
              value={lineCode}
              onChange={(e) => {
                setLineCode(e.target.value);
                setStopCode("");
              }}
            >
              <option value="">— Selecciona —</option>
              {lines.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dirección</label>
            <select
              className="w-full mt-1 border rounded h-9 px-2 bg-background"
              value={direction}
              onChange={(e) => {
                setDirection(Number(e.target.value));
                setStopCode("");
              }}
            >
              <option value={1}>1 · Ida</option>
              <option value={2}>2 · Vuelta</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Parada</label>
            <select
              className="w-full mt-1 border rounded h-9 px-2 bg-background"
              value={stopCode}
              onChange={(e) => setStopCode(e.target.value)}
              disabled={!lineCode}
            >
              <option value="">— Selecciona —</option>
              {stopsForLine.map((s) => (
                <option key={`${s.seq}-${s.stop_code}`} value={s.stop_code ?? ""}>
                  #{s.seq} · {s.stop_name} ({s.stop_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">ETA observada (min)</label>
            <Input
              inputMode="numeric"
              value={etaMin}
              onChange={(e) => setEtaMin(e.target.value)}
              placeholder="p. ej. 3"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" />
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !lineCode || !stopCode}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aplicar snapshot
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Eventos recientes {lineCode ? `· línea ${lineCode}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (eventsQ.data?.events ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos.</p>
          ) : (
            <div className="space-y-2">
              {eventsQ.data!.events.map((e) => (
                <div key={e.id} className="text-xs border rounded p-2 flex items-start gap-2">
                  {e.processed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      L{e.line_code} dir{e.direction} · parada {e.stop_code} ·{" "}
                      {e.observed_eta_minutes != null ? `${e.observed_eta_minutes} min` : "—"}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(e.observed_at).toLocaleString()} · conf {Number(e.confidence).toFixed(2)}
                      {e.segment_from_stop && e.segment_to_stop
                        ? ` · seg ${e.segment_from_stop}→${e.segment_to_stop}`
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
