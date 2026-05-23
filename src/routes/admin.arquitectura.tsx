import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/arquitectura")({
  head: () => ({ meta: [{ title: "Admin · Arquitectura" }] }),
  component: ArquitecturaPage,
});

const STACK = [
  { name: "TanStack Start v1", role: "Framework SSR + file routing en src/routes/" },
  { name: "React 19 + TypeScript strict", role: "Capa UI" },
  { name: "Vite 7", role: "Build / dev server" },
  { name: "Tailwind v4 + shadcn/ui", role: "Estilos y componentes" },
  { name: "TanStack Query", role: "Cache cliente · queryOptions + useQuery" },
  { name: "Supabase (Lovable Cloud)", role: "Auth, BD Postgres, RLS, Realtime" },
  { name: "Cloudflare Workers", role: "Runtime SSR + server fns en producción" },
  { name: "Lovable AI Gateway", role: "google/gemini-*, openai/gpt-* sin API key propia" },
];

const LAYERS = [
  {
    layer: "Rutas públicas",
    items: [
      "/ index · landing con Agente",
      "/playas, /tram, /bus, /vuelos, /ocio, /salud, /comprar, /donde-dormir, /fiestas, /clima",
      "/login, /perfil, /welcome",
    ],
  },
  {
    layer: "Rutas business (autenticadas)",
    items: [
      "/business · /business/login · /business/onboarding",
      "/business/bookings · /business/inbox · /business/qr · /business/metrics · /business/referrals",
    ],
  },
  {
    layer: "Admin (PIN gate)",
    items: [
      "/admin · layout con sidebar (este panel)",
      "/admin/places · /admin/salud · /admin/system (herramientas legacy)",
    ],
  },
  {
    layer: "API routes (src/routes/api/public/*)",
    items: [
      "Endpoints HTTP públicos para webhooks y cron",
      "tram/*, bus-eta, aena-flights, qr-issue, qr-validate, booking-create",
      "hooks/* · sync programados (aena, tram, cinemas, hoteles, news…)",
    ],
  },
  {
    layer: "Server functions (src/lib/*.functions.ts)",
    items: [
      "RPC tipado con createServerFn · auth via requireSupabaseAuth",
      "places, hotels, playas, ocio, salud, comprar, business/*, coord/*, agente-intents…",
    ],
  },
  {
    layer: "Edge functions",
    items: ["supabase/functions/chat · bus-eta · bus-eta-raw"],
  },
];

const KEY_COMPONENTS = [
  { name: "AgenteVamos", role: "Orquestador del asistente en home (dominios, persistencia)" },
  { name: "ChatScreen", role: "UI conversación + envío a edge function chat" },
  { name: "ExploreMap / LeafletBeachMap / BusMap", role: "Capas Leaflet de mapas" },
  { name: "TripTimeline / TramInline / LiveEta", role: "Planificador y ETAs transporte" },
  { name: "ListingCard / ListingPage", role: "Fichas de comercios y servicios" },
];

export function ArquitecturaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Arquitectura</h1>
        <p className="text-sm text-muted-foreground">
          Mapa técnico de la aplicación e instrumentación.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stack</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {STACK.map((s) => (
                <tr key={s.name} className="border-t">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capas de la aplicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {LAYERS.map((l) => (
            <div key={l.layer}>
              <Badge variant="secondary" className="mb-2">{l.layer}</Badge>
              <ul className="text-sm text-muted-foreground space-y-1 ml-3 list-disc list-inside">
                {l.items.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Componentes clave</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {KEY_COMPONENTS.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instrumentación / observabilidad</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>• <strong>Lovable Analytics</strong>: visitas, top pages, países, dispositivos (ver Métricas internas).</p>
          <p>• <strong>interaction_events</strong>: eventos de UI capturados via <code>trackEvent()</code> en src/lib/business/track.ts.</p>
          <p>• <strong>agente_unknown_queries / learning_log</strong>: queries que el Agente no resuelve, base para mejora supervisada.</p>
          <p>• <strong>shop_intent_learning</strong>: aprendizaje de intents del módulo Comprar.</p>
          <p>• <strong>Supabase logs</strong>: DB, Auth y Edge logs accesibles desde Lovable Cloud.</p>
        </CardContent>
      </Card>
    </div>
  );
}
