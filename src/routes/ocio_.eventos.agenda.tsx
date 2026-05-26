import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ocio_/eventos/agenda")({
  beforeLoad: () => {
    throw redirect({ to: "/ocio/eventos" });
  },
});
