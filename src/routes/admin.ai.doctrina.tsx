// Doctrina funcional del Agente — referencia central del CPA.
// Visible para que toda auditoría (Supervisión, Dudosas, Sin resolver,
// Conversaciones) se evalúe contra la misma filosofía y fases.
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/ai/doctrina")({
  head: () => ({ meta: [{ title: "CPA · Doctrina del Agente" }] }),
  component: DoctrinaPage,
});

function DoctrinaPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-xl">Naturaleza del agente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>ES:</strong> un <em>agente de enrutamiento contextual</em>.
            Su única función es ayudar al usuario a navegar la plataforma,
            entender su intención, construir una ruta y llevarlo a un endpoint
            final con nombre propio.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive">NO chatbot generalista</Badge>
            <Badge variant="destructive">NO romántico</Badge>
            <Badge variant="destructive">NO político</Badge>
            <Badge variant="destructive">NO religioso</Badge>
            <Badge variant="destructive">NO personal</Badge>
            <Badge variant="destructive">NO entretenimiento libre</Badge>
          </div>
          <p className="font-medium text-primary">
            Prioridad absoluta: INTENCIÓN → CONTEXTO → RUTA → ENDPOINT
          </p>
        </CardContent>
      </Card>

      <Phase
        n={1}
        title="Saludo + detección de intención"
        rules={[
          "El saludo SIEMPRE incluye búsqueda de intención.",
          "Reconducir desviaciones personales con frase breve + pregunta funcional.",
          "No profundizar en conversaciones personales.",
        ]}
        examples={[
          { ok: true, text: "☀️ Buenos días Leopoldo, ¿qué deseas hacer hoy?" },
          { ok: true, text: "🍷 Buenas noches, ¿qué estás buscando?" },
          {
            ok: true,
            text: "😊 Me encuentro bien, gracias. Mi función es ayudarte a navegar la plataforma. ¿Qué deseas hacer?",
          },
        ]}
        audit="Detectar desviaciones · evaluar reconducción · verificar foco funcional."
      />

      <Phase
        n={2}
        title="Definición de intención y ruta"
        rules={[
          "No precipitarse cuando las palabras clave cruzan dominios.",
          "Hacer preguntas cortas para aclarar contexto.",
          "Confirmar dominio antes de enrutar.",
        ]}
        examples={[
          {
            ok: false,
            text: '"Quiero ir a Benidorm" → asumir playa/turismo/hotel automáticamente.',
          },
          {
            ok: true,
            text: "🚋 ¿Quieres transporte, alojamiento o actividades en Benidorm?",
          },
        ]}
        audit="Precisión de intención · detección de falsas interpretaciones · contexto activo."
      />

      <Phase
        n={3}
        title="Enrutamiento contextual"
        rules={[
          "Mantener coherencia semántica dentro del dominio activo.",
          "No saltar entre contextos sin confirmación.",
          "El contexto activo tiene prioridad sobre keywords aisladas.",
        ]}
        examples={[
          {
            ok: true,
            text: 'Flujo TRAM → "Benidorm" se interpreta como destino de transporte, no como playa.',
          },
          {
            ok: false,
            text: 'Flujo TRAM → saltar a /playas porque apareció la keyword "Benidorm".',
          },
        ]}
        audit="Persistencia contextual · coherencia semántica · precisión de flujo."
      />

      <Phase
        n={4}
        title="Endpoint final (nombre propio)"
        rules={[
          "Aunque el usuario nombre el endpoint, confirmar intención antes de abrirlo.",
          "Tras confirmación → abrir endpoint. Aquí termina la utilidad principal del agente.",
          "Descripciones, reseñas y detalles enriquecidos pertenecen a fases posteriores del producto.",
        ]}
        examples={[
          {
            ok: true,
            text: '"Quiero ir a Playa Postiguet" → "🌊 Perfecto, entonces buscas playa y ocio. ¿Te llevo a Playa Postiguet?"',
          },
        ]}
        audit="Precisión de endpoint · confirmación final · cierre correcto del flujo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Criterios obligatorios de auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Cumplimiento filosófico (¿es enrutamiento o se desvió?)</li>
            <li>Precisión de intención</li>
            <li>Coherencia contextual (¿respetó el dominio activo?)</li>
            <li>Consistencia de ruta</li>
            <li>Calidad del endpoint final</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Cada incidencia revisada en Supervisión, Dudosas, Sin resolver y
            Conversaciones debe puntuarse contra estos 5 criterios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Phase({
  n,
  title,
  rules,
  examples,
  audit,
}: {
  n: number;
  title: string;
  rules: string[];
  examples: { ok: boolean; text: string }[];
  audit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge>Fase {n}</Badge> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">
            Reglas
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">
            Ejemplos
          </div>
          <ul className="space-y-1">
            {examples.map((e) => (
              <li key={e.text} className="flex gap-2">
                <span>{e.ok ? "✅" : "❌"}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Auditoría: </span>
          {audit}
        </div>
      </CardContent>
    </Card>
  );
}
