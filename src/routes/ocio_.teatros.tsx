import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ocio_/teatros")({
  beforeLoad: () => {
    throw redirect({ to: "/ocio/eventos" });
  },
  component: () => null,
});
