import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Car,
  ChevronDown,
  Clock,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShieldPlus,
  Siren,
  X,
} from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

// Centroides aproximados de municipios para estimar distancia
const MUNI_CENTROIDS: Record<string, [number, number]> = {
  Alicante: [38.3452, -0.481],
  "Sant Joan d'Alacant": [38.3956, -0.4385],
  "San Juan de Alicante": [38.3956, -0.4385],
  Elche: [38.2655, -0.6986],
  Elx: [38.2655, -0.6986],
  Elda: [38.4775, -0.7916],
  Torrevieja: [37.9787, -0.6822],
  Dénia: [38.8408, 0.1059],
  Orihuela: [38.0856, -0.9447],
  "Vila Joiosa": [38.5072, -0.2326],
  "La Vila Joiosa": [38.5072, -0.2326],
  Alcoi: [38.6989, -0.4738],
  Benidorm: [38.5411, -0.1226],
  "San Vicente del Raspeig": [38.3962, -0.5249],
};

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 *
      Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

type Hospital = {
  id: string;
  name: string;
  address: string | null;
  municipality: string;
  phone: string | null;
  schedule: string | null;
  health_department: string | null;
  website: string | null;
  kind: "publico" | "privado";
  has_urgencias: boolean;
};

// Hospitales privados de referencia en la provincia
const PRIVATE_HOSPITALS: Hospital[] = [
  {
    id: "priv-vithas-alicante",
    name: "Vithas Alicante (Medimar)",
    address: "Calle Padre Arrupe, 20",
    municipality: "Alicante",
    phone: "965 162 200",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://vithas.es/hospitales/vithas-alicante",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-vithas-perpetuo",
    name: "Vithas Perpetuo Socorro",
    address: "Plaza Dr. Gómez Ulla, 15",
    municipality: "Alicante",
    phone: "965 230 200",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://vithas.es/hospitales/vithas-perpetuo-socorro",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-quironsalud-torrevieja",
    name: "Quirónsalud Torrevieja",
    address: "Calle Partida de la Loma, s/n",
    municipality: "Torrevieja",
    phone: "966 921 313",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://www.quironsalud.com/torrevieja",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-hla-vistahermosa",
    name: "HLA Vistahermosa",
    address: "Av. de Denia, 103",
    municipality: "Alicante",
    phone: "965 264 200",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://www.hlavistahermosa.com/",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-imed-elche",
    name: "IMED Elche",
    address: "Calle Max Planck, 3",
    municipality: "Elche",
    phone: "966 916 200",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://www.imedhospitales.com/es/elche",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-imed-levante",
    name: "IMED Levante",
    address: "Calle Pintor Cabrera, 22",
    municipality: "Benidorm",
    phone: "966 819 800",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://www.imedhospitales.com/es/levante",
    kind: "privado",
    has_urgencias: true,
  },
  {
    id: "priv-clinica-benidorm",
    name: "Clínica Benidorm (HCB)",
    address: "Avda. Alfonso Puchades, 8",
    municipality: "Benidorm",
    phone: "965 853 850",
    schedule: "24h Urgencias",
    health_department: null,
    website: "https://www.clinicabenidorm.com/",
    kind: "privado",
    has_urgencias: true,
  },
];

// Cruz médica blanca sobre rojo (símbolo hospitalario)
const MedicalCross = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <rect x="0" y="0" width="24" height="24" rx="5" fill="#dc2626" />
    <rect x="10" y="4" width="4" height="16" rx="0.5" fill="#ffffff" />
    <rect x="4" y="10" width="16" height="4" rx="0.5" fill="#ffffff" />
  </svg>
);

export const Route = createFileRoute("/hospitales")({
  head: () => ({
    meta: [
      { title: "Hospitales de Alicante · Públicos y privados con ubicación" },
      {
        name: "description",
        content:
          "Dashboard de hospitales de la provincia de Alicante: públicos del SNS y privados. Dirección, teléfono, urgencias 24h y cómo llegar.",
      },
    ],
  }),
  component: HospitalesPage,
});

type Kind = "todos" | "publico" | "privado";

