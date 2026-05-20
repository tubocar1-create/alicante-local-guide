import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgenteIntentRow = {
  key: string;
  label: string;
  route: string | null;
  action: string | null;
  priority: number;
  keywords: string[];
};

export const loadAgenteIntents = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgenteIntentRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("agente_intents")
      .select("key,label,route,action,priority,keywords")
      .eq("active", true)
      .order("priority", { ascending: true });
    if (error) {
      console.error("loadAgenteIntents error", error);
      return [];
    }
    return (data ?? []) as AgenteIntentRow[];
  },
);
