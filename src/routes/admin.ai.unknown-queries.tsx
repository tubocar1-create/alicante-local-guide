// Cola de consultas que el agente no supo resolver.
// El admin puede promover a intent, marcar spam, ignorar, etc.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unknownQueriesQO } from "@/lib/admin-ai-shared";
import { actUnknownQuery } from "@/lib/admin-ai.functions";
import { ADMIN_PIN } from "@/lib/admin-shared";
import { toast } from "sonner";

type UnknownAction =
  | "promote_intent"
  | "add_faq"
  | "add_alias"
  | "spam"
  | "ignore"
  | "merge"
  | "send_to_supervision";

export const Route = createFileRoute("/admin/ai/unknown-queries")({
  component: UnknownQueriesPage,
});

type Status = "pending" | "processed" | "all";

function UnknownQueriesPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery(unknownQueriesQO(status, search));

  const mut = useMutation({
    mutationFn: (args: { id: string; action: string; payload?: Record<string, unknown> }) =>
      actUnknownQuery({
        data: {
          pin: ADMIN_PIN,
          id: args.id,
          action: args.action as Parameters<typeof actUnknownQuery>[0]["data"]["action"],
          payload: args.payload ?? {},
        },
      }),
    onSuccess: () => {
      toast({ title: "Acción aplicada" });
      qc.invalidateQueries({ queryKey: ["admin-ai", "unknown"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="processed">Procesadas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Refrescar
          </Button>
          <Badge variant="secondary" className="ml-auto">
            {q.data?.rows.length ?? 0} resultados
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !q.data?.rows.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              No hay consultas {status === "pending" ? "pendientes" : ""}.
            </p>
          ) : (
            <div className="divide-y">
              {q.data.rows.map((row) => (
                <div key={row.id} className="p-4 flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-words">{row.query}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{row.count}× repetida</Badge>
                      <span>norm: {row.normalized}</span>
                      {row.path && <span>· en {row.path}</span>}
                      {row.processed_at && <Badge>Procesada</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        mut.mutate({
                          id: row.id,
                          action: "promote_intent",
                          payload: {
                            key: `intent_${Date.now()}`,
                            label: row.normalized,
                            keywords: [row.normalized],
                            spoken_reply: "Te ayudo con eso.",
                          },
                        })
                      }
                      disabled={mut.isPending || !!row.processed_at}
                    >
                      Crear intent
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const response = prompt("Respuesta FAQ:");
                        if (!response) return;
                        mut.mutate({
                          id: row.id,
                          action: "add_faq",
                          payload: { response, keywords: [row.normalized] },
                        });
                      }}
                      disabled={mut.isPending || !!row.processed_at}
                    >
                      Añadir FAQ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mut.mutate({ id: row.id, action: "ignore" })}
                      disabled={mut.isPending || !!row.processed_at}
                    >
                      Ignorar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => mut.mutate({ id: row.id, action: "spam" })}
                      disabled={mut.isPending || !!row.processed_at}
                    >
                      Spam
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
