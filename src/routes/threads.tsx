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
  return (
    <div className="mx-auto min-h-svh max-w-md bg-background px-4 py-6">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground active:scale-95">
        ← Inicio
      </Link>
      <h1 className="mb-3 mt-3 text-xl font-semibold">Mis conversaciones</h1>
      <ul className="space-y-2">
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              to="/threads/$id"
              params={{ id: t.id }}
              className="block rounded-2xl border border-border bg-card p-3"
            >
              <p className="text-sm font-medium">{t.business?.name ?? "Negocio"}</p>
              <p className="text-xs text-muted-foreground">{t.status}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(t.last_message_at).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
        {localThreads.map((t) => (
          <li key={`local-${t.id}`} className="rounded-2xl border border-border bg-card p-3">
            <p className="text-sm font-medium">{t.business_name ?? "Negocio"}</p>
            <p className="text-xs text-muted-foreground">{t.status ?? "pending"}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(t.scheduled_at ?? t.created_at ?? Date.now()).toLocaleString()}
            </p>
          </li>
        ))}
        {threads.length === 0 && localThreads.length === 0 && (
          <li className="text-sm text-muted-foreground">Aún no tienes reservas activas.</li>
        )}
      </ul>
    </div>
  );
}
