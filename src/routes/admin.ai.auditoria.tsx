// Auditoría unificada del CPA — flujo único de revisión conversación-por-conversación.
// Cada turno (pregunta → respuesta del agente) se evalúa contra los 5 criterios
// obligatorios de la doctrina (filosofía, intención, contexto, ruta, endpoint)
// + fase 1..4 + veredicto global. La acción correctiva ("Resolver al vuelo") se
// realiza con quickResolveDubious; este flujo añade la capa de AUDITORÍA.
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
import { conversationsQO, intentsQO } from "@/lib/admin-ai-shared";
import {
  saveAuditVerdict,
  quickResolveDubious,
  deleteConversationTurns,
  type ConversationTurn,
  type AuditCriteria,
} from "@/lib/admin-ai.functions";
import { ADMIN_PIN, fmtDateTime } from "@/lib/admin-shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/ai/auditoria")({
  component: AuditoriaPage,
});

type Score = "ok" | "warn" | "bad" | "na";
type Phase = 1 | 2 | 3 | 4;
type Verdict = "ok" | "adjust" | "critical";

const CRITERIA: Array<{ k: keyof AuditCriteria; label: string; help: string }> = [
  { k: "philosophy", label: "Filosofía", help: "¿Enrutó o se desvió a chat libre/personal?" },
  { k: "intent", label: "Intención", help: "¿Detectó correctamente la intención?" },
  { k: "context", label: "Contexto", help: "¿Respetó el dominio activo (no saltó por keyword aislada)?" },
  { k: "route", label: "Ruta", help: "¿La ruta construida es coherente con la intención?" },
  { k: "endpoint", label: "Endpoint", help: "¿Cerró en un endpoint con nombre propio?" },
];

const SCORE_LABEL: Record<Score, string> = {
  ok: "✅ Cumple",
  warn: "⚠️ Parcial",
  bad: "❌ Falla",
  na: "— N/A",
};

