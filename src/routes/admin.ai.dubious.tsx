// Cola de interacciones DUDOSAS: el agente respondió pero el resultado es
// sospechoso (resolved=false o fallback_used=true). El admin las revisa una
// a una, las anota y, opcionalmente, las promueve a Supervisión para
// entrenar al sistema (añadir intent / keyword / FAQ).
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { dubiousQO, intentsQO } from "@/lib/admin-ai-shared";
import {
  reviewDubiousInteraction,
  quickResolveDubious,
  type DubiousRow,
} from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";
import { toast } from "sonner";


export const Route = createFileRoute("/admin/ai/dubious")({
  component: DubiousPage,
});

type StatusFilter = "pending" | "reviewed" | "all";
type KindFilter = "all" | "unresolved" | "fallback" | "low_confidence";
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

function DubiousPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DubiousRow | null>(null);
  const qc = useQueryClient();

  const q = useQuery(dubiousQO(status, kind, search));
  const intentsQ = useQuery(intentsQO());
  const intents = intentsQ.data?.intents ?? [];

  // Quick-resolve form state
  type QuickAction = "add_keyword" | "create_intent" | "add_faq";
  const [quickAction, setQuickAction] = useState<QuickAction>("add_keyword");
  const [targetIntentKey, setTargetIntentKey] = useState<string>("");
  const [newIntentKey, setNewIntentKey] = useState("");
  const [newIntentLabel, setNewIntentLabel] = useState("");
  const [newIntentRoute, setNewIntentRoute] = useState("");
  const [newIntentReply, setNewIntentReply] = useState("");
  const [faqResponse, setFaqResponse] = useState("");
  const [extraKeywords, setExtraKeywords] = useState("");


  // Estado local del formulario de revisión
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("misrouted");
  const [note, setNote] = useState("");
  const [promote, setPromote] = useState(true);
  const [suggestedIntent, setSuggestedIntent] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState("");

  function openRow(row: DubiousRow) {
    setSelected(row);
    setReviewStatus(
      row.fallback_used ? "missing_intent" : "misrouted",
    );
    setNote(row.review_note ?? "");
    setPromote(true);
    setSuggestedIntent(row.detected_intent ?? "");
    setSuggestedKeywords(row.raw_query);
    setQuickAction("add_keyword");
    setTargetIntentKey(row.detected_intent ?? "");
    setNewIntentKey("");
    setNewIntentLabel(row.raw_query);
    setNewIntentRoute("");
    setNewIntentReply(`Te llevo a ${row.raw_query}.`);
    setFaqResponse("");
    setExtraKeywords(row.raw_query);
  }

  const quickMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no row");
      const extras = extraKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      if (quickAction === "add_keyword") {
        return quickResolveDubious({
          data: {
            pin: ADMIN_PIN,
            id: selected.id,
            action: "add_keyword",
            target_key: targetIntentKey,
            keywords: extras,
            note: note || undefined,
          },
        });
      }
      if (quickAction === "create_intent") {
        return quickResolveDubious({
          data: {
            pin: ADMIN_PIN,
            id: selected.id,
            action: "create_intent",
            intent_key: newIntentKey,
            intent_label: newIntentLabel,
            intent_route: newIntentRoute || undefined,
            intent_spoken_reply: newIntentReply,
            keywords: extras,
            note: note || undefined,
          },
        });
      }
      return quickResolveDubious({
        data: {
          pin: ADMIN_PIN,
          id: selected.id,
          action: "add_faq",
          faq_response: faqResponse,
          keywords: extras,
          note: note || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.summary ?? "Resuelto");
      qc.invalidateQueries({ queryKey: ["admin-ai", "dubious"] });
      qc.invalidateQueries({ queryKey: ["admin-ai", "intents"] });
      qc.invalidateQueries({ queryKey: ["admin-ai"] });
      setSelected(null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Error"),
  });


  const mut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no row");
      return reviewDubiousInteraction({
        data: {
          pin: ADMIN_PIN,
          id: selected.id,
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
      toast.success("Interacción revisada");
      qc.invalidateQueries({ queryKey: ["admin-ai", "dubious"] });
      qc.invalidateQueries({ queryKey: ["admin-ai", "supervision"] });
      setSelected(null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Error"),
  });

  const rows = q.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Interacciones dudosas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Consultas que el agente atendió pero con baja calidad
            (no resueltas o con fallback). Revísalas para corregir
            enrutamientos y enriquecer el sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Por revisar</SelectItem>
                <SelectItem value="reviewed">Ya revisadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier tipo</SelectItem>
                <SelectItem value="unresolved">No resueltas</SelectItem>
                <SelectItem value="fallback">Con fallback IA</SelectItem>
                <SelectItem value="low_confidence">Baja confianza</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar en la consulta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["admin-ai", "dubious"] })
              }
            >
              Refrescar
            </Button>
          </div>

          {q.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {!q.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay interacciones dudosas con estos filtros. 🎉
            </p>
          )}

          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => openRow(r)}
                className="w-full text-left rounded-md border bg-card p-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.raw_query}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1.5">
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      {r.route_origin && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[12rem]">
                            {r.route_origin}
                          </span>
                        </>
                      )}
                      {r.detected_intent && (
                        <>
                          <span>·</span>
                          <span>intent: {r.detected_intent}</span>
                        </>
                      )}
                      {typeof r.latency_ms === "number" && (
                        <>
                          <span>·</span>
                          <span>{r.latency_ms}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {r.resolved === false && (
                      <Badge variant="destructive">no resuelta</Badge>
                    )}
                    {r.fallback_used && (
                      <Badge variant="secondary">fallback</Badge>
                    )}
                    {r.resolver_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.resolver_type}
                      </Badge>
                    )}
                    {r.reviewed_at && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        revisada
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Revisar interacción</SheetTitle>
                <SheetDescription className="line-clamp-3">
                  &ldquo;{selected.raw_query}&rdquo;
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-md border p-3 space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Origen: </span>
                    {selected.route_origin ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Resolver: </span>
                    {selected.resolver_type ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Intent detectado: </span>
                    {selected.detected_intent ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Failure: </span>
                    {selected.failure_reason ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cuándo: </span>
                    {new Date(selected.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Diagnóstico</Label>
                  <Select
                    value={reviewStatus}
                    onValueChange={(v) => setReviewStatus(v as ReviewStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {REVIEW_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Qué debería haber pasado, hipótesis, etc."
                    rows={3}
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="promote"
                    checked={promote}
                    onCheckedChange={(v) => setPromote(!!v)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="promote" className="cursor-pointer">
                      Enviar a Supervisión
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Crea un item revisable en /admin/ai/supervision para
                      añadir intent o keywords.
                    </p>
                  </div>
                </div>

                {promote && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    <div className="space-y-1.5">
                      <Label>Intent sugerido (opcional)</Label>
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
                        onChange={(e) => setSuggestedKeywords(e.target.value)}
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
                    {mut.isPending ? "Guardando…" : "Guardar revisión"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(null)}
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
