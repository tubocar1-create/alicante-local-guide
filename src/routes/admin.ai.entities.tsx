// CRUD sobre agente_proper_nouns (entidades y alias).
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { entitiesQO } from "@/lib/admin-ai-shared";
import { upsertEntity, deleteEntity } from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ai/entities")({
  component: EntitiesPage,
});

type EntityForm = {
  id?: string;
  name: string;
  normalized: string;
  category: string;
  route: string;
  aliases: string;
  priority: number;
  active: boolean;
};

const empty: EntityForm = {
  name: "",
  normalized: "",
  category: "lugar",
  route: "/",
  aliases: "",
  priority: 100,
  active: true,
};

function EntitiesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery(entitiesQO());
  const [editing, setEditing] = useState<EntityForm | null>(null);

  const upsert = useMutation({
    mutationFn: (f: EntityForm) =>
      upsertEntity({
        data: {
          pin: ADMIN_PIN,
          id: f.id,
          name: f.name,
          normalized: f.normalized.toLowerCase(),
          category: f.category,
          route: f.route,
          aliases: f.aliases.split(",").map((s) => s.trim()).filter(Boolean),
          priority: f.priority,
          active: f.active,
        },
      }),
    onSuccess: () => {
      toast({ title: "Guardado" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-ai", "entities"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEntity({ data: { pin: ADMIN_PIN, id } }),
    onSuccess: () => {
      toast({ title: "Eliminada" });
      qc.invalidateQueries({ queryKey: ["admin-ai", "entities"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Lugares, marcas y nombres propios con sus variantes ("castell" → "castillo santa bárbara").
        </p>
        <Button size="sm" onClick={() => setEditing(empty)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva entidad
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-2">
          {(q.data?.rows ?? []).map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4 flex flex-wrap gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{e.name}</span>
                    <Badge variant="outline">{e.category}</Badge>
                    {!e.active && <Badge variant="destructive">inactivo</Badge>}
                    <Badge variant="secondary">{e.route}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Alias: {(e.aliases ?? []).join(", ") || "—"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        id: e.id,
                        name: e.name,
                        normalized: e.normalized,
                        category: e.category,
                        route: e.route,
                        aliases: (e.aliases ?? []).join(", "),
                        priority: e.priority,
                        active: e.active,
                      })
                    }
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${e.name}"?`)) del.mutate(e.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar entidad" : "Nueva entidad"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <FieldE label="Nombre" v={editing.name} on={(v) => setEditing({ ...editing, name: v })} />
              <FieldE label="Normalizado" v={editing.normalized} on={(v) => setEditing({ ...editing, normalized: v })} />
              <FieldE label="Categoría" v={editing.category} on={(v) => setEditing({ ...editing, category: v })} />
              <FieldE label="Ruta" v={editing.route} on={(v) => setEditing({ ...editing, route: v })} />
              <FieldE
                label="Alias (separados por coma)"
                v={editing.aliases}
                on={(v) => setEditing({ ...editing, aliases: v })}
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

function FieldE({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
