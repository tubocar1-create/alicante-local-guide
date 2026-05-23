// CRUD visual sobre la tabla agente_intents.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { intentsQO, pct } from "@/lib/admin-ai-shared";
import { upsertIntent, deleteIntent } from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ai/intents")({
  component: IntentsPage,
});

type IntentForm = {
  id?: string;
  key: string;
  label: string;
  route: string;
  keywords: string;
  spoken_reply: string;
  priority: number;
  active: boolean;
};

const emptyForm: IntentForm = {
  key: "",
  label: "",
  route: "",
  keywords: "",
  spoken_reply: "",
  priority: 100,
  active: true,
};

export function IntentsPage() {
  const qc = useQueryClient();
  const q = useQuery(intentsQO());
  const [editing, setEditing] = useState<IntentForm | null>(null);

  const upsert = useMutation({
    mutationFn: (f: IntentForm) =>
      upsertIntent({
        data: {
          pin: ADMIN_PIN,
          id: f.id,
          key: f.key,
          label: f.label,
          route: f.route || null,
          keywords: f.keywords.split(",").map((s) => s.trim()).filter(Boolean),
          spoken_reply: f.spoken_reply,
          priority: f.priority,
          active: f.active,
        },
      }),
    onSuccess: () => {
      toast.success("Guardado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-ai", "intents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteIntent({ data: { pin: ADMIN_PIN, id } }),
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["admin-ai", "intents"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Define respuestas cuando el agente detecta una intención concreta.
        </p>
        <Button size="sm" onClick={() => setEditing(emptyForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo intent
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-2">
          {(q.data?.intents ?? []).map((i) => {
            const u = i.usage;
            const success = u.total ? u.resolved / u.total : 0;
            return (
              <Card key={i.id}>
                <CardContent className="p-4 flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{i.label}</span>
                      <Badge variant="outline">{i.key}</Badge>
                      {!i.active && <Badge variant="destructive">inactivo</Badge>}
                      {i.route && <Badge variant="secondary">{i.route}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(i.keywords ?? []).slice(0, 8).join(", ")}
                      {(i.keywords?.length ?? 0) > 8 ? " …" : ""}
                    </div>
                    <div className="text-xs mt-2 flex gap-3">
                      <span>Uso: <strong>{u.total}</strong></span>
                      <span>Éxito: <strong>{pct(success)}</strong></span>
                      <span>
                        Fallback: <strong>{u.total ? pct(u.fallback / u.total) : "—"}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing({
                          id: i.id,
                          key: i.key,
                          label: i.label,
                          route: i.route ?? "",
                          keywords: (i.keywords ?? []).join(", "),
                          spoken_reply: i.spoken_reply,
                          priority: i.priority,
                          active: i.active,
                        })
                      }
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar intent "${i.label}"?`)) del.mutate(i.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar intent" : "Nuevo intent"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Clave única" value={editing.key} onChange={(v) => setEditing({ ...editing, key: v })} />
              <Field label="Etiqueta visible" value={editing.label} onChange={(v) => setEditing({ ...editing, label: v })} />
              <Field label="Ruta (opcional)" value={editing.route} onChange={(v) => setEditing({ ...editing, route: v })} placeholder="/tram" />
              <Field
                label="Keywords (separadas por coma)"
                value={editing.keywords}
                onChange={(v) => setEditing({ ...editing, keywords: v })}
              />
              <div>
                <Label>Respuesta hablada</Label>
                <Textarea
                  value={editing.spoken_reply}
                  onChange={(e) => setEditing({ ...editing, spoken_reply: e.target.value })}
                  rows={3}
                />
              </div>
              <Field
                label="Prioridad"
                value={String(editing.priority)}
                onChange={(v) => setEditing({ ...editing, priority: Number(v) || 100 })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => editing && upsert.mutate(editing)} disabled={upsert.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
