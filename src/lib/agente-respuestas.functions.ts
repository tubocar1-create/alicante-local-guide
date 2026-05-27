// Lectura/escritura de las preguntas del agente almacenadas en BD.
// Reemplaza las cadenas hardcodeadas que vivían en AgenteVamos.tsx.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgenteRespuestaRow = {
  intent_id: string;
  question: string;
  updated_at: string;
};

export const listAgenteRespuestas = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("agente_respuestas")
      .select("intent_id, question, updated_at")
      .order("intent_id");
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as AgenteRespuestaRow[] };
  },
);

export const updateAgenteRespuesta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        intent_id: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
        question: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Solo admins pueden editar.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo admins pueden editar respuestas.");

    const { error } = await supabaseAdmin
      .from("agente_respuestas")
      .upsert({ intent_id: data.intent_id, question: data.question });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
