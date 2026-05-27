// Diálogo completo: secuencia pregunta→respuesta con tiempos, intents,
// modelo (Gemini vs agente local), página de origen y resaltado.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { conversationsQO } from "@/lib/admin-ai-shared";
import { fmtDateTime } from "@/lib/admin-shared";
import { cn } from "@/lib/utils";
import { Bot, Cpu, MapPin, Sparkles, Clock, Timer, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/admin/ai/dialogos")({
  component: DialogosPage,
});

const KEYWORDS = [
  "playa","playas","farmacia","hospital","urgencias","centro de salud","sanitario",
  "bus","autobús","autobus","tram","tranvía","tranvia","parada","línea","linea",
  "vuelo","vuelos","aeropuerto","hotel","hoteles","dormir","alojamiento",
  "comer","comida","restaurante","bar","tapas","cine","película","pelicula","cartelera",
  "concierto","evento","teatro","fiesta","hoguera","moros","cristianos",
  "comprar","tienda","ropa","ferretería","ferreteria","hogar",
  "rent","alquiler","coche","taxi","clima","tiempo",
];

function fmtGap(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

function fmtLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function isGeminiModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return /gemini|gpt|openai|lovable-ai/i.test(model);
}

function highlight(text: string): React.ReactNode {
  if (!text) return null;
  const re = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "gi");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark
        key={`k-${i++}`}
        className="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded px-1 py-0.5 font-semibold"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function DialogosPage() {
  const [days, setDays] = useState(7);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [search, setSearch] = useState("");

  const q = useQuery(conversationsQO(days, onlyIssues));
  const conversations = useMemo(() => {
    const all = q.data?.conversations ?? [];
    if (!search.trim()) return all;
    const s = search.trim().toLowerCase();
    return all.filter((c) =>
      c.turns.some(
        (t) =>
          t.raw_query.toLowerCase().includes(s) ||
          (t.reply_text ?? "").toLowerCase().includes(s) ||
          (t.detected_intent ?? "").toLowerCase().includes(s) ||
          (t.route_origin ?? "").toLowerCase().includes(s),
      ),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" /> Diálogos completos del agente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Rango</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 día</SelectItem>
                  <SelectItem value="3">3 días</SelectItem>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="14">14 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-48">
              <Label className="text-xs">Buscar</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="texto, intent, ruta…"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="only-issues"
                checked={onlyIssues}
                onCheckedChange={(c) => setOnlyIssues(!!c)}
              />
              <Label htmlFor="only-issues" className="text-sm">Solo con problemas</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              Refrescar
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-violet-500" /> Gemini / LLM
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Agente local
            </span>
            <span className="flex items-center gap-1">
              <mark className="bg-yellow-200 dark:bg-yellow-900/60 rounded px-1">palabra</mark> palabra clave
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="h-5 text-[10px]">/ruta</Badge> página de la app
            </span>
          </div>

          {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!q.isLoading && conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin diálogos en este rango.</p>
          )}
        </CardContent>
      </Card>

      {conversations.map((convo) => (
        <Card key={convo.key} className="overflow-hidden">
          <CardHeader className="bg-muted/40 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium">{fmtDateTime(convo.started_at)}</span>
                <span className="text-muted-foreground"> → {fmtDateTime(convo.ended_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <MessageCircle className="h-3 w-3" /> {convo.total_turns} turnos
                </Badge>
                {convo.unresolved_turns > 0 && (
                  <Badge variant="destructive">{convo.unresolved_turns} sin resolver</Badge>
                )}
                {convo.fallback_turns > 0 && (
                  <Badge className="bg-violet-600 hover:bg-violet-600">
                    {convo.fallback_turns} LLM
                  </Badge>
                )}
                {convo.route_origin && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" /> {convo.route_origin}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {convo.turns.map((t, idx) => {
              const gemini = isGeminiModel(t.model_used) || t.fallback_used === true;
              return (
                <div key={t.id} className="space-y-2 border-l-2 pl-3" style={{ borderColor: gemini ? "rgb(139,92,246)" : "rgb(16,185,129)" }}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">#{idx + 1}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(t.created_at)}
                    </span>
                    {t.gap_ms != null && (
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" /> +{fmtGap(t.gap_ms)} desde turno anterior
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      ⏱ latencia: <strong className="text-foreground">{fmtLatency(t.latency_ms)}</strong>
                    </span>
                    {t.route_origin && (
                      <Badge variant="outline" className="gap-1 h-5">
                        <MapPin className="h-3 w-3" /> {t.route_origin}
                      </Badge>
                    )}
                    {t.detected_intent && (
                      <Badge className="bg-blue-600 hover:bg-blue-600 gap-1 h-5">
                        <Sparkles className="h-3 w-3" /> intent: {t.detected_intent}
                      </Badge>
                    )}
                    {gemini ? (
                      <Badge className="bg-violet-600 hover:bg-violet-600 gap-1 h-5">
                        <Cpu className="h-3 w-3" /> {t.model_used ?? "Gemini"}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1 h-5">
                        <Bot className="h-3 w-3" /> Agente local
                      </Badge>
                    )}
                    {t.resolved === false && (
                      <Badge variant="destructive" className="h-5">no resuelto</Badge>
                    )}
                    {t.failure_reason && (
                      <Badge variant="outline" className="h-5">{t.failure_reason}</Badge>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Usuario
                    </div>
                    <div className="text-sm">{highlight(t.raw_query)}</div>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg px-3 py-2",
                      gemini ? "bg-violet-50 dark:bg-violet-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      {gemini ? <Cpu className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      Respuesta {gemini ? "(LLM)" : "(local)"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {t.reply_text ? highlight(t.reply_text) : (
                        <span className="italic text-muted-foreground">
                          (sin texto registrado — turnos antiguos no guardaban la respuesta)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
