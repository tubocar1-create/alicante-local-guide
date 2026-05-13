import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CalendarClock, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { listThreadsForBusiness } from "@/lib/coord/threads.functions";
import { sendMessage } from "@/lib/coord/messages.functions";
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
      <Link
        to="/business"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
      </Link>
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
          const bookingStatus = t.booking?.status;
          const isPending = bookingStatus === "pending";
          const isConfirmed = bookingStatus === "confirmed";
          const isRejected = bookingStatus === "cancelled";
          const isAwaitingBusiness = t.status === "awaiting_business" && isPending;
          const cardCls = isConfirmed
            ? "rounded-2xl border-2 border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30"
            : isRejected
              ? "rounded-2xl border-2 border-red-700 bg-red-100 dark:bg-red-950/40"
              : isAwaitingBusiness
                ? "rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 animate-blink"
                : "rounded-2xl border border-border bg-card";
          return (
            <li key={t.id} className={cardCls}>
              <Link
                to="/business/inbox/$id"
                params={{ id: t.id }}
                className="block p-3"
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
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${bookingBadge(bookingStatus, t.status)}`}>
                      {bookingLabel(bookingStatus, t.status, t.had_proposal, t.cancelled_by)}
                    </span>
                    <span className={`text-[10px] ${sla ? "text-destructive" : "text-muted-foreground"}`}>
                      {ageMin}m
                    </span>
                  </div>
                </div>
              </Link>
              {isPending && (
                <QuickActions
                  threadId={t.id}
                  scheduledAt={t.booking?.scheduled_at}
                  customerName={t.booking?.customer_name ?? undefined}
                />
              )}
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

function bookingBadge(b: string | undefined, s: string) {
  if (b === "confirmed") return "bg-emerald-500 text-white";
  if (b === "cancelled") return "bg-red-700 text-white";
  if (b === "completed") return "bg-muted text-muted-foreground";
  if (s === "awaiting_business") return "bg-amber-500 text-white";
  if (s === "awaiting_user") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-muted text-foreground";
}

function bookingLabel(
  b: string | undefined,
  s: string,
  hadProposal?: boolean,
  cancelledBy?: "business" | "user" | null,
) {
  if (b === "confirmed") return hadProposal ? "confirmada con cambio de horario" : "confirmada";
  if (b === "cancelled") {
    if (cancelledBy === "business") return "cancelada por el negocio";
    if (cancelledBy === "user") return "cancelada por el cliente";
    return "cancelada";
  }
  if (b === "completed") return "completada";
  if (s === "awaiting_business") return "nueva";
  if (s === "awaiting_user") return "esperando cliente";
  return s;
}

function badgeFor(s: string) {
  if (s === "awaiting_business") return "bg-primary/10 text-primary";
  if (s === "awaiting_user") return "bg-muted text-foreground";
  if (s === "closed" || s === "expired") return "bg-muted text-muted-foreground";
  return "bg-muted text-foreground";
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function QuickActions({
  threadId,
  scheduledAt,
  customerName,
}: {
  threadId: string;
  scheduledAt?: string;
  customerName?: string;
}) {
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | "propose" | "decline">(null);
  const [slot, setSlot] = useState(() =>
    scheduledAt ? toLocalInputValue(scheduledAt) : "",
  );
  const firstName = (customerName ?? "").split(" ")[0] || "Hola";
  const [reason, setReason] = useState(
    `Hola ${firstName}, hoy no tenemos disponibilidad en todo el horario. ¿Te gustaría reservar para otra fecha? Estaremos encantados de recibirte.`,
  );

  const m = useMutation({
    mutationFn: (v: { template_key: string; payload?: Record<string, unknown> }) =>
      send({ data: { thread_id: threadId, actor_role: "business", ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      setMode(null);
      toast.success("Respuesta enviada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (mode === "propose") {
    return (
      <div className="space-y-2 border-t border-border px-3 py-2">
        <p className="text-xs font-medium">Propón una nueva hora</p>
        <input
          type="datetime-local"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setMode(null)}
            className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Cancelar
          </button>
          <button
            disabled={m.isPending || !slot}
            onClick={() =>
              m.mutate({
                template_key: "business.propose_slot",
                payload: { scheduled_at: new Date(slot).toISOString() },
              })
            }
            className="flex-1 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            Enviar propuesta
          </button>
        </div>
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <div className="space-y-2 border-t border-border px-3 py-2">
        <p className="text-xs font-medium">Rechazar e invitar a otra fecha</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setMode(null)}
            className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Cancelar
          </button>
          <button
            disabled={m.isPending}
            onClick={() =>
              m.mutate({ template_key: "business.decline", payload: { reason } })
            }
            className="flex-1 rounded-full bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-50"
          >
            Rechazar e invitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 border-t border-border px-3 py-2">
      <button
        disabled={m.isPending}
        onClick={(e) => { e.stopPropagation(); m.mutate({ template_key: "business.confirm", payload: {} }); }}
        className="flex items-center justify-center gap-1 rounded-full bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" /> Aceptar
      </button>
      <button
        disabled={m.isPending}
        onClick={(e) => { e.stopPropagation(); setMode("propose"); }}
        className="flex items-center justify-center gap-1 rounded-full border border-border bg-background px-2 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <CalendarClock className="h-3.5 w-3.5" /> Cambiar
      </button>
      <button
        disabled={m.isPending}
        onClick={(e) => { e.stopPropagation(); setMode("decline"); }}
        className="flex items-center justify-center gap-1 rounded-full border border-border bg-background px-2 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" /> Rechazar
      </button>
    </div>
  );
}
