import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ticket,
  ShieldCheck,
  Clock,
  
  Copy,
  Check,
  LogIn,
  PartyPopper,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppAuth } from "@/hooks/useAppAuth";
import { addQr, findTodayQr } from "@/lib/qr-storage";

type Props = {
  placeId: string;
  placeName: string;
  autoCelebrate?: boolean;
  onClose: () => void;
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReferralDialog({ placeId, placeName, autoCelebrate, onClose }: Props) {
  const { user: authUser, profile, loading, isAuthenticated } = useAppAuth();
  const user = authUser
    ? {
        id: authUser.id,
        name: profile?.full_name || profile?.display_name || authUser.email?.split("@")[0] || "Tú",
        surname: null as string | null,
        email: authUser.email ?? null,
        phone: null as string | null,
      }
    : null;
  const [step, setStep] = useState<"rules" | "qr">("rules");
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [celebrate, setCelebrate] = useState<boolean>(!!autoCelebrate);
  const autoFiredRef = useRef(false);

  const day = todayStamp();
  const validUntil = "hoy a las 23:59";

  const qrUrl = useMemo(
    () =>
      code
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
            `https://alicante-friend.app/v/${code}`,
          )}`
        : "",
    [code],
  );

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);

    // 1 QR por local y día. Si ya existe uno de hoy para este local, lo reusamos.
    const existing = findTodayQr(user.id, placeId);
    if (existing) {
      toast.info("Ya generaste un QR hoy para este local 😉", {
        description:
          "Solo puedes crear un QR por local y día. Te enseñamos el que ya tenías; mañana podrás generar uno nuevo.",
        duration: 12000,
        closeButton: true,
      });
      setCode(existing.code);
      setStep("qr");
      setGenerating(false);
      return;
    }

    const nonce = Math.random().toString(36).slice(2, 6).toUpperCase();
    const newCode = `AF-${user.id.slice(0, 6).toUpperCase()}-${placeId.slice(-4).toUpperCase()}-${day.replace(
      /-/g,
      "",
    )}-${nonce}`;

    const expires = new Date();
    expires.setHours(23, 59, 59, 999);

    try {
      addQr({
        id: globalThis.crypto?.randomUUID?.() ?? `qr_${Math.random().toString(36).slice(2)}`,
        user_id: user.id,
        place_id: placeId,
        place_name: placeName,
        code: newCode,
        status: "active",
        created_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        used_at: null,
      });
    } catch {
      toast.error("No se pudo guardar el QR. Intenta de nuevo.");
      setGenerating(false);
      return;
    }

    // Best-effort: register the QR in the backend so it shows up on the
    // business dashboard. Never block the UX if it fails.
    fetch("/api/public/qr-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        place_id: placeId,
        place_name: placeName,
        code: newCode,
        expires_at: expires.toISOString(),
        user_id: user.id,
        user_name: user.name,
        user_surname: user.surname ?? null,
        user_email: user.email ?? null,
        user_phone: user.phone ?? null,
      }),
    }).catch(() => {});

    setCode(newCode);
    setStep("qr");
    setGenerating(false);
  }

  // Si volvemos del login con autoCelebrate, generamos QR automáticamente.
  useEffect(() => {
    if (
      autoCelebrate &&
      isAuthenticated &&
      !loading &&
      step === "rules" &&
      !generating &&
      !code &&
      !autoFiredRef.current
    ) {
      autoFiredRef.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCelebrate, isAuthenticated, loading]);

  function copyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {!loading && !isAuthenticated ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-warm text-primary-foreground">
                <LogIn className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-tight">Pon tu nombre primero</h3>
                <p className="text-[11px] text-muted-foreground">
                  Para generar tu QR de {placeName}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-foreground/90">
              Solo necesitamos un nombre (estamos en beta) para que tu QR sea único e intransferible
              y se guarde en tu perfil. Tarda 5 segundos 🙌
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-border py-2.5 text-sm text-muted-foreground active:scale-95"
              >
                Ahora no
              </button>
              <Link
                to="/auth/login"
                search={{ redirect: `/?ref=${encodeURIComponent(placeName)}` } as never}
                className="flex-1 rounded-full gradient-warm py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-soft active:scale-95"
              >
                Iniciar sesión
              </Link>
            </div>
          </>
        ) : step === "rules" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-warm text-primary-foreground">
                <Ticket className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-tight">Quiero ir a {placeName}</h3>
                <p className="text-[11px] text-muted-foreground">Normas de la referencia</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-foreground/90">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  El QR es <b>único e intransferible</b>. Solo lo puedes usar tú.
                </span>
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Solo es válido <b>{validUntil}</b>. Pasada esa hora, caduca.
                </span>
              </li>
              <li className="flex gap-2">
                <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Lo encontrarás guardado en tu <b>perfil → Mis QR</b> hasta que se use o caduque.
                </span>
              </li>
            </ul>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-border py-2.5 text-sm text-muted-foreground active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 rounded-full gradient-warm py-2.5 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
              >
                {generating ? "Generando…" : "Generar QR"}
              </button>
            </div>
          </>
        ) : (
          <>
            {celebrate && (
              <div className="mb-3 rounded-2xl gradient-warm p-4 text-primary-foreground shadow-soft">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5" />
                  <h3 className="text-lg font-bold leading-tight">¡Hecho, {user?.name}! 🎉</h3>
                </div>
                <p className="mt-1 text-sm opacity-95">
                  Bienvenido/a a la familia <b>Alicante Friend</b>. Aquí tienes tu primer QR para{" "}
                  <b>{placeName}</b>. ¡A disfrutar! 🥂
                </p>
              </div>
            )}
            <h3 className="text-base font-semibold leading-tight">Tu QR para {placeName}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Enséñalo en el local hoy para que validen tu visita.
            </p>

            <div className="mt-4 flex flex-col items-center gap-3">
              {qrUrl && (
                <img
                  src={qrUrl}
                  alt={`QR para ${placeName}`}
                  width={240}
                  height={240}
                  className="rounded-2xl border border-border bg-white p-2"
                />
              )}

              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-mono text-secondary-foreground active:scale-95"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {code}
              </button>

              <ul className="w-full space-y-1.5 rounded-xl border border-border bg-card/60 p-3 text-[11px] text-foreground/90">
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Válido <b>{validUntil}</b>. Pasada esa hora, caduca.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    <b>Único e intransferible.</b> Solo lo puedes usar tú.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Lo tienes guardado en <b>perfil → Mis QR</b>.
                  </span>
                </li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full rounded-full border border-border py-2.5 text-sm text-muted-foreground active:scale-95"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
