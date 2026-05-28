import { createFileRoute } from "@tanstack/react-router";
import { ChatScreen } from "@/components/ChatScreen";
import portadaImg from "@/assets/alicante-portada.webp";

const SITE_URL = "https://vamosalicante.com";
const OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/093254f8-3ab2-40aa-af9e-c02f37b4a16e/id-preview-b19d7e32--a8ec37f9-59bf-4ebb-a372-974e51dc0567.lovable.app-1778306557524.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alicante Friend — Tu guía local con IA en Alicante" },
      {
        name: "description",
        content:
          "Chatea con un amigo local en Alicante: consejos personales sobre playas, restaurantes, ocio, transporte y planes diarios sin trampas turísticas.",
      },
      { property: "og:title", content: "Alicante Friend — Tu guía local con IA" },
      {
        property: "og:description",
        content: "Tu amigo local con IA en Alicante: playas, restaurantes, ocio y transporte.",
      },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:title", content: "Alicante Friend" },
      { name: "twitter:description", content: "Tu amigo local con IA en Alicante." },
    ],
    links: [
      { rel: "canonical", href: SITE_URL + "/" },
      { rel: "preload", as: "image", href: portadaImg, fetchpriority: "high" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Alicante Friend",
          url: SITE_URL,
          inLanguage: "es-ES",
          description:
            "Guía local con IA para descubrir Alicante: playas, restaurantes, ocio, transporte y planes diarios.",
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <ChatScreen />;
}
