import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sparkles,
  Check,
  MessageSquareQuote,
  Users,
  Flame,
  Trophy,
  Info,
  LogIn,
  LogOut,
  QrCode,
  User as UserIcon,
  Power,
} from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { listQrs, subscribeQrs, type LocalQr } from "@/lib/qr-storage";
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

type ActionId = "itinerary" | "review" | "invite";

type QrRow = LocalQr;

function PerfilPage() {
  const { points, history, streakDays, weekStreakPoints, award } = usePoints();
  const { user, isAuthenticated, signOut } = useAuth();
  const level = getLevel(points);
  const { pctToNext, next, remaining } = getLevelProgress(points);
  const [activeTab, setActiveTab] = useState<"acciones" | "qrs" | "historial" | "niveles">(
    "acciones"
  );
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const loadingQrs = false;

  const badges = AFP_LEVELS.filter((l) => points >= l.min);

  useEffect(() => {
    if (!user) {
      setQrs([]);
      return;
    }
    const refresh = () => setQrs(listQrs(user.id));
    refresh();
    const unsub = subscribeQrs(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [user, activeTab]);

  const actions: Array<{
    id: ActionId;
    icon: typeof Check;
    title: string;
    desc: string;
    pts: number;
    onClick: () => void;
  }> = [
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
        award("friend_invited", {
          uniqueKey: name.trim().toLowerCase(),
          note: `Invitó a ${name.trim()}`,
        });
      },
    },
  ];

  const displayName = user?.name || "Invitado";
  const avatarUrl: string | undefined = undefined;

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
        {isAuthenticated ? (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        ) : (
          <Link
            to="/login"
            search={{ redirect: "/perfil" }}
            className="inline-flex items-center gap-1 rounded-full gradient-warm px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft active:scale-95"
          >
            <LogIn className="h-3.5 w-3.5" /> Entrar
          </Link>
        )}
      </header>

      {/* Identidad */}
      <section className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user ? "Usuario beta" : "No has iniciado sesión"}
          </p>
        </div>
      </section>

      {/* Tarjeta de progreso */}
      <section className="rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
            {level.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest opacity-90">
              Nivel {level.id}
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
                BETA
              </span>
            </p>
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
              <span>
                Siguiente: {next.emoji} {next.name}
              </span>
              <span>{remaining} pts para subir</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${pctToNext}%` }}
              />
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

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Estamos en Beta.</strong> Los QR no suman puntos hasta que el local los valide en
          su app. Los puntos y estadísticas son aún de prueba.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-full bg-muted p-1 text-xs">
        {(["acciones", "qrs", "historial", "niveles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium capitalize transition ${
              activeTab === t ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t === "qrs" ? "Mis QR" : t}
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

      {activeTab === "qrs" && (
        <div className="mt-3">
          {!isAuthenticated ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <p>Pon tu nombre para ver tus QR generados.</p>
              <Link
                to="/login"
                search={{ redirect: "/perfil" }}
                className="mt-3 inline-flex items-center gap-1 rounded-full gradient-warm px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
              >
                <LogIn className="h-3.5 w-3.5" /> Entrar
              </Link>
            </div>
          ) : loadingQrs ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Cargando tus QR…
            </p>
          ) : qrs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aún no has generado ningún QR. Pulsa <b>Quiero ir</b> en cualquier local 👇
            </p>
          ) : (
            <ul className="space-y-2">
              {qrs.map((q) => {
                const isExpired =
                  q.status === "expired" ||
                  (q.expires_at && new Date(q.expires_at) < new Date() && q.status === "active");
                const isUsed = q.status === "used";
                return (
                  <li
                    key={q.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      isUsed
                        ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                        : isExpired
                          ? "border-border bg-muted/40 opacity-70"
                          : "border-border bg-card/80"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <QrCode className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {q.place_name}
                        {isUsed && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Usado
                          </span>
                        )}
                        {!isUsed && isExpired && (
                          <span className="rounded-full bg-muted-foreground/20 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                            Caducado
                          </span>
                        )}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {q.code}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Generado{" "}
                        {new Date(q.created_at).toLocaleString("es-ES", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {q.used_at &&
                          ` · Usado ${new Date(q.used_at).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
                    {h.note && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {h.note}
                      </span>
                    )}
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(h.at).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-primary">
                    +{h.points}
                  </span>
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
                <span
                  key={b.id}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
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
                      {l.min}
                      {l.max === Infinity ? "+" : `–${l.max}`} pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{l.perk}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Cerrar app */}
      <section className="mt-6 border-t border-border pt-4">
        <button
          onClick={() => {
            const ok = window.confirm(
              "¿Cerrar la app? Se detendrá la ubicación y se cerrará esta pestaña.",
            );
            if (!ok) return;
            try {
              window.close();
            } catch {
              /* ignore */
            }
            // Si el navegador no permite cerrar la pestaña (no fue abierta por script),
            // dejamos una pantalla de despedida en blanco para liberar recursos.
            setTimeout(() => {
              document.body.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;text-align:center;padding:24px;">Puedes cerrar esta pestaña.<br/>¡Hasta pronto! 👋</div>';
            }, 150);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition active:scale-[0.99] hover:bg-destructive/10"
        >
          <Power className="h-4 w-4" /> Cerrar la app
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Detiene la geolocalización y cierra la pestaña.
        </p>
      </section>
    </div>
  );
}
