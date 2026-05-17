import { createFileRoute } from "@tanstack/react-router";
import { ChatScreen } from "@/components/ChatScreen";
import portadaImg from "@/assets/alicante-portada.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alicante Friend — Your local AI guide in Alicante" },
      {
        name: "description",
        content:
          "Chat with a friendly local AI in Alicante. Get personal tips on restaurants, beaches, nightlife and daily plans — no tourist traps.",
      },
      { property: "og:title", content: "Alicante Friend" },
      {
        property: "og:description",
        content: "Your friendly local AI companion for Alicante, Spain.",
      },
    ],
    links: [
      { rel: "preload", as: "image", href: portadaImg, fetchpriority: "high" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ChatScreen />;
}
