import { useMemo, useState } from "react";
import { Ticket, ShieldCheck, Clock, AlertTriangle, Copy, Check } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";

type Props = {
  placeId: string;
  placeName: string;
  onClose: () => void;
};

const USER_KEY = "afp_user_id_v1";

function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReferralDialog({ placeId, placeName, onClose }: Props) {
  const { award } = usePoints();
  const [step, setStep] = useState<"rules" | "qr">("rules");
  const [copied, setCopied] = useState(false);

  const userId = useMemo(() => getUserId(), []);
  const day = todayStamp();
  const nonce = useMemo(() => Math.random().toString(36).slice(2, 6).toUpperCase(), []);
  const code = `AF-${userId.replace(/^U-/, "")}-${placeId.slice(-4).toUpperCase()}-${day.replace(/-/g, "")}-${nonce}`;
  const qrPayload = `https://alicante-friend.app/v/${code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrPayload)}`;

  const validUntil = "hoy a las 23:59";

  function handleGenerate() {
    award("qr_generated", { note: `Quiero ir → ${placeName}`, silent: true });
    setStep("qr");
  }

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "rules" ? (
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
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  Generarlo <b>no da puntos</b>. Los AFP llegan cuando el local
                  valida el QR en sitio.
                </span>
              </li>
              <li className="flex gap-2">
                <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Tras la validación se convertirá en puntos y/o recompensas
                  físicas (en Beta: solo puntos demo).
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
                className="flex-1 rounded-full gradient-warm py-2.5 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95"
              >
                Generar QR
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold leading-tight">Tu QR para {placeName}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Enséñalo en el local hoy. Cuando lo escaneen, sumas tus AFP.
            </p>

            <div className="mt-4 flex flex-col items-center gap-3">
              <img
                src={qrUrl}
                alt={`QR para ${placeName}`}
                width={240}
                height={240}
                className="rounded-2xl border border-border bg-white p-2"
              />

              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-mono text-secondary-foreground active:scale-95"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {code}
              </button>

              <div className="w-full rounded-xl bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-700 dark:text-amber-300">
                Válido {validUntil}. Sin validación del local, no hay puntos.
              </div>
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
