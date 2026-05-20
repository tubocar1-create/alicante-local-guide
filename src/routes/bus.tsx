import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Ruta legacy: antes mostraba "Buses en vivo". Ahora cualquier entrada a /bus
// debe abrir el selector "¿Ya sabes qué bus tomar?" en Inicio.
export const Route = createFileRoute("/bus")({
  beforeLoad: ({ location }) => {
    // Solo redirige la URL exacta /bus al selector en Inicio.
    // No interferir con rutas hijas como /bus/dashboard/$code o /bus/lines/$code.
    if (location.pathname !== "/bus") return;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("agent:open-bus-picker", "1");
      } catch {
        /* noop */
      }
    }
    throw redirect({ href: "/?openBusPicker=1", replace: true });
  },
  component: () => <Outlet />,
});