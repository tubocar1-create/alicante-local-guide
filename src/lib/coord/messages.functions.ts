import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEMPLATES } from "./templates";
import { trackEvent } from "@/lib/business/track";

const SendSchema = z.object({
  thread_id: z.string().uuid(),
  template_key: z.string().min(1).max(80).optional(),
  text: z.string().min(1).max(280).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread, error: tErr } = await supabase
      .from("conversation_threads")
      .select("id, status, business_id, user_id, booking_id")
      .eq("id", data.thread_id)
      .single();
    if (tErr) throw new Error(tErr.message);
    if (thread.status === "closed" || thread.status === "expired") {
      throw new Error("Hilo cerrado");
    }

    // Determinar rol
    const isOwner = thread.user_id === userId;
    let isBusiness = false;
    if (!isOwner) {
      const { data: ok } = await supabase.rpc("is_business_member", {
        _user_id: userId,
        _business_id: thread.business_id,
      });
      isBusiness = !!ok;
    }
    if (!isOwner && !isBusiness) throw new Error("No autorizado");

    let messageType: "quick_reply" | "free_text" | "slot_proposal" = "free_text";
    let nextThreadStatus: string | undefined;
    let nextBookingStatus: string | undefined;
    let requiresAction = false;

    if (data.template_key) {
      const tpl = TEMPLATES[data.template_key];
      if (!tpl) throw new Error("Template inválido");
      if ((tpl.role === "user") !== isOwner) throw new Error("Rol no válido para template");
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
        sender_type: isOwner ? "user" : "business",
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
      const patch: Record<string, unknown> = { status: nextBookingStatus };
      if (data.template_key === "business.propose_slot" && data.payload && "scheduled_at" in data.payload) {
        // no cambia status, solo guarda nueva propuesta en metadata
      }
      await supabase.from("bookings").update(patch).eq("id", thread.booking_id);
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

    await trackEvent(supabase, {
      type: `coord_${data.template_key ?? "free_text"}`,
      business_id: thread.business_id,
      user_id: userId,
      metadata: { thread_id: thread.id },
    });

    return { message: msg };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", data.thread_id)
      .is("read_at", null);
    return { ok: true };
  });
