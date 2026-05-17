import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { populateHealthCategory } from "@/lib/health.functions";
import { populateAtencionContinuada } from "@/lib/health-google.functions";

export const Route = createFileRoute("/admin/salud")({
  head: () => ({ meta: [{ title: "Admin · Poblar salud" }] }),
  component: AdminSaludPage,
});

function AdminSaludPage() {
  const populate = useServerFn(populateHealthCategory);
  const [status, setStatus] = useState<
    Record<string, { loading: boolean; msg?: string; error?: string }>
  >({});

  async function run(slug: string, query: string) {
    setStatus((s) => ({ ...s, [slug]: { loading: true } }));
    try {
      const r = (await populate({ data: { category: slug, query } })) as
        | { inserted?: number; total?: number; discarded?: number; reason?: string; result?: { inserted?: number; total?: number; discarded?: number } }
        | undefined;
      const inserted = r?.inserted ?? r?.result?.inserted;
      const total = r?.total ?? r?.result?.total;
      const discarded = r?.discarded ?? r?.result?.discarded;
      setStatus((s) => ({
        ...s,
        [slug]: {
          loading: false,
          msg:
            inserted == null
              ? `Respuesta: ${JSON.stringify(r)}`
              : `${inserted} guardados · ${discarded ?? 0} descartados (sin web verificable) · ${total ?? inserted} candidatos IA${r?.reason ? ` · ${r.reason}` : ""}`,
        },
      }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        [slug]: { loading: false, error: (e as Error).message },
      }));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        to="/salud"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a Salud
      </Link>

      <h1 className="font-display text-2xl font-bold text-foreground">
        Poblar sector salud (IA + scraping)
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hasta 50 fichas por categoría. La IA propone negocios reales con web
        oficial y Firecrawl verifica teléfono, dirección y horario en cada
        sitio. Los negocios sin web verificable se descartan. Cada categoría
        puede tardar 1–3 minutos.
      </p>

      <ul className="mt-6 space-y-2">
        {HEALTH_CATEGORIES.map((c) => {
          const s = status[c.slug];
          return (
            <li
              key={c.slug}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
                style={{ background: c.bg, color: c.fg }}
              >
                {c.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {c.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {c.group === "publico" ? "Sistema público" : "Sector privado"} · IA
                </p>
                {s?.msg && (
                  <p className="text-[11px] text-emerald-600">{s.msg}</p>
                )}
                {s?.error && (
                  <p className="text-[11px] text-rose-600">{s.error}</p>
                )}
              </div>
              <button
                onClick={() => run(c.slug, c.query)}
                disabled={s?.loading}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {s?.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Poblar
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
