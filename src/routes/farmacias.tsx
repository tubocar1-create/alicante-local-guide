import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, MapPin, Navigation, Phone, Search, Sparkles, X } from "lucide-react";
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
  "03001": "Centro",
  "03002": "Casco Antiguo · Postiguet",
  "03003": "Mercado · Renfe",
  "03004": "Centro – Alfonso X",
  "03005": "Pla del Bon Repós",
  "03006": "Benalúa · Babel",
  "03007": "Carolinas Bajas",
  "03008": "Carolinas Altas",
  "03009": "Pla · Garbinet",
  "03010": "Virgen del Remedio",
  "03011": "Juan XXIII · V. del Carmen",
  "03012": "Ciudad de Asís · S. Familia",
  "03013": "San Blas",
  "03014": "Pol. San Blas · Tómbola",
  "03015": "Vistahermosa · Albufereta",
  "03016": "Cabo Huertas · Albufereta",
  "03112": "Villafranqueza",
  "03113": "Rebolledo · El Moralet",
  "03540": "Playa de San Juan",
  "03550": "Sant Joan d'Alacant",
  "03690": "Partidas Rurales",
  "03699": "Cañada del Fenollar",
};

const sectorFor = (cp: string | null) =>
  (cp && SECTORS[cp]) || (cp ? `Zona ${cp}` : "Sin código postal");

export const Route = createFileRoute("/farmacias")({
  head: () => ({
    meta: [
      { title: "Farmacias de Alicante · Dashboard por sector" },
      {
        name: "description",
        content:
          "Dashboard de farmacias de Alicante por sector y código postal. Direcciones, teléfonos y mapa.",
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
  const { state: geoState, request: requestGeo } = useUserLocation();
  const userCoords = geoState.status === "ready" ? geoState.coords : null;

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(
          "id, code, name, address, postal_code, city, phone, hours, is_24h, on_duty",
        )
        .order("postal_code", { ascending: true })
        .order("name", { ascending: true });
      if (!error && data) setItems(data as Pharmacy[]);
      setLoading(false);
    })();
  }, []);

  const distFor = (p: Pharmacy): number | null => {
    if (!userCoords || !p.postal_code) return null;
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
      className="fixed inset-0 z-[60] overflow-y-auto"
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
              className="h-9 w-full rounded-full border border-emerald-300/20 bg-white/[0.04] pl-8 pr-3 text-[12px] text-emerald-50 placeholder:text-emerald-200/40 focus:border-emerald-300/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Selector de zona (desplegable) */}
        <div className="mb-4 flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/60">
            {groupBy === "sector" ? "Sector" : "CP"}
          </label>
          <div className="relative">
            <select
              value={activeGroup ?? ""}
              onChange={(e) => setActiveGroup(e.target.value || null)}
              className="h-8 appearance-none rounded-full border border-emerald-300/25 bg-white/[0.04] py-1 pl-3 pr-8 text-[11px] text-emerald-50 focus:border-emerald-300/60 focus:outline-none"
            >
              <option value="" className="bg-emerald-950">
                Todas las zonas · {items.length}
              </option>
              {groups.map(([name, list]) => (
                <option key={name} value={name} className="bg-emerald-950">
                  {name} · {list.length}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-emerald-300/70">
              ▼
            </span>
          </div>
        </div>

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
                      <p className="truncate text-[11px] font-medium text-amber-50">
                        💊 {p.name}
                      </p>
                      <p className="truncate text-[10px] text-amber-100/60">
                        {p.address ?? ""}
                        {p.postal_code ? ` · ${p.postal_code}` : ""}
                      </p>
                    </div>
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="shrink-0 rounded-full bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] text-amber-950"
                      >
                        {p.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Tabla estilo dashboard */}
        <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-emerald-100">
              {loading ? "Cargando…" : `${filtered.length} farmacias`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-200/50">
              estado · horario · CP · {userCoords ? "dist" : "tel"}
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-emerald-50/90">
            <colgroup>
              <col />
              <col className="w-[54px]" />
              <col className="w-[110px] md:w-[24%]" />
              <col className="w-[52px]" />
              <col className="w-[78px]" />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.12em] text-emerald-200/60">
                <th className="px-1.5 py-1 font-medium">Farmacia</th>
                <th className="px-1 py-1 font-medium">Estado</th>
                <th className="px-1 py-1 font-medium">Horario</th>
                <th className="px-1 py-1 font-medium">CP</th>
                <th className="px-1 py-1 text-right font-medium">
                  {userCoords ? "Dist" : "Tel"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${p.name} ${p.address ?? ""} Alicante`,
                )}`;
                const status = computeOpen(p);
                const rowCls = p.is_24h
                  ? "bg-yellow-300/20 ring-1 ring-inset ring-yellow-300/50 hover:bg-yellow-300/25"
                  : "bg-white/[0.02] hover:bg-white/[0.05]";
                return (
                  <tr key={p.id} className={rowCls}>
                    <td className="rounded-l-md px-1.5 py-1.5 align-middle">
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-emerald-200"
                      >
                        <span className="text-[13px] leading-none">
                          {p.is_24h ? "🌙" : "💊"}
                        </span>
                        <span className="min-w-0 truncate text-[11px] font-medium">
                          {p.name}
                        </span>
                        {p.is_24h && (
                          <span className="ml-1 shrink-0 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-yellow-950">
                            24h
                          </span>
                        )}
                      </a>
                      {p.address && (
                        <p className="mt-0.5 truncate text-[9px] text-emerald-100/50 md:hidden">
                          <MapPin className="-mt-0.5 mr-0.5 inline h-2.5 w-2.5" />
                          {p.address}
                        </p>
                      )}
                    </td>
                    <td className="px-1 py-1 align-middle">
                      {status === "open" ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                          ● Abre
                        </span>
                      ) : status === "closed" ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold text-rose-300">
                          ● Cerr
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-1 py-0.5 text-[9px] font-semibold text-slate-400">
                          s/d
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 align-middle text-[10px] text-emerald-100/70">
                      <span className="flex items-start gap-1">
                        <Clock className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                        <span className="line-clamp-2 leading-tight">{p.hours ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <span className="font-mono text-[10px] text-emerald-200/80">
                        {p.postal_code ?? "—"}
                      </span>
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle">
                      {userCoords && (() => {
                        const d = distFor(p);
                        return d != null ? (
                          <div className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-200">
                            <Navigation className="h-3 w-3 text-emerald-300/70" />
                            ≈ {formatMeters(d)}
                          </div>
                        ) : (
                          <span className="text-[10px] text-emerald-200/40">—</span>
                        );
                      })()}
                      {p.phone ? (
                        <a
                          href={`tel:${p.phone}`}
                          aria-label={`Llamar a ${p.name}`}
                          className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] text-emerald-300 hover:text-emerald-200"
                        >
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{p.phone}</span>
                        </a>
                      ) : (
                        !userCoords && (
                          <span className="text-[10px] text-emerald-200/40">—</span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-4 text-center text-xs text-emerald-200/60"
                  >
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
