import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";

export type AgenteIntentRow = {
  key: string;
  label: string;
  route: string | null;
  action: string | null;
  priority: number;
  keywords: string[];
};

export type AgenteSubcategory = {
  domain: string;
  label: string;
  route: string;
  aliases: string[];
};

export type AgenteRoutingCatalog = {
  intents: AgenteIntentRow[];
  subcategories: Record<string, AgenteSubcategory[]>;
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

export const loadAgenteRoutingCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgenteRoutingCatalog> => {
    const intents = await loadAgenteIntents();

    const [{ count: pharmaciesCount }, { count: hospitalsCount }, { data: providerCategories }] =
      await Promise.all([
        supabaseAdmin.from("pharmacies").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("health_centers").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("health_providers").select("category"),
      ]);

    const dbHealthCategories = new Set(
      ((providerCategories ?? []) as Array<{ category: string | null }>)
        .map((row) => row.category)
        .filter(Boolean) as string[],
    );

    const healthFromApp = HEALTH_CATEGORIES
      .filter((category) => dbHealthCategories.size === 0 || dbHealthCategories.has(category.slug))
      .map((category) => ({
        domain: "salud",
        label: category.shortLabel ?? category.label,
        route: `/salud/${category.slug}`,
        aliases: [category.slug.replace(/-/g, " "), category.label, category.description].filter(Boolean),
      }));

    const healthCore: AgenteSubcategory[] = [
      ...(hospitalsCount && hospitalsCount > 0
        ? [{ domain: "salud", label: "Hospitales", route: "/hospitales", aliases: ["hospital", "hospitales"] }]
        : []),
      ...(pharmaciesCount && pharmaciesCount > 0
        ? [{ domain: "salud", label: "Farmacias", route: "/farmacias", aliases: ["farmacia", "farmacias", "guardia"] }]
        : []),
    ];

    return {
      intents,
      subcategories: {
        salud: [...healthCore, ...healthFromApp],
      },
    };
  },
);
