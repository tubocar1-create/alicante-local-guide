import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreadsForUser } from "@/lib/coord/threads.functions";

const LOCAL_BOOKINGS_KEY = "local_booking_threads_v1";

type LocalBookingThread = {
  id: string;
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
  const { data } = useQuery({
    queryKey: ["my-threads"],
    queryFn: () => fetchThreads(),
    enabled: isList,
    refetchInterval: 20000,
    retry: false,
    throwOnError: false,
  });

  if (!isList) {
    return <div className="mx-auto min-h-svh max-w-md bg-background"><Outlet /></div>;
  }

  const threads = data?.threads ?? [];
  const localThreads = readLocalBookings();
  const serverBookingIds = new Set(threads.map((t) => t.booking_id));
  const dedupedLocal = localThreads.filter((t) => !serverBookingIds.has(t.id));

  return (
    <div className="mx-auto min-h-svh max-w-md bg-background px-4 py-6">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground active:scale-95">
        ← Inicio
      </Link>
      <h1 className="mb-1 mt-3 text-xl font-semibold">Mis reservas</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Aquí verás el estado y la respuesta del negocio para cada reserva.
      </p>
      <ul className="space-y-2">
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              to="/threads/$id"
              params={{ id: t.id }}
              className="block rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{t.business?.name ?? "Negocio"}</p>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Última actividad: {new Date(t.last_message_at).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
        {dedupedLocal.map((t) => (
          <li key={`local-${t.id}`}>
            <Link
              to="/threads/$id"
              params={{ id: t.id }}
              search={{ token: t.access_token }}
              className="block rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{t.business_name ?? "Negocio"}</p>
                <StatusBadge status={t.status ?? "pending"} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t.scheduled_at ? `Para: ${new Date(t.scheduled_at).toLocaleString()}` : new Date(t.created_at ?? Date.now()).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
        {threads.length === 0 && dedupedLocal.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aún no tienes reservas. Cuando reserves en un negocio, aparecerá aquí con el estado y la respuesta.
          </li>
        )}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente por responder", cls: "bg-amber-100 text-amber-800" },
    awaiting_business: { label: "Pendiente por responder", cls: "bg-amber-100 text-amber-800" },
    awaiting_user: { label: "Esperando tu respuesta", cls: "bg-blue-100 text-blue-800" },
    confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-800" },
    rescheduled: { label: "Nuevo horario propuesto", cls: "bg-blue-100 text-blue-800" },
    rejected: { label: "Rechazada", cls: "bg-rose-100 text-rose-800" },
    declined: { label: "Rechazada", cls: "bg-rose-100 text-rose-800" },
    cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
    closed: { label: "Cerrada", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status ?? "pending"] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}
