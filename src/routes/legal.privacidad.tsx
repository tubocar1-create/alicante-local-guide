import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad · Alicante Friend" },
      { name: "description", content: "Conoce cómo tratamos tus datos personales, qué información recopilamos y cómo protegemos tu privacidad en Alicante Friend." },
      { property: "og:title", content: "Política de privacidad · Alicante Friend" },
      { property: "og:description", content: "Cómo recopilamos, usamos y protegemos tus datos personales en Alicante Friend, tu guía local con IA." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-svh bg-background px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Inicio
      </Link>
      <article className="prose prose-sm mx-auto mt-4 max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1>Política de privacidad</h1>
        <p className="text-xs text-muted-foreground">Última actualización: mayo 2026</p>
        <h2>1. Responsable</h2>
        <p>
          Alicante Friend ("la app") gestiona datos personales para ofrecer recomendaciones
          locales contextuales. Para consultas, escribe al canal de soporte de la app.
        </p>
        <h2>2. Datos que tratamos</h2>
        <ul>
          <li>Email y nombre visible (registro).</li>
          <li>Ubicación aproximada (si concedes el permiso de geolocalización).</li>
          <li>Audio efímero (solo durante el uso del asistente de voz).</li>
          <li>Métricas técnicas básicas (vistas de página, eventos operativos).</li>
        </ul>
        <h2>3. Finalidad</h2>
        <p>
          Personalizar recomendaciones, mejorar el servicio y mantener la seguridad de la
          cuenta. No vendemos tus datos.
        </p>
        <h2>4. Base legal</h2>
        <p>Consentimiento (registro, permisos) e interés legítimo (seguridad y mejora).</p>
        <h2>5. Conservación</h2>
        <p>
          Conservamos los datos mientras tu cuenta esté activa. Puedes solicitar su
          eliminación contactando con soporte.
        </p>
        <h2>6. Derechos</h2>
        <p>
          Acceso, rectificación, supresión, oposición, limitación y portabilidad. Para
          ejercerlos, contacta con soporte desde la app.
        </p>
        <h2>7. Encargados</h2>
        <p>
          Usamos Lovable Cloud (Supabase) como infraestructura. Los datos se procesan en la
          UE.
        </p>
      </article>
    </div>
  );
}
