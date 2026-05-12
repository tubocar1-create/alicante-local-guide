// Pure routing helpers over bus_line_stops graph.

export type RouteStop = {
  line_code: string;
  direction: number;
  seq: number;
  stop_code: string | null;
  stop_name: string;
};

export type Leg = {
  lineCode: string;
  direction: number;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  numStops: number;
  intermediate: { code: string | null; name: string }[];
};

export type Trip = {
  legs: Leg[];
  totalStops: number;
  transfers: number;
};

type LineKey = string; // `${line}|${dir}`

function buildIndex(stops: RouteStop[]) {
  const byLine = new Map<LineKey, RouteStop[]>();
  // For each stop_code -> list of (lineKey, position) it appears at
  const byStop = new Map<string, { key: LineKey; idx: number }[]>();

  for (const s of stops) {
    const key: LineKey = `${s.line_code}|${s.direction}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key)!.push(s);
  }
  for (const [key, list] of byLine) {
    list.sort((a, b) => a.seq - b.seq);
    list.forEach((s, idx) => {
      if (!s.stop_code) return;
      if (!byStop.has(s.stop_code)) byStop.set(s.stop_code, []);
      byStop.get(s.stop_code)!.push({ key, idx });
    });
  }
  return { byLine, byStop };
}

function buildLeg(
  list: RouteStop[],
  fromIdx: number,
  toIdx: number,
): Leg {
  const slice = list.slice(fromIdx, toIdx + 1);
  const from = slice[0];
  const to = slice[slice.length - 1];
  return {
    lineCode: from.line_code,
    direction: from.direction,
    fromCode: from.stop_code ?? "",
    fromName: from.stop_name,
    toCode: to.stop_code ?? "",
    toName: to.stop_name,
    numStops: slice.length - 1,
    intermediate: slice.slice(1, -1).map((s) => ({ code: s.stop_code, name: s.stop_name })),
  };
}

/**
 * Find direct trips and 1-transfer trips between two stop codes.
 * Returns up to ~12 results, sorted by transfers and total stops.
 */
export function findTrips(
  stops: RouteStop[],
  originCode: string,
  destCode: string,
  opts: { maxResults?: number } = {},
): Trip[] {
  if (!originCode || !destCode || originCode === destCode) return [];
  const max = opts.maxResults ?? 12;
  const { byLine, byStop } = buildIndex(stops);
  const trips: Trip[] = [];

  const originAt = byStop.get(originCode) ?? [];
  const destAt = byStop.get(destCode) ?? [];
  if (!originAt.length || !destAt.length) return [];

  // 1) Direct: same lineKey, originIdx < destIdx
  const destIdxByKey = new Map<LineKey, number>();
  for (const d of destAt) destIdxByKey.set(d.key, d.idx);

  const directKeys = new Set<LineKey>();
  for (const o of originAt) {
    const dIdx = destIdxByKey.get(o.key);
    if (dIdx != null && dIdx > o.idx) {
      const list = byLine.get(o.key)!;
      const leg = buildLeg(list, o.idx, dIdx);
      trips.push({ legs: [leg], totalStops: leg.numStops, transfers: 0 });
      directKeys.add(o.key);
    }
  }

  // 2) One transfer: line A from origin, then line B to dest, sharing a stop
  // Cap candidates to keep it fast.
  for (const o of originAt) {
    const listA = byLine.get(o.key)!;
    if (directKeys.has(o.key)) continue;
    // Walk forward from origin on lineA up to ~40 stops
    const maxA = Math.min(listA.length, o.idx + 41);
    for (let i = o.idx + 1; i < maxA; i++) {
      const transfer = listA[i];
      if (!transfer.stop_code) continue;
      const transferAt = byStop.get(transfer.stop_code);
      if (!transferAt) continue;
      for (const t of transferAt) {
        if (t.key === o.key) continue;
        const dIdx = destIdxByKey.get(t.key);
        if (dIdx != null && dIdx > t.idx) {
          const listB = byLine.get(t.key)!;
          const legA = buildLeg(listA, o.idx, i);
          const legB = buildLeg(listB, t.idx, dIdx);
          trips.push({
            legs: [legA, legB],
            totalStops: legA.numStops + legB.numStops,
            transfers: 1,
          });
        }
      }
    }
  }

  // De-dup by signature
  const seen = new Set<string>();
  const unique = trips.filter((t) => {
    const sig = t.legs
      .map((l) => `${l.lineCode}|${l.direction}|${l.fromCode}|${l.toCode}`)
      .join(">");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  unique.sort((a, b) => a.transfers - b.transfers || a.totalStops - b.totalStops);
  return unique.slice(0, max);
}
