import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Sparkles, ArrowLeft, PartyPopper, Send, Bot } from "lucide-react";
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
import banya1 from "@/assets/fiestas-banya-1.jpg";
import ofrenda1 from "@/assets/fiestas-ofrenda-1.jpg";
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
  }),
  component: FiestasPage,
});

type Photo = { src: string; caption: string };

const HOGUERAS_PHOTOS: Photo[] = [
  { src: hoguera1, caption: "La cremà: la noche en que arde la ciudad" },
  { src: ninot1, caption: "Ninots gigantes con personalidad propia" },
  { src: hoguera2, caption: "Monumentos de hasta 20 metros de altura" },
  { src: belleas1, caption: "Belleas del Foc y damas de honor" },
  { src: desfile1, caption: "Desfiles por todas las calles" },
  { src: crema1, caption: "Llamas que rozan los balcones" },
  { src: playa1, caption: "Hoguera en la playa de San Juan" },
];

const MASCLETAS_PHOTOS: Photo[] = [
  { src: mascleta1, caption: "La mascletà: pólvora que se siente en el pecho" },
  { src: mascleta2, caption: "Humo de colores sobre Luceros" },
  { src: fuegos1, caption: "Castillos de fuegos sobre el puerto" },
  { src: fuegos2, caption: "Pirotecnia sobre Santa Bárbara" },
];

const TRADICIONES_PHOTOS: Photo[] = [
  { src: ofrenda1, caption: "Ofrenda de Flores a la Virgen del Remedio" },
  { src: bunuelos1, caption: "Buñuelos y churros recién hechos" },
  { src: banya1, caption: "La Banyà: los bomberos te mojan ¡y te ríes!" },
  { src: belleas1, caption: "Trajes valencianos bordados a mano" },
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

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "¿Cuándo es la Cremà?",
  "¿Dónde veo la mascletà?",
  "¿Qué es la Banyà?",
  "¿Qué comer en fiestas?",
];

