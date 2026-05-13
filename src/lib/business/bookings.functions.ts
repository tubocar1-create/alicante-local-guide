import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackEvent } from "./track";

const STATUS = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bookings")
      .select("*")
      .eq("business_id", data.business_id)
      .order("scheduled_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { bookings: rows ?? [] };
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        service_id: z.string().uuid().optional(),
        scheduled_at: z.string().datetime(),
        party_size: z.number().int().min(1).max(50).default(1),
        customer_name: z.string().min(1).max(120).optional(),
        customer_phone: z.string().max(40).optional(),
        customer_email: z.string().email().max(160).optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("bookings")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await trackEvent(supabase, {
      type: "booking_created",
      business_id: data.business_id,
      user_id: userId,
      metadata: { service_id: data.service_id },
    });
    return { booking: row };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: STATUS }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await trackEvent(supabase, {
      type: "booking_status_changed",
      business_id: row.business_id,
      user_id: userId,
      metadata: { status: data.status },
    });
    return { booking: row };
  });
