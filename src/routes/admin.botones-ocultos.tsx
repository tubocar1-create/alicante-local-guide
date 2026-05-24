import { createFileRoute } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HIDDEN_BUTTONS, isPreviewHost } from "@/lib/hidden-buttons";

export const Route = createFileRoute("/admin/botones-ocultos")({
  head: () => ({ meta: [{ title: "Admin · Botones ocultos" }] }),
  component: BotonesOcultosPage,
});

function BotonesOcultosPage() {
  const preview = typeof window !== "undefined" ? isPreviewHost() : true;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <EyeOff className="h-6 w-6" /> Botones ocultos en producción
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estos botones están <strong>visibles en preview</strong> (sandbox /
          localhost / *.lovableproject.com) pero <strong>ocultos en la URL
          publicada</strong> (https). Útil para iterar funcionalidades sin
          exponerlas al público.
        </p>
        <p className="text-xs mt-2">
          Entorno actual:{" "}
          <span
            className={
              preview
                ? "text-emerald-600 font-medium"
                : "text-amber-600 font-medium"
            }
          >
            {preview ? "Preview (ves los botones)" : "Producción (botones ocultos)"}
          </span>
        </p>
      </header>

      <div className="grid gap-3">
        {HIDDEN_BUTTONS.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{b.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Ubicación: </span>
                {b.location}
              </div>
              <div>
                <span className="text-muted-foreground">Archivo: </span>
                <code className="text-xs">{b.file}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Motivo: </span>
                {b.reason}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Para añadir o quitar entradas, edita{" "}
        <code>src/lib/hidden-buttons.ts</code>.
      </p>
    </div>
  );
}
