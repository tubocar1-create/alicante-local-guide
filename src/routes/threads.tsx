import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreadsForUser, listGuestBookingStatuses } from "@/lib/coord/threads.functions";

const LOCAL_BOOKINGS_KEY = "local_booking_threads_v1";

type LocalBookingThread = {
  id: string;
  booking_id?: string;
  business_name?: string;
  status?: string;
  scheduled_at?: string;
  created_at?: string;
  access_token?: string;
};

function readLocalBookings(): LocalBookingThread[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/threads")({
  head: () => ({ meta: [{ title: "Mis conversaciones" }, { name: "robots", content: "noindex" }] }),
  component: ThreadsLayout,
});

function ThreadsLayout() {
  const location = useLocation();
  const isList = location.pathname === "/threads" || location.pathname === "/threads/";
  const fetchThreads = useServerFn(listThreadsForUser);
  const fetchGuest = useServerFn(listGuestBookingStatuses);

  const { data } = useQuery({
    queryKey: ["my-threads"],
    queryFn: () => fetchThreads(),
    enabled: isList,
    refetchInterval: 15000,
    retry: false,
    throwOnError: false,
  });

  const localThreads = isList ? readLocalBookings() : [];
  const guestItems = localThreads
    .filter((t) => t.access_token)
    .map((t) => ({ booking_id: t.booking_id ?? t.id, token: t.access_token! }));

  const { data: guestData } = useQuery({
    queryKey: [
      "guest-statuses",
      guestItems
        .map((i) => i.booking_id)
        .sort()
        .join(","),
    ],
    queryFn: () => fetchGuest({ data: { items: guestItems } }),
    enabled: isList && guestItems.length > 0,
    refetchInterval: 15000,
    retry: false,
    throwOnError: false,
  });

  if (!isList) {
    return (
      <div className="mx-auto min-h-svh max-w-md bg-background">
        <Outlet />
      </div>
    );
  }

  const threads = data?.threads ?? [];
  const guestStatuses = new Map((guestData?.items ?? []).map((i) => [i.booking_id, i]));
  const serverBookingIds = new Set(threads.map((t) => t.booking_id));
  const dedupedLocal = localThreads.filter((t) => !serverBookingIds.has(t.booking_id ?? t.id));

  return (
    <div className="mx-auto min-h-svh max-w-md bg-background px-4 py-6">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground active:scale-95"
      >
        ← Inicio
      </Link>
      <h1 className="mb-1 mt-3 text-xl font-semibold">Mis reservas</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Aquí verás el estado y la respuesta del negocio para cada reserva.
      </p>
      <ul className="space-y-2">
        {threads.map((t) => {
          const effectiveStatus = t.booking?.status ?? t.status;
          const cls = cardCls(effectiveStatus);
          const customerName = t.booking?.customer_name;
          return (
            <li key={t.id}>
              <Link
                to="/threads/$id"
                params={{ id: t.id }}
                className={`block rounded-2xl border p-3 ${cls}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{t.business?.name ?? "Negocio"}</p>
                  <StatusBadge status={effectiveStatus} />
                </div>
                {customerName && (
                  <p className="text-[11px] text-muted-foreground">
                    Reserva hecha por {customerName}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {t.booking?.scheduled_at ||
                  (t.context_snapshot as Record<string, unknown> | null)?.scheduled_at
                    ? `Para: ${new Date(String(t.booking?.scheduled_at ?? (t.context_snapshot as Record<string, unknown>).scheduled_at)).toLocaleString()}`
                    : `Última actividad: ${new Date(t.last_message_at).toLocaleString()}`}
                </p>
              </Link>
            </li>
          );
        })}
        {dedupedLocal.map((t) => {
          const bookingId = t.booking_id ?? t.id;
          const remote = guestStatuses.get(bookingId);
          const effectiveStatus =
            remote?.booking_status ?? remote?.thread?.status ?? t.status ?? "pending";
          const cls = cardCls(effectiveStatus);
          const customerName = remote?.customer_name;
          return (
            <li key={`local-${t.id}`}>
              <Link
                to="/threads/$id"
                params={{ id: t.id }}
                search={{ token: t.access_token }}
                className={`block rounded-2xl border p-3 ${cls}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {remote?.business_name ?? t.business_name ?? "Negocio"}
                  </p>
                  <StatusBadge status={effectiveStatus} />
                </div>
                {customerName && (
                  <p className="text-[11px] text-muted-foreground">
                    Reserva hecha por {customerName}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {remote?.scheduled_at || t.scheduled_at
                    ? `Para: ${new Date(remote?.scheduled_at ?? t.scheduled_at!).toLocaleString()}`
                    : new Date(t.created_at ?? Date.now()).toLocaleString()}
                </p>
              </Link>
            </li>
          );
        })}
        {threads.length === 0 && dedupedLocal.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aún no tienes reservas. Cuando reserves en un negocio, aparecerá aquí con el estado y la
            respuesta.
          </li>
        )}
      </ul>
    </div>
  );
}

function cardCls(status?: string) {
  if (status === "confirmed")
    return "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30 border-2";
  if (status === "rejected" || status === "declined" || status === "cancelled")
    return "border-red-700 bg-red-100 dark:bg-red-950/40 border-2";
  if (status === "awaiting_user" || status === "rescheduled")
    return "border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/20 animate-pulse";
  if (status === "pending" || status === "awaiting_business")
    return "border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 animate-pulse";
  return "border-border bg-card";
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente por responder", cls: "bg-amber-100 text-amber-800" },
    awaiting_business: { label: "Pendiente por responder", cls: "bg-amber-100 text-amber-800" },
    awaiting_user: { label: "Esperando tu respuesta", cls: "bg-blue-100 text-blue-800" },
    confirmed: { label: "Confirmada", cls: "bg-emerald-500 text-white" },
    rescheduled: { label: "Nuevo horario propuesto", cls: "bg-blue-100 text-blue-800" },
    rejected: { label: "Rechazada", cls: "bg-red-700 text-white" },
    declined: { label: "Rechazada", cls: "bg-red-700 text-white" },
    cancelled: { label: "Cancelada", cls: "bg-red-700 text-white" },
    closed: { label: "Cerrada", cls: "bg-muted text-muted-foreground" },
    completed: { label: "Completada", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status ?? "pending"] ?? {
    label: status ?? "—",
    cls: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}
