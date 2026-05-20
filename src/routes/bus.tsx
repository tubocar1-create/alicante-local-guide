import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta legacy: antes mostraba "Buses en vivo". Ahora cualquier entrada a /bus
// debe abrir el selector "¿Ya sabes qué bus tomar?" en Inicio.
export const Route = createFileRoute("/bus")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("agent:open-bus-picker", "1");
      } catch {
        /* noop */
      }
    }
    throw redirect({ to: "/", search: { openBusPicker: "1" } as any, replace: true });
  },
  component: () => null,
});