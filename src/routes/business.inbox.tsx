import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { listThreadsForBusiness } from "@/lib/coord/threads.functions";
import { TEMPLATES } from "@/lib/coord/templates";

export const Route = createFileRoute("/business/inbox")({
  head: () => ({ meta: [{ title: "Bandeja · Business" }, { name: "robots", content: "noindex" }] }),
  component: InboxPage,
});

function InboxPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const fetchThreads = useServerFn(listThreadsForBusiness);
  const qc = useQueryClient();

  const { data: bizData } = useQuery({ queryKey: ["my-businesses"], queryFn: () => fetchBiz() });
  const businesses = bizData?.businesses ?? [];
  const businessIds = businesses.map((b) => b.id);
  const business = businesses[0];

  const { data } = useQuery({
    queryKey: ["inbox", businessIds],
    queryFn: () => fetchThreads({ data: { business_ids: businessIds } }),
    enabled: businessIds.length > 0,
    refetchInterval: 15000,
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    if (!businessIds.length) return;
    const channels = businessIds.map((id) =>
      supabase
        .channel(`inbox:${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversation_threads", filter: `business_id=eq.${id}` },
          () => qc.invalidateQueries({ queryKey: ["inbox", businessIds] }),
        )
        .subscribe(),
    );
    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [businessIds.join(","), qc]);

  if (!business) return <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>;

  const threads = data?.threads ?? [];
  const awaiting = threads.filter((t) => t.status === "awaiting_business").length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Bandeja</h1>
        {awaiting > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {awaiting} pendiente{awaiting === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {threads.map((t) => {
          const last = t.last_message;
          const isBookingRequest =
            !last || last.template_key === "booking_created";
          const lastLabel = isBookingRequest
            ? `solicitó una reserva para ${t.booking?.party_size ?? 1} ${
                (t.booking?.party_size ?? 1) === 1 ? "persona" : "personas"
              }`
            : last?.template_key
              ? (TEMPLATES[last.template_key]?.label ?? last.template_key)
              : (last?.text ?? "—");
          const ageMin = Math.round((Date.now() - new Date(t.last_message_at).getTime()) / 60000);
          const sla = t.status === "awaiting_business" && ageMin > 10;
          return (
            <li key={t.id}>
              <Link
                to="/business/inbox/$id"
                params={{ id: t.id }}
                className="block rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.booking?.customer_name ?? "Cliente"}{" "}
                      <span className="font-normal text-muted-foreground">{lastLabel}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.booking
                        ? new Date(t.booking.scheduled_at).toLocaleString([], {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${badgeFor(t.status)}`}>
                      {t.status === "awaiting_business" ? "nuevo" : t.status}
                    </span>
                    <span className={`text-[10px] ${sla ? "text-destructive" : "text-muted-foreground"}`}>
                      {ageMin}m
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
        {threads.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin conversaciones todavía.</li>
        )}
      </ul>
    </div>
  );
}

function badgeFor(s: string) {
  if (s === "awaiting_business") return "bg-primary/10 text-primary";
  if (s === "awaiting_user") return "bg-muted text-foreground";
  if (s === "closed" || s === "expired") return "bg-muted text-muted-foreground";
  return "bg-muted text-foreground";
}
