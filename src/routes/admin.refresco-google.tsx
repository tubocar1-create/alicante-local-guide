import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { getRefreshStats } from "@/lib/admin-refresh.functions";
import { geocodeBusStops } from "@/lib/bus-geocode.functions";
import {
  geocodePharmacies,
  getPharmaciesGeocodeStats,
} from "@/lib/pharmacies-geocode.functions";

export const Route = createFileRoute("/admin/refresco-google")({
  head: () => ({ meta: [{ title: "Admin · Refresco Google" }] }),
  component: RefrescoGoogle,
});

type Action = {
  key: string;
  title: string;
  desc: string;
  url?: string;
  run?: () => Promise<unknown>;
};

function RefrescoGoogle() {
  const fetchStats = useServerFn(getRefreshStats);
  const runGeocode = useServerFn(geocodeBusStops);
  const runPharmGeocode = useServerFn(geocodePharmacies);
  const fetchPharmStats = useServerFn(getPharmaciesGeocodeStats);
  const stats = useQuery({
    queryKey: ["refresco-google-stats"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });
  const pharmStats = useQuery({
    queryKey: ["refresco-pharm-stats"],
    queryFn: () => fetchPharmStats(),
    staleTime: 30_000,
  });

  // helper: llama al endpoint en bucle hasta que remaining = 0
  async function loopScrape(source: "places" | "shops" | "hotels") {
    let totalDone = 0;
    let lastRemaining = Infinity;
    let stagnant = 0;
    for (let i = 0; i < 500; i++) {
      const res = await fetch(`/api/public/hooks/scrape-web-photos?source=${source}`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; done?: number; remaining?: number; error?: string };
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
      totalDone += j.done ?? 0;
      if ((j.remaining ?? 0) <= 0) return { totalDone, remaining: 0, batches: i + 1 };
      if ((j.remaining ?? 0) >= lastRemaining) {
        stagnant++;
        if (stagnant >= 3) return { totalDone, remaining: j.remaining, stoppedReason: "no avanza" };
      } else {
        stagnant = 0;
      }
      lastRemaining = j.remaining ?? 0;
    }
    return { totalDone, remaining: lastRemaining };
  }

  const actions: Action[] = [
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
    {
      key: "bus-geocode",
      title: `Geocodificar paradas de bus (${stats.data?.busPending ?? "—"} pendientes)`,
      desc: "Geocodifica hasta 120 paradas SIN coordenadas por ejecución. Una parada solo se llama una vez en su vida; el coste tiende a 0 cuando todas tengan lat/lng.",
      run: () => runGeocode(),
    },
    {
      key: "pharm-geocode",
      title: `Geocodificar farmacias (${pharmStats.data?.pending ?? "—"} pendientes)`,
      desc: "Geocodifica hasta 60 farmacias SIN coordenadas por ejecución usando Nominatim (OpenStreetMap, gratis). Tarda ~1 min/lote por el límite de 1 req/s. NO consume Google.",
      run: async () => {
        const r = await runPharmGeocode();
        pharmStats.refetch();
        return r;
      },
    },
    {
      key: "scrape-photos-places",
      title: "Scrapear fotos de la web (restaurantes/bares/cafés)",
      desc: "Para cada ficha con web oficial guardada y SIN fotos en BD, descarga hasta 8 fotos de su sitio (Firecrawl). Se ejecuta en bucle automático hasta agotar la cola. NO usa Google.",
      run: () => loopScrape("places"),
    },
    {
      key: "scrape-photos-shops",
      title: "Scrapear fotos de la web (tiendas con web)",
      desc: "Igual que el anterior pero para shop_businesses (Zara, Calzedonia, etc.) que tienen web y aún no tienen fotos guardadas.",
      run: () => loopScrape("shops"),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">🔄 Refresco de datos Google</h1>
        <p className="text-sm text-muted-foreground">
          Las llamadas a Google solo ocurren cuando aquí pulsas un botón.
          Las fotos se cachean para siempre en nuestro Storage; los datos
          (hoteles, lugares, coordenadas de paradas) viven en la base de datos
          sin caducidad automática.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Hoteles en BD" value={stats.data?.hotels ?? "—"} />
        <Stat label="Lugares cacheados" value={stats.data?.places ?? "—"} />
        <Stat label="Playas con foto" value={stats.data?.beaches ?? "—"} />
        <Stat label="Centros salud cacheados" value={stats.data?.health ?? "—"} />
        <Stat label="Paradas de bus" value={stats.data?.busTotal ?? "—"} />
        <Stat
          label="Paradas sin geocodificar"
          value={stats.data?.busPending ?? "—"}
        />
      </div>

      <div className="space-y-3">
        {actions.map((a) => (
          <ActionCard key={a.key} action={a} onDone={() => stats.refetch()} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action, onDone }: { action: Action; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMsg(null);
    try {
      let result: unknown;
      if (action.run) {
        result = await action.run();
      } else if (action.url) {
        const res = await fetch(action.url, { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || (j && j.ok === false)) {
          setState("err");
          setMsg(j?.error || `HTTP ${res.status}`);
          return;
        }
        result = j;
      }
      setState("ok");
      setMsg(JSON.stringify(result));
      onDone?.();
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