function FiestasChat() {
  const ask = useServerFn(askFiestasAI);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Hola! 🔥 Soy tu guía de las **Fiestas de Alicante**. Pregúntame por hogueras, mascletás, fechas, sitios para verlo todo… ¡vamos a vivirlo! 🎆",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await ask({ data: { messages: next.slice(-12) } });
      setMessages((m) => [...m, { role: "assistant", content: res.text || "…" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha fallado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="chat-fiestas"
      className="rounded-3xl bg-white/5 p-3 ring-1 ring-amber-300/30 backdrop-blur"
    >
      <header className="mb-2 flex items-center gap-2 px-1">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-black animate-fire-glow">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-base font-extrabold leading-tight text-amber-100">
            Pregunta a la IA de Fiestas
          </h4>
          <p className="text-[11px] text-amber-200/80">Hogueras, mascletás, ofrenda, banyà…</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-black/30 p-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-rise`}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-md bg-amber-400 px-3 py-2 text-sm font-medium text-black"
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

      {/* Quick prompts */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            disabled={loading}
            className="rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/30 active:scale-95 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="mt-2 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-amber-300/30 focus-within:ring-amber-300/70"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sobre las fiestas…"
          className="flex-1 bg-transparent text-sm text-amber-50 placeholder:text-amber-200/60 outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-black shadow active:scale-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function FiestasPage() {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg,#2a0a14 0%, #4a1418 35%, #7a2410 70%, #2a0a14 100%)",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-3 backdrop-blur">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <img src={hoguerasIcon} alt="" className="h-8 w-8 rounded-full" />
          <h1 className="text-lg font-extrabold tracking-tight">Fiestas de Alicante</h1>
        </div>
        <a
          href="#chat-fiestas"
          aria-label="Preguntar a la IA"
          className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-black animate-fire-glow"
        >
          <Bot className="h-5 w-5" />
        </a>
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a0a14] via-[#2a0a14]/30 to-transparent" />
        <FloatingEmojis />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/95 px-3 py-1 text-xs font-bold text-black shadow animate-fire-glow">
            <PartyPopper className="h-4 w-4 animate-spark" /> ¡Bienvenidos a la fiesta!
          </div>
          <h2 className="mt-2 text-3xl font-black leading-tight drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]">
            Fuego, pólvora <br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent">
              y mucho corazón
            </span>{" "}
            🔥
          </h2>
        </div>
      </section>

      {/* Marquee */}
      <div className="border-y border-amber-300/20 bg-black/30 py-2 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap text-sm font-bold text-amber-200">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0 gap-8 pr-8">
              <span>🔥 La Cremà · 24 junio medianoche</span>
              <span>💥 Mascletà · 14:00 h Luceros</span>
              <span>👑 Ofrenda de Flores</span>
              <span>🎆 Castillos en el puerto</span>
              <span>🌊 La Banyà</span>
              <span>💃 Belleas del Foc</span>
            </div>
          ))}
        </div>
      </div>

      <main className="space-y-8 px-4 py-6">
        <p className="text-base leading-relaxed text-amber-100 animate-rise">
          Alicante no se vive: <strong>se celebra</strong>. Del 20 al 24 de junio
          la ciudad entera arde de alegría con las <strong>Hogueras de San
          Juan</strong>, declaradas Fiesta de Interés Turístico Internacional.
          Música, desfiles, pólvora y olor a buñuelos en cada esquina ✨
        </p>

        {/* Chat IA */}
        <FiestasChat />

        {/* Hogueras */}
        <section className="animate-rise">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-400 animate-spark" />
            <h3 className="text-2xl font-extrabold">Hogueras de San Juan</h3>
          </div>
          <p className="mb-3 text-sm text-amber-100/90">
            Más de 90 monumentos artísticos —los <em>ninots</em>— se plantan por
            toda la ciudad y la noche del 24 arden todos a la vez en la mágica{" "}
            <strong>Cremà</strong>. Es el momento más esperado del año:
            despedimos la primavera entre llamas, abrazos y un calor que no es
            solo del fuego 💛
          </p>
          <PhotoStrip photos={HOGUERAS_PHOTOS} accent="#f97316" />
        </section>

        {/* Mascletás */}
        <section className="animate-rise">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-400 animate-spark" />
            <h3 className="text-2xl font-extrabold">Mascletás y fuegos</h3>
          </div>
          <p className="mb-3 text-sm text-amber-100/90">
            Cada día a las <strong>14:00 h</strong> en la <strong>Plaza de los
            Luceros</strong>, la <em>mascletà</em> hace temblar el suelo. No se
            escucha: <strong>se siente</strong> en el pecho. Y al caer la noche,
            los castillos de fuegos sobre el puerto te dejarán sin palabras 🎆
          </p>
          <PhotoStrip photos={MASCLETAS_PHOTOS} accent="#ec4899" />
        </section>

        {/* Tradiciones */}
        <section className="animate-rise">
          <div className="mb-3 flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-amber-300 animate-spark" />
            <h3 className="text-2xl font-extrabold">Tradiciones que enamoran</h3>
          </div>
          <p className="mb-3 text-sm text-amber-100/90">
            Trajes valencianos bordados, ríos de flores hacia la Virgen del
            Remedio, churros calentitos y bomberos que te mojan entre risas.
            Cada rincón huele a pólvora, azúcar y alegría 💛
          </p>
          <PhotoStrip photos={TRADICIONES_PHOTOS} accent="#fbbf24" />
        </section>

        {/* Tips */}
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 animate-rise">
          <h4 className="mb-2 text-lg font-bold text-amber-200">
            🎉 No te pierdas
          </h4>
          <ul className="space-y-2 text-sm text-amber-100">
            <li>🌅 <strong>La Plantà</strong> (19–20 jun): se levantan los monumentos.</li>
            <li>💥 <strong>Mascletà</strong> (cada día 14:00 h, Luceros).</li>
            <li>👑 <strong>Ofrenda de Flores</strong> a la Virgen del Remedio.</li>
            <li>🔥 <strong>La Cremà</strong> (24 jun, medianoche): ¡todo arde!</li>
            <li>🌊 <strong>Banyà</strong>: los bomberos te mojan, ¡prepárate a reír!</li>
          </ul>
        </section>

        <p className="pt-2 text-center text-xs text-amber-200/70">
          Hecho con 🔥 desde Alicante
        </p>
      </main>
    </div>
  );
}
