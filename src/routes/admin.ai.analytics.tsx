// Analítica IA: rankings de queries, intents y conversiones.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyticsQO } from "@/lib/admin-ai-shared";

export const Route = createFileRoute("/admin/ai/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const q = useQuery(analyticsQO());
  const d = q.data;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Rank title="Queries más frecuentes" items={d?.mostFrequent} kKey="query" />
      <Rank title="Queries con más fallos" items={d?.mostFailed} kKey="query" tone="bad" />
      <Rank title="Intents que generan conversiones" items={d?.topConversions} kKey="intent" tone="good" />
      <Rank title="Intents con más clicks" items={d?.topClicks} kKey="intent" />
      <Rank title="Rutas más usadas" items={d?.topRoutes} kKey="route" />
    </div>
  );
}

function Rank<T extends Record<string, unknown>>({
  title,
  items,
  kKey,
  tone,
}: {
  title: string;
  items: T[] | undefined;
  kKey: keyof T;
  tone?: "good" | "bad";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!items?.length ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((it, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span className="truncate">{String(it[kKey])}</span>
                <Badge variant={tone === "bad" ? "destructive" : tone === "good" ? "default" : "secondary"}>
                  {String(it.count)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
