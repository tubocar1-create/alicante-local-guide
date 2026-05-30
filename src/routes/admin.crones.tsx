import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Database, RefreshCw, Trash2, Sparkles, Bot, Hotel, Train, Plane, Film, Calendar, Newspaper, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/crones")({
  head: () => ({ meta: [{ title: "Crones programados — Admin" }] }),
  component: CronesPage,
});

type Cron = {
  name: string;
  schedule: string;
  scheduleHuman: string;
  what: string;
  why: string;
  type: "sync" | "purge" | "refresh";
};

type Group = {
  title: string;
  icon: typeof Clock;
  description: string;
  crons: Cron[];
};

const GROUPS: Group[] = [
  {
    title: "Cines",
    icon: Film,
    description: "Sincronización y limpieza de cartelera de cines.",
    crons: [
      {
        name: "cinemas-sync-daily",
        schedule: "0 11 * * *",
        scheduleHuman: "Todos los días a las 11:00 UTC",
        type: "sync",
        what: "Llama al endpoint que descarga la cartelera de cines y la guarda en la base de datos.",
        why: "Mantiene actualizada la cartelera diaria para que el agente pueda recomendar películas y horarios.",
      },
      {
        name: "purge-showtimes-daily",
        schedule: "30 3 * * *",
        scheduleHuman: "Todos los días a las 03:30 UTC",
        type: "purge",
        what: "Borra sesiones de cine pasadas y películas sin sesiones futuras (huérfanas).",
        why: "Evita acumular cartelera obsoleta que ya no sirve a nadie.",
      },
    ],
  },
  {
    title: "Eventos",
    icon: Calendar,
    description: "Sincronización y limpieza de eventos culturales y de ocio.",
    crons: [
      {
        name: "eventos-sync-monthly",
        schedule: "0 2 1 * *",
        scheduleHuman: "El día 1 de cada mes a las 02:00 UTC",
        type: "sync",
        what: "Descarga la agenda mensual de eventos y la guarda en base de datos.",
        why: "Refresco mensual del catálogo de eventos.",
      },
      {
        name: "eventos-purge-weekly",
        schedule: "0 3 * * 1",
        scheduleHuman: "Cada lunes a las 03:00 UTC",
        type: "purge",
        what: "Borra sesiones de eventos pasadas (con más de 1 día) y eventos sin sesiones futuras.",
        why: "Limpieza semanal para mantener la agenda ligera y al día.",
      },
      {
        name: "purge-operational-event-reviews-daily",
        schedule: "20 3 * * *",
        scheduleHuman: "Todos los días a las 03:20 UTC",
        type: "purge",
        what: "Limpia revisiones operativas de eventos antiguas.",
        why: "Evita que la cola de revisiones operativas crezca sin control.",
      },
    ],
  },
  {
    title: "Hoteles",
    icon: Hotel,
    description: "Refresco de precios dinámicos y catálogo estático de hoteles.",
    crons: [
      {
        name: "refresh-hotels-dynamic-night",
        schedule: "0 1 * * *",
        scheduleHuman: "Cada día a la 01:00 UTC (1 vez)",
        type: "refresh",
        what: "Refresca precios dinámicos de hoteles durante la noche.",
        why: "Ventana nocturna de bajo tráfico, una pasada diaria.",
      },
      {
        name: "refresh-hotels-dynamic-earlymorning",
        schedule: "*/30 4-7 * * *",
        scheduleHuman: "Cada 30 minutos, entre las 04:00 y las 07:59 UTC",
        type: "refresh",
        what: "Refresca precios dinámicos al despertar el día.",
        why: "Captura cambios tempranos de tarifa antes del pico de demanda.",
      },
      {
        name: "refresh-hotels-dynamic-morning",
        schedule: "*/10 8-11 * * *",
        scheduleHuman: "Cada 10 minutos, entre las 08:00 y las 11:59 UTC",
        type: "refresh",
        what: "Refresca precios dinámicos durante la mañana.",
        why: "Frecuencia alta en horas con muchas búsquedas.",
      },
      {
        name: "refresh-hotels-dynamic-midday",
        schedule: "*/5 12-16 * * *",
        scheduleHuman: "Cada 5 minutos, entre las 12:00 y las 16:59 UTC",
        type: "refresh",
        what: "Refresca precios dinámicos a mediodía/tarde.",
        why: "Máxima frecuencia: es la franja de mayor conversión.",
      },
      {
        name: "refresh-hotels-dynamic-evening",
        schedule: "*/15 17-22 * * *",
        scheduleHuman: "Cada 15 minutos, entre las 17:00 y las 22:59 UTC",
        type: "refresh",
        what: "Refresca precios dinámicos durante la tarde-noche.",
        why: "Equilibra frescura de datos y coste fuera del pico.",
      },
      {
        name: "refresh-hotels-dynamic-latenight",
        schedule: "0 23,0 * * *",
        scheduleHuman: "A las 23:00 y a las 00:00 UTC",
        type: "refresh",
        what: "Pasadas finales antes del cierre del día.",
        why: "Deja los precios al día para la primera consulta del día siguiente.",
      },
      {
        name: "sync-hotels-static-bimonthly",
        schedule: "0 3 1 1,3,5,7,9,11 *",
        scheduleHuman: "El día 1 de los meses impares a las 03:00 UTC",
        type: "sync",
        what: "Sincroniza el catálogo estático de hoteles (datos que cambian poco: nombre, dirección, descripción).",
        why: "Cada 2 meses es suficiente para info que no varía a diario.",
      },
      {
        name: "purge-hotels-calendar-daily",
        schedule: "25 3 * * *",
        scheduleHuman: "Todos los días a las 03:25 UTC",
        type: "purge",
        what: "Borra del calendario de hoteles las fechas que ya pasaron.",
        why: "Mantiene el calendario centrado en disponibilidad futura.",
      },
    ],
  },
  {
    title: "TRAM",
    icon: Train,
    description: "Sincronización y refresco del TRAM de Alicante.",
    crons: [
      {
        name: "tram-sync-daily",
        schedule: "0 1 * * *",
        scheduleHuman: "Todos los días a la 01:00 UTC",
        type: "sync",
        what: "Sincroniza horarios y servicios del TRAM para el día.",
        why: "Carga diaria del calendario del operador.",
      },
      {
        name: "refresh-tram-live-departures-every-10m",
        schedule: "*/10 * * * *",
        scheduleHuman: "Cada 10 minutos",
        type: "refresh",
        what: "Recalcula próximas salidas del TRAM para las siguientes 3 horas.",
        why: "Mantiene la información de salidas siempre fresca para el usuario.",
      },
      {
        name: "purge-tram-keep-window-daily",
        schedule: "10 1 * * *",
        scheduleHuman: "Todos los días a la 01:10 UTC",
        type: "purge",
        what: "Mantiene solo la ventana útil del TRAM (1 día), borra lo más viejo.",
        why: "Evita acumular horarios pasados que ya no se consultan.",
      },
    ],
  },
  {
    title: "AENA — Aeropuerto",
    icon: Plane,
    description: "Vuelos del aeropuerto de Alicante (ALC).",
    crons: [
      {
        name: "aena-sync-every-30-minutes",
        schedule: "*/30 * * * *",
        scheduleHuman: "Cada 30 minutos",
        type: "sync",
        what: "Descarga vuelos del aeropuerto ALC (llegadas y salidas).",
        why: "Los vuelos cambian de estado constantemente; media hora es el equilibrio entre frescura y coste.",
      },
      {
        name: "purge-aena-flights-every-30m",
        schedule: "*/30 * * * *",
        scheduleHuman: "Cada 30 minutos",
        type: "purge",
        what: "Borra vuelos cuya hora pasó hace más de 2 horas.",
        why: "La información de vuelos viejos no aporta valor; se mantiene solo la ventana útil.",
      },
    ],
  },
  {
    title: "Noticias y prensa",
    icon: Newspaper,
    description: "Refresco de noticias e incidencias locales.",
    crons: [
      {
        name: "refresh-alicante-news",
        schedule: "0 6 * * *",
        scheduleHuman: "Todos los días a las 06:00 UTC",
        type: "refresh",
        what: "Refresca el feed de noticias de Alicante.",
        why: "Una pasada diaria a primera hora deja el contenido listo para el día.",
      },
      {
        name: "refresh-alicante-press-daily",
        schedule: "0 2 * * *",
        scheduleHuman: "Todos los días a las 02:00 UTC",
        type: "refresh",
        what: "Refresca la selección de prensa local.",
        why: "Pasada nocturna fuera de horas de tráfico.",
      },
      {
        name: "refresh-incidencias-daily-7am",
        schedule: "0 6 * * *",
        scheduleHuman: "Todos los días a las 06:00 UTC",
        type: "refresh",
        what: "Refresca incidencias (cortes, obras, avisos) reportadas en la ciudad.",
        why: "Información operativa que el visitante consulta por la mañana.",
      },
    ],
  },
  {
    title: "Agente IA — Aprendizaje y limpieza",
    icon: Bot,
    description: "Mantenimiento de los datos del agente conversacional.",
    crons: [
      {
        name: "agente-learn-daily",
        schedule: "30 3 * * *",
        scheduleHuman: "Todos los días a las 03:30 UTC",
        type: "sync",
        what: "Ejecuta el proceso de aprendizaje del agente (analiza interacciones y mejora respuestas).",
        why: "Ciclo diario de mejora basado en lo aprendido el día anterior.",
      },
      {
        name: "purge-interaction-events-daily",
        schedule: "0 3 * * *",
        scheduleHuman: "Todos los días a las 03:00 UTC",
        type: "purge",
        what: "Borra eventos de interacción antiguos del agente.",
        why: "Evita inflar la tabla de eventos con datos que ya no sirven para análisis.",
      },
      {
        name: "purge-agente-learning-log-daily",
        schedule: "5 3 * * *",
        scheduleHuman: "Todos los días a las 03:05 UTC",
        type: "purge",
        what: "Limpia el log de aprendizaje del agente.",
        why: "Mantiene solo el histórico útil de aprendizaje.",
      },
      {
        name: "purge-agente-unknown-queries-daily",
        schedule: "10 3 * * *",
        scheduleHuman: "Todos los días a las 03:10 UTC",
        type: "purge",
        what: "Borra consultas no reconocidas antiguas.",
        why: "Las dudas viejas ya analizadas dejan de aportar; libera espacio.",
      },
      {
        name: "purge-agente-unknown-query-actions-daily",
        schedule: "15 3 * * *",
        scheduleHuman: "Todos los días a las 03:15 UTC",
        type: "purge",
        what: "Borra las acciones asociadas a consultas no reconocidas antiguas.",
        why: "Limpieza emparejada con la tabla anterior.",
      },
    ],
  },
];

