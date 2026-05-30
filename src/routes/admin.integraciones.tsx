import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/integraciones")({
  head: () => ({ meta: [{ title: "Admin · Integraciones externas" }] }),
  component: IntegracionesPage,
});

type Integration = {
  name: string;
  kind: "API" | "Scraper" | "Webhook" | "OAuth" | "AI";
  source: string;
  endpoint: string;
  alimenta: string;
  frecuencia: string;
};

const INTEGRATIONS: Integration[] = [
  // APIs externas
  { name: "Google Places", kind: "API", source: "GOOGLE_PLACES_API_KEY", endpoint: "src/lib/places.functions.ts, health-google.functions.ts", alimenta: "places, health_providers, shop_businesses", frecuencia: "Bajo demanda + admin" },
  { name: "Google Maps", kind: "API", source: "Conector Google Maps", endpoint: "ExploreMap, LeafletBeachMap, PlaceLocationMap", alimenta: "Renderizado mapas + tracking ID", frecuencia: "Cliente, en cada vista" },
  { name: "LiteAPI (Hoteles)", kind: "API", source: "LITEAPI_KEY", endpoint: "src/lib/hotels-liteapi.server.ts", alimenta: "hotels_static, hotels_dynamic, hotels_calendar", frecuencia: "Cron + bajo demanda" },
  { name: "AENA Flights", kind: "Scraper", source: "Pública", endpoint: "api/public/aena-flights · hooks/aena-sync", alimenta: "aena_flights", frecuencia: "Cron periódico" },
  { name: "TRAM Alicante", kind: "Scraper", source: "TRAM API/web", endpoint: "api/public/tram/* · hooks/tram-sync", alimenta: "bus_lines, bus_stops, bus_line_stops (red ferrocarril ligero)", frecuencia: "Diario / al sync" },
  { name: "Bus ETA (Vectalia)", kind: "API", source: "NAP_API_KEY", endpoint: "api/public/bus-eta · supabase/functions/bus-eta", alimenta: "Tiempos de paso en vivo (no persistente)", frecuencia: "Tiempo real" },
  { name: "Songkick", kind: "API", source: "SONGKICK_API_KEY", endpoint: "src/lib/ocio.functions.ts", alimenta: "Listado conciertos (no persistente)", frecuencia: "Bajo demanda" },
  { name: "Cines (sync)", kind: "Scraper", source: "Webs cines", endpoint: "hooks/cinemas-sync", alimenta: "cinemas, films", frecuencia: "Cron diario" },
  { name: "Firecrawl", kind: "API", source: "Conector Firecrawl", endpoint: "ads/alicante-city, ads/regional-agendas, refresh-news, refresh-alicante-press, refresh-incidencias", alimenta: "Tablas de ads/news (caché editorial)", frecuencia: "Cron" },
  { name: "Lovable AI Gateway", kind: "AI", source: "LOVABLE_API_KEY (managed)", endpoint: "fiestas-ai, film-ai, film-synopsis, ai-review, agente-intents, supabase/functions/chat", alimenta: "Respuestas IA (Gemini, GPT-5)", frecuencia: "Tiempo real" },
  // Auth
  { name: "Google OAuth", kind: "OAuth", source: "Supabase Auth + Lovable broker", endpoint: "src/integrations/lovable/index.ts", alimenta: "auth.users, profiles", frecuencia: "Por sesión" },
  // Webhooks/Cron entrantes
  { name: "Cron sync hoteles", kind: "Webhook", source: "Programador externo", endpoint: "api/public/hooks/sync-hotels-static · refresh-hotels-dynamic", alimenta: "hotels_static, hotels_dynamic", frecuencia: "Programado" },
  { name: "agente-learn", kind: "Webhook", source: "Auto-llamada del Agente", endpoint: "api/public/hooks/agente-learn", alimenta: "agente_admin_supervisions, agente_learning_log", frecuencia: "Tras query no resuelta" },
];

const KIND_VARIANT: Record<Integration["kind"], "default" | "secondary" | "outline" | "destructive"> = {
  API: "default",
  Scraper: "secondary",
  Webhook: "outline",
  OAuth: "secondary",
  AI: "default",
};

function IntegracionesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Integraciones externas</h1>
        <p className="text-sm text-muted-foreground">
          APIs, scrapers, webhooks y conectores que alimentan datos a la app.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{INTEGRATIONS.length} integraciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Servicio</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Fuente / clave</th>
                <th className="px-3 py-2 text-left">Endpoint en el código</th>
                <th className="px-3 py-2 text-left">Alimenta</th>
                <th className="px-3 py-2 text-left">Frecuencia</th>
              </tr>
            </thead>
            <tbody>
              {INTEGRATIONS.map((i) => (
                <tr key={i.name} className="border-t align-top">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{i.name}</td>
                  <td className="px-3 py-2"><Badge variant={KIND_VARIANT[i.kind]}>{i.kind}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{i.source}</td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground max-w-[280px]">{i.endpoint}</td>
                  <td className="px-3 py-2 text-muted-foreground">{i.alimenta}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{i.frecuencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
