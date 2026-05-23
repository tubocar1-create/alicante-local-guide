// Entrada del CPA: redirige a la cola única de Auditoría.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ai/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/ai/auditoria" });
  },
  component: () => null,
});
