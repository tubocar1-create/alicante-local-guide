import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Flame, Sparkles, ArrowLeft, PartyPopper, Send, Bot,
  CalendarDays, Clock, MapPin, Swords, Heart,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import hoguera1 from "@/assets/fiestas-hoguera-1.jpg";
import hoguera2 from "@/assets/fiestas-hoguera-2.jpg";
import mascleta1 from "@/assets/fiestas-mascleta-1.jpg";
import mascleta2 from "@/assets/fiestas-mascleta-2.jpg";
import fuegos1 from "@/assets/fiestas-fuegos-1.jpg";
import fuegos2 from "@/assets/fiestas-fuegos-2.jpg";
import desfile1 from "@/assets/fiestas-desfile-1.jpg";
import playa1 from "@/assets/fiestas-playa-1.jpg";
import ninot1 from "@/assets/fiestas-ninot-1.jpg";
import belleas1 from "@/assets/fiestas-belleas-1.jpg";
import bunuelos1 from "@/assets/fiestas-bunuelos-1.jpg";
import crema1 from "@/assets/fiestas-crema-1.jpg";
import ofrenda1 from "@/assets/fiestas-ofrenda-1.jpg";
import banya1 from "@/assets/fiestas-banya-1.jpg";
import aerea1 from "@/assets/fiestas-aerea-1.jpg";
import aerea2 from "@/assets/fiestas-aerea-2.jpg";
import arroz1 from "@/assets/fiestas-arroz-1.jpg";

import {
  PROGRAMA_2026, PREVIA_2026, MASCLETAS_2026, FUEGOS_2026,
  COSO_MULTICOLOR_2026, calcularFase,
  type Acto, type Jornada,
} from "@/data/fiestas-program";
import { MOROS_BARRIOS, MOROS_ELEMENTOS } from "@/data/moros-cristianos";
import hoguerasIcon from "@/assets/hogueras-alicante.png";
import { askFiestasAI } from "@/lib/fiestas-ai.functions";

export const Route = createFileRoute("/fiestas")({
  head: () => ({
    meta: [
      { title: "Fiestas de Alicante — Hogueras y Mascletás" },
      {
        name: "description",
        content:
          "Vive las Hogueras de San Juan y las mascletás de Alicante: fuego, pólvora, música y mucha fiesta en cada rincón de la ciudad.",
      },
      { property: "og:title", content: "Fiestas de Alicante" },
      {
        property: "og:description",
        content: "Hogueras, mascletás, desfiles y fuegos artificiales en Alicante.",
      },
      { property: "og:image", content: hoguera1 },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: "Hogueras de San Juan 2026",
          startDate: "2026-06-20",
          endDate: "2026-06-24",
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: "Alicante",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Alicante",
              addressRegion: "Comunidad Valenciana",
              addressCountry: "ES",
            },
          },
          description:
            "Hogueras de San Juan: mascletás, desfiles, fuegos artificiales y la cremà en Alicante.",
        }),
      },
    ],
  }),
  component: FiestasPage,
});

type Photo = { src: string; caption: string };

// Cada foto se usa UNA sola vez en toda la página.
const HOGUERAS_PHOTOS: Photo[] = [
  { src: hoguera2, caption: "Monumentos de hasta 20 metros de altura" },
  { src: desfile1, caption: "Desfiles por todas las calles" },
  { src: playa1, caption: "Hoguera en la playa de San Juan" },
  { src: banya1, caption: "La Banyà — los bomberos te mojan entre risas" },
];

