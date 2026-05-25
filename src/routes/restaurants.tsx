import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/restaurants")({
  beforeLoad: ({ location }) => {
    // El "Dashboard Gastronómico" se eliminó por diseño:
    // al pisar un restaurante específico debemos abrir directamente la ficha
    // (/restaurants/$placeId). Si alguien aterriza en /restaurants sin
    // placeId, lo enviamos al inicio.
    if (location.pathname === "/restaurants" || location.pathname === "/restaurants/") {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
