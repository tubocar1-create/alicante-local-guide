import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LEAFLET_HEAD_LINK } from "@/lib/leaflet-head";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Car,
  Clock,
  Globe,
  HeartPulse,
  MapPin,
  Phone,
  ShieldPlus,
  Siren,
  Stethoscope,
  Users,
} from "lucide-react";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));

// Ficha técnica curada por hospital (datos públicos)
type HospitalExtras = {
  lat: number;
  lng: number;
  beds?: number;
  staff?: number;
  founded?: number;
  area?: string; // población atendida
  level?: string; // nivel asistencial
  photos: string[];
  emergency_phone?: string;
  cita_phone?: string;
  services?: string[];
};

const EXTRAS: Record<string, HospitalExtras> = {
  // Hospital General Universitario Doctor Balmis
  "ac5060da-c9b9-4c74-8dc9-4f209cc4f51c": {
    lat: 38.3736,
    lng: -0.509,
    beds: 814,
    staff: 4200,
    founded: 1956,
    area: "≈ 270.000 habitantes",
    level: "Hospital terciario · referencia provincial",
    emergency_phone: "112",
    cita_phone: "966 908 484",
    services: [
      "Urgencias 24h",
      "UCI adultos y pediátrica",
      "Cirugía cardiovascular",
      "Oncología y radioterapia",
      "Maternidad y neonatología",
      "Trasplante renal",
      "Hemodiálisis",
      "Hospital de día",
      "Laboratorio y banco de sangre",
      "Radiología (TAC, RMN, PET-TC)",
      "Farmacia hospitalaria",
    ],
    photos: [
      "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=70",
    ],
  },
  // Hospital Universitario de Sant Joan d'Alacant
  "1e5fb1fa-0aba-457d-b173-578ea7c4cd1e": {
    lat: 38.4118,
    lng: -0.4391,
    beds: 370,
    staff: 2300,
    founded: 1984,
    area: "≈ 235.000 habitantes",
    level: "Hospital universitario · nivel II",
    emergency_phone: "112",
    cita_phone: "966 919 100",
    services: [
      "Urgencias 24h",
      "UCI",
      "Cirugía general y digestiva",
      "Ginecología y obstetricia",
      "Pediatría",
      "Oncología médica",
      "Rehabilitación",
      "Laboratorio clínico",
      "Diagnóstico por imagen",
      "Unidad del dolor",
    ],
    photos: [
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=70",
    ],
  },
  // Hospital General Universitario de Elche
  "64f8f487-da8d-4aa3-9bb8-b67bf25e6c25": {
    lat: 38.2589,
    lng: -0.7144,
    beds: 470,
    staff: 2400,
    founded: 1977,
    area: "≈ 165.000 habitantes",
    level: "Hospital universitario · nivel II",
    emergency_phone: "112",
    cita_phone: "966 616 117",
    services: [
      "Urgencias 24h",
      "UCI adultos",
      "Maternidad",
      "Pediatría",
      "Cardiología y hemodinámica",
      "Traumatología",
      "Oncología",
      "Diálisis",
      "Radiología (TAC, RMN)",
      "Farmacia hospitalaria",
    ],
    photos: [
      "https://images.unsplash.com/photo-1504439468489-c8920d796a29?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=70",
    ],
  },
  // Hospital General Universitario de Elda
  "bf0baa51-3395-48c0-80d7-618a821590b1": {
    lat: 38.4838,
    lng: -0.7866,
    beds: 320,
    staff: 1700,
    founded: 1984,
    area: "≈ 190.000 habitantes (Vinalopó Mitjà)",
    level: "Hospital comarcal · nivel II",
    emergency_phone: "112",
    cita_phone: "966 989 087",
    services: [
      "Urgencias 24h",
      "UCI",
      "Cirugía general",
      "Pediatría",
      "Ginecología y obstetricia",
      "Cardiología",
      "Traumatología",
      "Hemodiálisis",
      "Laboratorio",
      "Diagnóstico por imagen",
    ],
    photos: [
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=70",
      "https://images.unsplash.com/photo-1612824093904-2c0a9e0c0c5d?auto=format&fit=crop&w=900&q=70",
    ],
  },
};

type Hospital = {
  id: string;
  name: string;
  address: string | null;
  municipality: string;
  phone: string | null;
  schedule: string | null;
  health_department: string | null;
  website: string | null;
  specialties: string[] | null;
  associated_services: string[] | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
};

export const Route = createFileRoute("/hospitales_/$id")({
  head: () => ({
    meta: [{ title: "Ficha hospitalaria · Alicante" }],
    links: [LEAFLET_HEAD_LINK],
  }),
  component: HospitalDetailPage,
});

