import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatScreen } from "@/components/ChatScreen";
import { releaseLocation } from "@/hooks/useUserLocation";

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
  }),
  component: Index,
});

function Index() {
  // Make sure no leftover geolocation watcher keeps running while the user
  // is on the home screen planning routes.
  useEffect(() => {
    releaseLocation();
  }, []);
  return <ChatScreen />;
}

