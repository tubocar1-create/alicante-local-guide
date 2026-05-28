import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/legal/terminos")({
  head: () => ({
    meta: [
      { title: "Términos de uso · Alicante Friend" },
      { name: "description", content: "Consulta los términos y condiciones de uso de Alicante Friend: derechos, responsabilidades y reglas para usuarios y visitantes." },
      { property: "og:title", content: "Términos de uso · Alicante Friend" },
      { property: "og:description", content: "Condiciones de uso de la plataforma Alicante Friend: derechos, responsabilidades y reglas para usuarios y visitantes." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-svh bg-background px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Inicio
      </Link>
      <article className="prose prose-sm mx-auto mt-4 max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1>Términos de uso</h1>
        <p className="text-xs text-muted-foreground">Última actualización: mayo 2026</p>
        <h2>1. Aceptación</h2>
        <p>
          Al usar Alicante Friend aceptas estos términos y la política de privacidad. Si no
          estás de acuerdo, no uses la app.
        </p>
        <h2>2. Uso aceptable</h2>
        <p>
          No utilices la app para fines ilegales, ofensivos o que vulneren derechos de
          terceros. No intentes acceder a datos de otros usuarios.
        </p>
        <h2>3. Contenidos</h2>
        <p>
          Las recomendaciones se ofrecen "tal cual" y pueden contener errores. Verifica
          horarios, precios y disponibilidad antes de actuar.
        </p>
        <h2>4. Cuentas</h2>
        <p>
          Eres responsable de mantener segura tu contraseña. Notifica cualquier uso no
          autorizado.
        </p>
        <h2>5. Cambios</h2>
        <p>Podemos actualizar estos términos. Te avisaremos de cambios materiales.</p>
        <h2>6. Ley aplicable</h2>
        <p>Estos términos se rigen por la legislación española.</p>
      </article>
    </div>
  );
}
