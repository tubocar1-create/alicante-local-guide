import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ocio_/eventos_/agenda")({
  beforeLoad: () => {
    throw redirect({ to: "/ocio/eventos" });
  },
});
