import { useState } from "react";

export function TTSTestButton() {
  const [logs, setLogs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const log = (...args: unknown[]) => {
    const line = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    // eslint-disable-next-line no-console
    console.log("[TTS-TEST]", line);
    setLogs((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);
  };

  function probarTTS() {
    setOpen(true);
    log("TEST TTS");
    if (typeof window === "undefined" || !window.speechSynthesis) {
      log("speechSynthesis NO disponible");
      return;
    }
    const run = (voces: SpeechSynthesisVoice[]) => {
      log("VOICES count:", voces.length);
      voces.slice(0, 10).forEach((v) =>
        log(" -", v.name, v.lang, v.default ? "(default)" : ""),
      );
      const utterance = new SpeechSynthesisUtterance(
        "Hola, esta es una prueba de voz",
      );
      utterance.lang = "es-ES";
      const voz = voces.find((v) => v.lang.includes("es")) || voces[0];
      if (voz) {
        utterance.voice = voz;
        log("VOZ elegida:", voz.name, voz.lang);
      } else {
        log("Sin voces — falta Google Speech Services en Android");
      }
      utterance.onstart = () => log("VOICE START");
      utterance.onend = () => log("VOICE END");
      utterance.onerror = (e: SpeechSynthesisErrorEvent) =>
        log("VOICE ERROR", e.error || "(sin detalle)");
      speechSynthesis.cancel();
      setTimeout(() => {
        speechSynthesis.speak(utterance);
        log("speak() llamado");
      }, 300);
    };
    const voces = speechSynthesis.getVoices();
    if (voces.length) {
      run(voces);
    } else {
      log("Esperando onvoiceschanged...");
      speechSynthesis.onvoiceschanged = () => run(speechSynthesis.getVoices());
      setTimeout(() => {
        const v = speechSynthesis.getVoices();
        if (v.length) run(v);
        else log("Timeout: 0 voces tras 1500ms");
      }, 1500);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 99999,
        maxWidth: "calc(100vw - 16px)",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={probarTTS}
          style={{
            background: "#2563eb",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          PROBAR TTS
        </button>
        {open && (
          <button
            onClick={() => {
              setLogs([]);
              setOpen(false);
            }}
            style={{
              background: "#111",
              color: "white",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <pre
          style={{
            marginTop: 6,
            background: "rgba(0,0,0,0.85)",
            color: "#7CFC9F",
            padding: 8,
            borderRadius: 8,
            fontSize: 10,
            lineHeight: 1.3,
            maxHeight: "50vh",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            width: 320,
            maxWidth: "calc(100vw - 16px)",
          }}
        >
          {logs.join("\n") || "(sin logs)"}
        </pre>
      )}
    </div>
  );
}
