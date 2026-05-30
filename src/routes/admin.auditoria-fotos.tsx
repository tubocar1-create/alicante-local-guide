// Auditoría de fotos: tabla con totales por subsector y casillas
// de autorización POR SUBSECTOR para llamar a Google API.
// La página es SOLO informativa + checkboxes. NO llama a ninguna
// API externa. El estado de los checkboxes vive en localStorage.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ImageIcon, ImageOff, Lock, Sparkles, AlertTriangle } from "lucide-react";
import {
  getPhotoAudit,
  type SectorBlock,
} from "@/lib/admin-photo-audit.functions";
import { backfillAuthorizedPhotos } from "@/lib/admin-photo-backfill.functions";

export const Route = createFileRoute("/admin/auditoria-fotos")({
  head: () => ({ meta: [{ title: "Admin · Auditoría de fotos" }] }),
  component: AuditoriaFotos,
});

// v2 = autorización por subsector (clave = `${sector}::${subsector}`)
const STORAGE_KEY = "admin.google-auth.subsectors.v2";

function useSubsectorAuth(allKeys: string[]) {
  const [auth, setAuth] = useState<Record<string, boolean>>({});
  const keysSig = allKeys.join("|");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      const next: Record<string, boolean> = {};
      for (const k of allKeys) next[k] = !!parsed[k];
      setAuth(next);
    } catch {
      const next: Record<string, boolean> = {};
      for (const k of allKeys) next[k] = false;
      setAuth(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig]);

  const persist = (next: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggle = (key: string, value: boolean) => {
    setAuth((cur) => {
      const next = { ...cur, [key]: value };
      persist(next);
      return next;
    });
  };

  const setMany = (keys: string[], value: boolean) => {
    setAuth((cur) => {
      const next = { ...cur };
      for (const k of keys) next[k] = value;
      persist(next);
      return next;
    });
  };

  return { auth, toggle, setMany };
}

const subKey = (sectorKey: string, subKeyValue: string) =>
  `${sectorKey}::${subKeyValue}`;

