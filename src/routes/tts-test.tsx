import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tts-test")({
  component: TTSTest,
});

function TTSTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const log = (...args: unknown[]) => {
    const line = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    // eslint-disable-next-line no-console
    console.log(line);
    setLogs((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);
  };

  async function probarTTS() {
    log("TEST TTS");
    if (typeof window === "undefined" || !window.speechSynthesis) {
      log("speechSynthesis NO disponible");
      return;
    }
    const voces = speechSynthesis.getVoices();
    log("VOCES count:", voces.length);
    voces.forEach((v) => log(" -", v.name, v.lang, v.default ? "(default)" : ""));

    const utterance = new SpeechSynthesisUtterance(
      "Hola, esta es una prueba de voz",
    );
    utterance.lang = "es-ES";
    const voz = voces.find((v) => v.lang.includes("es")) || voces[0];
    if (voz) {
      utterance.voice = voz;
      log("VOZ elegida:", voz.name, voz.lang);
    } else {
      log("Sin voces — Android puede necesitar Google Speech Services");
    }
    utterance.onstart = () => log("VOICE START");
    utterance.onend = () => log("VOICE END");
    utterance.onerror = (e: SpeechSynthesisErrorEvent) =>
      log("VOICE ERROR", e.error || "(sin detalle)");

    speechSynthesis.cancel();
    setTimeout(() => {
      speechSynthesis.speak(utterance);
      log("speak() llamado");
    }, 500);
  }

  return (
    <div className="mx-auto max-w-md p-6 text-sm">
      <h1 className="mb-4 text-xl font-bold">Prueba TTS aislada</h1>
      <button
        onClick={probarTTS}
        className="rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold"
      >
        PROBAR VOZ
      </button>
      <button
        onClick={() => setLogs([])}
        className="ml-2 rounded-lg border px-3 py-3"
      >
        Limpiar
      </button>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-black/80 p-3 text-xs text-green-300 min-h-[200px]">
        {logs.join("\n") || "(sin logs todavía)"}
      </pre>
      <p className="mt-3 text-xs text-gray-500">
        Pulsa el botón. Si no oyes nada y no aparece VOICE START, el motor TTS
        del dispositivo está bloqueado. Si aparece VOICE ERROR, el motor está
        roto. Si VOCES count = 0, falta Google Speech Services en Android.
      </p>
    </div>
  );
}
