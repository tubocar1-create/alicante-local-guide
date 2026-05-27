// Lista todo lo que el agente ha aprendido (Gemini → BD).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { learnedQO } from "@/lib/admin-ai-shared";
import type { LearnedItem } from "@/lib/admin-ai.functions";

export const Route = createFileRoute("/admin/ai/aprendizaje")({
  head: () => ({ meta: [{ title: "Admin · Aprendizaje del agente" }] }),
  component: AprendizajePage,
});

type Filter = "all" | "intent" | "proper_noun" | "cache";

const KIND_LABEL: Record<LearnedItem["kind"], string> = {
  intent: "Intent",
  proper_noun: "Nombre propio",
  cache: "Respuesta aprendida",
};

const KIND_COLOR: Record<LearnedItem["kind"], string> = {
  intent: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  proper_noun: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cache: "bg-purple-500/15 text-purple-700 border-purple-500/30",
};

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return d;
  }
}

function AprendizajePage() {
  const { data, isLoading, refetch, isFetching } = useQuery(learnedQO());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== "all" && i.kind !== filter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.detail.toLowerCase().includes(q) ||
        (i.route ?? "").toLowerCase().includes(q) ||
        i.keywords.some((k) => k.toLowerCase().includes(q)) ||
        (i.reply ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const counts = useMemo(() => {
    const c = { intent: 0, proper_noun: 0, cache: 0 } as Record<LearnedItem["kind"], number>;
    items.forEach((i) => (c[i.kind] += 1));
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-bold">🎓 Aprendizaje del agente</h2>
        <p className="text-sm text-muted-foreground">
          Todo lo que el agente ha aprendido desde Gemini: intents semánticos,
          nombres propios y caché de respuestas. Cada fila incluye la hora exacta
          en que fue aprendida.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "intent", "proper_noun", "cache"] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? `Todos (${items.length})`
              : `${KIND_LABEL[f]} (${counts[f] ?? 0})`}
          </Button>
        ))}
        <Input
          placeholder="Buscar título, ruta, keyword…"
          className="max-w-sm ml-auto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Actualizando…" : "Refrescar"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando aprendizaje…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sin aprendizaje registrado todavía. Cuando Gemini resuelva una consulta,
          aparecerá aquí.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <Card key={`${it.kind}-${it.id}`}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={KIND_COLOR[it.kind]}>
                        {KIND_LABEL[it.kind]}
                      </Badge>
                      <span className="font-medium truncate">{it.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground break-all">{it.detail}</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div>🕒 {fmt(it.createdAt)}</div>
                    {it.updatedAt && it.updatedAt !== it.createdAt && (
                      <div className="opacity-70">act. {fmt(it.updatedAt)}</div>
                    )}
                  </div>
                </div>

                {it.route && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">→ ruta: </span>
                    <code className="px-1 py-0.5 bg-muted rounded">{it.route}</code>
                  </p>
                )}

                {it.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {it.keywords.map((k) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                    ))}
                  </div>
                )}

                {it.reply && (
                  <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                    "{it.reply}"
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
