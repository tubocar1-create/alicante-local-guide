import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/bases-datos")({
  head: () => ({ meta: [{ title: "Admin · Bases de datos" }] }),
  component: BasesDatosPage,
});

type Group = {
  group: string;
  tables: { name: string; purpose: string; feeds: string }[];
};

const GROUPS: Group[] = [
  {
    group: "Auth y usuarios",
    tables: [
      { name: "profiles", purpose: "Datos públicos del usuario (nombre, avatar, consentimientos, preferencias, marketing)", feeds: "/perfil, /admin/usuarios" },
      { name: "user_roles", purpose: "Roles app (admin, business_user)", feeds: "Gating admin, RLS de business" },
      { name: "test_users", purpose: "Captura legacy de leads, migrados a auth", feeds: "Botón 'Migrar test→Auth'" },
    ],
  },
  {
    group: "Negocios y reservas",
    tables: [
      { name: "businesses", purpose: "Ficha de negocio", feeds: "/business, fichas públicas" },
      { name: "business_users", purpose: "Membresía staff↔negocio", feeds: "Permisos backoffice" },
      { name: "services", purpose: "Catálogo de servicios reservables", feeds: "BookingDialog, /business" },
      { name: "bookings", purpose: "Reservas de cliente", feeds: "/business/bookings, ArrivalAlarm" },
      { name: "conversation_threads + messages", purpose: "Hilo cliente↔negocio post-reserva", feeds: "/business/inbox, /threads" },
      { name: "qr_codes / referral_qrs / referrals", purpose: "QRs y programa referidos", feeds: "/business/qr, /business/referrals" },
      { name: "campaigns", purpose: "Campañas por negocio", feeds: "/business/metrics" },
      { name: "interaction_events", purpose: "Telemetría de eventos UI", feeds: "/business/metrics, Métricas internas" },
    ],
  },
  {
    group: "Movilidad / transporte",
    tables: [
      { name: "bus_lines / bus_stops / bus_line_stops", purpose: "Red de autobús y TRAM (paradas, líneas, secuencia)", feeds: "/tram, /bus, planner, TripTimeline" },
      { name: "aena_flights", purpose: "Llegadas/salidas Alicante-Elche", feeds: "/vuelos" },
    ],
  },
  {
    group: "Turismo / contenido",
    tables: [
      { name: "places", purpose: "Caché de Google Places enriquecida", feeds: "EatNearby, listings, agente" },
      { name: "cinemas / films", purpose: "Cines y cartelera", feeds: "/ocio/cines, /ocio/cartelera" },
      { name: "hotels_static / hotels_dynamic / hotels_calendar", purpose: "Catálogo hotelero LiteAPI + precios", feeds: "/donde-dormir, /hotel/:id" },
      { name: "pharmacies", purpose: "Farmacias (guardia 24h)", feeds: "/farmacias" },
      { name: "health_centers / health_providers", purpose: "Centros y proveedores salud", feeds: "/salud, /hospitales, /sistema-sanitario" },
    ],
  },
  {
    group: "Comprar (shopping)",
    tables: [
      { name: "shop_sectors / shop_subsectors", purpose: "Taxonomía comercial", feeds: "/comprar, sectores" },
      { name: "shop_businesses", purpose: "Comercios enriquecidos con Google", feeds: "/comprar/tienda/:id" },
      { name: "shop_intents / shop_intent_learning", purpose: "Intents catalogados + aprendizaje", feeds: "Buscador de /comprar" },
    ],
  },
  {
    group: "Agente IA (NLP)",
    tables: [
      { name: "agente_intents", purpose: "Intents canónicos del Agente", feeds: "AgenteVamos.localResolve" },
      { name: "agente_faqs", purpose: "Respuestas frecuentes", feeds: "Agente / chat" },
      { name: "agente_proper_nouns", purpose: "Sinónimos / alias de entidades", feeds: "Normalización del Agente" },
      { name: "agente_unknown_queries", purpose: "Queries no resueltas", feeds: "Pipeline supervisión" },
      { name: "agente_learning_log", purpose: "Log decisiones IA sobre queries", feeds: "Auditoría aprendizaje" },
      { name: "agente_admin_supervisions", purpose: "Cola de revisión humana", feeds: "Backoffice supervisor" },
    ],
  },
];

function BasesDatosPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Bases de datos</h1>
        <p className="text-sm text-muted-foreground">
          Tablas del backend agrupadas por dominio, su función y qué parte de la app alimentan.
        </p>
      </header>

      {GROUPS.map((g) => (
        <Card key={g.group}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="secondary">{g.group}</Badge>
              <span className="text-xs text-muted-foreground font-normal">{g.tables.length} tablas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Tabla</th>
                  <th className="px-3 py-2 text-left">Función</th>
                  <th className="px-3 py-2 text-left">Alimenta</th>
                </tr>
              </thead>
              <tbody>
                {g.tables.map((t) => (
                  <tr key={t.name} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{t.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.purpose}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.feeds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
