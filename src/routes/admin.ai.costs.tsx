// Coste IA estimado (basado en model-pricing.ts).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
// Tablas en lugar de gráficas para mantener el bundle ligero.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { costsQO, money } from "@/lib/admin-ai-shared";

export const Route = createFileRoute("/admin/ai/costs")({
  component: CostsPage,
});

function CostsPage() {
  const q = useQuery(costsQO());
  const d = q.data;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Coste estimado en USD basado en precios públicos por modelo. Datos de los últimos 30 días.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coste diario</CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 overflow-auto">
          {d?.byDay.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                <tr>
                  <th className="text-left p-1">Día</th>
                  <th className="text-right p-1">Coste</th>
                </tr>
              </thead>
              <tbody>
                {d.byDay.map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="p-1">{row.key}</td>
                    <td className="p-1 text-right font-medium">{money(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coste por modelo</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.byModel.length ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-1">Modelo</th>
                    <th className="text-right p-1">Tokens in</th>
                    <th className="text-right p-1">Tokens out</th>
                    <th className="text-right p-1">Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byModel.map((m) => (
                    <tr key={m.model} className="border-t">
                      <td className="p-1">{m.model}</td>
                      <td className="p-1 text-right">{m.tokensIn.toLocaleString()}</td>
                      <td className="p-1 text-right">{m.tokensOut.toLocaleString()}</td>
                      <td className="p-1 text-right font-medium">{money(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coste por intent</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.byIntent.length ? (
              <ul className="text-sm space-y-1">
                {d.byIntent.map((i) => (
                  <li key={i.intent} className="flex justify-between">
                    <span>{i.intent}</span>
                    <Badge variant="secondary">{money(i.cost)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queries más caras</CardTitle>
        </CardHeader>
        <CardContent>
          {d?.mostExpensive.length ? (
            <ul className="text-sm space-y-1">
              {d.mostExpensive.map((q, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{q.query}</span>
                  <span className="text-xs text-muted-foreground">{q.model ?? "—"}</span>
                  <Badge variant="outline">{money(q.cost)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