const PHASE_LABEL: Record<Phase, string> = {
  1: "Fase 1 · Saludo + intención",
  2: "Fase 2 · Desambiguación",
  3: "Fase 3 · Enrutamiento contextual",
  4: "Fase 4 · Endpoint final",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "✅ OK",
  adjust: "⚠️ Requiere ajuste",
  critical: "❌ Crítica",
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

function defaultCriteria(): AuditCriteria {
  return { philosophy: "ok", intent: "ok", context: "ok", route: "ok", endpoint: "na" };
}

export function AuditoriaPage() {
  const [days, setDays] = useState(7);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selectedTurn, setSelectedTurn] = useState<ConversationTurn | null>(null);
  const qc = useQueryClient();

  const q = useQuery(conversationsQO(days, onlyIssues));
  const intentsQ = useQuery(intentsQO());
  const intents = intentsQ.data?.intents ?? [];
  const conversations = q.data?.conversations ?? [];

  // Audit form state
  const [phase, setPhase] = useState<Phase>(1);
  const [criteria, setCriteria] = useState<AuditCriteria>(defaultCriteria());
  const [verdict, setVerdict] = useState<Verdict>("ok");
  const [note, setNote] = useState("");

  // Quick-resolve form state (mismo modelo que /dudosas)
  type QuickAction = "none" | "add_keyword" | "create_intent" | "add_faq";
  const [quickAction, setQuickAction] = useState<QuickAction>("none");
  const [targetIntentKey, setTargetIntentKey] = useState("");
  const [newIntentKey, setNewIntentKey] = useState("");
  const [newIntentLabel, setNewIntentLabel] = useState("");
  const [newIntentRoute, setNewIntentRoute] = useState("");
  const [newIntentReply, setNewIntentReply] = useState("");
  const [faqResponse, setFaqResponse] = useState("");
  const [extraKeywords, setExtraKeywords] = useState("");

  function openTurn(t: ConversationTurn) {
    setSelectedTurn(t);
    // Inferir fase y veredicto sugerido a partir de señales del turno.
    const failed = t.resolved === false || t.fallback_used === true;
    const c: AuditCriteria = {
      philosophy: t.fallback_used ? "warn" : "ok",
      intent: t.detected_intent ? "ok" : "bad",
      context: "ok",
      route: t.resolved === false ? "bad" : "ok",
      endpoint: t.resolved ? "ok" : "na",
    };
    setCriteria(c);
    setPhase(t.detected_intent ? (t.resolved ? 4 : 3) : 2);
    setVerdict(failed ? "adjust" : "ok");
    setNote(t.audit_note ?? "");
    setQuickAction("none");
    setTargetIntentKey(t.detected_intent ?? "");
    setNewIntentKey("");
    setNewIntentLabel(t.raw_query);
    setNewIntentRoute("");
    setNewIntentReply(`Te llevo a ${t.raw_query}.`);
    setFaqResponse("");
    setExtraKeywords(t.raw_query);
  }

  const auditMut = useMutation({
    mutationFn: async () => {
      if (!selectedTurn) throw new Error("no turn");
      await saveAuditVerdict({
        data: {
          pin: ADMIN_PIN,
          id: selectedTurn.id,
          phase,
          criteria,
          verdict,
          note: note || undefined,
        },
      });
      // Si además quiere aplicar corrección al vuelo:
      if (quickAction !== "none") {
        const extras = extraKeywords.split(",").map((k) => k.trim()).filter(Boolean);
        if (quickAction === "add_keyword") {
          await quickResolveDubious({
            data: {
              pin: ADMIN_PIN, id: selectedTurn.id, action: "add_keyword",
              target_key: targetIntentKey, keywords: extras, note: note || undefined,
            },
          });
        } else if (quickAction === "create_intent") {
          await quickResolveDubious({
            data: {
              pin: ADMIN_PIN, id: selectedTurn.id, action: "create_intent",
              intent_key: newIntentKey, intent_label: newIntentLabel,
              intent_route: newIntentRoute || undefined,
              intent_spoken_reply: newIntentReply,
              keywords: extras, note: note || undefined,
            },
          });
        } else {
          await quickResolveDubious({
            data: {
              pin: ADMIN_PIN, id: selectedTurn.id, action: "add_faq",
              faq_response: faqResponse, keywords: extras, note: note || undefined,
            },
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Auditoría guardada");
      qc.invalidateQueries({ queryKey: ["admin-ai"] });
      setSelectedTurn(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const totals = useMemo(() => {
    const turns = conversations.reduce((a, c) => a + c.total_turns, 0);
    const issues = conversations.reduce(
      (a, c) => a + c.unresolved_turns + c.fallback_turns,
      0,
    );
    const audited = conversations.reduce(
      (a, c) => a + c.turns.filter((t) => t.audited_at).length,
      0,
    );
    return { sessions: conversations.length, turns, issues, audited };
  }, [conversations]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Auditoría doctrinal · turno por turno
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada turno se evalúa contra los <strong>5 criterios obligatorios</strong>{" "}
            (filosofía · intención · contexto · ruta · endpoint) y se asigna a una{" "}
            <strong>fase 1–4</strong> de la doctrina. Si la auditoría detecta un fallo,
            puedes corregir al vuelo desde el mismo panel.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
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
              <Checkbox checked={onlyIssues} onCheckedChange={(v) => setOnlyIssues(!!v)} />
              Solo con incidencias
            </label>
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", q.isFetching && "animate-spin")} />
              Refrescar
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              {totals.sessions} conversaciones · {totals.turns} turnos · {totals.issues} incidencias · {totals.audited} auditados
            </div>
          </div>

          {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!q.isLoading && conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay conversaciones en este periodo.</p>
          )}

          <div className="space-y-4">
            {conversations.map((c) => {
              const hasIssues = c.unresolved_turns > 0 || c.fallback_turns > 0;
              const durMs =
                new Date(c.ended_at).getTime() - new Date(c.started_at).getTime();
              return (
                <div
                  key={c.key}
                  className={cn("rounded-lg border bg-card", hasIssues && "border-amber-500/40")}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="font-medium">{fmtDateTime(c.started_at)}</span>
                    <span className="text-muted-foreground">
                      · {c.total_turns} turnos · {fmtDuration(durMs)}
                    </span>
                    {c.route_origin && (
                      <span className="text-muted-foreground truncate max-w-[14rem]">
                        · {c.route_origin}
                      </span>
                    )}
                    <div className="ml-auto flex gap-1">
                      {c.unresolved_turns > 0 && (
                        <Badge variant="destructive">{c.unresolved_turns} sin resolver</Badge>
                      )}
                      {c.fallback_turns > 0 && (
                        <Badge variant="secondary">{c.fallback_turns} fallback</Badge>
                      )}
                      {!hasIssues && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">ok</Badge>
                      )}
                    </div>
                  </div>

                  <ol className="divide-y">
                    {c.turns.map((t, idx) => {
                      const failed = t.resolved === false || t.fallback_used === true;
                      const audited = !!t.audited_at;
                      return (
                        <li key={t.id}>
                          {t.gap_ms != null && t.gap_ms > 1500 && (
                            <div className="px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/30">
                              <Clock className="h-3 w-3" />
                              espera de {fmtGap(t.gap_ms)}
                            </div>
                          )}
                          <button
                            onClick={() => openTurn(t)}
                            className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "text-[10px] font-mono w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                  failed
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-sm font-medium leading-snug">
                                  &ldquo;{t.raw_query}&rdquo;
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                                  {t.detected_intent && <span>→ {t.detected_intent}</span>}
                                  {t.resolver_type && <span>· {t.resolver_type}</span>}
                                  {typeof t.latency_ms === "number" && <span>· {t.latency_ms}ms</span>}
                                  {t.failure_reason && (
                                    <span className="text-destructive">· {t.failure_reason}</span>
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
                                  <Badge variant="secondary" className="text-[10px]">fallback</Badge>
                                )}
                                {audited && (
                                  <Badge className="bg-primary/80 hover:bg-primary/80 text-[10px]">
                                    auditado
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

      <Sheet open={!!selectedTurn} onOpenChange={(o) => !o && setSelectedTurn(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTurn && (
            <>
              <SheetHeader>
                <SheetTitle>Auditar turno</SheetTitle>
                <SheetDescription className="line-clamp-3">
                  &ldquo;{selectedTurn.raw_query}&rdquo;
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-5 text-sm">
                <div className="rounded-md border p-3 space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Cuándo: </span>{fmtDateTime(selectedTurn.created_at)}</div>
                  <div><span className="text-muted-foreground">Origen: </span>{selectedTurn.route_origin ?? "—"}</div>
                  <div><span className="text-muted-foreground">Intent detectado: </span>{selectedTurn.detected_intent ?? "—"}</div>
                  <div><span className="text-muted-foreground">Resolver: </span>{selectedTurn.resolver_type ?? "—"}</div>
                  <div><span className="text-muted-foreground">Decisión: </span>{selectedTurn.decision ?? "—"}</div>
                </div>

                {/* === Fase doctrinal === */}
                <div className="space-y-1.5">
                  <Label>Fase detectada</Label>
                  <Select value={String(phase)} onValueChange={(v) => setPhase(Number(v) as Phase)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {([1, 2, 3, 4] as Phase[]).map((p) => (
                        <SelectItem key={p} value={String(p)}>{PHASE_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* === 5 criterios === */}
                <div className="space-y-2">
                  <Label>Criterios doctrinales</Label>
                  <div className="rounded-md border divide-y">
                    {CRITERIA.map((c) => (
                      <div key={c.k} className="p-2 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{c.label}</div>
                          <div className="text-[11px] text-muted-foreground">{c.help}</div>
                        </div>
                        <Select
                          value={criteria[c.k]}
                          onValueChange={(v) => setCriteria({ ...criteria, [c.k]: v as Score })}
                        >
                          <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["ok", "warn", "bad", "na"] as Score[]).map((s) => (
                              <SelectItem key={s} value={s}>{SCORE_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* === Veredicto global === */}
                <div className="space-y-1.5">
                  <Label>Veredicto global</Label>
                  <Select value={verdict} onValueChange={(v) => setVerdict(v as Verdict)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["ok", "adjust", "critical"] as Verdict[]).map((v) => (
                        <SelectItem key={v} value={v}>{VERDICT_LABEL[v]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Nota</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Qué debería haber pasado, qué fase falló…"
                    rows={3}
                  />
                </div>

                {/* === Corrección al vuelo (opcional) === */}
                <div className="space-y-2 rounded-md border p-3 bg-primary/5">
                  <Label className="text-sm font-semibold">Aplicar corrección (opcional)</Label>
                  <Select value={quickAction} onValueChange={(v) => setQuickAction(v as QuickAction)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin corrección (solo auditar)</SelectItem>
                      <SelectItem value="add_keyword">Añadir keyword a intent existente</SelectItem>
                      <SelectItem value="create_intent">Crear nuevo intent</SelectItem>
                      <SelectItem value="add_faq">Crear FAQ</SelectItem>
                    </SelectContent>
                  </Select>

                  {quickAction === "add_keyword" && (
                    <div className="space-y-2">
                      <Select value={targetIntentKey} onValueChange={setTargetIntentKey}>
                        <SelectTrigger><SelectValue placeholder="Intent destino…" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                          {intents.map((i) => (
                            <SelectItem key={i.key as string} value={i.key as string}>
                              {i.key as string} — {i.label as string}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={extraKeywords}
                        onChange={(e) => setExtraKeywords(e.target.value)}
                        placeholder="Keywords (coma)"
                      />
                    </div>
                  )}

                  {quickAction === "create_intent" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={newIntentKey} onChange={(e) => setNewIntentKey(e.target.value)} placeholder="key" />
                        <Input value={newIntentRoute} onChange={(e) => setNewIntentRoute(e.target.value)} placeholder="/ruta" />
                      </div>
                      <Input value={newIntentLabel} onChange={(e) => setNewIntentLabel(e.target.value)} placeholder="Label" />
                      <Textarea value={newIntentReply} onChange={(e) => setNewIntentReply(e.target.value)} rows={2} placeholder="Respuesta hablada" />
                      <Input value={extraKeywords} onChange={(e) => setExtraKeywords(e.target.value)} placeholder="Keywords (coma)" />
                    </div>
                  )}

                  {quickAction === "add_faq" && (
                    <div className="space-y-2">
                      <Textarea value={faqResponse} onChange={(e) => setFaqResponse(e.target.value)} rows={3} placeholder="Respuesta de la FAQ" />
                      <Input value={extraKeywords} onChange={(e) => setExtraKeywords(e.target.value)} placeholder="Keywords (coma)" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => auditMut.mutate()} disabled={auditMut.isPending} className="flex-1">
                    {auditMut.isPending ? "Guardando…" : "Guardar auditoría"}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedTurn(null)} disabled={auditMut.isPending}>
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
