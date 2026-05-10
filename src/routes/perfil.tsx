import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, QrCode, Check, MessageSquareQuote, Users, Flame, Trophy, Info } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import { AFP_LABELS, AFP_LEVELS, AFP_REWARDS, getLevel, getLevelProgress } from "@/lib/afp";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Alicante Friend Points" },
      { name: "description", content: "Tu progreso, racha y puntos AFP en Alicante Friend." },
    ],
  }),
  component: PerfilPage,
});

type ActionId = "qr" | "itinerary" | "review" | "invite";

function PerfilPage() {
  const { points, history, streakDays, weekStreakPoints, award } = usePoints();
  const level = getLevel(points);
  const { pctToNext, next, remaining } = getLevelProgress(points);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"acciones" | "historial" | "niveles">("acciones");

  const badges = AFP_LEVELS.filter((l) => points >= l.min);

  const actions: Array<{ id: ActionId; icon: typeof QrCode; title: string; desc: string; pts: number; onClick: () => void }> = [
    {
      id: "qr",
      icon: QrCode,
      title: "Generar QR de referral",
      desc: "Enséñalo en el local. +20 ahora, +80 cuando lo confirmen.",
      pts: AFP_REWARDS.qr_generated,
      onClick: () => setQrOpen(true),
    },
    {
      id: "itinerary",
      icon: Check,
      title: "Marcar itinerario como hecho",
      desc: "¿Completaste un plan que te recomendé?",
      pts: AFP_REWARDS.itinerary_done,
      onClick: () => award("itinerary_done", { note: "Marcado desde el perfil" }),
    },
    {
      id: "review",
      icon: MessageSquareQuote,
      title: "Dejar reseña honesta",
      desc: "Cuéntame qué tal tu visita.",
      pts: AFP_REWARDS.review_left,
      onClick: () => award("review_left", { note: "Reseña enviada" }),
    },
    {
      id: "invite",
      icon: Users,
      title: "Invitar a un amigo",
      desc: "Una vez por amigo. Es el premio más gordo.",
      pts: AFP_REWARDS.friend_invited,
      onClick: () => {
        const name = window.prompt("Nombre o email del amigo (para no contarlo dos veces):");
        if (!name) return;
        award("friend_invited", { uniqueKey: name.trim().toLowerCase(), note: `Invitó a ${name.trim()}` });
      },
    },
  ];

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-background px-4 pb-16 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <h1 className="text-base font-semibold">Mi perfil</h1>
        <span className="w-[64px]" />
      </header>

      {/* Tarjeta de progreso */}
      <section className="rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
            {level.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest opacity-90">Nivel {level.id}</p>
            <h2 className="truncate text-lg font-semibold">{level.name}</h2>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-2xl font-bold tabular-nums">
              <Sparkles className="h-5 w-5" /> {points}
            </p>
            <p className="text-[10px] uppercase tracking-widest opacity-90">AFP</p>
          </div>
        </div>

        {next ? (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] opacity-90">
              <span>Siguiente: {next.emoji} {next.name}</span>
              <span>{remaining} pts para subir</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full bg-white transition-all" style={{ width: `${pctToNext}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm opacity-95">Estás en el nivel máximo. Eres leyenda 👑</p>
        )}

        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
            <Flame className="h-3.5 w-3.5" /> Racha: {streakDays} día{streakDays === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs">
            Esta semana: {weekStreakPoints}/100
          </span>
        </div>
      </section>

      {/* Mensaje de transparencia */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card/80 p-3 text-xs text-card-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <strong>Por ahora los puntos te dan mejor experiencia dentro de la app</strong> (recomendaciones más
          potentes y exclusivas). Pronto, cuando tenga acuerdos con locales, podrás canjearlos por descuentos y
          beneficios reales.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-full bg-muted p-1 text-xs">
        {(["acciones", "historial", "niveles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium capitalize transition ${
              activeTab === t ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "acciones" && (
        <ul className="mt-3 space-y-2">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                onClick={a.onClick}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 text-left shadow-sm transition active:scale-[0.99] hover:bg-accent/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                  +{a.pts}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {activeTab === "historial" && (
        <div className="mt-3">
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aún no has ganado puntos. Empieza generando un QR de referral 👇
            </p>
          ) : (
            <ul className="space-y-1.5">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{AFP_LABELS[h.action]}</span>
                    {h.note && <span className="block truncate text-[11px] text-muted-foreground">{h.note}</span>}
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(h.at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-primary">+{h.points}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "niveles" && (
        <div className="mt-3 space-y-3">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-primary" /> Badges desbloqueados
            </h3>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b.id} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {b.emoji} {b.name}
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-2">
            {AFP_LEVELS.map((l) => {
              const isCurrent = l.id === level.id;
              const unlocked = points >= l.min;
              return (
                <li
                  key={l.id}
                  className={`rounded-2xl border p-3 ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border bg-card/60"
                  } ${!unlocked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {l.emoji} {l.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {l.min}{l.max === Infinity ? "+" : `–${l.max}`} pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{l.perk}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {qrOpen && <QrDialog onClose={() => setQrOpen(false)} onAwardGenerate={() => award("qr_generated")} onAwardConfirm={() => award("qr_confirmed", { note: "Local confirmó la visita" })} />}
    </div>
  );
}

function QrDialog({
  onClose,
  onAwardGenerate,
  onAwardConfirm,
}: {
  onClose: () => void;
  onAwardGenerate: () => void;
  onAwardConfirm: () => void;
}) {
  const [generated, setGenerated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const code = `AF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    `https://alicante-friend.app/r/${code}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Tu QR de referral</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Genéralo y enséñalo en el local. Cuando confirmen tu visita, sumas el premio gordo.
        </p>

        {!generated ? (
          <button
            onClick={() => {
              setGenerated(true);
              onAwardGenerate();
            }}
            className="mt-4 w-full rounded-full gradient-warm py-3 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95"
          >
            Generar QR (+20 AFP)
          </button>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <img src={qrUrl} alt="QR de referral" width={240} height={240} className="rounded-2xl border border-border" />
            <code className="text-xs text-muted-foreground">{code}</code>
            {!confirmed ? (
              <button
                onClick={() => {
                  setConfirmed(true);
                  onAwardConfirm();
                }}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95"
              >
                El local lo confirmó (+80 AFP)
              </button>
            ) : (
              <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-700 dark:text-emerald-300">
                ✅ Confirmado. ¡Brutal! Puedes cerrar este diálogo.
              </p>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-border py-2 text-sm text-muted-foreground active:scale-95"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
