import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/voces")({
  head: () => ({ meta: [{ title: "Probador de voces — Alicante Friend" }] }),
  component: VocesPage,
});

const SAMPLE =
  "🚌 Buenos días Leopoldo, el bus 12 pasa en 6 minutos.";

function VocesPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [text, setText] = useState(SAMPLE);
  const [speakingURI, setSpeakingURI] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const es = all.filter((v) => v.lang.toLowerCase().startsWith("es"));
      const list = es.length ? es : all;
      setVoices(list);
      if (!voiceURI && list.length) setVoiceURI(list[0].voiceURI);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [voiceURI]);

  const speak = (uri: string) => {
    const v = voices.find((x) => x.voiceURI === uri);
    if (!v) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text || SAMPLE);
    u.voice = v;
    u.lang = v.lang;
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => setSpeakingURI(uri);
    u.onend = () => setSpeakingURI(null);
    u.onerror = () => setSpeakingURI(null);
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeakingURI(null);
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Probador de voces</h1>
          <p className="text-sm text-muted-foreground">
            Voces de síntesis del navegador disponibles en tu dispositivo
            ({voices.length} encontradas).
          </p>
        </header>

        <section className="space-y-3 rounded-lg border p-4">
          <label className="text-sm font-medium">Frase de prueba</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">
                Velocidad: {rate.toFixed(2)}
              </label>
              <Slider
                value={[rate]}
                min={0.5}
                max={1.6}
                step={0.05}
                onValueChange={([v]) => setRate(v)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Tono: {pitch.toFixed(2)}
              </label>
              <Slider
                value={[pitch]}
                min={0.5}
                max={1.6}
                step={0.05}
                onValueChange={([v]) => setPitch(v)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={voiceURI} onValueChange={setVoiceURI}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona una voz" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => speak(voiceURI)} disabled={!voiceURI}>
              ▶ Probar
            </Button>
            <Button variant="outline" onClick={stop}>
              ■
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Todas las voces</h2>
          <ul className="divide-y rounded-lg border">
            {voices.map((v) => (
              <li
                key={v.voiceURI}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.lang} {v.localService ? "· local" : "· remota"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={speakingURI === v.voiceURI ? "default" : "outline"}
                  onClick={() => speak(v.voiceURI)}
                >
                  {speakingURI === v.voiceURI ? "Sonando…" : "Escuchar"}
                </Button>
              </li>
            ))}
            {!voices.length && (
              <li className="p-4 text-sm text-muted-foreground">
                Tu navegador no expone voces de síntesis.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