const typeBadge = {
  sync: { label: "Sincronización", className: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300" },
  refresh: { label: "Refresco", className: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300" },
  purge: { label: "Limpieza", className: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300" },
} as const;

const typeIcon = { sync: Database, refresh: RefreshCw, purge: Trash2 } as const;

function CronesPage() {
  const total = GROUPS.reduce((acc, g) => acc + g.crons.length, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" /> Crones programados
        </h1>
        <p className="text-sm text-muted-foreground">
          Listado completo de las tareas automáticas que se ejecutan en segundo plano.
          Hay {total} crones activos agrupados por dominio. Todos los horarios están en UTC
          (Alicante = UTC+1 en invierno, UTC+2 en verano).
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className={typeBadge.sync.className}>Sincronización: trae datos nuevos de fuera</Badge>
          <Badge variant="outline" className={typeBadge.refresh.className}>Refresco: recalcula datos existentes</Badge>
          <Badge variant="outline" className={typeBadge.purge.className}>Limpieza: borra datos obsoletos</Badge>
        </div>
      </header>

      {GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="h-5 w-5 text-primary" />
                {group.title}
                <Badge variant="secondary" className="ml-2">{group.crons.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.crons.map((cron) => {
                const TypeIcon = typeIcon[cron.type];
                const badge = typeBadge[cron.type];
                return (
                  <div key={cron.name} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <code className="text-sm font-semibold break-all">{cron.name}</code>
                      </div>
                      <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
                        {cron.scheduleHuman}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        cron: {cron.schedule}
                      </p>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">¿Qué hace?</span> {cron.what}</p>
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">¿Por qué?</span> {cron.why}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Nota importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Esta página es <strong>solo informativa</strong>. Cualquier alta, baja o cambio de
            horario de un cron requiere instrucción explícita y se hace mediante migración SQL.
          </p>
          <p>
            Los crones de <strong>limpieza</strong> son independientes entre sí, cada uno se ocupa
            de su tabla. No existe un orquestador único.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
