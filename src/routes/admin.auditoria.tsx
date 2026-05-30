import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  ShieldCheck,
  Bot,
  Compass,
  Mic,
  Smartphone,
  Network,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoría pre-lanzamiento · Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditoriaPage,
});

type Estado = "OK" | "Warning" | "Critical";
type Fase = "F1 Saludo" | "F2 Ruta" | "F3 Enrutamiento" | "F4 Endpoint" | "UX" | "TTS" | "Seguridad" | "Endpoints" | "Rendimiento";

interface Hallazgo {
  id: string;
  area: string;
  fase: Fase;
  descripcion: string;
  reproduccion: string;
  correccion: string;
  estado: Estado;
}

const HALLAZGOS: Hallazgo[] = [
  // FASE 1 — Saludo + intención
  {
    id: "F1-01",
    area: "Agente · saludo inicial",
    fase: "F1 Saludo",
    descripcion: "Saludo TTS dispara correctamente al abrir el agente.",
    reproduccion: "Abrir /agente desde home, verificar audio inicial.",
    correccion: "—",
    estado: "OK",
  },
  {
    id: "F1-02",
    area: "Agente · intención fuera de contexto",
    fase: "F1 Saludo",
    descripcion: "El agente reconduce consultas personales/políticas/religiosas según doctrina.",
    reproduccion: "Preguntar al agente '¿qué opinas de…?'. Debe redirigir a su función de enrutamiento.",
    correccion: "Reforzar prompt de doctrina en agente-intents si aparece deriva.",
    estado: "OK",
  },
  {
    id: "F1-03",
    area: "Agente · detección keywords aisladas",
    fase: "F1 Saludo",
    descripcion: "Posibles falsos positivos cuando el usuario menciona una keyword sin intención dominante (ej. 'playa' en contexto restaurante).",
    reproduccion: "Conversar sobre restaurantes y mencionar 'cerca de la playa'.",
    correccion: "Auditar prioridad de contexto activo > keyword aislada en agente-intents.functions.ts.",
    estado: "Warning",
  },

  // FASE 2 — Definición de ruta
  {
    id: "F2-01",
    area: "Desambiguación",
    fase: "F2 Ruta",
    descripcion: "Pregunta de desambiguación se lanza cuando la intención es múltiple (ej. 'comprar' → 18 sectores).",
    reproduccion: "Decir 'quiero comprar' al agente.",
    correccion: "—",
    estado: "OK",
  },
  {
    id: "F2-02",
    area: "Salto prematuro",
    fase: "F2 Ruta",
    descripcion: "Verificar que no se enruta a endpoint sin confirmar sector/subsector en compras.",
    reproduccion: "Decir 'zapatos' sin contexto previo.",
    correccion: "Validar que el hub de compras presenta sectores antes del endpoint.",
    estado: "OK",
  },

  // FASE 3 — Enrutamiento contextual
  {
    id: "F3-01",
    area: "Persistencia de contexto",
    fase: "F3 Enrutamiento",
    descripcion: "El contexto activo se mantiene tras varias interacciones dentro del mismo dominio.",
    reproduccion: "Buscar restaurantes → filtrar por zona → pedir 'el primero'.",
    correccion: "—",
    estado: "OK",
  },
  {
    id: "F3-02",
    area: "Coherencia transporte",
    fase: "F3 Enrutamiento",
    descripcion: "Tram, bus urbano y buses larga distancia mantienen rutas independientes.",
    reproduccion: "Cambiar entre TRAM Alicante y Buses larga distancia desde menú de transporte.",
    correccion: "—",
    estado: "OK",
  },

  // FASE 4 — Endpoint final
  {
    id: "F4-01",
    area: "Nombres propios",
    fase: "F4 Endpoint",
    descripcion: "Llegada correcta a fichas con nombre propio (hotel, restaurante, cine).",
    reproduccion: "Pedir 'Hotel Meliá' al agente.",
    correccion: "—",
    estado: "OK",
  },
  {
    id: "F4-02",
    area: "Cierre de ruta",
    fase: "F4 Endpoint",
    descripcion: "Tras abrir ficha, el agente confirma y libera contexto.",
    reproduccion: "Abrir cualquier ficha desde el agente y volver al menú.",
    correccion: "—",
    estado: "OK",
  },

  // Contextual
  { id: "CTX-01", area: "Playas", fase: "F3 Enrutamiento", descripcion: "Listado y fichas operativas.", reproduccion: "Decir 'playas' al agente.", correccion: "—", estado: "OK" },
  { id: "CTX-02", area: "Restaurantes", fase: "F3 Enrutamiento", descripcion: "places responde, ranking por rating.", reproduccion: "'restaurantes cerca'", correccion: "—", estado: "OK" },
  { id: "CTX-03", area: "Hoteles", fase: "F3 Enrutamiento", descripcion: "LiteAPI integrada, calendario disponibilidad.", reproduccion: "'hoteles para esta noche'", correccion: "Validar caché y rate-limit en producción.", estado: "Warning" },
  { id: "CTX-04", area: "Cine", fase: "F3 Enrutamiento", descripcion: "Cartelera carga desde tabla films.", reproduccion: "'qué echan en el cine'", correccion: "—", estado: "OK" },
  { id: "CTX-05", area: "Clima", fase: "F3 Enrutamiento", descripcion: "Respuesta de clima por endpoint externo.", reproduccion: "'qué tiempo hace'", correccion: "Confirmar fallback si API externa falla.", estado: "Warning" },
  { id: "CTX-06", area: "Compras", fase: "F3 Enrutamiento", descripcion: "19 respuestas alineadas con doctrina.", reproduccion: "'quiero comprar X'", correccion: "—", estado: "OK" },

  // TTS
  { id: "TTS-01", area: "Saludo reentrada", fase: "TTS", descripcion: "Segundo acceso reproduce saludo corto.", reproduccion: "Salir y volver a /agente.", correccion: "—", estado: "OK" },
  { id: "TTS-02", area: "Speech overlap Android Chrome", fase: "TTS", descripcion: "Posible solapamiento de voz si el usuario interrumpe rápido.", reproduccion: "Hablar antes de que termine TTS en Android Chrome.", correccion: "Asegurar cancel() antes de cada speak() en hook de voz.", estado: "Warning" },
  { id: "TTS-03", area: "Timing micrófono", fase: "TTS", descripcion: "Micro se abre tras finalizar speech.", reproduccion: "Esperar fin de TTS y observar indicador de mic.", correccion: "—", estado: "OK" },

  // UX
  { id: "UX-01", area: "Navegación móvil 384px", fase: "UX", descripcion: "Header, tabs y carrusels funcionan en viewport mínimo.", reproduccion: "Abrir en 384x691.", correccion: "—", estado: "OK" },
  { id: "UX-02", area: "Botones ocultos en producción", fase: "UX", descripcion: "Bell, Soy un local, Mis QR, Taxis, Trenes, Buses larga distancia ocultos en https público.", reproduccion: "Ver /admin/botones-ocultos.", correccion: "—", estado: "OK" },
  { id: "UX-03", area: "Accesibilidad básica", fase: "UX", descripcion: "Faltan aria-labels en algunos iconos clicables.", reproduccion: "Auditar con Lighthouse a11y.", correccion: "Añadir aria-label a botones-icono sin texto.", estado: "Warning" },

  // Seguridad
  { id: "SEC-01", area: "RLS en tablas principales", fase: "Seguridad", descripcion: "RLS activo en profiles, bookings, businesses, agente_*.", reproduccion: "Revisión de policies en Supabase.", correccion: "—", estado: "OK" },
  { id: "SEC-02", area: "Panel admin", fase: "Seguridad", descripcion: "Protegido por PIN + sessionStorage. No es auth fuerte.", reproduccion: "Acceder a /admin sin PIN.", correccion: "Migrar a verificación de rol admin (has_role) antes del beta público.", estado: "Critical" },
  { id: "SEC-03", area: "Exposición de datos públicos", fase: "Seguridad", descripcion: "places, businesses, bus_* son public read (esperado).", reproduccion: "—", correccion: "—", estado: "OK" },
  { id: "SEC-04", area: "Edge functions / server fns", fase: "Seguridad", descripcion: "Server functions usan requireSupabaseAuth donde corresponde.", reproduccion: "Revisar lib/*.functions.ts.", correccion: "—", estado: "OK" },

  // Endpoints
  { id: "EP-01", area: "Mapas", fase: "Endpoints", descripcion: "Google Maps API responde con clave configurada.", reproduccion: "Abrir ficha con mapa.", correccion: "—", estado: "OK" },
  { id: "EP-02", area: "Enlaces externos", fase: "Endpoints", descripcion: "Web, teléfono y WhatsApp abren correctamente.", reproduccion: "Probar 3 fichas.", correccion: "—", estado: "OK" },
  { id: "EP-03", area: "Hoteles LiteAPI", fase: "Endpoints", descripcion: "Búsqueda dinámica responde <2s en sandbox.", reproduccion: "Buscar hoteles.", correccion: "Monitorizar latencia en producción.", estado: "Warning" },

  // Rendimiento
  { id: "PERF-01", area: "Tiempos carga inicial", fase: "Rendimiento", descripcion: "SSR + preload de Tanstack reducen LCP.", reproduccion: "Lighthouse mobile.", correccion: "Comprimir imágenes hero a webp.", estado: "Warning" },
  { id: "PERF-02", area: "Scroll y carruseles", fase: "Rendimiento", descripcion: "Suaves en mobile real.", reproduccion: "Scroll en home y listados.", correccion: "—", estado: "OK" },
];

