import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const ADMIN_PIN = "7910511";
const PIN_STORAGE_KEY = "admin_system_pin_ok";


export const Route = createFileRoute("/admin/system")({
  head: () => ({
    meta: [
      { title: "Admin · Sistema (oculto)" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
    ],
  }),
  component: AdminSystemPage,
});

// =====================================================================
// CATÁLOGO DEL SISTEMA — fuente única de información técnica del proyecto
// Mantener sincronizado con migraciones y endpoints reales.
// =====================================================================

type TableInfo = {
  name: string;
  domain: string;
  purpose: string;
  rls: string;
  writers?: string;
};

const TABLES: TableInfo[] = [
  // Agente
  { name: "agente_intents", domain: "Agente", purpose: "12 dominios oficiales + keywords (comer, dormir, playas, comprar, tomar_algo, transporte, mapa, salud, ocio, fiestas, clima, perfil).", rls: "Lectura pública (activos). Admin gestiona.", writers: "Admin / auto-learn" },
  { name: "agente_faqs", domain: "Agente", purpose: "FAQs con keywords y respuesta. Incrementa hits.", rls: "Lectura pública (activos). Admin gestiona." },
  { name: "agente_proper_nouns", domain: "Agente", purpose: "Entidades nombradas (lugares, eventos) con aliases.", rls: "Lectura pública (activos). Admin gestiona." },
  { name: "agente_unknown_queries", domain: "Agente", purpose: "Queries sin match. Se incrementa count.", rls: "Solo admin lee.", writers: "Cliente (insert/upsert)" },
  { name: "agente_learning_log", domain: "Agente", purpose: "Bitácora de cada clasificación automática de la IA.", rls: "Solo admin lee." },
  { name: "agente_admin_supervisions", domain: "Agente", purpose: "Cola de revisión humana de decisiones del auto-learning.", rls: "Solo admin lee/gestiona." },
  // Shop
  { name: "shop_sectors", domain: "Comprar", purpose: "Sectores raíz del shopping.", rls: "Lectura pública." },
  { name: "shop_subsectors", domain: "Comprar", purpose: "Subsectores.", rls: "Lectura pública." },
  { name: "shop_subsubsectors", domain: "Comprar", purpose: "Sub-subsectores (hoja).", rls: "Lectura pública." },
  { name: "shop_intents", domain: "Comprar", purpose: "Keywords → subsubsector. Routing del agente shop.", rls: "Lectura pública (activos)." },
  { name: "shop_intent_learning", domain: "Comprar", purpose: "Auto-aprendizaje específico de shop.", rls: "Solo admin." },
  { name: "shop_businesses", domain: "Comprar", purpose: "Comercios de Alicante enriquecidos con Google Places.", rls: "Lectura pública." },
  { name: "shop_zones", domain: "Comprar", purpose: "Zonas de la ciudad para shopping.", rls: "Lectura pública." },
  // Lugares / Restauración / Salud
  { name: "places", domain: "Lugares", purpose: "Cache de Google Places (restaurantes, etc.).", rls: "Lectura pública." },
  { name: "businesses", domain: "Negocios", purpose: "Negocios registrados (owner_id).", rls: "Owner gestiona / lectura pública (activos)." },
  { name: "business_users", domain: "Negocios", purpose: "Miembros de un negocio.", rls: "Solo miembros y admin." },
  { name: "services", domain: "Negocios", purpose: "Servicios reservables del negocio.", rls: "Lectura pública (activos)." },
  { name: "bookings", domain: "Reservas", purpose: "Reservas de usuarios.", rls: "Usuario propio / miembros del negocio." },
  { name: "conversation_threads", domain: "Inbox", purpose: "Hilos negocio ⇆ cliente.", rls: "Participantes y admin." },
  { name: "messages", domain: "Inbox", purpose: "Mensajes de los hilos.", rls: "Participantes." },
  { name: "campaigns", domain: "Marketing", purpose: "Campañas del negocio.", rls: "Miembros." },
  { name: "qr_codes", domain: "Marketing", purpose: "Códigos QR del negocio.", rls: "Solo miembros." },
  { name: "referrals", domain: "Marketing", purpose: "Sistema de referidos.", rls: "Miembros / referidor." },
  { name: "referral_qrs", domain: "Marketing", purpose: "QRs de referidos por usuario.", rls: "Usuario propio." },
  { name: "interaction_events", domain: "Analítica", purpose: "Eventos de interacción.", rls: "Miembros / usuario propio." },
  // Transporte
  { name: "bus_lines", domain: "Transporte", purpose: "Líneas de bus (Vectalia).", rls: "Lectura pública." },
  { name: "bus_line_stops", domain: "Transporte", purpose: "Paradas por línea y sentido.", rls: "Lectura pública." },
  { name: "bus_stops", domain: "Transporte", purpose: "Paradas geolocalizadas.", rls: "Lectura pública." },
  { name: "aena_flights", domain: "Transporte", purpose: "Vuelos AENA aeropuerto ALC.", rls: "Lectura pública.", writers: "Cron aena-sync" },
  // Salud
  { name: "health_centers", domain: "Salud", purpose: "Centros de salud oficiales.", rls: "Lectura pública." },
  { name: "health_providers", domain: "Salud", purpose: "Proveedores sanitarios (Google).", rls: "Lectura pública." },
  { name: "pharmacies", domain: "Salud", purpose: "Farmacias (guardia/24h).", rls: "Lectura pública." },
  // Ocio
  { name: "cinemas", domain: "Ocio", purpose: "Cines.", rls: "Lectura pública." },
  { name: "films", domain: "Ocio", purpose: "Películas en cartelera.", rls: "Lectura pública." },
  // Hoteles
  { name: "hotels_static", domain: "Dormir", purpose: "Hoteles (LiteAPI, estáticos).", rls: "Lectura pública.", writers: "Cron sync-hotels-static" },
  { name: "hotels_dynamic", domain: "Dormir", purpose: "Precio y disponibilidad actual.", rls: "Lectura pública.", writers: "Cron refresh-hotels-dynamic" },
  { name: "hotels_calendar", domain: "Dormir", purpose: "Disponibilidad por fecha.", rls: "Lectura pública." },
  // Usuario
  { name: "profiles", domain: "Usuario", purpose: "Perfil público del usuario.", rls: "Solo propietario." },
  { name: "user_roles", domain: "Usuario", purpose: "Roles (admin, business_user, user).", rls: "Verificado vía has_role()." },
];

type EndpointInfo = {
  path: string;
  method: string;
  purpose: string;
  frequency: string;
  triggered_by: string;
};

const ENDPOINTS: EndpointInfo[] = [
  {
    path: "/api/public/hooks/agente-learn",
    method: "POST / GET",
    purpose: "Auto-aprendizaje: clasifica unknown_queries (>=2 hits) con Lovable AI (gemini-3-flash-preview) y añade keywords a agente_intents si confidence >= 0.8.",
    frequency: "Diario 03:30 UTC (pg_cron job 'agente-learn-daily')",
    triggered_by: "pg_cron → pg_net",
  },
  {
    path: "/api/public/hooks/aena-sync",
    method: "POST",
    purpose: "Sincroniza vuelos AENA (aeropuerto ALC, salidas y llegadas).",
    frequency: "Cron periódico",
    triggered_by: "pg_cron / manual",
  },
  {
    path: "/api/public/hooks/tram-sync",
    method: "POST",
    purpose: "Sincroniza horarios/paradas del TRAM Alicante.",
    frequency: "Cron periódico",
    triggered_by: "pg_cron / manual",
  },
  {
    path: "/api/public/hooks/cinemas-sync",
    method: "POST",
    purpose: "Sincroniza cines y cartelera.",
    frequency: "Cron periódico",
    triggered_by: "pg_cron / manual",
  },
  {
    path: "/api/public/hooks/sync-hotels-static",
    method: "POST",
    purpose: "Trae catálogo estático de hoteles desde LiteAPI.",
    frequency: "Semanal",
    triggered_by: "pg_cron / manual",
  },
  {
    path: "/api/public/hooks/refresh-hotels-dynamic",
    method: "POST",
    purpose: "Refresca precio y disponibilidad de hoteles (LiteAPI).",
    frequency: "Frecuente (diario o varias veces al día)",
    triggered_by: "pg_cron / manual",
  },
];

type ExternalApi = {
  name: string;
  used_for: string;
  secret: string;
  surface: string;
};

const EXTERNAL_APIS: ExternalApi[] = [
  { name: "Lovable AI Gateway", used_for: "Clasificación de intents, FAQs, auto-aprendizaje del agente.", secret: "LOVABLE_API_KEY", surface: "Server functions + /api/public/hooks/agente-learn" },
  { name: "Google Places (New)", used_for: "Restaurantes, salud, comercios. Cache en places / health_providers / shop_businesses.", secret: "GOOGLE_PLACES_API_KEY", surface: "Server functions" },
  { name: "Google Maps JS API", used_for: "Mapas embebidos (mapa, playas, hospitales).", secret: "GOOGLE_MAPS_BROWSER_KEY", surface: "Frontend" },
  { name: "Google Maps Server", used_for: "Geocoding / cálculos server-side.", secret: "GOOGLE_MAPS_API_KEY", surface: "Server functions" },
  { name: "LiteAPI", used_for: "Catálogo, precios y disponibilidad de hoteles.", secret: "LITEAPI_KEY", surface: "Hooks de sincronización" },
  { name: "Firecrawl", used_for: "Scraping puntual (eventos, fichas).", secret: "FIRECRAWL_API_KEY", surface: "Server functions" },
  { name: "Songkick", used_for: "Conciertos / agenda musical.", secret: "SONGKICK_API_KEY", surface: "Server functions" },
  { name: "NAP API", used_for: "Datos NAP de comercios.", secret: "NAP_API_KEY", surface: "Server functions" },
];

type CronJob = {
  name: string;
  schedule: string;
  action: string;
};

const CRON_JOBS: CronJob[] = [
  { name: "agente-learn-daily", schedule: "30 3 * * * (03:30 UTC)", action: "POST → /api/public/hooks/agente-learn" },
];

type AgentDomain = {
  key: string;
  label: string;
  keywords_count: string;
};

const AGENT_DOMAINS: AgentDomain[] = [
  { key: "comer", label: "Comer", keywords_count: "≈573" },
  { key: "salud", label: "Salud", keywords_count: "≈526" },
  { key: "transporte", label: "Transporte", keywords_count: "≈315" },
  { key: "ocio", label: "Ocio", keywords_count: "≈315" },
  { key: "comprar", label: "Comprar", keywords_count: "≈296" },
  { key: "dormir", label: "Dormir", keywords_count: "≈280" },
  { key: "perfil", label: "Perfil", keywords_count: "≈264" },
  { key: "fiestas", label: "Fiestas", keywords_count: "≈263" },
  { key: "tomar_algo", label: "Tomar algo", keywords_count: "≈260" },
  { key: "playas", label: "Playas", keywords_count: "≈241" },
  { key: "mapa", label: "Mapa", keywords_count: "≈232" },
  { key: "clima", label: "Clima", keywords_count: "≈231" },
];

const LEARNING_PIPELINE = [
  "1. Usuario hace una consulta al agente.",
  "2. Si no hay match → se inserta/upserta en agente_unknown_queries (count++).",
  "3. Cron diario 03:30 UTC lanza /api/public/hooks/agente-learn.",
  "4. Toma hasta 25 queries no procesadas con count ≥ 2.",
  "5. Lovable AI clasifica cada query en uno de los 12 dominios.",
  "6. Si confidence ≥ 0.8 → añade keywords nuevas (normalizadas) a agente_intents.",
  "7. Registra cada decisión en agente_learning_log.",
  "8. Si confidence < 0.8 o dominio inválido → entra en agente_admin_supervisions para revisión humana.",
  "9. Marca la query como processed_at para no reprocesarla.",
];

// =====================================================================

function AdminSystemPage() {
  const check = useServerFn(checkIsAdmin);
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const handleClose = () => {
    if (typeof window !== "undefined" && window.opener) {
      window.close();
      return;
    }
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(PIN_STORAGE_KEY) === "1") {
      setPinOk(true);
    }
    let cancelled = false;
    check()
      .then((r) => {
        if (cancelled) return;
        setState(r.isAdmin ? "ok" : "denied");
      })
      .catch(() => !cancelled && setState("denied"));
    return () => {
      cancelled = true;
    };
  }, [check]);

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(PIN_STORAGE_KEY, "1");
      setPinOk(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">404 — Página no encontrada</p>
      </div>
    );
  }

  if (!pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <form onSubmit={submitPin} className="w-full max-w-sm space-y-4 border rounded-lg p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Acceso restringido</h2>
            <p className="text-xs text-muted-foreground">Introduce el PIN de administrador (7 dígitos).</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={7}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="•••••••"
          />
          {pinError && <p className="text-xs text-destructive">PIN incorrecto</p>}
          <Button type="submit" className="w-full" disabled={pin.length !== 7}>
            Entrar
          </Button>
        </form>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-background text-foreground">
      <Button
        onClick={handleClose}
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50 gap-2 shadow-md"
      >
        <X className="h-4 w-4" />
        Cerrar
      </Button>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-2">
          <Badge variant="outline" className="text-xs">Solo administrador · noindex</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Sistema · Visión técnica</h1>
          <p className="text-muted-foreground text-sm">
            Inventario completo de tablas, endpoints, integraciones externas y procesos
            programados. Mantén este catálogo sincronizado con las migraciones reales.
          </p>
        </header>


        <Section title="Dominios del agente (12 oficiales)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {AGENT_DOMAINS.map((d) => (
              <div key={d.key} className="rounded-md border border-border p-3 bg-card">
                <div className="font-mono text-xs text-muted-foreground">{d.key}</div>
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.keywords_count} keywords</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Pipeline de auto-aprendizaje">
          <ol className="space-y-1.5 text-sm">
            {LEARNING_PIPELINE.map((step) => (
              <li key={step} className="text-foreground/90">{step}</li>
            ))}
          </ol>
        </Section>

        <Section title={`Tablas (${TABLES.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Tabla</th>
                  <th className="py-2 pr-3">Dominio</th>
                  <th className="py-2 pr-3">Propósito</th>
                  <th className="py-2 pr-3">RLS</th>
                  <th className="py-2 pr-3">Escritores</th>
                </tr>
              </thead>
              <tbody>
                {TABLES.map((t) => (
                  <tr key={t.name} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{t.name}</td>
                    <td className="py-2 pr-3"><Badge variant="secondary">{t.domain}</Badge></td>
                    <td className="py-2 pr-3 text-foreground/90">{t.purpose}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{t.rls}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{t.writers ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={`Endpoints públicos (${ENDPOINTS.length})`}>
          <div className="space-y-3">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="rounded-md border border-border p-3 bg-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{e.method}</Badge>
                  <code className="text-xs">{e.path}</code>
                </div>
                <p className="text-sm mt-2 text-foreground/90">{e.purpose}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                  <span><strong>Frecuencia:</strong> {e.frequency}</span>
                  <span><strong>Disparado por:</strong> {e.triggered_by}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={`APIs externas (${EXTERNAL_APIS.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">API</th>
                  <th className="py-2 pr-3">Uso</th>
                  <th className="py-2 pr-3">Secret</th>
                  <th className="py-2 pr-3">Superficie</th>
                </tr>
              </thead>
              <tbody>
                {EXTERNAL_APIS.map((a) => (
                  <tr key={a.name} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-medium">{a.name}</td>
                    <td className="py-2 pr-3">{a.used_for}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{a.secret}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{a.surface}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={`Cron jobs (${CRON_JOBS.length})`}>
          <div className="space-y-2">
            {CRON_JOBS.map((j) => (
              <div key={j.name} className="rounded-md border border-border p-3 bg-card flex flex-wrap gap-3 items-center">
                <Badge variant="outline">{j.schedule}</Badge>
                <code className="text-xs">{j.name}</code>
                <span className="text-sm text-foreground/90">{j.action}</span>
              </div>
            ))}
          </div>
        </Section>

        <footer className="pt-4 text-xs text-muted-foreground border-t border-border">
          Página oculta · acceso restringido a usuarios con rol <code>admin</code>.
          No enlazada desde la UI pública.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
