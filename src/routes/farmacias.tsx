import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, MapPin, Phone, Search, Sparkles, X } from "lucide-react";

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
  "03007": "Carolinas Bajas · Florida",
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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(
          "id, code, name, address, postal_code, city, phone, hours, is_24h, on_duty",
        )
        .order("is_24h", { ascending: false })
        .order("postal_code", { ascending: true })
        .order("name", { ascending: true });
      if (!error && data) setItems(data as Pharmacy[]);
      setLoading(false);
    })();
  }, []);

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
    return base;
  }, [items, q, activeGroup, groupBy]);

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

        {/* Chips de sectores */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGroup(null)}
            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
              activeGroup == null
                ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                : "border-emerald-300/15 bg-white/[0.02] text-emerald-200/60 hover:text-emerald-100"
            }`}
          >
            Todas · {items.length}
          </button>
          {groups.map(([name, list]) => (
            <button
              key={name}
              onClick={() => setActiveGroup(name === activeGroup ? null : name)}
              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                activeGroup === name
                  ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                  : "border-emerald-300/15 bg-white/[0.02] text-emerald-200/60 hover:text-emerald-100"
              }`}
            >
              {name} · {list.length}
            </button>
          ))}
        </div>

        {/* Tabla estilo dashboard */}
        <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-emerald-100">
              {loading ? "Cargando…" : `${filtered.length} farmacias`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-200/50">
              nombre · zona · dirección · tel
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-emerald-50/90">
            <colgroup>
              <col />
              <col className="w-[70px]" />
              <col className="hidden md:table-column md:w-[40%]" />
              <col className="w-[78px]" />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.12em] text-emerald-200/60">
                <th className="px-1.5 py-1 font-medium">Farmacia</th>
                <th className="px-1 py-1 font-medium">CP</th>
                <th className="hidden px-1 py-1 font-medium md:table-cell">
                  Dirección
                </th>
                <th className="px-1 py-1 text-right font-medium">Tel</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${p.name} ${p.address ?? ""} Alicante`,
                )}`;
                return (
                  <tr key={p.id} className="bg-white/[0.02] hover:bg-white/[0.05]">
                    <td className="rounded-l-md px-1.5 py-1.5 align-middle">
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-emerald-200"
                      >
                        <span className="text-[13px] leading-none">💊</span>
                        <span className="min-w-0 truncate text-[11px] font-medium">
                          {p.name}
                        </span>
                      </a>
                    </td>
                    <td className="px-1 py-1 align-middle font-mono text-[10px] text-emerald-200/80">
                      {p.postal_code ?? "—"}
                    </td>
                    <td className="hidden px-1 py-1 align-middle text-[10px] text-emerald-100/70 md:table-cell">
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1 hover:text-emerald-200"
                      >
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                        <span className="truncate">{p.address ?? "—"}</span>
                      </a>
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle">
                      {p.phone ? (
                        <a
                          href={`tel:${p.phone}`}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300 hover:text-emerald-200"
                        >
                          <Phone className="h-3 w-3" />
                          {p.phone}
                        </a>
                      ) : (
                        <span className="text-[10px] text-emerald-200/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
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
