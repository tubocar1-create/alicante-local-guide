import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car, Clock, MapPin, Navigation, Phone, Siren, X } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

// Centroides aproximados de municipios (lat/lng) para estimar distancia
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
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
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
  has_urgencias: boolean;
};

// Cruz hospitalaria estilo farmacia (verde)
const HospitalCross = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <rect x="9" y="2" width="6" height="20" rx="1" fill="#16a34a" />
    <rect x="2" y="9" width="20" height="6" rx="1" fill="#16a34a" />
  </svg>
);

export const Route = createFileRoute("/hospitales")({
  head: () => ({
    meta: [
      { title: "Hospitales públicos de Alicante · SNS con ubicación" },
      {
        name: "description",
        content:
          "Hospitales públicos del Sistema Nacional de Salud en la provincia de Alicante. Dirección, teléfono, urgencias 24h y distancia desde tu ubicación.",
      },
      { property: "og:title", content: "Hospitales públicos de Alicante" },
      { property: "og:description", content: "Hospitales del SNS en la provincia de Alicante con dirección, teléfono, urgencias 24h y distancia." },
      { property: "og:url", content: "https://vamosalicante.com/hospitales" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/hospitales" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Hospitales públicos de Alicante",
          description: "Directorio de hospitales del Sistema Nacional de Salud en la provincia de Alicante.",
          url: "https://vamosalicante.com/hospitales",
        }),
      },
    ],
  }),
  component: HospitalesPage,
});

function HospitalesPage() {
  const [items, setItems] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
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
        const publics: Hospital[] = (
          data as Array<Hospital & { specialties?: string[] }>
        ).map((h) => ({
          id: h.id,
          name: h.name,
          address: h.address,
          municipality: h.municipality,
          phone: h.phone,
          schedule: h.schedule,
          health_department: h.health_department,
          website: h.website,
          has_urgencias:
            (h.schedule ?? "").toLowerCase().includes("24") ||
            (h.specialties ?? []).some((s) => s.toLowerCase().includes("urgencias")),
        }));
        setItems(publics);
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

  const sorted = useMemo(() => {
    const base = [...items];
    if (userCoords) {
      base.sort((a, b) => {
        const da = distFor(a);
        const db = distFor(b);
        if (da == null && db == null) return a.name.localeCompare(b.name, "es");
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    } else {
      base.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, userCoords]);

  const urgencias = items.filter((h) => h.has_urgencias).length;

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #022c22 0%, #064e3b 45%, #052e2b 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/salud"
            className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 transition hover:text-emerald-200"
          >
            ← Volver a Salud
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/80">
              SNS · 24h
            </span>
            <Link
              to="/salud"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-emerald-300/20 p-1.5 text-emerald-200/80 transition hover:border-emerald-300/40 hover:text-emerald-100"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-5 flex items-start gap-3">
          <HospitalCross className="mt-1 h-9 w-9 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">
              Salud · Hospitales públicos
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-emerald-50 md:text-4xl">
              Hospitales{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200 bg-clip-text text-transparent">
                de Alicante
              </span>
            </h1>
            <p className="mt-1 text-xs text-emerald-100/70 md:text-sm">
              {loading
                ? "Cargando red hospitalaria…"
                : `${items.length} hospitales públicos · ${urgencias} con urgencias 24h`}
            </p>
          </div>
        </div>

        {/* Geolocalización */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
        </div>

        {/* Banner urgencias 24h */}
        <div className="mb-4 rounded-2xl border border-rose-300/30 bg-gradient-to-br from-rose-500/15 via-rose-400/5 to-transparent p-3 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Siren className="h-3.5 w-3.5 text-rose-300" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200">
              Urgencias 24 horas · {urgencias}
            </p>
          </div>
          <p className="text-[11px] text-emerald-100/80">
            En caso de emergencia vital llama al{" "}
            <a href="tel:112" className="font-bold text-rose-200 underline">
              112
            </a>
            . Para consultas no urgentes utiliza tu centro de salud.
          </p>
        </div>

        {/* Lista de hospitales */}
        <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-2 backdrop-blur-xl md:p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <p className="text-[12px] font-semibold text-emerald-100">
              {loading ? "Cargando…" : `${sorted.length} hospitales`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-200/50">
              {userCoords ? "ordenados por cercanía" : "ordenados a-z"}
            </p>
          </div>

          <ul className="space-y-1.5">
            {sorted.map((h) => {
              const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${h.name} ${h.address ?? ""} ${h.municipality}`,
              )}&travelmode=driving`;
              const dist = distFor(h);
              const cardCls = h.has_urgencias
                ? "border-yellow-300/40 bg-yellow-300/10 ring-1 ring-inset ring-yellow-300/30"
                : "border-emerald-300/10 bg-white/[0.03] hover:bg-white/[0.06]";
              return (
              <li key={h.id} className={`rounded-xl border p-2.5 transition ${cardCls}`}>
                  <Link
                    to="/hospitales/$id"
                    params={{ id: h.id }}
                    className="block"
                  >
                    {/* Línea 1: nombre + 24h + distancia */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <HospitalCross className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-emerald-50 underline-offset-2 hover:underline">
                          {h.name}
                        </span>
                        {h.has_urgencias && (
                          <span className="shrink-0 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-yellow-950">
                            24h
                          </span>
                        )}
                      </div>
                      {userCoords && dist != null && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                          <Navigation className="h-2.5 w-2.5" />
                          {formatMeters(dist)}
                        </span>
                      )}
                    </div>

                  {/* Dirección */}
                  {(h.address || h.municipality) && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-100/70">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                      <span className="line-clamp-2">
                        {[h.address, h.municipality].filter(Boolean).join(" · ")}
                      </span>
                    </p>
                  )}

                  {/* Horario */}
                  {h.schedule && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-emerald-100/75">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300/60" />
                      <span className="line-clamp-2 leading-snug">{h.schedule}</span>
                    </p>
                  )}

                  {/* Departamento */}
                  {h.health_department && (
                    <p className="mt-1 text-[10px] text-emerald-200/60">
                      {h.health_department}
                    </p>
                  )}
                  </Link>

                  {/* Acciones: Ir + teléfono (estilo farmacia) */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <a
                      href={dirHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Cómo llegar a ${h.name}`}
                      title="Cómo llegar en coche"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-300 active:scale-95"
                    >
                      <Car className="h-2.5 w-2.5" />
                      Ir
                    </a>
                    {h.phone && (
                      <a
                        href={`tel:${h.phone.replace(/\s/g, "")}`}
                        aria-label={`Llamar a ${h.name}`}
                        className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-300 active:scale-95"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        {h.phone}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
            {!loading && sorted.length === 0 && (
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
