import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { Send, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getThread } from "@/lib/coord/threads.functions";
import { sendMessage, markThreadRead } from "@/lib/coord/messages.functions";
import { suggestionsFor, TEMPLATES } from "@/lib/coord/templates";
import { cn } from "@/lib/utils";

export function ThreadView({ threadId, role }: { threadId: string; role: "user" | "business" }) {
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markThreadRead);
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { thread_id: threadId } }),
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
      send({ data: { thread_id: threadId, ...v } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Cargando…</p>;

  const { thread, messages, booking } = data;
  const closed = thread.status === "closed" || thread.status === "expired";
  const suggestions = suggestionsFor(role, thread.status, booking?.status ?? "pending");

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
                {msg.template_key && (
                  <p className="text-xs font-semibold opacity-80">
                    {TEMPLATES[msg.template_key]?.label ?? msg.template_key}
                  </p>
                )}
                {msg.text && <p>{msg.text}</p>}
                {renderPayload(msg.template_key, msg.payload)}
                <p className="mt-0.5 text-[10px] opacity-60">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Quick replies + composer */}
      {closed ? (
        <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          Conversación cerrada
        </div>
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
