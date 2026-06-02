import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { captureLineSnapshot, listRecentSnapshots } from "@/lib/bus-snapshot.functions";
import { isPreviewCaptureMode } from "@/lib/transport-mode";

export const Route = createFileRoute("/admin/bus-snapshots")({
  component: BusSnapshotsPage,
});

// Mapping inicial línea → parada de prueba (la respuesta es independiente de la parada,
// sólo necesitamos un stopCode válido dentro de cada línea para abrir el mapa).
const LINE_STOPS: Array<{ line: string; stop: string }> = [
  { line: "01", stop: "4359" },
  { line: "02", stop: "4359" },
  { line: "03", stop: "4359" },
  { line: "04", stop: "4359" },
  { line: "05", stop: "4359" },
  { line: "06", stop: "4359" },
  { line: "07", stop: "4359" },
  { line: "08A", stop: "4359" },
  { line: "09", stop: "4359" },
  { line: "12", stop: "5110" },
  { line: "13", stop: "4359" },
  { line: "14", stop: "4359" },
  { line: "22", stop: "4359" },
  { line: "39", stop: "4359" },
];

function BusSnapshotsPage() {
  const captureFn = useServerFn(captureLineSnapshot);
  const listFn = useServerFn(listRecentSnapshots);
  const qc = useQueryClient();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["bus-snapshots"],
    queryFn: () => listFn(),
  });

  const capture = useMutation({
    mutationFn: (vars: { line: string; stopCode: string }) =>
      captureFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bus-snapshots"] }),
  });

  const captureAll = useMutation({
    mutationFn: async () => {
      const results: Array<{ line: string; buses: number; error?: string }> = [];
      for (const { line, stop } of LINE_STOPS) {
        const stopCode = overrides[line] ?? stop;
        try {
          const r = await captureFn({ data: { line, stopCode } });
          results.push({ line, buses: r.buses });
        } catch (e) {
          results.push({ line, buses: 0, error: (e as Error).message });
        }
      }
      return results;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bus-snapshots"] }),
  });

  const preview = typeof window !== "undefined" ? isPreviewCaptureMode() : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Snapshot Engine — buses Vectalia
            <Badge variant={preview ? "default" : "secondary"}>
              {preview ? "PREVIEW_CAPTURE_MODE" : "PROD (estimated)"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Herramienta experimental. Captura el estado realtime de cada línea desde{" "}
            <code>qr.vectalia.es/Alicante/mapa.aspx</code> vía Firecrawl, cuenta los
            buses activos y guarda el snapshot en BD para entrenar el motor de ETA.
          </p>
          <p>
            No afecta a producción: el público sigue viendo ETA estimado desde horarios offline.
          </p>
          <Button
            onClick={() => captureAll.mutate()}
            disabled={captureAll.isPending}
          >
            {captureAll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Capturar todas las líneas
          </Button>
          {captureAll.data && (
            <div className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {captureAll.data.map((r) => (
                <div key={r.line} className="rounded border p-2">
                  <strong>L{r.line}</strong>{" "}
                  {r.error ? <span className="text-destructive">err</span> : `${r.buses} bus`}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LINE_STOPS.map(({ line, stop }) => (
            <div key={line} className="flex items-center gap-2 text-sm">
              <span className="w-12 font-mono">L{line}</span>
              <Input
                className="w-24"
                placeholder={stop}
                value={overrides[line] ?? ""}
                onChange={(e) => setOverrides((s) => ({ ...s, [line]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={capture.isPending}
                onClick={() =>
                  capture.mutate({ line, stopCode: overrides[line] || stop })
                }
              >
                Capturar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Snapshots recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left p-1">Fecha</th>
                  <th className="text-left p-1">Línea</th>
                  <th className="text-left p-1">Parada</th>
                  <th className="text-left p-1">Buses</th>
                  <th className="text-left p-1">URL</th>
                </tr>
              </thead>
              <tbody>
                {(data?.snapshots ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-1">{new Date(s.captured_at).toLocaleString()}</td>
                    <td className="p-1 font-mono">{s.line}</td>
                    <td className="p-1 font-mono">{s.stop_code}</td>
                    <td className="p-1 font-bold">{s.buses_count}</td>
                    <td className="p-1 truncate max-w-xs">
                      <a className="underline" href={s.source_url ?? "#"} target="_blank" rel="noreferrer">
                        abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
