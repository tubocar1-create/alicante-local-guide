import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { Send, Clock, Check, CalendarClock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getThread } from "@/lib/coord/threads.functions";
import { sendMessage, markThreadRead } from "@/lib/coord/messages.functions";
import { suggestionsFor, TEMPLATES } from "@/lib/coord/templates";
import { cn } from "@/lib/utils";

export function ThreadView({
  threadId,
  role,
  accessToken,
}: {
  threadId: string;
  role: "user" | "business";
  accessToken?: string;
}) {
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markThreadRead);
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { thread_id: threadId, actor_role: role, access_token: accessToken } }),
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`thread:${threadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => {
        qc.invalidateQueries({ queryKey: ["thread", threadId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_threads", filter: `id=eq.${threadId}` }, () => {
        qc.invalidateQueries({ queryKey: ["thread", threadId] });
      })
      .subscribe();
    markRead({ data: { thread_id: threadId } }).catch(() => {});
    return () => { supabase.removeChannel(ch); };
  }, [threadId, qc, markRead]);

  const m = useMutation({
    mutationFn: (v: { template_key?: string; text?: string; payload?: Record<string, unknown> }) =>
      send({ data: { thread_id: threadId, actor_role: role, access_token: accessToken, ...v } }),
    onSuccess: () => {
      setText("");
      toast.success("Respuesta enviada al negocio");
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Cargando…</p>;

  const { thread, messages, booking, business } = data;
  const closed = thread.status === "closed" || thread.status === "expired";
  const suggestions = suggestionsFor(role, thread.status, booking?.status ?? "pending");
  const latestProposal = [...messages]
    .reverse()
    .find((msg) => msg.template_key === "business.propose_slot");
  const businessName = business?.name ?? "El negocio";

  return (
    <div className="flex h-full flex-col">
      {/* Header contextual */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">
          {booking?.customer_name ?? "Cliente"} · {booking?.party_size}p
        </p>
        <p className="text-xs text-muted-foreground">
          {booking ? new Date(booking.scheduled_at).toLocaleString() : ""} · {booking?.status}
        </p>
      </div>

      {/* Timeline */}
      <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((msg) => {
          const mine =
            (role === "user" && msg.sender_type === "user") ||
            (role === "business" && msg.sender_type === "business");
          const sys = msg.sender_type === "system";
          if (sys) {
            if (msg.template_key === "booking_created" && booking) {
              return (
                <li key={msg.id} className="mx-auto max-w-[90%] rounded-2xl border border-border bg-muted/40 px-3 py-2 text-center text-xs">
                  <p className="font-medium text-foreground">
                    {booking.customer_name} ha solicitado una reserva
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {booking.party_size} {booking.party_size === 1 ? "persona" : "personas"} ·{" "}
                    {new Date(booking.scheduled_at).toLocaleString([], {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {booking.notes && (
                    <p className="mt-1 italic text-muted-foreground">"{booking.notes}"</p>
                  )}
                </li>
              );
            }
            return (
              <li key={msg.id} className="text-center text-[11px] text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                {labelFor(msg.template_key, msg.payload)} ·{" "}
                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </li>
            );
          }
          return (
            <li key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {msg.template_key === "business.propose_slot" && role === "user" ? (
                  <>
                    <p className="text-xs font-semibold opacity-80">
                      {businessName} te propone cambio de hora para:
                    </p>
                    {(msg.payload as Record<string, unknown> | null)?.scheduled_at && (
                      <p className="mt-1 text-sm font-medium">
                        {new Date(
                          String((msg.payload as Record<string, unknown>).scheduled_at),
                        ).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {msg.template_key && (
                      <p className="text-xs font-semibold opacity-80">
                        {TEMPLATES[msg.template_key]?.label ?? msg.template_key}
                      </p>
                    )}
                    {msg.text && <p>{msg.text}</p>}
                    {renderPayload(msg.template_key, msg.payload)}
                  </>
                )}
                <p className="mt-0.5 text-[10px] opacity-60">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                {role === "user" &&
                  !closed &&
                  msg.template_key === "business.propose_slot" &&
                  msg.id === latestProposal?.id &&
                  thread.status === "awaiting_user" &&
                  booking?.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={m.isPending}
                        onClick={() =>
                          m.mutate({
                            template_key: "user.accept",
                            payload: { proposal_message_id: msg.id },
                          })
                        }
                        className="flex-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        Aceptar nueva hora
                      </button>
                      <button
                        disabled={m.isPending}
                        onClick={() =>
                          m.mutate({
                            template_key: "user.reject_proposal",
                            payload: { proposal_message_id: msg.id },
                          })
                        }
                        className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                      >
                        Cancelar reserva
                      </button>
                    </div>
                  )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Composer */}
      {closed ? (
        <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          Conversación cerrada
        </div>
      ) : role === "business" && booking?.status === "pending" ? (
        <BusinessDecisionPanel
          currentScheduledAt={booking.scheduled_at}
          customerName={booking.customer_name ?? "Hola"}
          pending={m.isPending}
          onConfirm={() => m.mutate({ template_key: "business.confirm", payload: {} })}
          onPropose={(iso) =>
            m.mutate({ template_key: "business.propose_slot", payload: { scheduled_at: iso } })
          }
          onDecline={(reason) =>
            m.mutate({ template_key: "business.decline", payload: { reason } })
          }
        />
      ) : (
        <div className="border-t border-border bg-card px-3 py-2">
          {suggestions.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    if (s.key === "business.propose_slot") {
                      const dt = window.prompt("Nueva hora (ISO, ej. 2026-05-14T19:30:00Z)");
                      if (!dt) return;
                      m.mutate({ template_key: s.key, payload: { scheduled_at: dt } });
                    } else if (s.key === "business.running_late" || s.key === "user.running_late") {
                      const v = window.prompt("Minutos de retraso", "10");
                      if (!v) return;
                      m.mutate({ template_key: s.key, payload: { delay_minutes: Number(v) } });
                    } else {
                      m.mutate({ template_key: s.key, payload: {} });
                    }
                  }}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              placeholder="Escribe un mensaje breve…"
              className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) m.mutate({ text: text.trim() });
              }}
            />
            <button
              disabled={!text.trim() || m.isPending}
              onClick={() => m.mutate({ text: text.trim() })}
              className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(key: string | null, payload: unknown): string {
  if (key === "booking_created") return "Reserva creada";
  if (key === "qr_validated") return "QR validado";
  if (key === "thread_closed") return "Conversación cerrada";
  return key ?? "Evento";
  void payload;
}

function renderPayload(key: string | null, payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (key?.endsWith("propose_slot") && p.scheduled_at) {
    return (
      <p className="mt-1 text-xs">
        Nueva hora: {new Date(String(p.scheduled_at)).toLocaleString()}
      </p>
    );
  }
  if (key?.endsWith("running_late") && p.delay_minutes) {
    return <p className="mt-1 text-xs">+{String(p.delay_minutes)} min</p>;
  }
  if (key === "user.on_my_way" && p.eta_minutes != null) {
    return <p className="mt-1 text-xs">ETA ~{String(p.eta_minutes)} min</p>;
  }
  return null;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function BusinessDecisionPanel({
  currentScheduledAt,
  customerName,
  pending,
  onConfirm,
  onPropose,
  onDecline,
}: {
  currentScheduledAt: string;
  customerName: string;
  pending: boolean;
  onConfirm: () => void;
  onPropose: (iso: string) => void;
  onDecline: (reason: string) => void;
}) {
  const [mode, setMode] = useState<null | "propose" | "decline">(null);
  const [slot, setSlot] = useState(() => toLocalInputValue(currentScheduledAt));
  const [reason, setReason] = useState(
    `Hola ${customerName.split(" ")[0]}, hoy no tenemos disponibilidad en todo el horario. ¿Te gustaría reservar para otra fecha? Estaremos encantados de recibirte.`,
  );

  if (mode === "propose") {
    return (
      <div className="space-y-2 border-t border-border bg-card px-3 py-3">
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
            className="flex-1 rounded-full border border-border px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={pending || !slot}
            onClick={() => onPropose(new Date(slot).toISOString())}
            className="flex-1 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Enviar propuesta
          </button>
        </div>
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <div className="space-y-2 border-t border-border bg-card px-3 py-3">
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
            className="flex-1 rounded-full border border-border px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={pending}
            onClick={() => onDecline(reason)}
            className="flex-1 rounded-full bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-50"
          >
            Rechazar e invitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card px-3 py-3">
      <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        Responder al cliente
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button
          disabled={pending}
          onClick={onConfirm}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-2 py-3 text-primary-foreground disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          <span className="text-[11px] font-medium leading-tight">Aceptar</span>
        </button>
        <button
          disabled={pending}
          onClick={() => setMode("propose")}
          className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 disabled:opacity-50"
        >
          <CalendarClock className="h-5 w-5" />
          <span className="text-[11px] font-medium leading-tight">Cambiar hora</span>
        </button>
        <button
          disabled={pending}
          onClick={() => setMode("decline")}
          className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-destructive disabled:opacity-50"
        >
          <X className="h-5 w-5" />
          <span className="text-[11px] font-medium leading-tight">Rechazar</span>
        </button>
      </div>
    </div>
  );
}
