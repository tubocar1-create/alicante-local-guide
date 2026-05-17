import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sistema-sanitario")({
  head: () => ({
    meta: [
      { title: "Sistema Sanitario de Alicante | Hospitales y Centros de Salud" },
      {
        name: "description",
        content:
          "Guía oficial del sistema sanitario público de Alicante: atención primaria, hospitales, especialidades, urgencias, salud mental y trámites.",
      },
    ],
  }),
  component: SistemaSanitarioPage,
});

type HealthCenter = {
  id: string;
  name: string;
  service_type: string;
  specialties: string[];
  address: string | null;
  municipality: string;
  phone: string | null;
  schedule: string | null;
  health_department: string | null;
  associated_services: string[];
  website: string | null;
  source_url: string | null;
  notes: string | null;
};

// ─── Árbol de categorías ──────────────────────────────────────────────
type SubCat = {
  key: string;
  label: string;
  emoji?: string;
  // filtros aplicados sobre health_centers
  service_types?: string[];
  specialty_any?: string[]; // coincide si la especialidad contiene cualquier término
  staticInfo?: { title: string; body: React.ReactNode };
};

type Category = {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  subs: SubCat[];
};

const CATEGORIES: Category[] = [
  {
    key: "primaria",
    label: "Atención Primaria",
    emoji: "🩺",
    desc: "Tu centro de salud de referencia",
    subs: [
      { key: "centros", label: "Centros de Salud", emoji: "🏥", service_types: ["centro_salud", "consultorio"] },
      { key: "pediatria", label: "Pediatría", emoji: "👶", service_types: ["centro_salud"], specialty_any: ["Pediatría"] },
      { key: "familia", label: "Medicina Familiar", emoji: "👨‍⚕️", service_types: ["centro_salud"], specialty_any: ["Medicina familiar"] },
      { key: "enfermeria", label: "Enfermería", emoji: "💉", service_types: ["centro_salud"], specialty_any: ["Enfermería", "Matrona"] },
    ],
  },
  {
    key: "hospitales",
    label: "Hospitales",
    emoji: "🏨",
    desc: "Hospitales públicos de la provincia",
    subs: [
      { key: "all", label: "Todos los hospitales", emoji: "🏨", service_types: ["hospital"] },
      { key: "balmis", label: "Hospital Dr. Balmis", emoji: "⭐", service_types: ["hospital"], specialty_any: [] },
      { key: "santjoan", label: "Hospital Sant Joan", emoji: "⭐", service_types: ["hospital"], specialty_any: [] },
      { key: "elche", label: "Hospital de Elche", emoji: "⭐", service_types: ["hospital"], specialty_any: [] },
      { key: "elda", label: "Hospital de Elda", emoji: "⭐", service_types: ["hospital"], specialty_any: [] },
    ],
  },
  {
    key: "especialidades",
    label: "Especialidades",
    emoji: "🔬",
    desc: "Consultas externas por derivación",
    subs: [
      { key: "all", label: "Todas las especialidades", emoji: "🔬", service_types: ["especialidades", "hospital"] },
      { key: "cardio", label: "Cardiología", emoji: "❤️", specialty_any: ["Cardiología"] },
      { key: "trauma", label: "Traumatología", emoji: "🦴", specialty_any: ["Traumatología"] },
      { key: "derma", label: "Dermatología", emoji: "🧴", specialty_any: ["Dermatología"] },
      { key: "neuro", label: "Neurología", emoji: "🧠", specialty_any: ["Neurología"] },
      { key: "gine", label: "Ginecología", emoji: "🌸", specialty_any: ["Ginecología"] },
      { key: "oftal", label: "Oftalmología", emoji: "👁️", specialty_any: ["Oftalmología"] },
      { key: "orl", label: "Otorrinolaringología", emoji: "👂", specialty_any: ["Otorrinolaringología"] },
      { key: "onco", label: "Oncología", emoji: "🎗️", specialty_any: ["Oncología"] },
    ],
  },
  {
    key: "urgencias",
    label: "Urgencias",
    emoji: "🚑",
    desc: "Atención urgente y emergencias",
    subs: [
      {
        key: "samu",
        label: "SAMU · 112",
        emoji: "🚨",
        staticInfo: {
          title: "SAMU — Emergencias sanitarias",
          body: (
            <>
              <p>Para emergencias graves (pérdida de conocimiento, dolor torácico, accidente, hemorragia importante…) llama al <strong>112</strong>.</p>
              <p className="mt-2">El SAMU envía ambulancias medicalizadas con soporte vital avanzado. Servicio público y gratuito 24h.</p>
              <a href="tel:112" className="inline-block mt-3 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">📞 Llamar al 112</a>
            </>
          ),
        },
      },
      { key: "pac", label: "PAC · Punto de Atención Continuada", emoji: "🌙", service_types: ["urgencias"] },
      { key: "hosp", label: "Urgencias Hospitalarias 24h", emoji: "🏨", service_types: ["hospital"], specialty_any: ["Urgencias 24h"] },
    ],
  },
  {
    key: "mental",
    label: "Salud Mental",
    emoji: "🧠",
    desc: "Psicología, psiquiatría y unidades especializadas",
    subs: [
      { key: "all", label: "Unidades de Salud Mental", emoji: "🧠", service_types: ["salud_mental"] },
      { key: "psico", label: "Psicología", emoji: "💭", specialty_any: ["Psicología", "Psicología infantil"] },
      { key: "psiq", label: "Psiquiatría", emoji: "💊", specialty_any: ["Psiquiatría", "Psiquiatría infantil"] },
      { key: "infantil", label: "Infanto-Juvenil", emoji: "🧒", specialty_any: ["Psicología infantil", "Psiquiatría infantil"] },
    ],
  },
  {
    key: "admin",
    label: "Administración",
    emoji: "📋",
    desc: "Trámites: cita previa, tarjeta SIP, departamentos",
    subs: [
      {
        key: "cita",
        label: "Cita Previa",
        emoji: "📅",
        staticInfo: {
          title: "Cita Previa — Conselleria de Sanitat",
          body: (
            <>
              <p>Puedes pedir cita con tu médico de familia, pediatra o enfermería por estos canales:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>App oficial <strong>GVA + Salut</strong> (Android / iOS)</li>
                <li>Web: <a className="text-sky-700 underline" href="https://citaprevia.gva.es" target="_blank" rel="noreferrer">citaprevia.gva.es</a></li>
                <li>Teléfono automático: <a className="text-sky-700 underline" href="tel:966592100">966 592 100</a></li>
                <li>Mostrador de tu centro de salud</li>
              </ul>
            </>
          ),
        },
      },
      {
        key: "sip",
        label: "Tarjeta Sanitaria (SIP)",
        emoji: "💳",
        staticInfo: {
          title: "Tarjeta SIP",
          body: (
            <>
              <p>La tarjeta <strong>SIP</strong> es tu identificación sanitaria en la Comunitat Valenciana.</p>
              <p className="mt-2">Para solicitarla, renovarla o cambiar de centro acude al mostrador de tu centro de salud con DNI/NIE y certificado de empadronamiento.</p>
              <a className="inline-block mt-3 bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-lg" href="https://san.gva.es/es/sip" target="_blank" rel="noreferrer">Más información</a>
            </>
          ),
        },
      },
      {
        key: "deptos",
        label: "Departamentos de Salud",
        emoji: "🗺️",
        staticInfo: {
          title: "Departamentos de Salud en Alicante",
          body: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Dpto. Alicante — Hospital General Dr. Balmis</li>
              <li>Dpto. Sant Joan d'Alacant — Hospital Universitari Sant Joan</li>
              <li>Dpto. Elche — Hospital General</li>
              <li>Dpto. Elche-Crevillent — Hospital del Vinalopó</li>
              <li>Dpto. Elda — Hospital General de Elda</li>
              <li>Dpto. Marina Baixa — Hospital de la Vila Joiosa</li>
              <li>Dpto. Orihuela — Hospital Vega Baja</li>
              <li>Dpto. Torrevieja — Hospital de Torrevieja</li>
              <li>Dpto. Dénia — Hospital de Dénia</li>
              <li>Dpto. Alcoi — Hospital Verge dels Lliris</li>
            </ul>
          ),
        },
      },
      {
        key: "contactos",
        label: "Contactos útiles",
        emoji: "📞",
        staticInfo: {
          title: "Teléfonos útiles",
          body: (
            <ul className="space-y-1">
              <li>🚨 Emergencias: <a className="text-sky-700 underline" href="tel:112">112</a></li>
              <li>📅 Cita previa: <a className="text-sky-700 underline" href="tel:966592100">966 592 100</a></li>
              <li>☎️ Información Sanitat: <a className="text-sky-700 underline" href="tel:900161161">900 161 161</a></li>
              <li>💊 Farmacia de guardia: consulta <Link to="/farmacias" className="text-sky-700 underline">/farmacias</Link></li>
            </ul>
          ),
        },
      },
    ],
  },
];

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  hospital: { label: "Hospital", emoji: "🏨" },
  centro_salud: { label: "Centro de salud", emoji: "🩺" },
  consultorio: { label: "Consultorio", emoji: "🏡" },
  urgencias: { label: "Urgencias / PAC", emoji: "🚑" },
  especialidades: { label: "C. Especialidades", emoji: "🔬" },
  salud_mental: { label: "Salud Mental", emoji: "🧠" },
  farmacia: { label: "Farmacia", emoji: "💊" },
};

