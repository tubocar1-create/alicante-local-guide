import { createFileRoute, redirect } from "@tanstack/react-router";

// Página legacy eliminada: el Dashboard Nocturno ahora vive inline en el chat
// del Inicio. Redirigimos a "/" para que cualquier enlace antiguo siga vivo.
export const Route = createFileRoute("/nocturno")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
