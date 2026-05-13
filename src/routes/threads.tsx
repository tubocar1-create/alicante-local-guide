import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreadsForUser } from "@/lib/coord/threads.functions";

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
  });

  if (!isList) {
    return <div className="mx-auto min-h-svh max-w-md bg-background"><Outlet /></div>;
  }

  const threads = data?.threads ?? [];
  return (
    <div className="mx-auto min-h-svh max-w-md bg-background px-4 py-6">
      <h1 className="mb-3 text-xl font-semibold">Mis conversaciones</h1>
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
        {threads.length === 0 && (
          <li className="text-sm text-muted-foreground">Aún no tienes reservas activas.</li>
        )}
      </ul>
    </div>
  );
}
