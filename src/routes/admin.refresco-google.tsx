import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getRefreshStats } from "@/lib/admin-refresh.functions";

export const Route = createFileRoute("/admin/refresco-google")({
  head: () => ({ meta: [{ title: "Admin · Refresco Google" }] }),
  component: RefrescoGoogle,
});

type Action = {
  key: string;
  title: string;
  desc: string;
  url: string;
};

const ACTIONS: Action[] = [
  {
    key: "hotels",
    title: "Hoteles (Places)",
    desc: "Re-ejecuta la búsqueda completa de hoteles en 30 km. Genera muchas llamadas a Google. Ejecutar 1× cada 2-3 meses como mucho.",
    url: "/api/public/hooks/sync-hotels-static",
  },
  {
    key: "hotels-dynamic",
    title: "Hoteles (LiteAPI dinámico)",
    desc: "Refresca precios/disponibilidad vía LiteAPI. No consume Google.",
    url: "/api/public/hooks/refresh-hotels-dynamic",
  },
  {
    key: "beaches",
    title: "Portadas de playas",
    desc: "Vuelve a buscar y cachear en Storage la foto de portada de cada playa. ~50 llamadas a Google.",
    url: "/api/public/hooks/sync-beach-covers",
  },
];

function RefrescoGoogle() {
  const fetchStats = useServerFn(getRefreshStats);
  const stats = useQuery({
    queryKey: ["refresco-google-stats"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">🔄 Refresco de datos Google</h1>
        <p className="text-sm text-muted-foreground">
          Las llamadas a Google solo ocurren cuando aquí pulsas un botón.
          Las fotos se cachean para siempre en nuestro Storage; los datos
          (hoteles, lugares) viven en la base de datos sin caducidad
          automática.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Hoteles en BD" value={stats.data?.hotels ?? "—"} />
        <Stat label="Lugares cacheados" value={stats.data?.places ?? "—"} />
        <Stat label="Playas con foto" value={stats.data?.beaches ?? "—"} />
        <Stat label="Centros salud cacheados" value={stats.data?.health ?? "—"} />
      </div>

      <div className="space-y-3">
        {ACTIONS.map((a) => (
          <ActionCard key={a.key} action={a} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: Action }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch(action.url, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        setState("err");
        setMsg(j.error || `HTTP ${res.status}`);
      } else {
        setState("ok");
        setMsg(JSON.stringify(j));
      }
    } catch (e) {
      setState("err");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {state === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          {state === "err" && <AlertCircle className="h-4 w-4 text-destructive" />}
          {action.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{action.desc}</p>
        <Button onClick={run} disabled={state === "running"} size="sm">
          <RefreshCw className={state === "running" ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
          {state === "running" ? "Ejecutando…" : "Refrescar ahora"}
        </Button>
        {msg && (
          <pre className="text-[11px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {msg}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
