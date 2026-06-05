import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

/**
 * Página puente /enlace
 * ---------------------------------------------------------------
 * Sirve como intermediaria entre un botón interno y un destino
 * externo. El usuario nunca debería verla: en cuanto monta,
 * redirige a la URL recibida por query (?url=...&replace=1).
 *
 * Aquí es donde se pueden colocar scripts de terceros (afiliación,
 * tracking, conversiones, etc.) sin tocar la estructura del resto
 * de la app.
 *
 * Uso desde cualquier botón:
 *   navigate({ to: "/enlace", search: { url: "https://destino.com" } })
 *   <Link to="/enlace" search={{ url: "https://destino.com" }} />
 */

const searchSchema = z.object({
  url: z.string().url().optional(),
  replace: z.union([z.literal("1"), z.literal("0")]).optional(),
  target: z.union([z.literal("_self"), z.literal("_blank")]).optional(),
});

export const Route = createFileRoute("/enlace")({
  validateSearch: (search) => searchSchema.parse(search),
  component: EnlacePuente,
});

function EnlacePuente() {
  const { url, replace, target } = Route.useSearch();

  useEffect(() => {
    if (!url) return;

    // === SCRIPTS EXTERNOS ===
    // Script de terceros inyectado como puente (tracking/afiliación)
    const externalScript = document.createElement("script");
    externalScript.src = "https://emrldtp.com/NTMyOTM5.js?t=532939";
    externalScript.async = true;
    document.head.appendChild(externalScript);
    // ========================

    const go = () => {
      if (target === "_blank") {
        window.open(url, "_blank", "noopener,noreferrer");
        window.history.back();
        return;
      }
      if (replace === "0") {
        window.location.assign(url);
      } else {
        window.location.replace(url);
      }
    };

    // Pequeño delay para que los scripts externos puedan ejecutarse.
    const t = setTimeout(go, 50);
    return () => clearTimeout(t);
  }, [url, replace, target]);

  // No observable: pantalla en blanco.
  return <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "transparent" }} />;
}
