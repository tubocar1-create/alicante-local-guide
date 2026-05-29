import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car, ChevronDown, Clock, MapPin, Navigation, Phone, Search, Sparkles, X } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

// Centroides aproximados por código postal (Alicante) para estimar distancia.
const CP_CENTROIDS: Record<string, [number, number]> = {
  "03001": [38.3452, -0.4810],
  "03002": [38.3470, -0.4790],
  "03003": [38.3430, -0.4870],
  "03004": [38.3490, -0.4855],
  "03005": [38.3530, -0.4830],
  "03006": [38.3380, -0.4900],
  "03007": [38.3550, -0.4895],
  "03008": [38.3585, -0.4870],
  "03009": [38.3640, -0.4810],
  "03010": [38.3700, -0.4900],
  "03011": [38.3640, -0.4980],
  "03012": [38.3580, -0.4760],
  "03013": [38.3565, -0.4710],
  "03014": [38.3625, -0.4660],
  "03015": [38.3590, -0.4400],
  "03016": [38.3490, -0.4310],
  "03112": [38.3800, -0.5050],
  "03113": [38.4000, -0.5100],
  "03540": [38.3650, -0.4150],
  "03550": [38.3960, -0.4380],
  "03690": [38.4200, -0.5400],
  "03699": [38.4150, -0.5800],
};

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

type Pharmacy = {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  hours: string | null;
  is_24h: boolean;
  on_duty: boolean;
  lat: number | null;
  lng: number | null;
};

// Calcula estado abierto/cerrado a partir de la cadena de horario.
// Soporta strings tipo "Lu-Vi 09:30-13:30 y 16:30-20:30 · Sa 09:30-13:30".
function computeOpen(p: Pharmacy): "open" | "closed" | "unknown" {
  if (p.is_24h) return "open";
  if (!p.hours) return "unknown";
  const now = new Date();
  const dow = now.getDay(); // 0=Dom..6=Sab
  // map ES short
  const isWeekday = dow >= 1 && dow <= 5;
  const isSat = dow === 6;
  const isSun = dow === 0;
  const hhmm = now.getHours() * 60 + now.getMinutes();
  const segments = p.hours.split(/·|;/).map((s) => s.trim());
  let applicable: string | null = null;
  for (const seg of segments) {
    const lower = seg.toLowerCase();
    if (isWeekday && /lu.?-vi|l-v/.test(lower)) applicable = seg;
    else if (isSat && /sa/.test(lower)) applicable = seg;
    else if (isSun && /do/.test(lower)) applicable = seg;
  }
  if (!applicable) return isSun ? "closed" : "unknown";
  const ranges = applicable.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g);
  if (!ranges) return "unknown";
  for (const r of ranges) {
    const m = r.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)!;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (hhmm >= start && hhmm <= end) return "open";
  }
  return "closed";
}

const SECTORS: Record<string, string> = {
  "03001": "Centro · Explanada · Puerto · Casco Histórico",
  "03002": "Santa Cruz · Casco Antiguo · Ayuntamiento · Rambla",
  "03003": "Ensanche Diputación · Benalúa · Canalejas",
  "03004": "Mercado Central · Plaza de Toros · Campoamor",
  "03005": "Babel · Benalúa Sur · Florida Baja",
  "03006": "La Florida · Ciudad de Asís · Babel",
  "03007": "San Gabriel · Gran Vía Sur",
  "03008": "Rabasa · Tómbola · Ciudad Jardín",
  "03009": "Virgen del Remedio · Juan XXIII · Colonia Requena",
  "03010": "Altozano · Los Ángeles · San Blas Alto",
  "03011": "Divina Pastora · Villafranqueza · Garbinet",
  "03012": "Carolinas Altas · Pla del Bon Repós",
  "03013": "Carolinas Bajas · Campoamor · Mercado",
  "03014": "Nou Alacant · Virgen del Carmen",
  "03015": "Playa de San Juan · Vistahermosa · Albufereta",
  "03016": "Cabo de las Huertas · Playa de San Juan · Albufereta",
};

const sectorFor = (cp: string | null) =>
  (cp && SECTORS[cp]) || (cp ? `Zona ${cp}` : "Sin código postal");