type Step = "categoria" | "subcategoria" | "departamento" | "municipio" | "resultados" | "detalle" | "info";

function SistemaSanitarioPage() {
  const [step, setStep] = useState<Step>("categoria");
  const [cat, setCat] = useState<Category | null>(null);
  const [sub, setSub] = useState<SubCat | null>(null);
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [selected, setSelected] = useState<HealthCenter | null>(null);
  const [data, setData] = useState<HealthCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("health_centers")
        .select("*")
        .order("name");
      if (!mounted) return;
      if (error) console.error(error);
      setData((data as HealthCenter[]) ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Centros filtrados por sub-categoría (sin filtros aún de depto/municipio)
  const baseFiltered = useMemo(() => {
    if (!sub) return [];
    let list = data;
    if (sub.service_types?.length) list = list.filter((d) => sub.service_types!.includes(d.service_type));
    if (sub.specialty_any?.length) {
      const terms = sub.specialty_any.map((t) => t.toLowerCase());
      list = list.filter((d) => d.specialties?.some((s) => terms.some((t) => s.toLowerCase().includes(t))));
    }
    // sub-categorías de hospital específico
    if (cat?.key === "hospitales" && sub.key !== "all") {
      const map: Record<string, RegExp> = {
        balmis: /balmis|general universitario de alicante|general d'alacant/i,
        santjoan: /sant joan|san juan/i,
        elche: /elche|elx/i,
        elda: /elda/i,
      };
      const re = map[sub.key];
      if (re) list = list.filter((d) => re.test(d.name));
    }
    return list;
  }, [data, sub, cat]);

  const departamentos = useMemo(() => Array.from(new Set(baseFiltered.map((d) => d.health_department ?? "Otros"))).sort(), [baseFiltered]);
  const municipios = useMemo(
    () => Array.from(new Set(baseFiltered.filter((d) => !departamento || d.health_department === departamento).map((d) => d.municipality))).sort(),
    [baseFiltered, departamento],
  );
  const resultados = useMemo(
    () => baseFiltered.filter((d) => (!departamento || d.health_department === departamento) && (!municipio || d.municipality === municipio)),
    [baseFiltered, departamento, municipio],
  );

  const reset = () => {
    setStep("categoria"); setCat(null); setSub(null);
    setDepartamento(null); setMunicipio(null); setSelected(null);
  };

  const chooseSub = (s: SubCat) => {
    setSub(s); setDepartamento(null); setMunicipio(null); setSelected(null);
    if (s.staticInfo) setStep("info");
    else setStep("departamento");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-sky-700 hover:underline">← Volver al inicio</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">🏥 Sistema Sanitario de Alicante</h1>
        <p className="text-sm text-slate-600 mt-1">
          Guía oficial: atención primaria, hospitales, especialidades, urgencias, salud mental y trámites administrativos.
        </p>

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-xs mt-4 text-slate-500">
          <button onClick={reset} className="hover:text-sky-700">Inicio</button>
          {cat && <><span>›</span><button onClick={() => { setSub(null); setStep("subcategoria"); }} className="hover:text-sky-700">{cat.label}</button></>}
          {sub && <><span>›</span><span className="text-slate-700">{sub.label}</span></>}
          {departamento && <><span>›</span><span className="text-slate-700">{departamento}</span></>}
          {municipio && <><span>›</span><span className="text-slate-700">{municipio}</span></>}
        </nav>
      </header>

      <main className="px-4 pb-12 max-w-2xl mx-auto">
        {loading && <p className="text-slate-500">Cargando…</p>}

        {!loading && step === "categoria" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">¿Qué necesitas?</h2>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => { setCat(c); setStep("subcategoria"); }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-400 hover:shadow-sm transition"
              >
                <div className="text-base font-semibold text-slate-900">
                  <span className="mr-2">{c.emoji}</span>{c.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
              </button>
            ))}
          </section>
        )}

        {!loading && step === "subcategoria" && cat && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">{cat.emoji} {cat.label}</h2>
            {cat.subs.map((s) => (
              <button
                key={s.key}
                onClick={() => chooseSub(s)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-sky-400 transition"
              >
                <div className="text-sm font-medium text-slate-900">
                  <span className="mr-2">{s.emoji}</span>{s.label}
                </div>
              </button>
            ))}
          </section>
        )}

        {!loading && step === "info" && sub?.staticInfo && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{sub.staticInfo.title}</h2>
            <div className="text-sm text-slate-700 leading-relaxed">{sub.staticInfo.body}</div>
            <button onClick={() => setStep("subcategoria")} className="mt-2 text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200">← Volver</button>
          </section>
        )}

        {!loading && step === "departamento" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">¿En qué departamento de salud?</h2>
            {baseFiltered.length === 0 && (
              <p className="text-sm text-slate-500">Aún no hay centros registrados para esta opción.</p>
            )}
            {baseFiltered.length > 0 && (
              <button
                onClick={() => { setDepartamento(null); setStep("municipio"); }}
                className="w-full text-left bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800 hover:bg-sky-100"
              >
                Cualquier departamento →
              </button>
            )}
            {departamentos.map((d) => (
              <button
                key={d}
                onClick={() => { setDepartamento(d); setStep("municipio"); }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-400 transition"
              >
                <div className="text-sm font-medium text-slate-900">{d}</div>
              </button>
            ))}
          </section>
        )}

        {!loading && step === "municipio" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">¿En qué municipio?</h2>
            <button
              onClick={() => { setMunicipio(null); setStep("resultados"); }}
              className="w-full text-left bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800 hover:bg-sky-100"
            >
              Cualquier municipio →
            </button>
            {municipios.map((m) => (
              <button
                key={m}
                onClick={() => { setMunicipio(m); setStep("resultados"); }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-400 transition"
              >
                <div className="text-sm font-medium text-slate-900">{m}</div>
              </button>
            ))}
          </section>
        )}

        {!loading && step === "resultados" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">
              {resultados.length} resultado{resultados.length === 1 ? "" : "s"}
            </h2>
            {resultados.length === 0 && (
              <p className="text-sm text-slate-500">No hay centros con estos filtros.</p>
            )}
            {resultados.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelected(c); setStep("detalle"); }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-400 transition"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {TYPE_LABELS[c.service_type]?.emoji} {c.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">{c.municipality} · {c.health_department}</div>
                {c.specialties?.length > 0 && (
                  <div className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {c.specialties.slice(0, 4).join(" · ")}
                  </div>
                )}
              </button>
            ))}
          </section>
        )}

        {!loading && step === "detalle" && selected && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-xl font-bold text-slate-900">
              {TYPE_LABELS[selected.service_type]?.emoji} {selected.name}
            </h2>
            <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold">
              {TYPE_LABELS[selected.service_type]?.label}
            </div>

            <dl className="text-sm divide-y divide-slate-100">
              {selected.address && <Row k="Dirección" v={`${selected.address}, ${selected.municipality}`} />}
              {selected.phone && <Row k="Teléfono" v={<a className="text-sky-700 underline" href={`tel:${selected.phone}`}>{selected.phone}</a>} />}
              {selected.schedule && <Row k="Horario" v={selected.schedule} />}
              {selected.health_department && <Row k="Departamento" v={selected.health_department} />}
              {selected.specialties?.length > 0 && <Row k="Especialidades" v={selected.specialties.join(", ")} />}
              {selected.associated_services?.length > 0 && <Row k="Servicios" v={selected.associated_services.join(", ")} />}
              {selected.notes && <Row k="Notas" v={selected.notes} />}
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg">📞 Llamar</a>
              )}
              {selected.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name}, ${selected.address}, ${selected.municipality}`)}`}
                  target="_blank" rel="noreferrer"
                  className="bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >🗺️ Cómo llegar</a>
              )}
              {selected.website && (
                <a href={selected.website} target="_blank" rel="noreferrer"
                   className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200">🌐 Web oficial</a>
              )}
              <button
                onClick={() => { setSelected(null); setStep("resultados"); }}
                className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200"
              >← Volver</button>
            </div>
          </section>
        )}

        {!loading && step !== "categoria" && step !== "detalle" && step !== "info" && (
          <button onClick={reset} className="mt-6 text-xs text-slate-500 hover:text-sky-700">↺ Empezar de nuevo</button>
        )}
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="py-2 grid grid-cols-3 gap-2">
      <dt className="text-xs uppercase text-slate-500 col-span-1">{k}</dt>
      <dd className="col-span-2 text-slate-800">{v}</dd>
    </div>
  );
}
