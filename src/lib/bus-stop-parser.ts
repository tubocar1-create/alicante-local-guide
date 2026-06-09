// Parser client-side de paradas de bus desde el HTML de
// https://movilidad.alicante.es/paradas-de-bus
// Diseñado para ser robusto a cambios menores: usa búsqueda semántica
// por texto en lugar de selectores frágiles.

export type BusArrival = {
  line: string;
  destination: string;
  etaText: string;
  etaMinutes: number | null;
};

export type BusStopData = {
  stopId: number;
  stopName: string;
  arrivals: BusArrival[];
};

export type ExtractResult = {
  stop: BusStopData | null;
  debug: {
    fetchMs: number;
    htmlBytes: number;
    blocksFound: number;
    arrivalsFound: number;
    error?: string;
  };
};

function parseEtaToMinutes(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let total = 0;
  let matched = false;
  const minMatch = t.match(/(\d+)\s*min/);
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
    matched = true;
  }
  const secMatch = t.match(/(\d+)\s*seg/);
  if (secMatch) {
    // se redondea hacia arriba si hay segundos relevantes
    total += parseInt(secMatch[1], 10) >= 30 ? 1 : 0;
    matched = true;
  }
  if (!matched) {
    const onlyNum = t.match(/^\s*(\d+)\s*$/);
    if (onlyNum) return parseInt(onlyNum[1], 10);
    return null;
  }
  return total;
}

function findStopBlock(doc: Document, stopId: number): HTMLElement | null {
  const idStr = String(stopId);
  // Buscar nodos de texto que contengan "5110 :" o "5110:" o "5110 -"
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const re = new RegExp(`\\b${idStr}\\b\\s*[:\\-–]\\s*[A-ZÁÉÍÓÚÑ]`);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const txt = node.nodeValue ?? "";
    if (re.test(txt)) {
      // Subir hasta encontrar un contenedor con una tabla dentro
      let el: HTMLElement | null = (node.parentElement as HTMLElement) ?? null;
      for (let i = 0; i < 10 && el; i++) {
        if (el.querySelector("table")) return el;
        el = el.parentElement;
      }
      // fallback: devuelve el ancestro más cercano
      return (node.parentElement as HTMLElement) ?? null;
    }
  }
  return null;
}

function extractStopName(block: HTMLElement, stopId: number): string {
  const text = block.textContent ?? "";
  const re = new RegExp(`\\b${stopId}\\b\\s*[:\\-–]\\s*([^\\n\\r|·]+?)(?:\\s{2,}|$|\\n)`);
  const m = text.match(re);
  if (m) return m[1].trim().replace(/\s+/g, " ");
  return "";
}

function extractArrivalsFromTable(table: HTMLTableElement): BusArrival[] {
  const arrivals: BusArrival[] = [];
  const headerCells = Array.from(table.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
    .map((c) => (c.textContent ?? "").trim().toLowerCase());

  // Detectar columnas
  const idxLine = headerCells.findIndex((h) => /l[íi]nea|line/.test(h));
  const idxDest = headerCells.findIndex((h) => /destino|destination/.test(h));
  const idxEta = headerCells.findIndex((h) => /llegada|eta|tiempo/.test(h));

  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const dataRows = rows.length > 0 ? rows : Array.from(table.querySelectorAll("tr")).slice(1);

  for (const row of dataRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) continue;
    const get = (i: number) => (i >= 0 && i < cells.length ? (cells[i].textContent ?? "").trim() : "");
    const line = get(idxLine >= 0 ? idxLine : 0);
    const destination = get(idxDest >= 0 ? idxDest : 1);
    const etaText = get(idxEta >= 0 ? idxEta : cells.length - 1);
    if (!line && !destination && !etaText) continue;
    arrivals.push({
      line: line.replace(/\s+/g, " "),
      destination: destination.replace(/\s+/g, " "),
      etaText: etaText.replace(/\s+/g, " "),
      etaMinutes: parseEtaToMinutes(etaText),
    });
  }
  return arrivals;
}

export function parseStopFromHtml(html: string, stopId: number): BusStopData | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const block = findStopBlock(doc, stopId);
  if (!block) return null;
  const stopName = extractStopName(block, stopId);
  const table = block.querySelector("table") as HTMLTableElement | null;
  const arrivals = table ? extractArrivalsFromTable(table) : [];
  return { stopId, stopName, arrivals };
}

export async function extractStopFromPage(
  pageUrl: string,
  stopId: number
): Promise<ExtractResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(pageUrl, { cache: "no-store" });
    const html = await res.text();
    const fetchMs = Math.round(performance.now() - t0);
    const htmlBytes = new Blob([html]).size;
    const stop = parseStopFromHtml(html, stopId);
    return {
      stop,
      debug: {
        fetchMs,
        htmlBytes,
        blocksFound: stop ? 1 : 0,
        arrivalsFound: stop?.arrivals.length ?? 0,
      },
    };
  } catch (e) {
    return {
      stop: null,
      debug: {
        fetchMs: Math.round(performance.now() - t0),
        htmlBytes: 0,
        blocksFound: 0,
        arrivalsFound: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
