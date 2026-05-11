import { createFileRoute } from "@tanstack/react-router";
import { ChatScreen } from "@/components/ChatScreen";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Alicante Friend" },
      {
        name: "description",
        content:
          "Habla con tu amigo local de Alicante. Recomendaciones de restaurantes, playas, planes y rincones secretos.",
      },
    ],
  }),
  component: () => <ChatScreen />,
});
