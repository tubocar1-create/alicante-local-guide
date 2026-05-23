// Conversaciones del agente: muestra cada interacción como una secuencia
// turno-a-turno (pregunta → respuesta → pregunta → respuesta) con tiempos,
// latencias y badges visuales del estado de resolución. Cada turno puede
// abrirse para revisar/corregir justo el punto donde el agente falló.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { conversationsQO } from "@/lib/admin-ai-shared";
import {
  reviewDubiousInteraction,
  type ConversationTurn,
} from "@/lib/admin-ai.functions";
import { ADMIN_PIN, fmtDateTime } from "@/lib/admin-shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/ai/conversations")({
  component: ConversationsPage,
});

type ReviewStatus =
  | "ok"
  | "misrouted"
  | "missing_intent"
  | "needs_faq"
  | "spam"
  | "ignore";

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  ok: "Estaba bien",
  misrouted: "Mal enrutada",
  missing_intent: "Falta intent / keyword",
  needs_faq: "Necesita FAQ",
  spam: "Spam",
  ignore: "Ignorar",
};

function fmtGap(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

function ConversationsPage() {
  const [days, setDays] = useState(7);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selectedTurn, setSelectedTurn] =
    useState<ConversationTurn | null>(null);
  const qc = useQueryClient();

  const q = useQuery(conversationsQO(days, onlyIssues));
  const conversations = q.data?.conversations ?? [];

  // Formulario de revisión del turno seleccionado
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("misrouted");
  const [note, setNote] = useState("");
  const [promote, setPromote] = useState(true);
  const [suggestedIntent, setSuggestedIntent] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState("");

  function openTurn(turn: ConversationTurn) {
    setSelectedTurn(turn);
    setReviewStatus(
      turn.fallback_used ? "missing_intent" : "misrouted",
    );
    setNote(turn.review_note ?? "");
    setPromote(true);
    setSuggestedIntent(turn.detected_intent ?? "");
    setSuggestedKeywords(turn.raw_query);
  }

  const mut = useMutation({
    mutationFn: () => {
      if (!selectedTurn) throw new Error("no turn");
      return reviewDubiousInteraction({
        data: {
          pin: ADMIN_PIN,
          id: selectedTurn.id,
          status: reviewStatus,
          note: note || undefined,
          promote_to_supervision: promote,
          suggested_intent: suggestedIntent || undefined,
          suggested_keywords: suggestedKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
      });
    },
    onSuccess: () => {
      toast.success("Turno corregido");
      qc.invalidateQueries({ queryKey: ["admin-ai"] });
      setSelectedTurn(null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Error"),
  });

  const totals = useMemo(() => {
    const turns = conversations.reduce((a, c) => a + c.total_turns, 0);
    const issues = conversations.reduce(
      (a, c) => a + c.unresolved_turns + c.fallback_turns,
      0,
    );
    return { sessions: conversations.length, turns, issues };
  }, [conversations]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversaciones del agente
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada conversación se reconstruye desde el log: verás la
            secuencia exacta de turnos, cuánto tardó el agente en
            responder y dónde falló. Pulsa cualquier turno para corregirlo.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(days)}
              onValueChange={(v) => setDays(Number(v))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="3">Últimos 3 días</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="14">Últimos 14 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={onlyIssues}
                onCheckedChange={(v) => setOnlyIssues(!!v)}
              />
              Solo con incidencias
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 mr-1.5",
                  q.isFetching && "animate-spin",
                )}
              />
              Refrescar
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              {totals.sessions} conversaciones · {totals.turns} turnos ·{" "}
              {totals.issues} incidencias
            </div>
          </div>

          {q.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {!q.isLoading && conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay conversaciones en este periodo.
            </p>
          )}

          <div className="space-y-4">
            {conversations.map((c) => {
              const hasIssues =
                c.unresolved_turns > 0 || c.fallback_turns > 0;
              const durMs =
                new Date(c.ended_at).getTime() -
                new Date(c.started_at).getTime();
              return (
                <div
                  key={c.key}
                  className={cn(
                    "rounded-lg border bg-card",
                    hasIssues && "border-amber-500/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
                    <Badge variant="outline" className="font-mono">
                      {c.session_id ? "sesión" : "agrupada"}
                    </Badge>
                    <span className="font-medium">
                      {fmtDateTime(c.started_at)}
                    </span>
                    <span className="text-muted-foreground">
                      · {c.total_turns} turnos · duración{" "}
                      {fmtDuration(durMs)}
                    </span>
                    {c.route_origin && (
                      <span className="text-muted-foreground truncate max-w-[14rem]">
                        · {c.route_origin}
                      </span>
                    )}
                    <div className="ml-auto flex gap-1">
                      {c.unresolved_turns > 0 && (
                        <Badge variant="destructive">
                          {c.unresolved_turns} sin resolver
                        </Badge>
                      )}
                      {c.fallback_turns > 0 && (
                        <Badge variant="secondary">
                          {c.fallback_turns} fallback
                        </Badge>
                      )}
                      {!hasIssues && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          ok
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ol className="divide-y">
                    {c.turns.map((t, idx) => {
                      const failed =
                        t.resolved === false || t.fallback_used === true;
                      return (
                        <li key={t.id}>
                          {t.gap_ms != null && t.gap_ms > 1500 && (
                            <div className="px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/30">
                              <Clock className="h-3 w-3" />
                              espera de {fmtGap(t.gap_ms)} antes del
                              siguiente turno
                            </div>
                          )}
                          <button
                            onClick={() => openTurn(t)}
                            className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center pt-0.5">
                                <span
                                  className={cn(
                                    "text-[10px] font-mono w-5 h-5 rounded-full flex items-center justify-center",
                                    failed
                                      ? "bg-destructive/15 text-destructive"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {idx + 1}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-sm font-medium leading-snug">
                                  &ldquo;{t.raw_query}&rdquo;
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                                  {t.detected_intent && (
                                    <span className="flex items-center gap-1">
                                      <ArrowRight className="h-3 w-3" />
                                      {t.detected_intent}
                                    </span>
                                  )}
                                  {t.resolver_type && (
                                    <span>· {t.resolver_type}</span>
                                  )}
                                  {typeof t.latency_ms === "number" && (
                                    <span>· {t.latency_ms}ms</span>
                                  )}
                                  {t.failure_reason && (
                                    <span className="text-destructive">
                                      · {t.failure_reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {t.resolved === true && !t.fallback_used && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                )}
                                {t.resolved === false && (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                {t.fallback_used && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    fallback
                                  </Badge>
                                )}
                                {t.reviewed_at && (
                                  <Badge
                                    className="bg-emerald-600 hover:bg-emerald-600 text-[10px]"
                                  >
                                    revisado
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={!!selectedTurn}
        onOpenChange={(o) => !o && setSelectedTurn(null)}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedTurn && (
            <>
              <SheetHeader>
                <SheetTitle>Corregir este turno</SheetTitle>
                <SheetDescription className="line-clamp-3">
                  &ldquo;{selectedTurn.raw_query}&rdquo;
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-md border p-3 space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Cuándo: </span>
                    {fmtDateTime(selectedTurn.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Origen: </span>
                    {selectedTurn.route_origin ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Intent detectado:{" "}
                    </span>
                    {selectedTurn.detected_intent ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Resolver: </span>
                    {selectedTurn.resolver_type ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Decisión: </span>
                    {selectedTurn.decision ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Latencia: </span>
                    {selectedTurn.latency_ms != null
                      ? `${selectedTurn.latency_ms}ms`
                      : "—"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Diagnóstico</Label>
                  <Select
                    value={reviewStatus}
                    onValueChange={(v) =>
                      setReviewStatus(v as ReviewStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {REVIEW_LABELS[k]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Qué debería haber pasado…"
                    rows={3}
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="promote-conv"
                    checked={promote}
                    onCheckedChange={(v) => setPromote(!!v)}
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="promote-conv"
                      className="cursor-pointer"
                    >
                      Enviar a Supervisión
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Crea un item revisable para entrenar el sistema
                      (intent/keyword/FAQ).
                    </p>
                  </div>
                </div>

                {promote && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    <div className="space-y-1.5">
                      <Label>Intent sugerido</Label>
                      <Input
                        value={suggestedIntent}
                        onChange={(e) => setSuggestedIntent(e.target.value)}
                        placeholder="ej. playas"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Keywords sugeridas</Label>
                      <Input
                        value={suggestedKeywords}
                        onChange={(e) =>
                          setSuggestedKeywords(e.target.value)
                        }
                        placeholder="separadas por comas"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => mut.mutate()}
                    disabled={mut.isPending}
                    className="flex-1"
                  >
                    {mut.isPending ? "Guardando…" : "Guardar corrección"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedTurn(null)}
                    disabled={mut.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
