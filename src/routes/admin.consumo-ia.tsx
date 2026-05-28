import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConsumptionSummary } from "@/lib/admin-consumption.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/consumo-ia")({
  head: () => ({ meta: [{ title: "Admin · Consumo IA" }] }),
  component: ConsumoIA,
});

const RANGES = [
  { label: "1 h", hours: 1 },
  { label: "12 h", hours: 12 },
  { label: "24 h", hours: 24 },
  { label: "7 d", hours: 24 * 7 },
  { label: "30 d", hours: 24 * 30 },
];

function ConsumoIA() {
  const [hours, setHours] = useState(12);
  const fetchFn = useServerFn(getConsumptionSummary);
  const q = useQuery({
    queryKey: ["consumo-ia", hours],
    queryFn: () => fetchFn({ data: { hours, provider: "lovable_ai" } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">🤖 Consumo IA (Lovable AI Gateway)</h1>
        <p className="text-sm text-muted-foreground">
          Llamadas registradas vía el wrapper <code>callLovableAI</code>. Los call
          sites que aún no estén migrados no aparecen aquí.
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
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Llamadas" value={q.data.totals.calls.toLocaleString()} />
            <Stat label="Tokens in" value={q.data.totals.tokensIn.toLocaleString()} />
            <Stat label="Tokens out" value={q.data.totals.tokensOut.toLocaleString()} />
            <Stat label="Coste est." value={`$${q.data.totals.cost.toFixed(4)}`} />
            <Stat label="Latencia media" value={`${q.data.totals.avgLatency} ms`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Por modelo</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Modelo", "Llamadas", "Tokens in", "Tokens out", "Coste"]}>
                {q.data.byModelOrEndpoint.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.key}</td>
                    <td className="py-1.5 pr-3">{r.calls}</td>
                    <td className="py-1.5 pr-3">{r.tokensIn.toLocaleString()}</td>
                    <td className="py-1.5 pr-3">{r.tokensOut.toLocaleString()}</td>
                    <td className="py-1.5 pr-3">${r.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por origen (caller)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Caller", "Llamadas", "Tokens in", "Tokens out", "Coste"]}>
                {q.data.byCaller.map((r) => (
                  <tr key={r.caller} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.caller}</td>
                    <td className="py-1.5 pr-3">{r.calls}</td>
                    <td className="py-1.5 pr-3">{r.tokensIn.toLocaleString()}</td>
                    <td className="py-1.5 pr-3">{r.tokensOut.toLocaleString()}</td>
                    <td className="py-1.5 pr-3">${r.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas 100 llamadas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table headers={["Hora", "Caller", "Modelo", "Status", "ms", "Tk in/out", "Coste"]}>
                {q.data.recent.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-3 text-xs">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="py-1 pr-3 text-xs font-mono">{r.caller}</td>
                    <td className="py-1 pr-3 text-xs">{r.model ?? "—"}</td>
                    <td className="py-1 pr-3 text-xs">{r.status_code ?? "—"}</td>
                    <td className="py-1 pr-3 text-xs">{r.latency_ms ?? "—"}</td>
                    <td className="py-1 pr-3 text-xs">{r.tokens_input ?? 0}/{r.tokens_output ?? 0}</td>
                    <td className="py-1 pr-3 text-xs">${Number(r.estimated_cost ?? 0).toFixed(4)}</td>
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
