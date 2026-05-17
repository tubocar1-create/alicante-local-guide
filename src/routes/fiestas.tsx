import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles, ArrowLeft, PartyPopper } from "lucide-react";
import hoguera1 from "@/assets/fiestas-hoguera-1.jpg";
import hoguera2 from "@/assets/fiestas-hoguera-2.jpg";
import mascleta1 from "@/assets/fiestas-mascleta-1.jpg";
import fuegos1 from "@/assets/fiestas-fuegos-1.jpg";
import desfile1 from "@/assets/fiestas-desfile-1.jpg";
import playa1 from "@/assets/fiestas-playa-1.jpg";
import hoguerasIcon from "@/assets/hogueras-alicante.png";

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
  { src: hoguera2, caption: "Ninots gigantes que sonríen al sol" },
  { src: desfile1, caption: "Belleas y desfiles por las calles" },
  { src: playa1, caption: "Hoguera en la playa, noche de San Juan" },
];

const MASCLETAS_PHOTOS: Photo[] = [
  { src: mascleta1, caption: "La mascletà: pólvora que se siente en el pecho" },
  { src: fuegos1, caption: "Castillos de fuegos sobre el puerto" },
  { src: hoguera1, caption: "Tracas finales bajo Santa Bárbara" },
];

function PhotoStrip({ photos, accent }: { photos: Photo[]; accent: string }) {
  return (
    <div className="-mx-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-3 px-4">
        {photos.map((p, i) => (
          <figure
            key={i}
            className="snap-start shrink-0 w-[78vw] max-w-[360px] overflow-hidden rounded-2xl bg-black/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
            style={{ outline: `2px solid ${accent}55` }}
          >
            <img
              src={p.src}
              alt={p.caption}
              loading="lazy"
              width={1280}
              height={896}
              className="block h-56 w-full object-cover"
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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-3 backdrop-blur">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <img src={hoguerasIcon} alt="" className="h-8 w-8 rounded-full ring-2 ring-amber-300/80" />
          <h1 className="text-lg font-extrabold tracking-tight">Fiestas de Alicante</h1>
        </div>
        <span className="w-9" />
      </header>

      {/* Hero */}
      <section className="relative">
        <img
          src={hoguera1}
          alt="Hogueras de San Juan en Alicante"
          width={1280}
          height={896}
          className="h-64 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a0a14] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-bold text-black shadow">
            <PartyPopper className="h-4 w-4" /> ¡Bienvenidos a la fiesta!
          </div>
          <h2 className="mt-2 text-3xl font-black leading-tight drop-shadow">
            Fuego, pólvora <br />y mucho corazón 🔥
          </h2>
        </div>
      </section>

      <main className="space-y-8 px-4 py-6">
        <p className="text-base leading-relaxed text-amber-100">
          Alicante no se vive: <strong>se celebra</strong>. Del 20 al 24 de junio
          la ciudad entera arde de alegría con las <strong>Hogueras de San
          Juan</strong>, declaradas Fiesta de Interés Turístico Internacional.
          Música, desfiles, pólvora y olor a buñuelos en cada esquina ✨
        </p>

        {/* Hogueras */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-400" />
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
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-400" />
            <h3 className="text-2xl font-extrabold">Mascletás</h3>
          </div>
          <p className="mb-3 text-sm text-amber-100/90">
            Cada día a las <strong>14:00 h</strong> en la <strong>Plaza de los
            Luceros</strong>, la <em>mascletà</em> hace temblar el suelo. No se
            escucha: <strong>se siente</strong> en el pecho. Un ritmo de
            pólvora trenzado por los mejores pirotécnicos de la Comunidad
            Valenciana. ¡Y al caer la noche, los castillos de fuegos sobre el
            puerto te dejarán sin palabras! 🎆
          </p>
          <PhotoStrip photos={MASCLETAS_PHOTOS} accent="#ec4899" />
        </section>

        {/* Tips */}
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
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
