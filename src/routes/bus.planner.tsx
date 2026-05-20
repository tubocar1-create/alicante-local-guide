import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta legacy: el planificador ahora vive en el selector de buses del Inicio.
// Redirigimos a "/" y dejamos un flag en sessionStorage para que ChatScreen
// abra el picker en cuanto monte.
export const Route = createFileRoute("/bus/planner")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("agent:open-bus-picker", "1");
      } catch {
        /* noop */
      }
    }
    throw redirect({ href: "/?openBusPicker=1", replace: true });
  },
  component: () => null,
});