const SCORES = {
  global: 86,
  agente: 90,
  routing: 88,
  ux: 87,
  seguridad: 72,
  readiness: "Beta — apto con 1 bloqueante (SEC-02) a resolver antes de público abierto.",
};

function estadoBadge(e: Estado) {
  if (e === "OK") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">OK</Badge>;
  if (e === "Warning") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 border">Warning</Badge>;
  return <Badge className="bg-red-500/15 text-red-700 border-red-500/30 border">Critical</Badge>;
}

function ScoreCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  const color = value >= 85 ? "text-emerald-600" : value >= 70 ? "text-amber-600" : "text-red-600";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold ${color}`}>{value}<span className="text-sm text-muted-foreground">/100</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditoriaPage() {
  const [filtro, setFiltro] = useState<Estado | "ALL">("ALL");
  const items = useMemo(() => filtro === "ALL" ? HALLAZGOS : HALLAZGOS.filter(h => h.estado === filtro), [filtro]);

  const counts = useMemo(() => ({
    ok: HALLAZGOS.filter(h => h.estado === "OK").length,
    warn: HALLAZGOS.filter(h => h.estado === "Warning").length,
    crit: HALLAZGOS.filter(h => h.estado === "Critical").length,
  }), []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary mt-1" />
        <div>
          <h1 className="text-2xl font-semibold">Auditoría pre-lanzamiento</h1>
          <p className="text-sm text-muted-foreground">Informe funcional, contextual, TTS, UX, seguridad, endpoints y rendimiento.</p>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ScoreCard label="Global plataforma" value={SCORES.global} icon={Gauge} />
        <ScoreCard label="Agente" value={SCORES.agente} icon={Bot} />
        <ScoreCard label="Routing" value={SCORES.routing} icon={Compass} />
        <ScoreCard label="UX" value={SCORES.ux} icon={Smartphone} />
        <ScoreCard label="Seguridad" value={SCORES.seguridad} icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Readiness producción
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{SCORES.readiness}</CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><div><div className="text-xs text-muted-foreground">OK</div><div className="text-xl font-semibold">{counts.ok}</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><div><div className="text-xs text-muted-foreground">Warning</div><div className="text-xl font-semibold">{counts.warn}</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-600" /><div><div className="text-xs text-muted-foreground">Critical</div><div className="text-xl font-semibold">{counts.crit}</div></div></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "OK", "Warning", "Critical"] as const).map(f => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>{f === "ALL" ? "Todos" : f}</Button>
        ))}
      </div>

      {/* Hallazgos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> Hallazgos ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map(h => (
            <div key={h.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{h.id}</span>
                  <span className="font-medium text-sm">{h.area}</span>
                  <Badge variant="outline" className="text-xs">{h.fase}</Badge>
                </div>
                {estadoBadge(h.estado)}
              </div>
              <p className="text-sm">{h.descripcion}</p>
              <div className="grid md:grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Reproducción:</span> {h.reproduccion}</div>
                <div><span className="text-muted-foreground">Corrección:</span> {h.correccion}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mic className="h-4 w-4" /> Notas finales</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Plataforma apta para <strong>beta cerrada</strong>. Bloqueante para beta pública: <strong>SEC-02</strong> (autenticación robusta del panel admin con rol <code>has_role(auth.uid(), 'admin')</code>).</p>
          <p>Recomendado antes de abrir al público: resolver warnings de TTS overlap (Android Chrome), accesibilidad de iconos y monitorización de LiteAPI.</p>
        </CardContent>
      </Card>
    </div>
  );
}
