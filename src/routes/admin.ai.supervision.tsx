// Revisión manual de respuestas del agente.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supervisionQO, intentsQO } from "@/lib/admin-ai-shared";
import { submitSupervision } from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ai/supervision")({
  component: SupervisionPage,
});

type Status = "pending" | "approved" | "rejected" | "all";

function SupervisionPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [targetIntent, setTargetIntent] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const q = useQuery(supervisionQO(status));
  const intentsQ = useQuery(intentsQO());

  const mut = useMutation({
    mutationFn: (args: {
      id: string;
      status: "approved" | "rejected";
      notes?: string;
      final_intent?: string;
      final_keywords?: string[];
    }) =>
      submitSupervision({
        data: {
          pin: ADMIN_PIN,
          id: args.id,
          status: args.status,
          admin_notes: args.notes,
          final_intent: args.final_intent,
          final_keywords: args.final_keywords,
        },
      }),
    onSuccess: () => {
      toast.success("Revisión guardada");
      qc.invalidateQueries({ queryKey: ["admin-ai", "supervision"] });
      qc.invalidateQueries({ queryKey: ["admin-ai", "intents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex gap-2 items-center pt-6">
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="approved">Aprobadas</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="ml-auto">
            {q.data?.rows.length ?? 0} items
          </Badge>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !q.data?.rows.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No hay elementos en supervisión.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {q.data.rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {r.raw_query}
                  <Badge variant={r.status === "pending" ? "secondary" : "outline"}>
                    {r.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Intent sugerido" value={r.suggested_intent ?? "—"} />
                  <Info label="Intent final" value={r.final_intent ?? "—"} />
                  <Info label="Confianza" value={r.confidence ?? "—"} />
                  <Info label="Modelo" value={r.model ?? "—"} />
                </div>
                {r.suggested_keywords?.length ? (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Keywords sugeridas: </span>
                    {r.suggested_keywords.map((k: string) => (
                      <Badge key={k} variant="outline" className="mr-1">
                        {k}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {r.status === "pending" && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Notas (opcional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          mut.mutate({ id: r.id, status: "approved", notes: notes[r.id] })
                        }
                        disabled={mut.isPending}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          mut.mutate({ id: r.id, status: "rejected", notes: notes[r.id] })
                        }
                        disabled={mut.isPending}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
