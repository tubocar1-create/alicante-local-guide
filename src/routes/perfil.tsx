import { VamosWord } from "@/components/VamosWord";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  LogIn,
  LogOut,
  QrCode,
  User as UserIcon,
  Power,
  Briefcase,
  MapPin,
} from "lucide-react";
import { isGeoEnabled, setGeoEnabled, useUserLocation, formatDistance, distanceKm } from "@/hooks/useUserLocation";
import { useAppAuth } from "@/hooks/useAppAuth";
import { PermissionPrompt } from "@/components/PermissionPrompt";
import { listQrs, subscribeQrs, type LocalQr } from "@/lib/qr-storage";
import { isPreviewHost } from "@/lib/hidden-buttons";

const PUERTA_DEL_MAR = { lat: 38.3414, lng: -0.481 };

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Alicante Friend" },
      { name: "description", content: "Gestiona tu perfil personal, tus favoritos y tus códigos QR guardados en Alicante Friend." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Mi perfil — Alicante Friend" },
      { property: "og:description", content: "Gestiona tu perfil personal, tus favoritos y tus códigos QR guardados en Alicante Friend." },
      { property: "og:url", content: "https://vamosalicante.com/perfil" },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const appAuth = useAppAuth();
  const { isAuthenticated, signOut } = appAuth;
  const user = appAuth.user
    ? {
        id: appAuth.user.id,
        name: appAuth.profile?.full_name || appAuth.profile?.display_name || appAuth.user.email || "",
        email: appAuth.user.email ?? "",
      }
    : null;
  const [qrs, setQrs] = useState<LocalQr[]>([]);
  const [geoEnabled, setGeoEnabledState] = useState(false);
  const loc = useUserLocation();
  const coords = loc.state.status === "ready" ? loc.state.coords : null;

  useEffect(() => {
    setGeoEnabledState(isGeoEnabled());
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setQrs([]);
      return;
    }
    const refresh = () => setQrs(listQrs(user.id));
    refresh();
    return subscribeQrs(refresh);
  }, [user?.id]);

  const distance =
    coords && geoEnabled
      ? formatDistance(distanceKm(coords, PUERTA_DEL_MAR))
      : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <Link
          to="/"
          aria-label="Volver"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-bold">Mi perfil</h1>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-3 py-4">
        {/* Real-auth (Supabase) account block */}
        {appAuth.isAuthenticated ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Mi cuenta</p>
            <p className="mt-1 text-sm font-bold">
              {appAuth.profile?.full_name || appAuth.profile?.display_name || appAuth.user?.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{appAuth.user?.email}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {appAuth.emailVerified ? "✓ Email verificado" : "⚠ Email pendiente de verificar"}
              {appAuth.profile?.login_method && ` · ${appAuth.profile.login_method}`}
            </p>
            <button
              onClick={appAuth.signOut}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
            </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">¿Aún no tienes cuenta?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crea una cuenta para guardar favoritos y sincronizar entre dispositivos.
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                to="/auth/signup"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Crear cuenta
              </Link>
              <Link
                to="/auth/login"
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold"
              >
                Iniciar sesión
              </Link>
            </div>
          </section>
        )}

        <PermissionPrompt permission="geolocation" />
        <PermissionPrompt permission="microphone" />

        {isAuthenticated && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {user?.name?.trim().charAt(0).toUpperCase() || <UserIcon className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{user?.name || "Invitado"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email || "Inicia sesión para guardar tus QR"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
            {isPreviewHost() && (
              <Link
                to="/business"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold active:scale-95"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Soy un local
              </Link>
            )}
          </div>
        </section>
        )}


        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Ubicación</p>
            </div>
            <button
              onClick={() => {
                const next = !geoEnabled;
                setGeoEnabled(next);
                setGeoEnabledState(next);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold active:scale-95 ${
                geoEnabled
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              <Power className="h-3 w-3" />
              {geoEnabled ? "Activada" : "Desactivada"}
            </button>
          </div>
          {distance && (
            <p className="mt-2 text-xs text-muted-foreground">
              Estás a {distance} de Puerta del Mar.
            </p>
          )}
        </section>

        {isPreviewHost() && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Mis QR</h2>
            </div>
            {qrs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aún no has generado ningún QR. Pulsa <VamosWord /> en una recomendación para crear uno.
              </p>
            ) : (
              <ul className="space-y-2">
                {qrs.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{q.place_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {new Date(q.created_at).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        q.status === "active"
                          ? "bg-primary/15 text-primary"
                          : q.status === "used"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q.status === "active" ? "Activo" : q.status === "used" ? "Usado" : "Caducado"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isAuthenticated && (
          <button
            onClick={signOut}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-destructive active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        )}
      </main>
    </div>
  );
}
