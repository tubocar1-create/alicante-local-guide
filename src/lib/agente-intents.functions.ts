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
  spoken_reply?: string | null;
};


export type AgenteSubcategory = {
  domain: string;
  label: string;
  route: string;
  aliases: string[];
  prompt?: string;
  submenu?: string;
};

export type AgenteRoutingCatalog = {
  intents: AgenteIntentRow[];
  subcategories: Record<string, AgenteSubcategory[]>;
};

export const loadAgenteIntents = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgenteIntentRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("agente_intents")
      .select("key,label,route,action,priority,keywords,spoken_reply")
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
    const { data: intentRows, error: intentsError } = await supabaseAdmin
      .from("agente_intents")
      .select("key,label,route,action,priority,keywords,spoken_reply")
      .eq("active", true)
      .order("priority", { ascending: true });
    if (intentsError) console.error("loadAgenteRoutingCatalog intents error", intentsError);
    const intents = (intentRows ?? []) as AgenteIntentRow[];

    const [
      { count: pharmaciesCount },
      { count: hospitalsCount },
      { data: providerCategories },
      { data: placeCategories },
    ] =
      await Promise.all([
        supabaseAdmin.from("pharmacies").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("health_centers").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("health_providers").select("category"),
        supabaseAdmin.from("places").select("category, cuisine"),
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
        aliases: [category.slug.replace(/-/g, " "), category.label, category.description, category.query].filter(Boolean),
      }));

    const healthCore: AgenteSubcategory[] = [
      ...(hospitalsCount && hospitalsCount > 0
        ? [{ domain: "salud", label: "Hospitales", route: "/hospitales", aliases: ["hospital", "hospitales"] }]
        : []),
      ...(pharmaciesCount && pharmaciesCount > 0
        ? [{ domain: "salud", label: "Farmacias", route: "/farmacias", aliases: ["farmacia", "farmacias", "guardia"] }]
        : []),
    ];

    const existingPlaceCategories = new Set(
      ((placeCategories ?? []) as Array<{ category: string | null; cuisine: string | null }>)
        .map((row) => row.category)
        .filter(Boolean) as string[],
    );

    const foodTaxonomy: Record<string, { label: string; prompt: string; aliases: string[]; domain?: string }> = {
      typical: { label: "Cocina típica", prompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora", aliases: ["cocina típica", "tipica", "tradicional"] },
      rice_fish: { label: "Arroces y pescado", prompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?", aliases: ["arroz", "arroces", "paella", "pescado"] },
      italian: { label: "Italiano", prompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?", aliases: ["italiano", "pasta", "trattoria"] },
      asian: { label: "Japonés / Asiático", prompt: "Un japonés o asiático rico abierto ahora", aliases: ["japonés", "japones", "asiático", "asiatico", "sushi", "ramen"] },
      brunch: { label: "Desayuno / Brunch", prompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora", aliases: ["desayuno", "brunch", "cafetería", "cafeteria"] },
      pizzas: { label: "Pizzas", prompt: "Una pizzería abierta ahora (Telepizza, Domino's…)", aliases: ["pizza", "pizzas", "pizzería", "pizzeria"] },
      chains: { label: "Comida rápida", prompt: "comida rápida", aliases: ["comida rápida", "comida rapida", "fast food", "hamburguesa", "kebab", "pollo frito"] },
      international: { label: "Internacional", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?", aliases: ["internacional", "hindú", "hindu", "árabe", "arabe", "mexicano"] },
      drinks: { label: "Bares y copas", prompt: "¿Dónde voy a tomar algo abierto ahora?", aliases: ["bar", "bares", "copas", "cerveza", "pub", "discoteca"], domain: "tomar_algo" },
    };

    const foodSubcategories = Array.from(existingPlaceCategories)
      .map((category) => foodTaxonomy[category])
      .filter(Boolean)
      .map((entry) => ({
        domain: entry.domain ?? "comer",
        label: entry.label,
        route: "/",
        prompt: entry.prompt,
        aliases: entry.aliases,
      }));

    return {
      intents,
      subcategories: {
        salud: [...healthCore, ...healthFromApp],
        comer: foodSubcategories.filter((entry) => entry.domain === "comer"),
        tomar_algo: foodSubcategories.filter((entry) => entry.domain === "tomar_algo"),
      },
    };
  },
);
