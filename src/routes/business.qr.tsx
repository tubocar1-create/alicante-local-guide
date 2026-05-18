import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { validateQrCode } from "@/lib/business/qr.functions";
import { ScanLine, CheckCircle2, XCircle, Camera, CameraOff } from "lucide-react";

export const Route = createFileRoute("/business/qr")({
  component: QrReaderPage,
});

type ScanResult =
  | { ok: true; purpose: string; code: string }
  | { ok: false; reason: string; code: string };

function QrReaderPage() {
  const validate = useServerFn(validateQrCode);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const m = useMutation({
    mutationFn: (c: string) => validate({ data: { code: c } }),
    onSuccess: (res, c) => {
      if (res.ok) {
        setLast({ ok: true, purpose: res.qr.purpose, code: c });
        toast.success("QR validado");
      } else {
        setLast({ ok: false, reason: res.reason, code: c });
        toast.error(`QR no válido: ${res.reason}`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  function submit(c: string) {
    const clean = c.trim().toUpperCase();
    if (clean.length < 4) return;
    setCode("");
    m.mutate(clean);
  }

  // Optional camera scan via BarcodeDetector (Chromium/Android). Falls back to manual.
  async function startCamera() {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) {
      toast.error("Tu navegador no soporta lectura de QR. Introduce el código a mano.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats: ["qr_code"] });
      setScanning(true);
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            const raw = codes[0].rawValue;
            // Accept either a raw code or a URL like /api/public/qr-validate?code=XXXX
            let extracted = raw;
            try {
              const u = new URL(raw);
              extracted = u.searchParams.get("code") ?? raw;
            } catch {
              // not a URL, keep raw
            }
            stopCamera();
            submit(extracted);
            return;
          }
        } catch {
          // ignore frame errors
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      toast.error("No se pudo acceder a la cámara");
    }
  }

  function stopCamera() {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Validar QR</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Lee el QR que el usuario emitió desde la app <VamosWord /> para confirmar su visita.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ScanLine className="h-10 w-10" />
              <span className="text-xs">Cámara apagada</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          {scanning ? (
            <button
              onClick={stopCamera}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-medium"
            >
              <CameraOff className="h-3.5 w-3.5" /> Detener
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Camera className="h-3.5 w-3.5" /> Escanear con cámara
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground">
          O introduce el código manualmente
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider"
            maxLength={64}
          />
          <button
            type="submit"
            disabled={m.isPending || code.trim().length < 4}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            Validar
          </button>
        </form>
      </section>

      {last && (
        <div
          className={
            "flex items-start gap-3 rounded-2xl border p-3 text-sm " +
            (last.ok
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-destructive/40 bg-destructive/10")
          }
        >
          {last.ok ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {last.ok ? "Visita confirmada" : "QR no válido"}
            </p>
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono">{last.code}</span>
              {last.ok ? ` · ${last.purpose}` : ` · ${last.reason}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
