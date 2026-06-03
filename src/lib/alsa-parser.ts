// Parser para resultados ALSA (markdown de Firecrawl).
// Extrae salidas/llegadas con horarios, duración, estaciones, tipo de bus y precios.

export type AlsaJourney = {
  departure: string; // "HH:MM"
  arrival: string;   // "HH:MM"
  durationMinutes: number;
  origin: string;
  destination: string;
  busType: string | null; // "DOBLE PISO" | "SUPRA" | "COMFORT" | null (normal)
  priceFromEur: number | null;
  promoPriceEur: number | null;
  observations: string[];
};

const KNOWN_STATIONS = [
  "Alicante Estación De Autobús",
  "Alicante Estación de Autobús",
  "Madrid Estación Sur",
  "Aeropuerto Madrid - Barajas T4",
  "Aeropuerto Madrid - Barajas T1",
  "Madrid Estación de Conde de Casal",
];

function splitStations(line: string): { origin: string; destination: string } {
  // El markdown concatena origen+destino sin separador. Probamos prefijos conocidos.
  for (const st of KNOWN_STATIONS) {
    if (line.startsWith(st)) {
      const rest = line.slice(st.length).trim();
      return { origin: st, destination: rest || line };
    }
  }
  // Heurística: buscar el segundo capital tras un grupo Madrid/Aeropuerto/Alicante.
  const m = line.match(/^(.+?)(Alicante|Madrid|Aeropuerto|Valencia|Barcelona)(.*)$/);
  if (m) {
    return { origin: m[1].trim(), destination: (m[2] + m[3]).trim() };
  }
  return { origin: line, destination: "" };
}

function parsePriceToken(raw: string): number | null {
  const m = raw.replace(/\./g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function parseAlsaResults(md: string): AlsaJourney[] {
  const out: AlsaJourney[] = [];
  // Cortar por bullets "- " que empiezan cada tarjeta.
  // Cada tarjeta tiene: opcional **TIPO**, luego **HH:MM** Xh Y min **HH:MM**, luego estaciones, luego "Desde N,NN €".
  const blocks = md.split(/\n\s*-\s+/);
  for (const raw of blocks) {
    const block = raw.replace(/\r/g, "").trim();
    if (!block) continue;

    // Bus type (al inicio del bloque, opcional). Excluir falsos positivos.
    let busType: string | null = null;
    const typeMatch = block.match(/^\*\*(DOBLE PISO|SUPRA|COMFORT)\*\*/);
    if (typeMatch) busType = typeMatch[1];

    // Horario
    const timeRegex = /\*\*(\d{2}:\d{2})\*\*\s*(\d+)\s*h(?:\s*(\d+)\s*min)?\s*\*\*(\d{2}:\d{2})\*\*/;
    const timeMatch = block.match(timeRegex);
    if (!timeMatch) continue;
    const departure = timeMatch[1];
    const arrival = timeMatch[4];
    const durationMinutes = parseInt(timeMatch[2], 10) * 60 + (timeMatch[3] ? parseInt(timeMatch[3], 10) : 0);

    // Línea de estaciones: justo después del horario, antes de cualquier `_..._`
    const afterTime = block.slice(block.indexOf(timeMatch[0]) + timeMatch[0].length);
    const stationLineMatch = afterTime.match(/\n+([^\n_*][^\n]*?)(?=\n|_|$)/);
    let origin = "", destination = "";
    if (stationLineMatch) {
      const stationLine = stationLineMatch[1].trim();
      ({ origin, destination } = splitStations(stationLine));
    }

    // Observaciones (texto en cursivas con _ _).
    const observations: string[] = [];
    const obsRegex = /_([^_\n]+)_/g;
    let obsMatch: RegExpExecArray | null;
    while ((obsMatch = obsRegex.exec(afterTime)) !== null) {
      const t = obsMatch[1].trim();
      if (t && !/^Cerrar$|^Oculto$/.test(t)) observations.push(t);
    }

    // Precio "desde" y promo
    const priceMatch = afterTime.match(/Desde\s*(\d+(?:\.\d+)?,\d{2})\s*€(?:\s*(\d+(?:\.\d+)?,\d{2})\s*€)?/);
    let priceFromEur: number | null = null;
    let promoPriceEur: number | null = null;
    if (priceMatch) {
      priceFromEur = parsePriceToken(priceMatch[1]);
      if (priceMatch[2]) promoPriceEur = parsePriceToken(priceMatch[2]);
    }

    out.push({
      departure,
      arrival,
      durationMinutes,
      origin,
      destination,
      busType,
      priceFromEur,
      promoPriceEur,
      observations,
    });
  }
  return out;
}
