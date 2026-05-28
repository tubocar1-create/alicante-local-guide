import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConsumptionSummary } from "@/lib/admin-consumption.functions";
import { getGoogleKillSwitch, setGoogleKillSwitch } from "@/lib/admin-killswitch.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/admin/consumo-google")({
  head: () => ({ meta: [{ title: "Admin · Consumo Google" }] }),
  component: ConsumoGoogle,
});

const RANGES = [
  { label: "1 h", hours: 1 },
  { label: "12 h", hours: 12 },
  { label: "24 h", hours: 24 },
  { label: "7 d", hours: 24 * 7 },
  { label: "30 d", hours: 24 * 30 },
];

const PROVIDERS = [
  { value: undefined as string | undefined, label: "Todos" },
  { value: "google_places", label: "Places" },
  { value: "google_maps", label: "Maps" },
  { value: "google_geocoding", label: "Geocoding" },
  { value: "google_directions", label: "Directions" },
];

function ConsumoGoogle() {
  const [hours, setHours] = useState(12);
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const fetchFn = useServerFn(getConsumptionSummary);
  const q = useQuery({
    queryKey: ["consumo-google", hours, provider],
    queryFn: () =>
      fetchFn({
        data: provider
          ? { hours, provider: provider as "google_places" }
          : { hours },
      }),
    staleTime: 60_000,
  });

  // Filter client-side to google_* when "Todos" is selected
  const filtered = q.data
    ? {
        ...q.data,
        recent: q.data.recent.filter((r) => r.provider.startsWith("google_")),
      }
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">☁️ Consumo Google Cloud</h1>
        <p className="text-sm text-muted-foreground">
          Llamadas a Google Places, Maps, Geocoding y Directions registradas
          desde el servidor con el wrapper <code>fetchGoogle</code>. Las
          llamadas desde el navegador (mapa) solo se ven en Google Cloud
          Console.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.hours}
            size="sm"
            variant={hours === r.hours ? "default" : "outline"}
            onClick={() => setHours(r.hours)}
          >
            {r.label}
          </Button>
        ))}
        <span className="w-2" />
        {PROVIDERS.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={provider === p.value ? "default" : "outline"}
            onClick={() => setProvider(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {filtered && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Llamadas" value={filtered.totals.calls.toLocaleString()} />
            <Stat label="Errores" value={String(filtered.totals.errors)} />
            <Stat label="Latencia media" value={`${filtered.totals.avgLatency} ms`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Por endpoint</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Endpoint", "Llamadas"]}>
                {filtered.byModelOrEndpoint.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.key}</td>
                    <td className="py-1.5 pr-3">{r.calls}</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por origen (caller)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Caller", "Llamadas"]}>
                {filtered.byCaller.map((r) => (
                  <tr key={r.caller} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.caller}</td>
                    <td className="py-1.5 pr-3">{r.calls}</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas 100 llamadas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Hora", "Provider", "Endpoint", "Caller", "Status", "ms"]}>
                {filtered.recent.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-3 text-xs">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="py-1 pr-3 text-xs">{r.provider.replace("google_", "")}</td>
                    <td className="py-1 pr-3 text-xs font-mono">{r.endpoint}</td>
                    <td className="py-1 pr-3 text-xs font-mono">{r.caller}</td>
                    <td className="py-1 pr-3 text-xs">{r.status_code ?? "—"}</td>
                    <td className="py-1 pr-3 text-xs">{r.latency_ms ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          {headers.map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