// Cruz verde estilo farmacia española
const PharmacyCross = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <rect x="9" y="2" width="6" height="20" rx="1" fill="#16a34a" />
    <rect x="2" y="9" width="20" height="6" rx="1" fill="#16a34a" />
  </svg>
);

export const Route = createFileRoute("/farmacias")({
  head: () => ({
    meta: [
      { title: "Farmacias de Alicante · Dashboard por sector" },
      {
        name: "description",
        content:
          "Dashboard de farmacias de Alicante por sector y código postal. Direcciones, teléfonos y mapa.",
      },
      { property: "og:title", content: "Farmacias de Alicante — Dashboard por sector y código postal" },
      { property: "og:description", content: "Encuentra farmacias en Alicante por sector y CP: direcciones, teléfonos, horarios y mapa interactivo." },
      { property: "og:url", content: "https://vamosalicante.com/farmacias" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/farmacias" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Farmacias de Alicante",
          description: "Directorio de farmacias en Alicante por sector y código postal con direcciones y teléfonos.",
          url: "https://vamosalicante.com/farmacias",
        }),
      },
    ],
  }),
  component: FarmaciasPage,
});

function FarmaciasPage() {
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<"sector" | "postal">("sector");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const { state: geoState, request: requestGeo } = useUserLocation();
  const userCoords = geoState.status === "ready" ? geoState.coords : null;

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(
          "id, code, name, address, postal_code, city, phone, hours, is_24h, on_duty, lat, lng",
        )
        .order("postal_code", { ascending: true })
        .order("name", { ascending: true });
      if (!error && data) setItems(data as Pharmacy[]);
      setLoading(false);
    })();
  }, []);

  const distFor = (p: Pharmacy): number | null => {
    if (!userCoords) return null;
    // Prefer real geocoded coords when available
    if (p.lat != null && p.lng != null) {
      return haversineMeters(userCoords, { lat: p.lat, lng: p.lng });
    }
    if (!p.postal_code) return null;
    const c = CP_CENTROIDS[p.postal_code];
    if (!c) return null;
    return haversineMeters(userCoords, { lat: c[0], lng: c[1] });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base = items;
    if (needle) {
      base = base.filter((p) =>
        [p.name, p.address, p.postal_code, p.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle)),
      );
    }
    if (activeGroup) {
      base = base.filter((p) => {
        const key =
          groupBy === "sector"
            ? sectorFor(p.postal_code)
            : p.postal_code || "Sin CP";
        return key === activeGroup;
      });
    }
    if (userCoords) {
      base = [...base].sort((a, b) => {
        const da = distFor(a);
        const db = distFor(b);
        if (da == null && db == null) {
          return (a.postal_code ?? "").localeCompare(b.postal_code ?? "");
        }
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    } else {
      base = [...base].sort((a, b) => {
        const cp = (a.postal_code ?? "zzz").localeCompare(b.postal_code ?? "zzz");
        if (cp !== 0) return cp;
        return a.name.localeCompare(b.name, "es");
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, activeGroup, groupBy, userCoords]);

  const groups = useMemo(() => {
    const map = new Map<string, Pharmacy[]>();
    for (const p of items) {
      const key =
        groupBy === "sector"
          ? sectorFor(p.postal_code)
          : p.postal_code || "Sin CP";
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "es"),
    );
  }, [items, groupBy]);

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #04130d 0%, #06241a 45%, #0a1f2e 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 transition hover:text-emerald-200"
          >
            ← Volver
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/80">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-emerald-300/20 p-1.5 text-emerald-200/80 transition hover:border-emerald-300/40 hover:text-emerald-100"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">
            Salud · Directorio
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-emerald-50 md:text-4xl">
            Farmacias{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200 bg-clip-text text-transparent">
              de Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-emerald-100/70 md:text-sm">
            {loading
              ? "Cargando red de farmacias…"
              : `${items.length} farmacias en ${groups.length} ${
                  groupBy === "sector" ? "sectores" : "códigos postales"
                }`}
          </p>
        </div>

        {/* Toggle + search */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-white/[0.03] p-0.5 text-[11px] backdrop-blur">
            <button
              onClick={() => {
                setGroupBy("sector");
                setActiveGroup(null);
              }}
              className={`rounded-full px-3 py-1 transition ${
                groupBy === "sector"
                  ? "bg-emerald-400/90 text-emerald-950"
                  : "text-emerald-200/70 hover:text-emerald-100"
              }`}
            >
              Por sector
            </button>
            <button
              onClick={() => {
                setGroupBy("postal");
                setActiveGroup(null);
              }}
              className={`rounded-full px-3 py-1 transition ${
                groupBy === "postal"
                  ? "bg-emerald-400/90 text-emerald-950"
                  : "text-emerald-200/70 hover:text-emerald-100"
              }`}
            >
              Por CP
            </button>
          </div>
          <button
            onClick={requestGeo}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition ${
              userCoords
                ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                : "border-emerald-300/20 bg-white/[0.04] text-emerald-200/80 hover:text-emerald-100"
            }`}
            title={geoState.status === "error" ? geoState.message : "Ordenar por cercanía"}
          >
            <Navigation className="h-3 w-3" />
            {geoState.status === "loading"
              ? "Localizando…"
              : userCoords
                ? "Cerca de ti"
                : "Usar mi ubicación"}
          </button>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-300/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar farmacia, calle, CP…"
              aria-label="Buscar farmacias"
              className="h-9 w-full rounded-full border border-emerald-300/20 bg-white/[0.04] pl-8 pr-3 text-[12px] text-emerald-50 placeholder:text-emerald-200/40 focus:border-emerald-300/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Selector de zona estilo BusKnownPicker */}
        <div className="mb-4">
          <button
            onClick={() => setZoneOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-emerald-300/25 bg-white/[0.04] px-3 py-2 text-left backdrop-blur transition hover:border-emerald-300/45"
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-200/60">
                  {groupBy === "sector" ? "Sector" : "Código postal"}
                </span>
                <span className="truncate text-[12px] font-semibold text-emerald-50">
                  {activeGroup ?? `Todas las zonas · ${items.length}`}
                </span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-emerald-300/80" />
          </button>
        </div>

        {zoneOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
            onClick={() => setZoneOpen(false)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-emerald-300/20 bg-emerald-950/95 p-3 shadow-2xl md:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-50">
                  <PharmacyCross className="h-4 w-4" /> Elige zona
                </h2>
                <button
                  onClick={() => setZoneOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4 text-emerald-100" />
                </button>
              </div>

              <div className="mb-2 inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-emerald-300/20 bg-white/[0.04] p-0.5 text-[11px]">
                <button
                  onClick={() => {
                    setGroupBy("sector");
                    setActiveGroup(null);
                  }}
                  className={`rounded-full px-3 py-1 transition ${
                    groupBy === "sector"
                      ? "bg-emerald-400/90 text-emerald-950"
                      : "text-emerald-200/70"
                  }`}
                >
                  Por sector
                </button>
                <button
                  onClick={() => {
                    setGroupBy("postal");
                    setActiveGroup(null);
                  }}
                  className={`rounded-full px-3 py-1 transition ${
                    groupBy === "postal"
                      ? "bg-emerald-400/90 text-emerald-950"
                      : "text-emerald-200/70"
                  }`}
                >
                  Por CP
                </button>
              </div>

              <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-white/[0.04] px-2.5 py-1">
                <Search className="h-3 w-3 text-emerald-300/70" />
                <input
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder="Buscar zona…"
                  aria-label="Filtrar por zona"
                  className="flex-1 bg-transparent text-[12px] text-emerald-50 outline-none placeholder:text-emerald-200/40"
                />
              </div>

              <div className="max-h-[55vh] min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                <button
                  onClick={() => {
                    setActiveGroup(null);
                    setZoneOpen(false);
                    setZoneSearch("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                    activeGroup === null
                      ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-50"
                      : "border-emerald-300/10 bg-white/[0.03] text-emerald-100 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="font-semibold">Todas las zonas</span>
                  <span className="text-[10px] text-emerald-200/70">{items.length}</span>
                </button>
                {groups
                  .filter(([name]) =>
                    name.toLowerCase().includes(zoneSearch.trim().toLowerCase()),
                  )
                  .map(([name, list]) => (
                    <button
                      key={name}
                      onClick={() => {
                        setActiveGroup(name);
                        setZoneOpen(false);
                        setZoneSearch("");
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                        activeGroup === name
                          ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-50"
                          : "border-emerald-300/10 bg-white/[0.03] text-emerald-100 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="min-w-0 truncate font-semibold">{name}</span>
                      <span className="ml-2 shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-emerald-200/80">
                        {list.length}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Banner farmacias 24h */}
        {(() => {
          const h24 = items.filter((p) => p.is_24h);
          if (h24.length === 0) return null;
          return (
            <div className="mb-4 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-400/10 via-orange-400/5 to-transparent p-3 backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200">
                  Turno 24 horas · {h24.length}
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {h24.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-300/15 bg-white/[0.03] px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-[11px] font-medium text-amber-50">
                        <PharmacyCross className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </p>
                      <p className="truncate text-[10px] text-amber-100/60">
                        {p.address ?? ""}
                        {p.postal_code ? ` · ${sectorFor(p.postal_code)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          `${p.name} ${p.address ?? ""} Alicante`,
                        )}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Cómo llegar a ${p.name}`}
                        title="Cómo llegar en coche"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-950 active:scale-95"
                      >
                        <Car className="h-2.5 w-2.5" />
                        Ir
                      </a>
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          role="button"
                          aria-label={`Llamar a ${p.name}`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-950 active:scale-95"
                        >
                          <Phone className="h-2.5 w-2.5" />
                          {p.phone}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Lista de farmacias en tarjetas legibles */}
        <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-2 backdrop-blur-xl md:p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <p className="text-[12px] font-semibold text-emerald-100">
              {loading ? "Cargando…" : `${filtered.length} farmacias`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-200/50">
              {userCoords ? "ordenadas por cercanía" : "ordenadas por zona"}
            </p>
          </div>

          <ul className="space-y-1.5">
            {filtered.map((p) => {
              const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${p.name} ${p.address ?? ""} Alicante`,
              )}`;
              const status = computeOpen(p);
              const dist = distFor(p);
              const cardCls = p.is_24h
                ? "border-yellow-300/50 bg-yellow-300/15 ring-1 ring-inset ring-yellow-300/40"
                : "border-emerald-300/10 bg-white/[0.03] hover:bg-white/[0.06]";
              return (
                <li
                  key={p.id}
                  className={`rounded-xl border p-2.5 transition ${cardCls}`}
                >
                  {/* Línea 1: nombre + badge 24h + distancia */}
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                    >
                      <span className="text-base leading-none">
                        {p.is_24h ? "🌙" : <PharmacyCross className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-emerald-50">
                        {p.name}
                      </span>
                      {p.is_24h && (
                        <span className="shrink-0 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-yellow-950">
                          24h
                        </span>
                      )}
                    </a>
                    {userCoords && dist != null && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                        <Navigation className="h-2.5 w-2.5" />
                        {formatMeters(dist)}
                      </span>
                    )}
                  </div>

                  {/* Línea 2: dirección */}
                  {p.address && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-100/70">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                      <span className="line-clamp-2">{p.address}</span>
                    </p>
                  )}

                  {/* Línea 3: horario */}
                  {p.hours && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-100/75">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                      <span className="line-clamp-2 leading-snug">{p.hours}</span>
                    </p>
                  )}

                  {/* Línea 4: estado + CP + tel */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {status === "open" ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        ● Abierta
                      </span>
                    ) : status === "closed" ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        ● Cerrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        s/d
                      </span>
                    )}
                    {p.postal_code && (
                      <span className="rounded-full border border-emerald-300/20 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-emerald-200/80">
                        {sectorFor(p.postal_code)}
                      </span>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${p.name} ${p.address ?? ""} Alicante`,
                      )}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Cómo llegar a ${p.name}`}
                      title="Cómo llegar en coche"
                      className={`${p.phone ? "" : "ml-auto "}inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-950 shadow-sm transition active:scale-95 hover:bg-emerald-300`}
                    >
                      <Car className="h-2.5 w-2.5" />
                      Ir
                    </a>
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        role="button"
                        aria-label={`Llamar a ${p.name}`}
                        className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-950 shadow-sm transition active:scale-95 hover:bg-amber-300"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {p.phone}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
            {!loading && filtered.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-emerald-200/60">
                Sin resultados.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
