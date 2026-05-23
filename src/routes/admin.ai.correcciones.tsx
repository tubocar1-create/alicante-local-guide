// Página única de correcciones del CPA.
// Agrupa los tres flujos: Auditoría (turno-por-turno), Supervisión (pendientes
// del agente) y Entrenamiento (intents + entidades) en pestañas internas.
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditoriaPage } from "./admin.ai.auditoria";
import { SupervisionPage } from "./admin.ai.supervision";
import { IntentsPage } from "./admin.ai.intents";
import { EntitiesPage } from "./admin.ai.entities";

export const Route = createFileRoute("/admin/ai/correcciones")({
  head: () => ({ meta: [{ title: "Admin · Correcciones del Agente" }] }),
  component: CorreccionesPage,
});

function CorreccionesPage() {
  return (
    <Tabs defaultValue="auditoria" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="auditoria">🔍 Auditoría</TabsTrigger>
        <TabsTrigger value="supervision">🛟 Supervisión</TabsTrigger>
        <TabsTrigger value="intents">🎯 Intents</TabsTrigger>
        <TabsTrigger value="entities">🏷️ Entidades</TabsTrigger>
      </TabsList>
      <TabsContent value="auditoria" className="mt-0">
        <AuditoriaPage />
      </TabsContent>
      <TabsContent value="supervision" className="mt-0">
        <SupervisionPage />
      </TabsContent>
      <TabsContent value="intents" className="mt-0">
        <IntentsPage />
      </TabsContent>
      <TabsContent value="entities" className="mt-0">
        <EntitiesPage />
      </TabsContent>
    </Tabs>
  );
}
