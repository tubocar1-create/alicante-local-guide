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
      supabase.from("bookings").select("metadata").eq("id", thread.booking_id).single(),
      supabase.from("businesses").select("owner_id").eq("id", thread.business_id).single(),
      userId
        ? supabase.rpc("is_business_member", { _user_id: userId, _business_id: thread.business_id })
        : Promise.resolve({ data: false }),
    ]);

    const isOwner = !!userId && thread.user_id === userId;
    const isPublicUser = data.actor_role === "user" && tokenMatches(booking, data.access_token);
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

    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        sender_type: isOwner || isPublicUser ? "user" : "business",
        sender_user_id: userId,
        message_type: messageType,
        template_key: data.template_key ?? null,
        text: data.text ?? null,
        payload: (data.payload ?? {}) as never,
        requires_action: requiresAction,
      })
      .select()
      .single();
    if (mErr) throw new Error(mErr.message);

    if (nextThreadStatus) {
      await supabase
        .from("conversation_threads")
        .update({
          status: nextThreadStatus as never,
          ...(nextThreadStatus === "closed" ? { closed_at: new Date().toISOString() } : {}),
        })
        .eq("id", thread.id);
    }
    if (nextBookingStatus) {
      await supabase
        .from("bookings")
        .update({ status: nextBookingStatus as never })
        .eq("id", thread.booking_id);
    }
    // Si propose_slot, persistimos en booking.metadata
    if (data.template_key === "business.propose_slot" && data.payload?.scheduled_at) {
      await supabase
        .from("bookings")
        .update({
          metadata: { proposed_scheduled_at: data.payload.scheduled_at } as never,
        })
        .eq("id", thread.booking_id);
    }

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
