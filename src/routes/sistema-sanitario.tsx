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
          "Guía oficial del sistema sanitario público de Alicante: hospitales, centros de salud, urgencias y especialidades por departamento y municipio.",
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

const TYPE_LABELS: Record<string, { label: string; emoji: string; desc: string }> = {
  hospital: { label: "Hospital", emoji: "🏥", desc: "Atención hospitalaria y urgencias 24h" },
  centro_salud: { label: "Centro de salud", emoji: "🩺", desc: "Atención primaria y pediatría" },
  consultorio: { label: "Consultorio", emoji: "🏡", desc: "Consultas en pedanías y municipios pequeños" },
  urgencias: { label: "Urgencias / PAC", emoji: "🚑", desc: "Atención fuera del horario habitual" },
  especialidades: { label: "Centro de especialidades", emoji: "🔬", desc: "Consultas externas por derivación" },
  farmacia: { label: "Farmacia", emoji: "💊", desc: "Farmacias y guardias" },
};

type Step = "tipo" | "departamento" | "municipio" | "resultados" | "detalle";

function SistemaSanitarioPage() {
  const [step, setStep] = useState<Step>("tipo");
  const [tipo, setTipo] = useState<string | null>(null);
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
    return () => {
      mounted = false;
    };
  }, []);

  const tipos = useMemo(() => {
    const s = new Set(data.map((d) => d.service_type));
    return Array.from(s);
  }, [data]);

  const departamentos = useMemo(() => {
    const s = new Set(
      data.filter((d) => !tipo || d.service_type === tipo).map((d) => d.health_department ?? "Otros"),
    );
    return Array.from(s).sort();
  }, [data, tipo]);

  const municipios = useMemo(() => {
    const s = new Set(
      data
        .filter((d) => (!tipo || d.service_type === tipo) && (!departamento || d.health_department === departamento))
        .map((d) => d.municipality),
    );
    return Array.from(s).sort();
  }, [data, tipo, departamento]);

  const resultados = useMemo(
    () =>
      data.filter(
        (d) =>
          (!tipo || d.service_type === tipo) &&
          (!departamento || d.health_department === departamento) &&
          (!municipio || d.municipality === municipio),
      ),
    [data, tipo, departamento, municipio],
  );

  const reset = () => {
    setStep("tipo");
    setTipo(null);
    setDepartamento(null);
    setMunicipio(null);
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-sky-700 hover:underline">← Volver al inicio</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">🏥 Sistema Sanitario de Alicante</h1>
        <p className="text-sm text-slate-600 mt-1">
          Información oficial extraída de los portales{" "}
          <a className="underline" href="https://san.gva.es" target="_blank" rel="noreferrer">san.gva.es</a>,{" "}
          <a className="underline" href="https://alicante.san.gva.es" target="_blank" rel="noreferrer">alicante.san.gva.es</a> y{" "}
          <a className="underline" href="https://sanjuan.san.gva.es" target="_blank" rel="noreferrer">sanjuan.san.gva.es</a>.
        </p>

        {/* Breadcrumb / pasos */}
        <nav className="flex flex-wrap items-center gap-1 text-xs mt-4 text-slate-500">
          <button onClick={reset} className="hover:text-sky-700">1. Tipo</button>
          {tipo && <><span>›</span><button onClick={() => setStep("departamento")} className="hover:text-sky-700">{TYPE_LABELS[tipo]?.label ?? tipo}</button></>}
          {departamento && <><span>›</span><button onClick={() => setStep("municipio")} className="hover:text-sky-700">{departamento}</button></>}
          {municipio && <><span>›</span><span className="text-slate-700">{municipio}</span></>}
        </nav>
      </header>

      <main className="px-4 pb-12 max-w-2xl mx-auto">
        {loading && <p className="text-slate-500">Cargando…</p>}

        {!loading && step === "tipo" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">¿Qué tipo de servicio necesitas?</h2>
            {tipos.map((t) => {
              const meta = TYPE_LABELS[t] ?? { label: t, emoji: "•", desc: "" };
              return (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setStep("departamento"); }}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-400 hover:shadow-sm transition"
                >
                  <div className="text-base font-medium text-slate-900">
                    <span className="mr-2">{meta.emoji}</span>{meta.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{meta.desc}</div>
                </button>
              );
            })}
          </section>
        )}

        {!loading && step === "departamento" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">¿En qué departamento de salud?</h2>
            <button
              onClick={() => { setDepartamento(null); setStep("municipio"); }}
              className="w-full text-left bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800 hover:bg-sky-100"
            >
              Cualquier departamento →
            </button>
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
                    {c.specialties.slice(0, 3).join(" · ")}
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
              {selected.associated_services?.length > 0 && <Row k="Servicios asociados" v={selected.associated_services.join(", ")} />}
              {selected.notes && <Row k="Notas" v={selected.notes} />}
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  📞 Llamar
                </a>
              )}
              {selected.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name}, ${selected.address}, ${selected.municipality}`)}`}
                  target="_blank" rel="noreferrer"
                  className="bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  🗺️ Cómo llegar
                </a>
              )}
              {selected.website && (
                <a href={selected.website} target="_blank" rel="noreferrer"
                   className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200">
                  🌐 Web oficial
                </a>
              )}
              <button
                onClick={() => { setSelected(null); setStep("resultados"); }}
                className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200"
              >
                ← Volver
              </button>
            </div>
          </section>
        )}

        {!loading && step !== "tipo" && step !== "detalle" && (
          <button onClick={reset} className="mt-6 text-xs text-slate-500 hover:text-sky-700">
            ↺ Empezar de nuevo
          </button>
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