function AuditoriaFotos() {
  const fetchFn = useServerFn(getPhotoAudit);
  const q = useQuery({
    queryKey: ["photo-audit"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const allKeys = useMemo(() => {
    if (!q.data) return [];
    const out: string[] = [];
    for (const s of q.data.sectors) {
      for (const r of s.subsectors) out.push(subKey(s.key, r.key));
    }
    return out;
  }, [q.data]);

  const { auth, toggle, setMany } = useSubsectorAuth(allKeys);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando totales por
        subsector…
      </div>
    );
  }
  if (q.error) {
    return (
      <p className="text-sm text-destructive">{(q.error as Error).message}</p>
    );
  }
  const data = q.data!;

  const grand = data.sectors.reduce(
    (acc, s) => {
      for (const r of s.subsectors) {
        acc.total += r.total;
        acc.withPhoto += r.withPhoto;
        acc.withoutPhoto += r.withoutPhoto;
      }
      return acc;
    },
    { total: 0, withPhoto: 0, withoutPhoto: 0 },
  );

  const totalAuthorized = Object.values(auth).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">📸 Auditoría de fotos por subsector</h1>
        <p className="text-sm text-muted-foreground">
          Recuento de cuántos elementos tienen una foto visible y cuántos no, en
          cada subsector del proyecto. Cada fila lleva su propia casilla:
          marcada = autorizas a llamar a Google API para ESE subsector. Sin
          marcar = prohibido. Yo (Lovable) no hago ninguna llamada por mi
          cuenta.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Generado: {new Date(data.generatedAt).toLocaleString("es-ES")}
          </span>
          <span>
            Subsectores autorizados: <strong>{totalAuthorized}</strong> /{" "}
            {allKeys.length}
          </span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total general (todos los sectores)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Big label="Elementos" value={grand.total} />
            <Big
              label="Con foto"
              value={grand.withPhoto}
              tone="good"
              icon={<ImageIcon className="h-4 w-4" />}
            />
            <Big
              label="Sin foto"
              value={grand.withoutPhoto}
              tone="bad"
              icon={<ImageOff className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      {data.sectors.map((sector) => (
        <SectorCard
          key={sector.key}
          sector={sector}
          auth={auth}
          onToggle={(subKeyValue, v) => toggle(subKey(sector.key, subKeyValue), v)}
          onToggleAll={(v) =>
            setMany(
              sector.subsectors.map((r) => subKey(sector.key, r.key)),
              v,
            )
          }
        />
      ))}
    </div>
  );
}

function SectorCard({
  sector,
  auth,
  onToggle,
  onToggleAll,
}: {
  sector: SectorBlock;
  auth: Record<string, boolean>;
  onToggle: (subKeyValue: string, v: boolean) => void;
  onToggleAll: (v: boolean) => void;
}) {
  const totals = sector.subsectors.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.withPhoto += r.withPhoto;
      acc.withoutPhoto += r.withoutPhoto;
      return acc;
    },
    { total: 0, withPhoto: 0, withoutPhoto: 0 },
  );

  const authedCount = sector.subsectors.filter(
    (r) => !!auth[subKey(sector.key, r.key)],
  ).length;
  const allAuth = authedCount > 0 && authedCount === sector.subsectors.length;
  const anyAuth = authedCount > 0;

  return (
    <Card className={anyAuth ? "border-emerald-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{sector.label}</CardTitle>
            <p className="text-[11px] font-mono text-muted-foreground">
              {sector.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {anyAuth && (
              <Badge className="bg-emerald-600">
                {authedCount}/{sector.subsectors.length} autorizados
              </Badge>
            )}
            <button
              type="button"
              onClick={() => onToggleAll(!allAuth)}
              className="text-xs border rounded-md px-2.5 py-1.5 hover:bg-muted"
              disabled={sector.subsectors.length === 0}
            >
              {allAuth ? "Desmarcar todo" : "Marcar todo"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-1.5 pr-2 font-medium w-10">Auth.</th>
              <th className="py-1.5 pr-3 font-medium">Subsector</th>
              <th className="py-1.5 pr-3 font-medium text-right">Total</th>
              <th className="py-1.5 pr-3 font-medium text-right">Con foto</th>
              <th className="py-1.5 pr-3 font-medium text-right">Sin foto</th>
              <th className="py-1.5 pr-3 font-medium text-right">% con foto</th>
            </tr>
          </thead>
          <tbody>
            {sector.subsectors.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-3 text-xs text-muted-foreground italic"
                >
                  Sin subsectores poblados.
                </td>
              </tr>
            )}
            {sector.subsectors.map((r) => {
              const pct = r.total > 0 ? Math.round((r.withPhoto / r.total) * 100) : 0;
              const k = subKey(sector.key, r.key);
              const checked = !!auth[k];
              return (
                <tr
                  key={r.key}
                  className={`border-b last:border-b-0 ${checked ? "bg-emerald-500/5" : ""}`}
                >
                  <td className="py-1.5 pr-2">
                    <label className="flex items-center justify-center cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => onToggle(r.key, v === true)}
                        aria-label={`Autorizar Google API para ${r.label}`}
                      />
                    </label>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      {checked ? (
                        <Badge className="bg-emerald-600 h-4 px-1 text-[10px]">
                          OK
                        </Badge>
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                      {r.label}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700">
                    {r.withPhoto}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-destructive">
                    {r.withoutPhoto}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-xs text-muted-foreground">
                    {r.total > 0 ? `${pct}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-muted/30">
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-3">Total {sector.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{totals.total}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">
                {totals.withPhoto}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-destructive">
                {totals.withoutPhoto}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-xs">
                {totals.total > 0
                  ? `${Math.round((totals.withPhoto / totals.total) * 100)}%`
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function Big({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-destructive"
        : "";
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString("es-ES")}
      </p>
    </div>
  );
}
