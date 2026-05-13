import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TEMPLATES } from "./templates";
import type { Database } from "@/integrations/supabase/types";

const SendSchema = z.object({
  thread_id: z.string().uuid(),
  template_key: z.string().min(1).max(80).optional(),
  text: z.string().min(1).max(280).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  actor_role: z.enum(["user", "business"]).optional(),
  access_token: z.string().min(12).max(120).optional(),
});

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentUserId() {
  const authHeader = getRequestHeader("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function tokenMatches(booking: { metadata: unknown } | null, accessToken?: string) {
  if (!booking || !accessToken || typeof booking.metadata !== "object" || booking.metadata === null) return false;
  return (booking.metadata as Record<string, unknown>).public_access_token === accessToken;
}

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = serviceClient();
    if (!supabase) throw new Error("Backend no disponible");
    const userId = await currentUserId();

    const { data: thread, error: tErr } = await supabase
      .from("conversation_threads")
      .select("id, status, business_id, user_id, booking_id")
      .eq("id", data.thread_id)
      .single();
    if (tErr) throw new Error(tErr.message);
    if (thread.status === "closed" || thread.status === "expired") {
      throw new Error("Hilo cerrado");
    }

    const [{ data: booking }, { data: business }, { data: ok }] = await Promise.all([
      supabase.from("bookings").select("status, metadata, scheduled_at").eq("id", thread.booking_id).single(),
      supabase.from("businesses").select("owner_id").eq("id", thread.business_id).single(),
      userId
        ? supabase.rpc("is_business_member", { _user_id: userId, _business_id: thread.business_id })
        : Promise.resolve({ data: false }),
    ]);

    const isOwner = !!userId && thread.user_id === userId;
    let isPublicUser = data.actor_role === "user" && tokenMatches(booking, data.access_token);

    // Auto-recovery: si la metadata perdió el token (caso de bug previo) y el hilo
    // es de invitado (sin user_id), aceptamos el primer token presentado y lo
    // reescribimos para futuras acciones.
    if (
      !isOwner &&
      !isPublicUser &&
      data.actor_role === "user" &&
      data.access_token &&
      thread.user_id === null &&
      booking &&
      (typeof booking.metadata !== "object" ||
        booking.metadata === null ||
        !(booking.metadata as Record<string, unknown>).public_access_token)
    ) {
      const prev =
        booking.metadata && typeof booking.metadata === "object"
          ? (booking.metadata as Record<string, unknown>)
          : {};
      await supabase
        .from("bookings")
        .update({
          metadata: { ...prev, public_access_token: data.access_token } as never,
        })
        .eq("id", thread.booking_id);
      isPublicUser = true;
    }

    const isBusiness = !!ok || (data.actor_role === "business" && business?.owner_id === null);
    if (!isOwner && !isPublicUser && !isBusiness) throw new Error("No autorizado");

    let messageType: "quick_reply" | "free_text" | "slot_proposal" = "free_text";
    let nextThreadStatus: string | undefined;
    let nextBookingStatus: string | undefined;
    let requiresAction = false;

    if (data.template_key) {
      const tpl = TEMPLATES[data.template_key];
      if (!tpl) throw new Error("Template inválido");
      if ((tpl.role === "user") !== (isOwner || isPublicUser)) throw new Error("Rol no válido para template");
      if (tpl.payloadSchema) tpl.payloadSchema.parse(data.payload ?? {});
      messageType = data.template_key.endsWith("propose_slot") ? "slot_proposal" : "quick_reply";
      nextThreadStatus = tpl.nextThreadStatus;
      nextBookingStatus = tpl.nextBookingStatus;
      requiresAction = !!tpl.requiresAction;
    }

    const payload = (data.payload ?? {}) as Record<string, unknown>;
    const isProposalAnswer = data.template_key === "user.accept" || data.template_key === "user.reject_proposal";
    const isBusinessDecision =
      data.template_key === "business.confirm" ||
      data.template_key === "business.propose_slot" ||
      data.template_key === "business.decline";

    if (isProposalAnswer && (thread.status !== "awaiting_user" || booking?.status !== "pending")) {
      throw new Error("Esta propuesta ya fue respondida");
    }
    if (isBusinessDecision && booking?.status !== "pending") {
      throw new Error("Esta reserva ya fue respondida");
    }
    if (data.template_key === "user.cancel" && !["pending", "confirmed"].includes(String(booking?.status))) {
      throw new Error("Esta reserva ya no se puede cancelar");
    }
    if (data.template_key === "user.cancel" && thread.status === "awaiting_user" && booking?.status === "pending") {
      throw new Error("Responde la propuesta con aceptar o cancelar reserva");
    }

    let acceptedScheduledAt: string | undefined;
    if (data.template_key === "user.accept") {
      let proposalQuery = supabase
        .from("messages")
        .select("payload")
        .eq("thread_id", thread.id)
        .eq("template_key", "business.propose_slot");
      if (typeof payload.proposal_message_id === "string") {
        proposalQuery = proposalQuery.eq("id", payload.proposal_message_id);
      } else {
        proposalQuery = proposalQuery.order("created_at", { ascending: false }).limit(1);
      }
      const { data: proposal } = await proposalQuery.maybeSingle();
      const proposalPayload = proposal?.payload as Record<string, unknown> | null | undefined;
      const metaPayload = booking?.metadata as Record<string, unknown> | null | undefined;
      const proposed = proposalPayload?.scheduled_at ?? metaPayload?.proposed_scheduled_at;
      if (typeof proposed === "string" && !Number.isNaN(new Date(proposed).getTime())) {
        acceptedScheduledAt = new Date(proposed).toISOString();
      }
      if (!acceptedScheduledAt) throw new Error("No hay una nueva hora pendiente");
    }

    if (nextBookingStatus) {
      const bookingPatch = {
        status: nextBookingStatus as never,
        ...(acceptedScheduledAt ? { scheduled_at: acceptedScheduledAt } : {}),
      };
      let bookingUpdate = supabase
        .from("bookings")
        .update(bookingPatch)
        .eq("id", thread.booking_id);
      if (isProposalAnswer || isBusinessDecision) bookingUpdate = bookingUpdate.eq("status", "pending");
      if (data.template_key === "user.cancel") bookingUpdate = bookingUpdate.in("status", ["pending", "confirmed"]);
      const { data: updatedBooking, error: bErr } = await bookingUpdate.select("id").maybeSingle();
      if (bErr) throw new Error(bErr.message);
      if (!updatedBooking) throw new Error("Esta reserva ya fue respondida");
    }

    if (nextThreadStatus) {
      let threadUpdate = supabase
        .from("conversation_threads")
        .update({
          status: nextThreadStatus as never,
          ...(nextThreadStatus === "closed" ? { closed_at: new Date().toISOString() } : {}),
        })
        .eq("id", thread.id);
      if (isProposalAnswer) threadUpdate = threadUpdate.eq("status", "awaiting_user");
      const { error: thErr } = await threadUpdate;
      if (thErr) throw new Error(thErr.message);
    }

    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        sender_type: isOwner || isPublicUser ? "user" : "business",
        sender_user_id: userId,
        message_type: messageType,
        template_key: data.template_key ?? null,
        text: data.text ?? null,
        payload: payload as never,
        requires_action: requiresAction,
      })
      .select()
      .single();
    if (mErr) throw new Error(mErr.message);

    await supabase.from("interaction_events").insert({
      type: `coord_${data.template_key ?? "free_text"}`,
      business_id: thread.business_id,
      user_id: userId,
      source: "coord",
      metadata: { thread_id: thread.id } as never,
    });

    return { message: msg };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = serviceClient();
    if (!supabase) return { ok: false };
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", data.thread_id)
      .is("read_at", null);
    return { ok: true };
  });
