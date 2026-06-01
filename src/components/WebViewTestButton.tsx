import { useState } from "react";
import { Bug, X } from "lucide-react";

// Botón flotante de debug: abre un panel con un iframe embebido
// apuntando a consulta.aspx (parada 5110 por defecto) para probar
// en vivo si el WebView puede o no leer la URL.

export function WebViewTestButton() {
  const [open, setOpen] = useState(false);
  const [stop, setStop] = useState("5110");
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [nonce, setNonce] = useState(0);

  const src = `https://movilidad.vectalia.es/QR/Alicante/consulta.aspx?p=${encodeURIComponent(stop)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(null);
          setOpen(true);
        }}
        aria-label="Test WebView"
        title="Test WebView (debug)"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+8px)] z-[60] flex items-center gap-1.5 rounded-full border-2 border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg active:scale-95"
      >
        <Bug className="h-3.5 w-3.5" />
        WebView test
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">WebView test</span>
            <input
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="w-20 rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="parada"
            />
            <button
              onClick={() => {
                setLoaded(null);
                setNonce((n) => n + 1);
              }}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              Cargar
            </button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {loaded === null ? "cargando…" : loaded ? "load OK" : "load error"}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground break-all">
            {src}
          </div>
          <iframe
            key={`${stop}-${nonce}`}
            src={src}
            title="consulta.aspx test"
            className="flex-1 w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(false)}
          />
          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Si el panel aparece en blanco, Vectalia está bloqueando el embed
            (X-Frame-Options / CSP). En ese caso el WebView web no puede leer la URL.
          </div>
        </div>
      )}
    </>
  );
}
