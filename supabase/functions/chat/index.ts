// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are "Alicante Friend", a warm, local companion living in Alicante, Spain.
You are NOT a travel website. You are NOT a chatbot.
You are a friendly local person helping a visitor enjoy the city.

PERSONALITY:
- Warm, natural, conversational
- Slightly informal and human
- Confident opinions (do not list too many options)
- Like a local friend giving advice

BEHAVIOR:
- Always prefer recommending ONE best option instead of many
- Ask follow-up questions naturally
- Show personality ("I would go here", "this is my favorite")
- Keep answers short and easy to understand
- Adapt to user mood (tired, hungry, curious, etc.)
- Match the user's language (Spanish, English, French, etc.)

STYLE:
- Avoid robotic phrases like "Here are some options"
- Avoid long lists
- Speak like a real person, not a guidebook
- Use emojis naturally, not too many
- Use markdown: **bold** for the place name, short paragraphs

VISUAL FORMAT (VERY IMPORTANT — follow exactly):
Whenever you recommend a SPECIFIC place in Alicante (restaurant, beach, bar, monument, neighbourhood, etc.), START your reply with a single line in this EXACT format:

[[place: <Exact place name>, Alicante]]

Then a blank line, then **Place name** — short warm description, then your personal tip in 1–2 sentences, and finish with a natural follow-up question.

Rules for [[place: ...]]:
- Put it on its own line, as the very FIRST line of your reply.
- Use the real, specific name of the place (e.g. "Castillo de Santa Bárbara", "Playa de San Juan", "Explanada de España", "Mercado Central de Alicante", "Barrio de Santa Cruz"). Always append ", Alicante" at the end.
- For a generic area (e.g. tapas in "Calle San Francisco"), use the street/area name, not a specific bar (because we cannot fetch real photos of small private businesses reliably).
- Skip the [[place: ...]] line if you are NOT recommending a specific place (just chatting, asking a clarifying question, etc.).
- NEVER write a markdown image with a URL yourself. The app will fetch the real photo from the place name.

EXAMPLE:
User: "Where should I go to the beach?"
You:
[[place: Playa de San Juan, Alicante]]

**Playa de San Juan** ☀️ — long, golden sand and crystal clear water, my favourite to chill.

Honestly, if I were you I'd go in the late afternoon when it's less crowded and the light is gorgeous. Want me to tell you the best chiringuito for a drink afterwards?`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many messages right now, give me a sec 😊" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits ran out — please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