function HospitalDetailPage() {
  const { id } = Route.useParams();
  const [h, setH] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("health_centers")
        .select(
          "id, name, address, municipality, phone, schedule, health_department, website, specialties, associated_services, notes, lat, lng",
        )
        .eq("id", id)
        .maybeSingle();
      setH((data as Hospital) ?? null);
      setLoading(false);
    })();
  }, [id]);

  const extras = EXTRAS[id];
  const lat = h?.lat ?? extras?.lat ?? null;
  const lng = h?.lng ?? extras?.lng ?? null;
  const query = h
    ? encodeURIComponent(`${h.name} ${h.address ?? ""} ${h.municipality}`)
    : "";
  const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const services = extras?.services ?? h?.associated_services ?? [];
  const specialties = h?.specialties ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #022c22 0%, #064e3b 45%, #052e2b 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-5">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/hospitales"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-300/40 hover:text-emerald-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
            <ShieldPlus className="h-3 w-3" />
            SNS público
          </span>
        </header>

        {loading || !h ? (
          <p className="py-12 text-center text-sm text-emerald-200/70">
            {loading ? "Cargando ficha…" : "Hospital no encontrado."}
          </p>
        ) : (
          <>
            {/* Título */}
            <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300/70">
                Ficha técnica hospitalaria
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-emerald-50 md:text-3xl">
                {h.name}
              </h1>
              {extras?.level && (
                <p className="mt-1 text-[12px] text-emerald-200/80">
                  {extras.level}
                </p>
              )}
              {h.health_department && (
                <p className="mt-1 text-[11px] text-emerald-100/60">
                  {h.health_department}
                </p>
              )}
            </div>

            {/* Fotos */}
            {extras?.photos?.length ? (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {extras.photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${h.name} - foto ${i + 1}`}
                    loading="lazy"
                    className="h-32 w-full rounded-xl border border-emerald-300/10 object-cover md:h-44"
                  />
                ))}
              </div>
            ) : null}

            {/* Stats principales */}
            <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {extras?.beds != null && (
                <Stat icon={BedDouble} label="Camas" value={`${extras.beds}`} />
              )}
              {extras?.staff != null && (
                <Stat
                  icon={Users}
                  label="Profesionales"
                  value={`${extras.staff.toLocaleString("es")}`}
                />
              )}
              {extras?.founded != null && (
                <Stat
                  icon={Building2}
                  label="Inauguración"
                  value={`${extras.founded}`}
                />
              )}
              {extras?.area && (
                <Stat icon={HeartPulse} label="Población" value={extras.area} />
              )}
            </div>

            {/* Acciones */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <a
                href={dirHref}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 px-3 py-3 text-emerald-950 shadow-lg shadow-emerald-900/30 transition active:scale-95"
              >
                <Car className="h-5 w-5" />
                <span className="text-[11px] font-bold">Cómo llegar</span>
              </a>
              {h.phone && (
                <a
                  href={`tel:${h.phone.replace(/\s/g, "")}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-3 text-amber-950 shadow-lg shadow-amber-900/30 transition active:scale-95"
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Centralita</span>
                </a>
              )}
              <a
                href="tel:112"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 px-3 py-3 text-white shadow-lg shadow-rose-900/30 transition active:scale-95"
              >
                <Siren className="h-5 w-5" />
                <span className="text-[11px] font-bold">112 Urgencias</span>
              </a>
            </div>

            {/* Datos de contacto */}
            <div className="mb-4 space-y-2 rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-3 backdrop-blur-xl">
              {(h.address || h.municipality) && (
                <Row icon={MapPin} label="Dirección">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-100 underline-offset-2 hover:underline"
                  >
                    {[h.address, h.municipality].filter(Boolean).join(", ")}
                  </a>
                </Row>
              )}
              {h.phone && (
                <Row icon={Phone} label="Centralita">
                  <a
                    href={`tel:${h.phone.replace(/\s/g, "")}`}
                    className="font-mono text-emerald-100"
                  >
                    {h.phone}
                  </a>
                </Row>
              )}
              {extras?.cita_phone && (
                <Row icon={Phone} label="Cita previa">
                  <a
                    href={`tel:${extras.cita_phone.replace(/\s/g, "")}`}
                    className="font-mono text-emerald-100"
                  >
                    {extras.cita_phone}
                  </a>
                </Row>
              )}
              {h.schedule && (
                <Row icon={Clock} label="Horario">
                  <span>{h.schedule}</span>
                </Row>
              )}
              {h.website && (
                <Row icon={Globe} label="Web oficial">
                  <a
                    href={h.website}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-emerald-100 underline-offset-2 hover:underline"
                  >
                    {h.website.replace(/^https?:\/\//, "")}
                  </a>
                </Row>
              )}
            </div>

            {/* Mapa */}
            {lat != null && lng != null && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                  <MapPin className="h-3.5 w-3.5" />
                  Ubicación
                </p>
                <Suspense
                  fallback={
                    <div className="h-56 w-full animate-pulse rounded-2xl bg-emerald-900/40" />
                  }
                >
                  <PlaceLocationMap
                    lat={lat}
                    lng={lng}
                    name={h.name}
                    address={h.address}
                  />
                </Suspense>
              </div>
            )}

            {/* Servicios */}
            {services.length > 0 && (
              <Section
                icon={Stethoscope}
                title={`Servicios y unidades (${services.length})`}
              >
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-100"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Especialidades */}
            {specialties.length > 0 && (
              <Section icon={HeartPulse} title="Especialidades médicas">
                <div className="flex flex-wrap gap-1.5">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-teal-300/20 bg-teal-400/10 px-2.5 py-1 text-[11px] text-teal-100"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Notas */}
            {h.notes && (
              <Section icon={Building2} title="Sobre el hospital">
                <p className="text-[12px] leading-relaxed text-emerald-100/80">
                  {h.notes}
                </p>
              </Section>
            )}

            <p className="mt-6 text-center text-[10px] text-emerald-200/40">
              Datos públicos del SNS · Conselleria de Sanitat (GVA)
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.04] p-2.5 backdrop-blur-xl">
      <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-display text-base font-bold leading-tight text-emerald-50">
        {value}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/70" />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300/60">
          {label}
        </div>
        <div className="text-emerald-100/90">{children}</div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-emerald-300/15 bg-white/[0.03] p-3 backdrop-blur-xl">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}
