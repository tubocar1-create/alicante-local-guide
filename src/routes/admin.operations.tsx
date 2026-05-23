/**
 * Centro de Control Operativo (/admin/operations)
 *
 * Dashboard para observar el uso real de la app:
 * - KPIs superiores (eventos hoy, usuarios, clicks, reservas, maps)
 * - Feed de actividad en vivo
 * - Tabla operacional con filtros + paginación + auto-refresh
 * - Panel lateral de detalle con anotación/corrección manual
 *
 * NO incluye telemetría ni lógica del agente IA.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getOperationalKpis,
  listOperationalEvents,
  getOperationalEvent,
  saveOperationalReview,
} from "@/lib/operations/operations.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Activity,
  MousePointerClick,
  CalendarCheck,
  MapPin,
  Users,
  RefreshCw,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/operations")({
  head: () => ({
    meta: [
      { title: "Centro Operativo · Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OperationsPage,
});

// ---------------- Tipos ----------------

interface EventRow {
  id: string;
  type: string;
  source: string | null;
  business_id: string | null;
  user_id: string | null;
  campaign_id: string | null;
  conversion_status: string | null;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown> | null;
}

interface ReviewRow {
  id: string;
  event_id: string;
  flag: string;
  corrected_type: string | null;
  corrected_category: string | null;
  corrected_source: string | null;
  note: string | null;
  reviewed_by: string | null;
  created_at: string;
}

// ---------------- Constantes UI ----------------

const EVENT_TYPES = [
  "listing_opened",
  "maps_opened",
  "booking_started",
  "booking_created",
  "search_used",
  "filter_used",
  "chat_opened",
  "qr_generated",
  "section_changed",
  "page_view",
];

const FLAG_LABELS: Record<string, string> = {
  ok: "Correcto",
  incorrect_data: "Dato incorrecto",
  wrong_category: "Categoría incorrecta",
  duplicate: "Duplicado",
  false_positive: "Falso positivo",
  not_an_error: "No es un error",
};

// Mapeo type → color de badge para feedback visual rápido
const TYPE_COLOR: Record<string, string> = {
  listing_opened: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  maps_opened: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  booking_started: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  booking_created: "bg-green-500/15 text-green-700 dark:text-green-300",
  search_used: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  filter_used: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  chat_opened: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  qr_generated: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  section_changed: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  page_view: "bg-slate-400/15 text-slate-600 dark:text-slate-400",
};

// ---------------- Página ----------------

function OperationsPage() {
  const getKpis = useServerFn(getOperationalKpis);
  const listEvents = useServerFn(listOperationalEvents);
  const getEvent = useServerFn(getOperationalEvent);
  const saveReview = useServerFn(saveOperationalReview);

  const [kpis, setKpis] = useState<{
    eventsToday: number;
    eventsYesterday: number;
    clicks: number;
    bookings: number;
    maps: number;
    users: number;
  } | null>(null);

  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    event: EventRow | null;
    reviews: ReviewRow[];
  } | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);

  // ---- Cargas ----

  const refreshKpis = useCallback(async () => {
    try {
      const data = await getKpis();
      setKpis(data);
    } catch (e) {
      console.error(e);
    }
  }, [getKpis]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listEvents({
        data: {
          search,
          type: type === "all" ? "" : type,
          limit: pageSize,
          offset: page * pageSize,
        },
      });
      setRows(data.rows as EventRow[]);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [listEvents, search, type, page]);

  useEffect(() => {
    void refreshKpis();
    void refreshList();
  }, [refreshKpis, refreshList]);

  // Auto-refresh cada 15s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refreshKpis();
      void refreshList();
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshKpis, refreshList]);

  // Cargar detalle cuando se selecciona evento
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void (async () => {
      try {
        const data = await getEvent({ data: { id: selectedId } });
        setDetail({
          event: data.event as EventRow | null,
          reviews: data.reviews as ReviewRow[],
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedId, getEvent]);

  // Feed en vivo: los 8 más recientes
  const liveFeed = useMemo(() => rows.slice(0, 8), [rows]);

  const variation = useMemo(() => {
    if (!kpis) return null;
    const diff = kpis.eventsToday - kpis.eventsYesterday;
    const pct = kpis.eventsYesterday
      ? Math.round((diff / kpis.eventsYesterday) * 100)
      : null;
    return { diff, pct };
  }, [kpis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Centro Operativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Actividad real de la app · sin telemetría IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")}
            />
            Auto {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshKpis();
              void refreshList();
            }}
          >
            Refrescar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Eventos hoy"
          value={kpis?.eventsToday ?? "—"}
          delta={variation}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Usuarios activos"
          value={kpis?.users ?? "—"}
        />
        <KpiCard
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Clicks negocio"
          value={kpis?.clicks ?? "—"}
        />
        <KpiCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Reservas"
          value={kpis?.bookings ?? "—"}
        />
        <KpiCard
          icon={<MapPin className="h-4 w-4" />}
          label="Maps abiertos"
          value={kpis?.maps ?? "—"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Feed en vivo */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Actividad en vivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveFeed.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin eventos aún.</p>
            )}
            {liveFeed.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={cn("font-mono text-[10px]", TYPE_COLOR[e.type])}
                  >
                    {e.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(e.occurred_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {(e.metadata as { route?: string })?.route ?? e.source ?? "—"}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <CardTitle className="text-base">Eventos operacionales</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => {
                      setPage(0);
                      setSearch(e.target.value);
                    }}
                    className="pl-7 h-8 w-40"
                  />
                </div>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setPage(0);
                    setType(v);
                  }}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 font-medium">Hora</th>
                    <th className="text-left p-2 font-medium">Tipo</th>
                    <th className="text-left p-2 font-medium">Ruta</th>
                    <th className="text-left p-2 font-medium">Usuario</th>
                    <th className="text-left p-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Sin eventos.
                      </td>
                    </tr>
                  )}
                  {rows.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t hover:bg-muted/40 cursor-pointer"
                      onClick={() => setSelectedId(e.id)}
                    >
                      <td className="p-2 font-mono text-xs whitespace-nowrap">
                        {new Date(e.occurred_at).toLocaleTimeString()}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono text-[10px]",
                            TYPE_COLOR[e.type],
                          )}
                        >
                          {e.type}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground truncate max-w-[180px]">
                        {(e.metadata as { route?: string })?.route ??
                          e.source ??
                          "—"}
                      </td>
                      <td className="p-2 text-xs font-mono text-muted-foreground">
                        {e.user_id ? e.user_id.slice(0, 8) : "—"}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedId(e.id);
                          }}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Paginación */}
            <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground">
              <span>
                {total} eventos · página {page + 1} /{" "}
                {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel lateral detalle */}
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle del evento</SheetTitle>
            <SheetDescription>
              Información, contexto y corrección manual
            </SheetDescription>
          </SheetHeader>

          {detail?.event && (
            <EventDetail
              event={detail.event}
              reviews={detail.reviews}
              onSave={async (payload) => {
                await saveReview({
                  data: { ...payload, event_id: detail.event!.id },
                });
                // recargar detalle
                const d = await getEvent({
                  data: { id: detail.event!.id },
                });
                setDetail({
                  event: d.event as EventRow | null,
                  reviews: d.reviews as ReviewRow[],
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------- Subcomponentes ----------------

function KpiCard({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delta?: { diff: number; pct: number | null } | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span className="flex items-center gap-1.5">
            {icon}
            {label}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold">{value}</span>
          {delta && (
            <span
              className={cn(
                "text-xs flex items-center gap-0.5",
                delta.diff > 0 && "text-emerald-600",
                delta.diff < 0 && "text-red-600",
                delta.diff === 0 && "text-muted-foreground",
              )}
            >
              {delta.diff > 0 ? (
                <ArrowUp className="h-3 w-3" />
              ) : delta.diff < 0 ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {delta.pct !== null ? `${Math.abs(delta.pct)}%` : "—"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetail({
  event,
  reviews,
  onSave,
}: {
  event: EventRow;
  reviews: ReviewRow[];
  onSave: (payload: {
    flag: string;
    corrected_type?: string | null;
    corrected_category?: string | null;
    corrected_source?: string | null;
    note?: string | null;
  }) => Promise<void>;
}) {
  const [flag, setFlag] = useState<string>("ok");
  const [correctedType, setCorrectedType] = useState("");
  const [correctedSource, setCorrectedSource] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const route = (event.metadata as { route?: string })?.route ?? "—";

  return (
    <div className="space-y-5 mt-4">
      {/* Información */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Información</h3>
        <div className="text-xs space-y-1 bg-muted/40 p-3 rounded-md">
          <Field label="ID" value={event.id} mono />
          <Field label="Fecha" value={new Date(event.occurred_at).toLocaleString()} />
          <Field label="Tipo" value={event.type} />
          <Field label="Ruta" value={route} />
          <Field label="Usuario" value={event.user_id ?? "anónimo"} mono />
          <Field label="Negocio" value={event.business_id ?? "—"} mono />
          <Field label="Origen" value={event.source ?? "—"} />
          <Field
            label="Conversión"
            value={event.conversion_status ?? "—"}
          />
        </div>
      </section>

      {/* Metadata */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Metadata</h3>
        <pre className="text-[11px] bg-muted/40 p-3 rounded-md overflow-x-auto max-h-48">
          {JSON.stringify(event.metadata ?? {}, null, 2)}
        </pre>
      </section>

      {/* Revisiones previas */}
      {reviews.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">
            Revisiones ({reviews.length})
          </h3>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="text-xs border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{FLAG_LABELS[r.flag] ?? r.flag}</Badge>
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.note && <p className="mt-1 text-muted-foreground">{r.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Corrección manual */}
      <section className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3">Corregir / Anotar</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Marcar como</label>
            <Select value={flag} onValueChange={setFlag}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FLAG_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">
                Tipo corregido
              </label>
              <Input
                value={correctedType}
                onChange={(e) => setCorrectedType(e.target.value)}
                placeholder={event.type}
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">
                Origen corregido
              </label>
              <Input
                value={correctedSource}
                onChange={(e) => setCorrectedSource(e.target.value)}
                placeholder={event.source ?? ""}
                className="h-8"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">
              Nota operativa
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anotación interna…"
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  flag,
                  corrected_type: correctedType || null,
                  corrected_source: correctedSource || null,
                  note: note || null,
                });
                setNote("");
                setCorrectedType("");
                setCorrectedSource("");
                setFlag("ok");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando…" : "Guardar corrección"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right break-all", mono && "font-mono text-[10px]")}>
        {value}
      </span>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
