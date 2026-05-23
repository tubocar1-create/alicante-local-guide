// Shared helpers for /admin pages
import { queryOptions } from "@tanstack/react-query";
import { listAdminUsers } from "@/lib/admin-users.functions";

export const ADMIN_PIN = "7910511";
export const PIN_KEY = "admin_home_pin_ok";

export const adminUsersQueryOptions = () =>
  queryOptions({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers({ data: { pin: ADMIN_PIN } }),
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTimeOnly(iso: string | number | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