function HospitalesPage() {
  const [items, setItems] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("todos");
  const [activeMuni, setActiveMuni] = useState<string | null>(null);
  const [muniOpen, setMuniOpen] = useState(false);
  const [muniSearch, setMuniSearch] = useState("");
  const { state: geoState, request: requestGeo } = useUserLocation();
  const userCoords = geoState.status === "ready" ? geoState.coords : null;

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("health_centers")
        .select(
          "id, name, address, municipality, phone, schedule, health_department, website, specialties",
        )
        .eq("service_type", "hospital")
        .order("name");
      if (!error && data) {
        const publics: Hospital[] = (data as Array<Hospital & { specialties?: string[] }>).map(
          (h) => ({
            id: h.id,
            name: h.name,
            address: h.address,
            municipality: h.municipality,
            phone: h.phone,
            schedule: h.schedule,
            health_department: h.health_department,
            website: h.website,
            kind: "publico",
            has_urgencias:
              (h.schedule ?? "").toLowerCase().includes("24") ||
              (h.specialties ?? []).some((s) => s.toLowerCase().includes("urgencias")),
          }),
        );
        setItems([...publics, ...PRIVATE_HOSPITALS]);
      }
      setLoading(false);
    })();
  }, []);

  const distFor = (h: Hospital): number | null => {
    if (!userCoords) return null;
    const c = MUNI_CENTROIDS[h.municipality];
    if (!c) return null;
    return haversineMeters(userCoords, { lat: c[0], lng: c[1] });
  };

  const filtered = useMemo(() => {
    let base = items;
    if (kind !== "todos") base = base.filter((h) => h.kind === kind);
    if (activeMuni) base = base.filter((h) => h.municipality === activeMuni);
    const needle = q.trim().toLowerCase();
    if (needle) {
      base = base.filter((h) =>
        [h.name, h.address, h.municipality, h.health_department, h.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle)),
      );
    }
    if (userCoords) {
      base = [...base].sort((a, b) => {
        const da = distFor(a);
        const db = distFor(b);
        if (da == null && db == null) return a.name.localeCompare(b.name, "es");
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    } else {
      base = [...base].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "publico" ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, kind, activeMuni, q, userCoords]);

  const municipios = useMemo(() => {
    const set = new Set<string>();
    for (const h of items) set.add(h.municipality);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      publicos: items.filter((h) => h.kind === "publico").length,
      privados: items.filter((h) => h.kind === "privado").length,
      urgencias: items.filter((h) => h.has_urgencias).length,
    };
  }, [items]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #f8fafc 0%, #eef4fb 45%, #e0ecf8 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-rose-300/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/salud"
            className="text-[11px] uppercase tracking-[0.25em] text-sky-700/80 transition hover:text-sky-900"
          >
            ← Volver a Salud
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-sky-800/80">
              Activos · 24h
            </span>
            <Link
              to="/salud"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-sky-300/40 bg-white/60 p-1.5 text-sky-700 transition hover:border-sky-400/60"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-5 flex items-start gap-3">
          <MedicalCross className="mt-1 h-9 w-9 shrink-0 shadow-md" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-sky-700/70">
              Salud · Hospitales
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Hospitales{" "}
              <span className="bg-gradient-to-r from-sky-700 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                de Alicante
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              {loading
                ? "Cargando red hospitalaria…"
                : `${counts.total} hospitales · ${counts.publicos} públicos · ${counts.privados} privados`}
            </p>
          </div>
        </div>

        {/* Toggle público/privado + geolocalización + búsqueda */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-sky-300/50 bg-white/70 p-0.5 text-[11px] shadow-sm backdrop-blur">
            {(
              [
                { k: "todos", label: "Todos" },
                { k: "publico", label: "Públicos" },
                { k: "privado", label: "Privados" },
              ] as const
            ).map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1 transition ${
                  kind === k
                    ? "bg-sky-600 text-white shadow"
                    : "text-sky-800/80 hover:text-sky-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={requestGeo}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition ${
              userCoords
                ? "border-rose-400/50 bg-rose-50 text-rose-700"
                : "border-sky-300/50 bg-white/70 text-sky-800 hover:bg-white"
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-600/70" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar hospital, calle, municipio…"
              className="h-9 w-full rounded-full border border-sky-300/50 bg-white/80 pl-8 pr-3 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Selector de municipio */}
        <div className="mb-4">
          <button
            onClick={() => setMuniOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-sky-300/50 bg-white/80 px-3 py-2 text-left shadow-sm backdrop-blur transition hover:border-sky-500/70"
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[9px] uppercase tracking-[0.2em] text-sky-700/70">
                  Municipio
                </span>
                <span className="truncate text-[12px] font-semibold text-slate-900">
                  {activeMuni ?? `Toda la provincia · ${counts.total}`}
                </span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-sky-700/80" />
          </button>
        </div>

        {muniOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center"
            onClick={() => setMuniOpen(false)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-sky-200 bg-white p-3 shadow-2xl md:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MedicalCross className="h-4 w-4" /> Elige municipio
                </h3>
                <button
                  onClick={() => setMuniOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1">
                <Search className="h-3 w-3 text-sky-600/80" />
                <input
                  value={muniSearch}
                  onChange={(e) => setMuniSearch(e.target.value)}
                  placeholder="Buscar municipio…"
                  className="flex-1 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="max-h-[55vh] min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                <button
                  onClick={() => {
                    setActiveMuni(null);
                    setMuniOpen(false);
                    setMuniSearch("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                    activeMuni === null
                      ? "border-sky-500/60 bg-sky-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold">Toda la provincia</span>
                  <span className="text-[10px] text-slate-500">{counts.total}</span>
                </button>
                {municipios
                  .filter((m) =>
                    m.toLowerCase().includes(muniSearch.trim().toLowerCase()),
                  )
                  .map((m) => {
                    const n = items.filter((h) => h.municipality === m).length;
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          setActiveMuni(m);
                          setMuniOpen(false);
                          setMuniSearch("");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                          activeMuni === m
                            ? "border-sky-500/60 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0 truncate font-semibold">{m}</span>
                        <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {n}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Banner urgencias 24h */}
        <div className="mb-4 rounded-2xl border border-rose-300/50 bg-gradient-to-br from-rose-500/10 via-rose-400/5 to-transparent p-3 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Siren className="h-3.5 w-3.5 text-rose-600" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-700">
              Urgencias 24 horas · {counts.urgencias}
            </p>
          </div>
          <p className="text-[11px] text-slate-700">
            En caso de emergencia vital llama al{" "}
            <a href="tel:112" className="font-bold text-rose-700 underline">
              112
            </a>
            . Para consultas no urgentes utiliza tu centro de salud.
          </p>
        </div>

        {/* Lista de hospitales */}
        <div className="rounded-2xl border border-sky-200 bg-white/70 p-2 backdrop-blur-xl md:p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <p className="text-[12px] font-semibold text-slate-800">
              {loading ? "Cargando…" : `${filtered.length} hospitales`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
              {userCoords ? "ordenados por cercanía" : "ordenados por tipo"}
            </p>
          </div>

          <ul className="space-y-1.5">
            {filtered.map((h) => {
              const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${h.name} ${h.address ?? ""} ${h.municipality}`,
              )}`;
              const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${h.name} ${h.address ?? ""} ${h.municipality}`,
              )}&travelmode=driving`;
              const dist = distFor(h);
              const isPublic = h.kind === "publico";
              const cardCls = isPublic
                ? "border-sky-300/50 bg-sky-50/70 hover:bg-sky-50"
                : "border-violet-300/50 bg-violet-50/60 hover:bg-violet-50";
              return (
                <li
                  key={h.id}
                  className={`rounded-xl border p-2.5 transition ${cardCls}`}
                >
                  {/* Línea 1: nombre + tipo + distancia */}
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 flex-1 items-start gap-1.5"
                    >
                      <span className="mt-0.5 shrink-0 text-base leading-none">
                        {isPublic ? (
                          <ShieldPlus className="h-4 w-4 text-sky-700" />
                        ) : (
                          <Building2 className="h-4 w-4 text-violet-700" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-slate-900">
                        {h.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          isPublic
                            ? "bg-sky-600 text-white"
                            : "bg-violet-600 text-white"
                        }`}
                      >
                        {isPublic ? "SNS" : "Privado"}
                      </span>
                      {h.has_urgencias && (
                        <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          24h
                        </span>
                      )}
                    </a>
                    {userCoords && dist != null && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-600/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-800">
                        <Navigation className="h-2.5 w-2.5" />
                        {formatMeters(dist)}
                      </span>
                    )}
                  </div>

                  {/* Dirección */}
                  {(h.address || h.municipality) && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-600">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                      <span className="line-clamp-2">
                        {[h.address, h.municipality].filter(Boolean).join(" · ")}
                      </span>
                    </p>
                  )}

                  {/* Horario */}
                  {h.schedule && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-700">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-sky-600" />
                      <span className="line-clamp-2 leading-snug">{h.schedule}</span>
                    </p>
                  )}

                  {/* Departamento */}
                  {h.health_department && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {h.health_department}
                    </p>
                  )}

                  {/* Acciones */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <a
                      href={dirHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Cómo llegar a ${h.name}`}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
                    >
                      <Car className="h-2.5 w-2.5" />
                      Cómo llegar
                    </a>
                    {h.phone && (
                      <a
                        href={`tel:${h.phone.replace(/\s/g, "")}`}
                        aria-label={`Llamar a ${h.name}`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 font-mono text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {h.phone}
                      </a>
                    )}
                    {h.website && (
                      <a
                        href={h.website}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Web de ${h.name}`}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-50 active:scale-95"
                      >
                        <Globe className="h-2.5 w-2.5" />
                        Web oficial
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
            {!loading && filtered.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-slate-500">
                Sin resultados.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