function PhotoStrip({ photos, accent }: { photos: Photo[]; accent: string }) {
  return (
    <div className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-3 px-4">
        {photos.map((p, i) => (
          <figure
            key={i}
            className="snap-start shrink-0 w-[78vw] max-w-[360px] overflow-hidden rounded-2xl bg-black/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] animate-rise"
            style={{
              outline: `2px solid ${accent}55`,
              animationDelay: `${i * 80}ms`,
            }}
          >
            <img
              src={p.src}
              alt={p.caption}
              loading="lazy"
              width={1280}
              height={896}
              className="block h-56 w-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <figcaption
              className="px-3 py-2 text-sm font-semibold text-white"
              style={{ background: `linear-gradient(90deg, ${accent}cc, transparent)` }}
            >
              {p.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function FloatingEmojis() {
  // Decorative floating emojis across the hero
  const items = [
    { e: "🔥", top: "8%",  left: "6%",  delay: "0s",   size: 28 },
    { e: "✨", top: "18%", left: "82%", delay: "0.6s", size: 22 },
    { e: "🎆", top: "55%", left: "10%", delay: "1.2s", size: 30 },
    { e: "🎇", top: "70%", left: "78%", delay: "0.3s", size: 26 },
    { e: "💃", top: "40%", left: "88%", delay: "0.9s", size: 24 },
    { e: "🥁", top: "78%", left: "45%", delay: "1.5s", size: 22 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((it, i) => (
        <span
          key={i}
          className="absolute animate-float-slow drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          style={{
            top: it.top,
            left: it.left,
            fontSize: it.size,
            animationDelay: it.delay,
          }}
        >
          {it.e}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// PROGRAMA 2026 — datos verificados, voz de alicantino
// ============================================================

function FaseBanner({ fase }: { fase: ReturnType<typeof calcularFase> }) {
  const conf = {
    "previa": {
      bg: "from-amber-500/30 to-orange-600/20",
      ring: "ring-amber-300/50",
      emoji: "⏳",
      titulo: "Aún quedan días… y se nota",
      texto:
        "Estamos en cuenta atrás. Las comisiones ya están ensayando, los ninots casi listos en los talleres y los foguerers no duermen. Mira la guía y elige qué vivir.",
    },
    "semana-grande": {
      bg: "from-orange-500/40 to-red-600/30",
      ring: "ring-orange-300/60 animate-fire-glow",
      emoji: "🔥",
      titulo: "¡Estamos en plena semana grande!",
      texto:
        "Hoy Alicante huele a pólvora y a buñuelos. Cada hora hay algo. Sal a la calle, no te lo pienses.",
    },
    "fuegos-postiguet": {
      bg: "from-pink-500/30 to-purple-600/20",
      ring: "ring-pink-300/60",
      emoji: "🎆",
      titulo: "Castillos en el Postiguet",
      texto:
        "Las hogueras ya ardieron, pero la pólvora sigue: cinco noches de castillos sobre la playa. Llévate una toalla y la mejor compañía.",
    },
    "nostalgia": {
      bg: "from-indigo-500/20 to-amber-500/10",
      ring: "ring-amber-300/30",
      emoji: "🕯️",
      titulo: "Y ya está… hasta el año que viene",
      texto:
        "El olor a humo se ha ido, pero la palmera de Santa Bárbara sigue viva en la cabeza. Aquí te dejo el recuerdo del programa 2026, para que cuentes los días hasta las próximas.",
    },
  }[fase];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${conf.bg} p-4 ring-1 ${conf.ring}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{conf.emoji}</span>
        <div>
          <h4 className="text-base font-extrabold text-amber-50">{conf.titulo}</h4>
          <p className="mt-1 text-sm leading-relaxed text-amber-100/90">{conf.texto}</p>
        </div>
      </div>
    </div>
  );
}

function ActoRow({ acto }: { acto: Acto }) {
  const tipoColor: Record<string, string> = {
    pirotecnia: "bg-orange-500/20 text-orange-200 ring-orange-400/40",
    desfile: "bg-pink-500/20 text-pink-200 ring-pink-400/40",
    ofrenda: "bg-amber-400/20 text-amber-200 ring-amber-300/40",
    crema: "bg-red-500/20 text-red-200 ring-red-400/40",
    noche: "bg-indigo-500/20 text-indigo-200 ring-indigo-400/40",
    dia: "bg-white/10 text-amber-100 ring-white/20",
  };
  const cls = tipoColor[acto.tipo ?? "dia"];
  return (
    <li className="flex gap-3 border-l-2 border-amber-300/30 pl-3">
      <div className="flex min-w-[52px] items-center gap-1 pt-0.5 text-xs font-bold text-amber-200">
        <Clock className="h-3 w-3" /> {acto.hora}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-50">{acto.titulo}</p>
        {acto.lugar && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-200/70">
            <MapPin className="h-3 w-3" /> {acto.lugar}
          </p>
        )}
        {acto.tipo && (
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>
            {acto.tipo}
          </span>
        )}
      </div>
    </li>
  );
}

function JornadaCard({ jornada, destacar }: { jornada: Jornada; destacar?: boolean }) {
  return (
    <article
      className={`shrink-0 w-[86vw] max-w-[380px] snap-start rounded-2xl bg-black/40 p-4 ring-1 ${
        destacar ? "ring-amber-300/70 shadow-[0_0_30px_-5px_rgba(251,191,36,0.5)]" : "ring-white/10"
      }`}
    >
      <header className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
          {jornada.etiqueta}
        </p>
        {jornada.titular && (
          <h5 className="mt-0.5 text-lg font-extrabold leading-tight text-amber-50">
            {jornada.titular}
          </h5>
        )}
      </header>
      <ul className="space-y-2.5">
        {jornada.actos.map((a, i) => <ActoRow key={i} acto={a} />)}
      </ul>
    </article>
  );
}

function ProgramaSection() {
  const fase = useMemo(() => calcularFase(), []);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-4 animate-rise">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-amber-300 animate-spark" />
        <h3 className="text-2xl font-extrabold">Programa Hogueras 2026</h3>
      </div>

      <FaseBanner fase={fase} />

      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="text-sm leading-relaxed text-amber-100">
          Te lo cuento como se lo cuento a quien viene por primera vez: las Hogueras{" "}
          <strong>no empiezan el 20 de junio</strong>. Empiezan en abril, en silencio,
          cuando se elige la <strong>Bellea del Foc</strong> y los artistas empiezan
          a moldear los ninots. Luego vienen el Pregón, la Cabalgata… y un día,
          de repente, suena la primera mascletà y ya no hay marcha atrás.
        </p>
        <ul className="mt-3 space-y-1 text-[13px] text-amber-100/90">
          {PREVIA_2026.map((p, i) => (
            <li key={i} className="flex gap-2"><span className="text-amber-300">•</span>{p}</li>
          ))}
        </ul>
      </div>

      <div className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 px-4">
          {PROGRAMA_2026.map((j) => (
            <JornadaCard key={j.fecha} jornada={j} destacar={j.fecha === hoy} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-orange-600/30 to-red-700/20 p-4 ring-1 ring-orange-400/40">
        <h4 className="mb-2 flex items-center gap-2 text-lg font-extrabold text-amber-50">
          💥 Las mascletàs de Luceros · 14:00 h
        </h4>
        <p className="mb-3 text-sm text-amber-100/90">
          Una al día, del 18 al 24 de junio. Llega <strong>una hora antes</strong> mínimo
          y no te pongas justo delante si es tu primera vez —el suelo tiembla.
        </p>
        <ul className="grid grid-cols-2 gap-1.5 text-xs">
          {MASCLETAS_2026.map((m) => (
            <li key={m.dia} className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/10">
              <span className="font-bold text-amber-200">{m.dia}</span>{" "}
              <span className="text-amber-100/90">{m.pirotecnico}</span>
              {m.nota && <span className="text-amber-200/60"> · {m.nota}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-pink-600/30 to-purple-700/20 p-4 ring-1 ring-pink-400/40">
        <h4 className="mb-2 flex items-center gap-2 text-lg font-extrabold text-amber-50">
          🎆 Castillos del Postiguet · 00:00 h
        </h4>
        <p className="mb-3 text-sm text-amber-100/90">
          Las hogueras ya ardieron, pero la fiesta continúa. Cinco noches de pirotecnia
          sobre la <strong>Playa del Postiguet / Cocó</strong>. Llévate la toalla y siéntate
          en la arena: es de las cosas más bonitas que vas a vivir.
        </p>
        <ul className="grid grid-cols-1 gap-1.5 text-xs">
          {FUEGOS_2026.map((f) => (
            <li key={f.dia} className="flex justify-between rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/10">
              <span className="font-bold text-amber-200">{f.dia}</span>
              <span className="text-amber-100/90">{f.pirotecnico}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-amber-300/30">
        <h4 className="flex items-center gap-2 text-lg font-extrabold text-amber-50">
          🎉 Coso Multicolor — el adiós oficial
        </h4>
        <p className="mt-1 text-sm text-amber-100/90">
          <strong>{COSO_MULTICOLOR_2026.etiqueta} · {COSO_MULTICOLOR_2026.hora} h</strong>
          <br />
          {COSO_MULTICOLOR_2026.recorrido}
        </p>
        <p className="mt-2 text-sm text-amber-100/90">{COSO_MULTICOLOR_2026.descripcion}</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-black/50 p-4 ring-1 ring-amber-300/30">
        <h4 className="text-lg font-extrabold text-amber-50">🏕️ Barracas y racós</h4>
        <p className="mt-1 text-sm text-amber-100/90">
          Las <strong>barracas</strong> abren el 20 por la noche y son <em>la fiesta</em>:
          música hasta el amanecer, comida casera, cerveza, amigos y desconocidos que
          terminan abrazados. Los <strong>racós</strong> son su versión pequeña, más
          de barrio. Si quieres entender por qué los alicantinos no duermen en
          junio, métete en una.
        </p>
      </div>
    </section>
  );
}

// ============================================================
// MOROS Y CRISTIANOS — capítulo aparte, alma de barrio
// ============================================================

function MorosCristianosSection() {
  return (
    <section className="space-y-4 animate-rise">
      <div className="flex items-center gap-2">
        <Swords className="h-6 w-6 text-amber-300 animate-spark" />
        <h3 className="text-2xl font-extrabold">Moros y Cristianos</h3>
      </div>


      <p className="text-sm leading-relaxed text-amber-100">
        Si las Hogueras son la cara internacional de Alicante, los{" "}
        <strong>Moros y Cristianos</strong> son su <strong>alma de barrio</strong>.
        Aquí no hay turistas con cámaras enormes: hay vecinos que llevan toda la
        vida en la misma comparsa, generaciones que se pasan el paso de unos a otros,
        y barrios enteros que se vuelcan en una sola semana.
      </p>

      <p className="text-sm leading-relaxed text-amber-100">
        Recuerdan la <strong>Reconquista</strong> de la ciudad allá por el siglo XIII,
        pero más que una clase de historia son <em>una excusa para vivir</em>:
        para ponerse un traje espectacular, beber con la gente del barrio en la kábila,
        oír la banda de música y disparar arcabuces hasta que huele a pólvora
        durante días.
      </p>

      <h4 className="pt-2 text-lg font-extrabold text-amber-200">
        Los barrios que la viven
      </h4>
      <div className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 px-4">
          {MOROS_BARRIOS.map((b) => (
            <article
              key={b.barrio}
              className="shrink-0 w-[78vw] max-w-[330px] snap-start rounded-2xl bg-black/40 p-4 ring-1 ring-amber-300/20"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                {b.cuando}
              </p>
              <h5 className="mt-0.5 text-lg font-extrabold text-amber-50">{b.barrio}</h5>
              <p className="mt-1 text-xs italic text-amber-200/80">{b.caracter}</p>
              <p className="mt-2 text-sm text-amber-100/90">{b.detalle}</p>
            </article>
          ))}
        </div>
      </div>


      <h4 className="pt-2 text-lg font-extrabold text-amber-200">
        Cómo se vive (las claves)
      </h4>
      <div className="space-y-2">
        {MOROS_ELEMENTOS.map((el) => (
          <div
            key={el.titulo}
            className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
          >
            <p className="text-sm font-extrabold text-amber-100">{el.titulo}</p>
            <p className="mt-1 text-[13px] text-amber-100/90">{el.descripcion}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-500/15 p-4 ring-1 ring-amber-300/40">
        <p className="flex items-start gap-2 text-sm text-amber-100">
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            Si vas a alguna, no te quedes solo en el desfile: <strong>busca la
            kábila</strong>, pide permiso para asomarte y déjate invitar a una
            cerveza. Eso es Alicante. Eso es lo que no sale en las guías.
          </span>
        </p>
      </div>
    </section>
  );
}

type Msg = { role: "user" | "assistant"; content: string };


function FiestasChat() {
  const ask = useServerFn(askFiestasAI);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await ask({ data: { messages: next.slice(-12) } });
      setMessages((m) => [...m, { role: "assistant", content: res.text || "…" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha fallado");
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Panel flotante con respuestas, solo visible cuando hay conversación */}
      {hasMessages && open && (
        <div
          className="fixed inset-x-2 bottom-[68px] z-30 rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#3a0a14]/95 to-[#7a2410]/95 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] backdrop-blur-xl animate-rise"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
        >
          <header className="flex items-center justify-between gap-2 border-b border-amber-300/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-black animate-fire-glow">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-sm font-extrabold text-amber-100">IA de Fiestas</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-xs font-bold text-amber-200 hover:bg-white/10"
              aria-label="Cerrar"
            >
              Cerrar ✕
            </button>
          </header>
          <div ref={scrollRef} className="max-h-[55vh] space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-rise`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-amber-300 to-orange-400 px-3 py-2 text-sm font-medium text-black"
                      : "prose prose-invert prose-sm max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-sm text-amber-50"
                  }
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white/10 px-3 py-2">
                  <div className="flex items-end gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <p className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100">{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Input fijo abajo */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-amber-300/30 bg-gradient-to-r from-[#ff6b35]/95 via-[#ec4899]/95 to-[#f59e0b]/95 px-3 py-2 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        {hasMessages && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ver respuesta"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white active:scale-95"
          >
            <Bot className="h-5 w-5" />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sobre las fiestas…"
          className="flex-1 rounded-full bg-white/95 px-4 py-2 text-sm text-[#2a0a14] placeholder:text-[#7a2410]/60 outline-none ring-1 ring-white/40 focus:ring-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#ec4899] shadow active:scale-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}

// ============================================================
// RELATO EN 3 ACTOS — ANTES · DURANTE · DESPUÉS
// Dinámico: la fase actual se ilumina, las otras se ven en off
// ============================================================

type RelatoFoto = { src: string; alt: string; caption: string; ring: string; cap: string };

function ActoBloque({
  numero,
  fase,
  activo,
  pretitulo,
  titulo,
  acento,
  parrafos,
  fotos,
}: {
  numero: string;
  fase: "previa" | "semana-grande" | "fuegos-postiguet" | "nostalgia";
  activo: boolean;
  pretitulo: string;
  titulo: string;
  acento: string; // ej: "from-amber-400 to-orange-500"
  parrafos: ReactNode[];
  fotos: (RelatoFoto | RelatoFoto[])[];
}) {
  // Intercalamos foto entre párrafos
  const bloques: ReactNode[] = [];
  parrafos.forEach((p, i) => {
    bloques.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-amber-50/95">
        {p}
      </p>,
    );
    const slot = fotos[i];
    const list = Array.isArray(slot) ? slot : slot ? [slot] : [];
    list.forEach((foto, j) => {
      if (!foto.src) return;
      bloques.push(
        <figure
          key={`f-${i}-${j}`}
          className={`overflow-hidden rounded-3xl ring-2 ${foto.ring} animate-rise`}
        >
          <img
            src={foto.src}
            alt={foto.alt}
            loading="lazy"
            width={1280}
            height={896}
            className="h-56 w-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <figcaption
            className={`bg-gradient-to-r ${foto.cap} px-3 py-2 text-sm font-semibold text-white`}
          >
            {foto.caption}
          </figcaption>
        </figure>,
      );
    });
  });

  return (
    <section
      className={`relative space-y-4 rounded-3xl p-4 ring-1 transition-all ${
        activo
          ? "bg-black/30 ring-amber-300/60 shadow-[0_15px_50px_-15px_rgba(251,191,36,0.5)]"
          : "bg-black/20 ring-white/10 opacity-90"
      }`}
    >
      <header className="flex items-center gap-3">
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${acento} text-xl font-black text-white shadow-lg ${
            activo ? "animate-fire-glow" : ""
          }`}
        >
          {numero}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200/80">
            {pretitulo}
          </p>
          <h3 className="text-2xl font-black leading-tight text-amber-50 drop-shadow">
            {titulo}
          </h3>
        </div>
        {activo && (
          <span className="ml-auto animate-pulse rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-[#2a0a14]">
            AHORA
          </span>
        )}
      </header>
      {bloques}
    </section>
  );
}

function Relato() {
  const fase = useMemo(() => calcularFase(), []);

  const antes: ReactNode[] = [
    <>
      Empieza a notarse en mayo. La ciudad cuchichea, los <strong>foguerers</strong>
      cierran talleres con llave y empiezan a aparecer <strong>carteles con
      las Belleas del Foc</strong> en los escaparates. <em>Algo grande viene</em>,
      y todo Alicante lo sabe.
    </>,
    <>
      En los talleres, ninots de seis metros esperan boca abajo a que les
      pinten la última ceja. Suena un transistor de fondo, huele a cola y
      virutas. <strong>Un año entero de trabajo</strong> para arder en una
      sola noche. Eso, en Alicante, no es tristeza: es <strong>poesía</strong>.
    </>,
    <>
      Llega el <strong>Pregón</strong> (5 de junio). Desfile, música y de
      repente toda la ciudad <em>cambia el chip</em>. A partir de ahí,
      cuenta atrás real: <strong>Cabalgata del Ninot</strong>, primera
      mascletà de aviso, <strong>Arribada del Foc</strong> con luz y
      pirotecnia… y el corazón ya late distinto.
    </>,
  ];

  const antesFotos: RelatoFoto[] = [
    {
      src: belleas1,
      alt: "Bellea del Foc",
      caption: "👑 Las Belleas del Foc — el primer aviso de que viene la fiesta",
      ring: "ring-rose-300/50",
      cap: "from-rose-500/80 to-pink-500/80",
    },
  ];

  const durante: ReactNode[] = [
    <>
      Y un día, a las 14:00, suena. La <strong>Plaza de los Luceros</strong>
      se llena hasta los balcones y la <strong>mascletà</strong> arranca
      lenta, sube, sube, y termina en un <strong>terremoto seco</strong> que
      te golpea el pecho. Hay quien aplaude llorando. Es normal.
    </>,
    <>
      Después, comer en serio. Estás en territorio sagrado del{" "}
      <strong>arroz</strong>: <em>arroz a banda</em>, <em>del senyoret</em>,
      <em> arroz negro</em> con alioli, o una <em>fideuà</em> que aquí se
      respeta como hermana del arroz. Acompañas con un{" "}
      <strong>Monastrell</strong> del Vinalopó o cerveza fría con{" "}
      <em>quisquillas de Santa Pola</em> y <em>salazones</em>. Sobremesa
      larga, sin reloj.
    </>,
    <>
      Por la tarde, los <strong>ninots</strong> ya están plantados en cada
      esquina y caminar por el centro es una <strong>visita a un museo al
      aire libre</strong>. Una banda toca un pasodoble, una <em>dansà</em>
      improvisada, alguien te invita a un <em>buñuelo de calabaza</em>
      caliente con azúcar. El olor a aceite y azúcar es la firma oficial
      de las Hogueras.
    </>,
    <>
      Cae el sol y empieza la <strong>Ofrenda de Flores</strong>: miles de
      personas con trajes valencianos bordados a mano caminando desde
      Alfonso X hasta la Concatedral con ramos para la{" "}
      <strong>Virgen del Remedio</strong>. Es lento, es bonito, es{" "}
      <em>profundamente emocional</em>. Aunque no seas creyente, hay algo
      ahí que te toca.
    </>,
    <>
      Si te queda aire, subes al <strong>Castillo de Santa Bárbara</strong>
      con la ciudad encendida a tus pies, te pierdes por el barrio de{" "}
      <strong>Santa Cruz</strong> entre flores y casas blancas, o te
      asomas al <strong>MARQ</strong> o el <strong>MACA</strong>. Cultura
      sin prisa, con la brisa de mar en la cara.
    </>,
    <>
      Y por la noche… <strong>las barracas</strong>. Carpas inmensas
      montadas por las comisiones, con cocina propia, barra y DJ. Los{" "}
      <strong>racós</strong> son la versión de barrio. Cenas tipo tapeo,
      conciertos pequeños, gente bailando con cincuenta años y gente
      bailando con dieciocho, mezclados. <strong>No cierran hasta que sale
      el sol</strong>, literalmente.
    </>,
  ];

  const duranteFotos: (RelatoFoto | RelatoFoto[])[] = [
    [
      {
        src: mascleta1,
        alt: "Mascletà en Luceros",
        caption: "💥 La mascletà — pólvora que se siente en el pecho",
        ring: "ring-orange-300/50",
        cap: "from-orange-500/80 to-red-500/80",
      },
      {
        src: aerea1,
        alt: "Vista aérea de la mascletà en Luceros",
        caption: "🚁 Luceros desde el aire — la pólvora envolviendo la fuente",
        ring: "ring-amber-300/50",
        cap: "from-amber-500/80 to-orange-500/80",
      },
      {
        src: aerea2,
        alt: "Mascletà vista desde arriba con humo blanco",
        caption: "☁️ Toda la plaza desaparece bajo el humo blanco",
        ring: "ring-yellow-300/50",
        cap: "from-yellow-500/80 to-amber-400/80",
      },
      {
        src: mascleta2,
        alt: "Humo de mascletà sobre Alicante",
        caption: "💨 Pólvora a mediodía — el momento justo antes de comer",
        ring: "ring-yellow-300/50",
        cap: "from-yellow-500/80 to-amber-500/80",
      },
    ],
    {
      src: arroz1,
      alt: "Arroz a banda en paella",
      caption: "🥘 Arroz a banda — territorio sagrado en la sobremesa alicantina",
      ring: "ring-orange-300/50",
      cap: "from-orange-500/80 to-amber-500/80",
    },
    {
      src: bunuelos1,
      alt: "Buñuelos de calabaza",
      caption: "🍩 Bunyols de carabassa — el olor oficial de las fiestas",
      ring: "ring-amber-300/50",
      cap: "from-amber-500/80 to-orange-400/80",
    },
    {
      src: ofrenda1,
      alt: "Ofrenda de Flores",
      caption: "👑 Ofrenda de Flores — el corazón emocional de las Hogueras",
      ring: "ring-rose-300/50",
      cap: "from-rose-500/80 to-pink-500/80",
    },
    // índice 4 (Santa Bárbara / Santa Cruz) sin foto — solo texto
    {
      src: "",
      alt: "",
      caption: "",
      ring: "",
      cap: "",
    },
    {
      src: ninot1,
      alt: "Ninot plantado",
      caption: "🎭 Ninots — sátira y arte a 20 metros de altura",
      ring: "ring-pink-300/50",
      cap: "from-pink-500/80 to-purple-500/80",
    },
  ];

  const despues: ReactNode[] = [
    <>
      Madrugada del 24 al 25. <strong>La Cremà</strong>. A las 00:00 una{" "}
      <strong>palmera de fuegos</strong> sale disparada desde el Castillo
      y, a partir de ahí, todas las hogueras de la ciudad arden a la vez.
      El cielo se pinta de naranja, el aire es puro humo y, de pronto,
      llegan los bomberos con las mangueras: <strong>la Banyà</strong>.
      Te empapan mientras gritas y te ríes. Quien lo vive una vez, vuelve.
    </>,
    <>
      Cuando crees que se acabó, no. Quedan <strong>cinco noches más de
      castillos pirotécnicos</strong> sobre la <strong>Playa del
      Postiguet</strong>, del 25 al 29 de junio, siempre a medianoche.
      Toalla, cerveza fría, los pies en la arena, el mar de fondo y el
      cielo pintado de fuego. <em>Ése</em> es el verdadero adiós.
    </>,
    <>
      Y aún queda Alicante en bandeja: TRAM a <strong>San Juan</strong>,{" "}
      <strong>Albufereta</strong> o <strong>Cabo Huertas</strong>, calas
      turquesas, agua a 22 grados y nadie con prisa. La fiesta termina,
      pero el verano arranca aquí mismo.
    </>,
    <>
      Y luego… silencio. Las calles quedan vacías, queda olor a humo
      durante dos días y los foguerers ya están <em>pensando en el
      monumento del año que viene</em>. Por eso decimos que las Hogueras
      no terminan nunca: <strong>se descansan</strong>.
    </>,
  ];

  const despuesFotos: RelatoFoto[] = [
    {
      src: crema1,
      alt: "La Cremà",
      caption: "🔥 La Cremà — la noche en que arde Alicante entera",
      ring: "ring-red-300/50",
      cap: "from-red-500/80 to-orange-500/80",
    },
    {
      src: fuegos1,
      alt: "Castillo de fuegos sobre la bahía de Alicante",
      caption: "🎆 Castillos del Postiguet — pólvora sobre la bahía",
      ring: "ring-purple-300/50",
      cap: "from-purple-500/80 to-pink-500/80",
    },
    {
      src: fuegos2,
      alt: "Fuegos artificiales sobre el mar de Alicante",
      caption: "🎇 La pólvora cae al agua — cinco noches a medianoche",
      ring: "ring-pink-300/50",
      cap: "from-pink-500/80 to-rose-500/80",
    },
  ];

  return (
    <div className="space-y-6 animate-rise">
      <div className="rounded-3xl bg-gradient-to-br from-yellow-300/20 via-pink-500/20 to-orange-500/20 p-5 ring-1 ring-yellow-300/40">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-200">
          El relato de las Hogueras
        </p>
        <h2 className="mt-1 text-3xl font-black leading-tight text-amber-50 drop-shadow">
          Antes · Durante · Después
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/95">
          Alicante no se vive: <strong>se celebra</strong>. Y la celebración
          tiene tres tiempos. Te los cuento en orden, como pasan — y se
          ilumina el que estamos viviendo ahora mismo ✨
        </p>
      </div>

      <ActoBloque
        numero="I"
        fase="previa"
        activo={fase === "previa"}
        pretitulo="Acto I — La cuenta atrás"
        titulo="Antes: huele a algo que viene"
        acento="from-amber-400 to-orange-500"
        parrafos={antes}
        fotos={antesFotos}
      />

      <ActoBloque
        numero="II"
        fase="semana-grande"
        activo={fase === "semana-grande"}
        pretitulo="Acto II — La explosión"
        titulo="Durante: siete días que duran un año"
        acento="from-orange-500 to-red-600"
        parrafos={durante}
        fotos={duranteFotos}
      />

      <ActoBloque
        numero="III"
        fase="fuegos-postiguet"
        activo={fase === "fuegos-postiguet" || fase === "nostalgia"}
        pretitulo="Acto III — El eco"
        titulo="Después: el fuego no se apaga del todo"
        acento="from-pink-500 to-purple-600"
        parrafos={despues}
        fotos={despuesFotos}
      />
    </div>
  );
}

function FiestasPage() {
  useEffect(() => { trackPageView("fiestas"); }, []);
  return (

    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg,#ff6b35 0%, #ec4899 30%, #a21caf 55%, #7a2410 80%, #2a0a14 100%)",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 bg-gradient-to-r from-[#ff6b35]/90 via-[#ec4899]/90 to-[#f59e0b]/90 px-3 py-3 backdrop-blur">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <img src={hoguerasIcon} alt="" className="h-8 w-8 rounded-full" />
          <h1 className="text-lg font-extrabold tracking-tight drop-shadow">Fiestas de Alicante</h1>
        </div>
        <div className="h-9 w-9" />
      </header>

      {/* Hero animado */}
      <section className="relative animate-rise">
        <img
          src={hoguera1}
          alt="Hogueras de San Juan en Alicante"
          width={1280}
          height={896}
          className="h-72 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#7a2410] via-[#ec4899]/20 to-transparent" />
        <FloatingEmojis />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-orange-400 px-3 py-1 text-xs font-bold text-[#2a0a14] shadow animate-fire-glow">
            <PartyPopper className="h-4 w-4 animate-spark" /> ¡Bienvenidos a la fiesta!
          </div>
          <h2 className="mt-2 text-3xl font-black leading-tight drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]">
            Fuego, pólvora <br />
            <span className="bg-gradient-to-r from-yellow-200 via-pink-300 to-orange-300 bg-clip-text text-transparent">
              y mucho corazón
            </span>{" "}
            🔥
          </h2>
        </div>
      </section>

      {/* Marquee */}
      <div className="border-y border-yellow-300/40 bg-gradient-to-r from-orange-500/40 via-pink-500/40 to-amber-400/40 py-2 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap text-sm font-bold text-yellow-100 drop-shadow">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0 gap-8 pr-8">
              <span>🔥 La Cremà · 24 junio medianoche</span>
              <span>💥 Mascletà · 14:00 h Luceros</span>
              <span>👑 Ofrenda de Flores</span>
              <span>🎆 Castillos en el puerto</span>
              <span>🌊 La Banyà</span>
              <span>💃 Belleas del Foc</span>
              <span>🏖️ Playa del Postiguet</span>
              <span>🍤 Arroz a banda</span>
            </div>
          ))}
        </div>
      </div>

      <main className="space-y-8 px-4 py-6 pb-28">
        {/* RELATO EN 3 ACTOS — antes, durante, después */}
        <Relato />

        {/* Chat IA — solo input fijo + popover */}
        <FiestasChat />

        {/* Programa 2026 verificado */}
        <ProgramaSection />

        {/* Hogueras */}
        <section className="animate-rise">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-300 animate-spark" />
            <h3 className="text-2xl font-extrabold drop-shadow">Hogueras de San Juan</h3>
          </div>
          <p className="mb-3 text-sm text-amber-50/95">
            Más de 90 monumentos artísticos —los <em>ninots</em>— se plantan por
            toda la ciudad y la noche del 24 arden todos a la vez en la mágica{" "}
            <strong>Cremà</strong>. Es el momento más esperado del año:
            despedimos la primavera entre llamas, abrazos y un calor que no es
            solo del fuego 💛
          </p>
          <PhotoStrip photos={HOGUERAS_PHOTOS} accent="#f97316" />
        </section>


        {/* Moros y Cristianos — alma de barrio */}
        <MorosCristianosSection />

        {/* Tips */}
        <section className="rounded-2xl bg-gradient-to-br from-yellow-400/20 via-pink-500/20 to-orange-500/20 p-4 ring-1 ring-yellow-300/40 animate-rise">
          <h4 className="mb-2 text-lg font-bold text-yellow-100">
            🎉 No te pierdas
          </h4>
          <ul className="space-y-2 text-sm text-amber-50">
            <li>🌅 <strong>La Plantà</strong> (19–20 jun): se levantan los monumentos.</li>
            <li>💥 <strong>Mascletà</strong> (cada día 14:00 h, Luceros).</li>
            <li>👑 <strong>Ofrenda de Flores</strong> a la Virgen del Remedio.</li>
            <li>🔥 <strong>La Cremà</strong> (24 jun, medianoche): ¡todo arde!</li>
            <li>🌊 <strong>Banyà</strong>: los bomberos te mojan, ¡prepárate a reír!</li>
            <li>🏖️ <strong>Castillos del Postiguet</strong> (25–29 jun, 00:00 h).</li>
          </ul>
        </section>

        <p className="pt-2 text-center text-xs text-yellow-100/80">
          Hecho con 🔥 desde Alicante
        </p>
      </main>
    </div>
  );
}
