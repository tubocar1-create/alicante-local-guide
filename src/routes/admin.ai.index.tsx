// Entrada del CPA: redirige a la página única de Correcciones.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ai/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/ai/correcciones" });
  },
  component: () => null,
});
