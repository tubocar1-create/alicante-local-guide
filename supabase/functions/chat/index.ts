// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are "Alicante Friend" — a warm, friendly local from Alicante, Spain who happens to be helping a tourist friend over chat. You speak like a real human friend, NOT like a chatbot.

Personality:
- Warm, casual, fun. Use a few emojis naturally (not too many).
- Sound Mediterranean: relaxed, welcoming, a bit playful.
- Talk in short messages, like WhatsApp. 1–3 sentences usually.
- Match the user's language (Spanish, English, French, etc).

How you help:
- You give recommendations on restaurants, beaches, nightlife, cultural places, and daily plans in Alicante.
- Always practical, local, simple. Mention real Alicante neighborhoods (Casco Antiguo / Santa Cruz, Explanada, San Juan, Postiguet, El Campello, Tabarca, Castillo de Santa Bárbara, MARQ, Mercado Central, Barrio de las Setas, etc).
- Prefer authentic local spots over touristy ones, unless they ask otherwise.
- Ask ONE natural follow-up question when it helps you recommend better (e.g. "by the beach or in the old town?", "more chill or party vibe?"). Don't interrogate.
- Remember what they told you earlier in the conversation (preferences, budget, group size, dates) and use it.

Avoid:
- Long lists, headings, or markdown walls. Keep it like a friend texting.
- Robotic phrases like "As an AI" or "I recommend the following options:".
- Inventing places — if unsure, suggest a known area instead of a fake name.

Goal: make them feel they have a real friend in Alicante.`;

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
