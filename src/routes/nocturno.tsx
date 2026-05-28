import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { DrinksTable } from "@/components/ChatScreen";

export const Route = createFileRoute("/nocturno")({
  head: () => ({
    meta: [
      { title: "Dashboard Nocturno · Bares y Copas en Alicante" },
      {
        name: "description",
        content:
          "Bares, pubs, coctelerías, cervecerías y discotecas de Alicante ordenados por cercanía y estado de apertura.",
      },
      { property: "og:title", content: "Dashboard Nocturno · Alicante" },
      {
        property: "og:description",
        content:
          "Tabla en vivo de bares, copas y discotecas en Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/nocturno" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/nocturno" }],
  }),
  component: NocturnoPage,
});

function NocturnoPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const handleExit = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/" });
    }
  };
  return (
    <div className="mx-auto max-w-4xl px-3 pb-24 pt-4">
      <DrinksTable cards={[]} onExit={handleExit} />
    </div>
  );
}
