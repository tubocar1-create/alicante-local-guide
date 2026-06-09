import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Bus, FileCode, Download } from "lucide-react";

export const Route = createFileRoute("/admin/modelo-buses")({
  head: () => ({
    meta: [
      { title: "Modelo de buses (archivo) — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ModeloBusesPage,
});

// Carga eager de todos los archivos archivados como texto raw.
// Vite bundlea estos .txt como strings; no se ejecutan.
const ARCHIVED_FILES = import.meta.glob(
  "../lib/_archive/bus-engine-v1/*.txt",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

function shortName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.txt$/, "");
}

function ModeloBusesPage() {
  const files = useMemo(() => {
    return Object.entries(ARCHIVED_FILES)
      .map(([path, content]) => ({
        path,
        name: shortName(path),
        content,
        lines: content.split("\n").length,
        bytes: new Blob([content]).size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [filter, setFilter] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);

  const visible = filter
    ? files.filter((f) =>
        f.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : files;

  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const totalLines = files.reduce((s, f) => s + f.lines, 0);

  const downloadFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    // Concatena todos los archivos en un solo .txt versionado.
    const sep = "\n\n" + "=".repeat(80) + "\n";
    const blob = files
      .map((f) => `// FILE: ${f.name}\n${sep}\n${f.content}`)
      .join(sep);
    downloadFile(
      `bus-engine-v1-snapshot-${new Date().toISOString().slice(0, 10)}.txt`,
      blob,
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Modelo de buses — Archivo v1</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Snapshot congelado del motor de buses virtuales que llevamos
          construyendo. Si Akamai bloquea el acceso a tiempos reales y tenemos
          que volver al modelo predictivo puro, aquí está toda la filosofía
          documentada y el código fuente preservado.
        </p>
      </header>

      {/* ============================ FILOSOFÍA ============================ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filosofía del modelo</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground space-y-6">
          <Section title="1. Principio fundamental">
            <p>
              <strong>Buses virtuales persistentes</strong>. No predecimos ETAs
              parada-a-parada de forma independiente. Simulamos cada bus a lo
              largo de su ciclo completo y, desde su posición sobre la
              polilínea, <em>derivamos</em> los ETAs de cada parada.
            </p>
            <p className="text-muted-foreground text-xs">
              Regla: la posición del bus es la fuente de verdad; los ETAs son
              una proyección de esa posición, nunca al revés.
            </p>
          </Section>

          <Section title="2. Nacimiento y muerte de buses virtuales">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Un bus virtual <strong>nace</strong> en su terminal de origen a
                la hora EXACTA de una salida oficial del cuadro de servicio.
              </li>
              <li>
                Un bus virtual <strong>muere</strong> al llegar a la última
                parada de su sentido (
                <code>elapsed ≥ tripDuration</code>). No hay regulación
                inventada ni reinyección automática.
              </li>
              <li>
                Sin <code>ScheduledDeparture</code> oficial NO hay nacimiento.
                Regla dura.
              </li>
              <li>
                El número de buses simultáneos resulta naturalmente del
                cronograma — para la L12 esto produce los 4 buses confirmados.
              </li>
            </ul>
          </Section>

          <Section title="3. Ventana de servicio">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Apertura derivada del HORARIO REAL: la primera salida del día
                (cualquier sentido) marca el arranque.
              </li>
              <li>Cierre fijo: 22:30 (último bus virtual incorporado).</li>
              <li>
                Estados de ventana:{" "}
                <code>before_service | daytime | evening_reduced (≥22:00) | after_last_service</code>
                .
              </li>
              <li>
                Un bus ya nacido sigue vivo hasta llegar a final aunque la
                ventana de nuevas salidas haya cerrado.
              </li>
            </ul>
          </Section>

          <Section title="4. Velocidades por franja y por segmento">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Cada segmento parada→parada tiene{" "}
                <code>avgMinutes</code>, <code>rushMinutes</code>,{" "}
                <code>nightMinutes</code>, <code>weekendMinutes</code>,{" "}
                <code>holidayMinutes</code> aprendidos del histórico
                (<code>SegmentStat</code>).
              </li>
              <li>
                <code>detectProfile()</code> clasifica la hora actual en{" "}
                <code>morning_peak | midday | afternoon_peak | evening | night | weekend | holiday</code>
                .
              </li>
              <li>
                Multiplicadores: hora pico × 1.10 más lento, noche × 1.20 más
                rápido, festivo × 0.90, finde × 0.95.
              </li>
              <li>
                Distancia usada: SIEMPRE la <strong>routed</strong> (polilínea
                calle-a-calle) en <code>stopDistances</code>. Haversine sólo
                como fallback — subestima ~40-50% el recorrido urbano y
                comprime artificialmente la flota.
              </li>
            </ul>
          </Section>

          <Section title="5. Ciclo de un bus">
            <p>El ciclo se descompone como:</p>
            <pre className="bg-muted p-3 rounded text-[11px] overflow-x-auto">
{`[0, idaTotal)                              → moving IDA
[idaTotal, idaTotal + reg)                 → terminal_wait (terminal IDA)
[+reg, +reg + vueltaTotal)                 → moving VUELTA
[+vueltaTotal, +vueltaTotal + reg)         → terminal_wait (terminal VUELTA → cierra ciclo)`}
            </pre>
            <p>
              <code>cycleMin</code> se elige según franja horaria (mañana,
              mediodía, tarde, noche, finde) de <code>CycleStat</code>.{" "}
              <code>terminalRegulationMin</code> viene de{" "}
              <code>terminalWaitAvgMin</code> aprendido.
            </p>
          </Section>

          <Section title="6. Headway efectivo">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Se infiere por mediana de diferencias entre salidas oficiales
                dentro de la ventana <code>[now-30, now+60]</code> minutos.
              </li>
              <li>
                Fallback: laborable = 15 min, sábado = 20, domingo/festivo =
                25.
              </li>
              <li>
                Tamaño de flota crudo: <code>ceil(cycleMin / headwayMin)</code>
                .
              </li>
            </ul>
          </Section>

          <Section title="7. Perfiles operacionales por línea">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Tienen <strong>PRIORIDAD ABSOLUTA</strong> sobre el cálculo
                matemático.
              </li>
              <li>
                Definen <code>baseBuses</code>, <code>maxBuses</code>,{" "}
                <code>serviceStart</code>, <code>eveningCutoff</code>,{" "}
                <code>lastService</code> y <code>extras</code> (buses
                adicionales según <code>activationScore</code>).
              </li>
              <li>
                Línea 12: dato real confirmado, 4 buses en carrusel.
              </li>
              <li>
                Resto de líneas diurnas: incorporación GRADUAL desde
                <code> baseBuses = 1</code> hasta el tope inferido.
              </li>
              <li>Líneas nocturnas (3N, 13N, 22N): 1 bus por línea.</li>
              <li>
                Perfil por defecto si la línea no tiene uno explícito: 4
                buses, ventana derivada del horario real, cierre 22:30.
              </li>
            </ul>
          </Section>

          <Section title="8. Anclaje, fase y corrección por observación">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Cada bus se ancla a su <code>departureMin</code> oficial
                (slotKey = <code>{`${"${dir}"}-${"${HHMM}"}`}</code>) y mantiene
                identidad entre refrescos.
              </li>
              <li>
                El aprendizaje SOLO puede ajustar la fase del bus en{" "}
                <code>±MAX_PHASE_CORRECTION_MIN = 1.5 min (±90 s)</code>.
              </li>
              <li>
                Nunca puede inventar un bus ni reposicionarlo libremente.
              </li>
            </ul>
          </Section>

          <Section title="9. Validador de consistencia">
            <ul className="list-disc pl-5 space-y-1">
              <li>Dedupe de buses solapados.</li>
              <li>
                Spacing mínimo entre buses consecutivos en el mismo sentido.
              </li>
              <li>
                Velocidad fisicamente plausible (estimada por{" "}
                <code>estimateSpeedKmh</code>).
              </li>
              <li>
                Cap por <code>fleetSizeMax</code> del perfil.
              </li>
              <li>
                Reporta <code>removedRatio</code> — entrada al{" "}
                <code>SAFE MODE</code> si supera 40%.
              </li>
            </ul>
          </Section>

          <Section title="10. Confianza y SAFE MODE">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Confianza por segmento ← muestras del histórico (
                <code>SegmentStat.confidence</code>).
              </li>
              <li>
                Degradación temporal por <code>lastObservationAgeSec</code>:
                {" "}5 min sin observación → ×0.85; 15 min → ×0.65; 30 min →
                ×0.4.
              </li>
              <li>
                Clasificación: <code>high | medium | low | safe</code>.
              </li>
              <li>
                SAFE MODE activado si <code>avgConfidence &lt; 0.35</code>, o
                {" "}<code>ageSec &gt; 30 min</code>, o validador limpió &gt;
                40% de buses. En safe mode el motor se limita a horarios
                oficiales con velocidad media.
              </li>
            </ul>
          </Section>

          <Section title="11. Direcciones — convención dura">
            <p className="text-xs">
              Tabla de equivalencias entre tablas (regla CORE del proyecto):
            </p>
            <pre className="bg-muted p-3 rounded text-[11px] overflow-x-auto">
{`bus_line_departures   → dir 0 = IDA, 1 = VUELTA
bus_line_stops        → dir 1 = IDA, 2 = VUELTA
bus_line_service_windows.terminal_name → fuente de verdad para razonar
                                          dónde nacen los buses`}
            </pre>
            <p className="text-xs text-muted-foreground">
              NUNCA razonar sobre nacimientos sin verificar primero{" "}
              <code>terminal_name</code> en{" "}
              <code>bus_line_service_windows</code>.
            </p>
          </Section>

          <Section title="12. Derivación de ETAs por parada">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Para cada parada, busca buses vivos del mismo sentido cuyo{" "}
                <code>stopSeq</code> sea ≥ al de la parada.
              </li>
              <li>
                <code>etaMin = cumTimes[stopSeq] - bus.tripElapsedMin</code> (más
                la corrección de fase aplicada).
              </li>
              <li>
                ETA &lt; 0 → bus ya pasó. Se descarta para esa parada.
              </li>
              <li>
                Se reporta el siguiente ETA (mínimo positivo) y opcionalmente
                el segundo.
              </li>
            </ol>
          </Section>
        </CardContent>
      </Card>

      {/* ============================ ARCHIVO DE CÓDIGO ============================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5" /> Código fuente preservado
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {files.length} archivos · {totalLines.toLocaleString()} líneas ·{" "}
                {(totalBytes / 1024).toFixed(1)} KB. Snapshot inmutable en{" "}
                <code>src/lib/_archive/bus-engine-v1/</code>.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={downloadAll}>
              <Download className="h-4 w-4 mr-1" /> Descargar todo (.txt)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filtrar por nombre de archivo…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <div className="space-y-2">
            {visible.map((f) => {
              const isOpen = openFile === f.path;
              return (
                <div
                  key={f.path}
                  className="border rounded-md overflow-hidden bg-card"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFile(isOpen ? null : f.path)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <code className="text-sm font-mono">{f.name}</code>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {f.lines} líneas
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {(f.bytes / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(f.name, f.content);
                      }}
                      title="Descargar este archivo"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </button>
                  {isOpen && (
                    <pre className="bg-muted/40 text-[11px] leading-relaxed p-3 overflow-x-auto max-h-[600px] overflow-y-auto border-t font-mono whitespace-pre">
                      {f.content}
                    </pre>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin resultados para "{filter}".
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-base m-0">{title}</h3>
      <div className="text-sm space-y-2">{children}</div>
    </section>
  );
}
