#!/usr/bin/env python3
"""Resolve orphan bus stops locally using shapes + name matching.
NO external APIs. Outputs SQL UPDATEs and a report.
"""
import json, re, math, subprocess, sys, difflib
from collections import defaultdict

# ---------- 1. Normalization ----------
ALIASES = {
    "XLAN": "XIMENEZ LANGUCHA",
    "XHER": "XIMENEZ HERCULES",
    "XCDS": "XIMENEZ CRUZ DEL SUR",
    "CDAS": "CIUDAD DE ASIS",
    "AGRV": "ALONSO GRAN VIA",
    "AGUI": "AGUILA",
    "MAES": "MAESTRO ALONSO",
    "GACA": "GASTON CASTELLO",
    "CENI": "CEFEO NINOLES",
    "COLR": "COLONIA REQUENA",
}
ABBREV = {
    r"\bA\.\s*": "ANTONIO ",
    r"\bAV\.\s*": "AVENIDA ",
    r"\bAVDA\.\s*": "AVENIDA ",
    r"\bC\/\s*": "CALLE ",
    r"\bSR\.\s*": "SEÑOR ",
    r"\bPZA\.\s*": "PLAZA ",
    r"\bPL\.\s*": "PLAZA ",
    r"\bSTA\.\s*": "SANTA ",
    r"\bSTO\.\s*": "SANTO ",
}
ACCENTS = str.maketrans("ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç",
                        "AAAAAEEEEIIIIOOOOOUUUUNCAAAAAEEEEIIIIOOOOOUUUUNC")

def normalize(name: str) -> str:
    if not name: return ""
    s = name.upper().translate(ACCENTS)
    s = re.sub(r"\(TRAM\)", " ", s)
    s = re.sub(r"\(.+?\)", " ", s)
    # alias by L3-XXX or bare token
    m = re.match(r"^L\d+-([A-Z]+)$", s.replace(" ", ""))
    if m and m.group(1) in ALIASES:
        s = ALIASES[m.group(1)]
    for tok, exp in ALIASES.items():
        if re.search(rf"\b{tok}\b", s): s = re.sub(rf"\b{tok}\b", exp, s)
    for pat, rep in ABBREV.items(): s = re.sub(pat, rep, s)
    s = s.replace("-", " ").replace("/", " ")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ---------- DB helpers ----------
def q(sql: str):
    r = subprocess.run(["psql","-At","-F","\t","-c", sql], capture_output=True, text=True, check=True)
    return [line.split("\t") for line in r.stdout.strip().split("\n") if line]

# ---------- 2. Load data ----------
print("Loading data...", file=sys.stderr)
all_stops = q("SELECT code, name, lat, lng FROM bus_stops WHERE lat IS NOT NULL AND lng IS NOT NULL")
known_by_norm = defaultdict(list)
for code, name, lat, lng in all_stops:
    known_by_norm[normalize(name)].append((code, name, float(lat), float(lng)))

orphans = q("""SELECT bls.line_code, bls.direction, bls.seq, bls.stop_name, bls.stop_code
               FROM bus_line_stops bls
               LEFT JOIN bus_stops bs ON bs.code = bls.stop_code
               WHERE bls.line_code IN ('14','3','7')
                 AND (bs.lat IS NULL OR bs.lng IS NULL OR bls.stop_code IS NULL)
               ORDER BY bls.line_code, bls.direction, bls.seq""")

line_stops = defaultdict(list)  # (line, dir) -> [(seq, name, code, lat, lng)]
all_line_stops = q("""SELECT bls.line_code, bls.direction, bls.seq, bls.stop_name, bls.stop_code,
                             bs.lat, bs.lng
                      FROM bus_line_stops bls
                      LEFT JOIN bus_stops bs ON bs.code = bls.stop_code
                      WHERE bls.line_code IN ('14','3','7')
                      ORDER BY bls.line_code, bls.direction, bls.seq""")
for lc, d, seq, name, code, lat, lng in all_line_stops:
    line_stops[(lc, int(d))].append({
        "seq": int(seq), "name": name, "code": code,
        "lat": float(lat) if lat else None, "lng": float(lng) if lng else None
    })

shapes_raw = q("SELECT line_code, direction, geometry::text FROM bus_line_shapes WHERE line_code IN ('14','3','7')")
shapes = {}
for lc, d, geom in shapes_raw:
    g = json.loads(geom)
    coords = g["coordinates"]  # [[lng,lat], ...]
    shapes[(lc, int(d))] = [(c[1], c[0]) for c in coords]  # store as (lat,lng)

# ---------- Geo utils ----------
R = 6371000
def hav(a, b):
    la1, lo1 = math.radians(a[0]), math.radians(a[1])
    la2, lo2 = math.radians(b[0]), math.radians(b[1])
    dl, do = la2-la1, lo2-lo1
    h = math.sin(dl/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(do/2)**2
    return 2*R*math.asin(math.sqrt(h))

def cum_distances(poly):
    cum=[0.0]
    for i in range(1,len(poly)):
        cum.append(cum[-1]+hav(poly[i-1], poly[i]))
    return cum

def project_point_on_polyline(pt, poly, cum):
    """Return (dist_along_m, snap_distance_m, snapped_point)."""
    best = (None, 1e18, None)
    for i in range(len(poly)-1):
        a, b = poly[i], poly[i+1]
        # Use equirectangular approx in meters
        # Convert to local meters relative to a
        lat0 = math.radians(a[0])
        kx = R * math.cos(lat0) * math.pi/180
        ky = R * math.pi/180
        ax, ay = 0.0, 0.0
        bx = (b[1]-a[1])*kx; by = (b[0]-a[0])*ky
        px = (pt[1]-a[1])*kx; py = (pt[0]-a[0])*ky
        dx, dy = bx-ax, by-ay
        seglen2 = dx*dx+dy*dy
        t = 0 if seglen2==0 else max(0, min(1, (px*dx+py*dy)/seglen2))
        sx, sy = ax+t*dx, ay+t*dy
        d = math.hypot(px-sx, py-sy)
        if d < best[1]:
            seg_d = math.sqrt(seglen2)*t
            snap_lat = a[0] + (b[0]-a[0])*t
            snap_lng = a[1] + (b[1]-a[1])*t
            best = (cum[i]+seg_d, d, (snap_lat, snap_lng))
    return best

def point_at_distance(poly, cum, dist):
    """Return (lat,lng) at given cumulative distance along polyline."""
    if dist <= 0: return poly[0]
    if dist >= cum[-1]: return poly[-1]
    # binary search
    lo, hi = 0, len(cum)-1
    while lo<hi-1:
        mid=(lo+hi)//2
        if cum[mid]<=dist: lo=mid
        else: hi=mid
    seg = dist - cum[lo]
    seglen = cum[lo+1] - cum[lo]
    if seglen==0: return poly[lo]
    t = seg/seglen
    a, b = poly[lo], poly[lo+1]
    return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

# ---------- 3. Resolve ----------
results = []  # {line, dir, seq, code, name, new_lat, new_lng, source, conf, warn}

def find_name_match(orphan_name):
    n = normalize(orphan_name)
    if not n: return None
    # exact normalized
    if n in known_by_norm:
        c = known_by_norm[n][0]
        return (c[2], c[3], "internal_match_exact", 0.98, c[0])
    # contains both ways
    for kn, lst in known_by_norm.items():
        if (n in kn or kn in n) and abs(len(n)-len(kn))<=8:
            c = lst[0]
            return (c[2], c[3], "internal_match_contains", 0.90, c[0])
    # fuzzy
    matches = difflib.get_close_matches(n, list(known_by_norm.keys()), n=1, cutoff=0.85)
    if matches:
        c = known_by_norm[matches[0]][0]
        return (c[2], c[3], "internal_match_fuzzy", 0.80, c[0])
    return None

# Pre-project ALL known stops on shape for each (line,dir) — used in phase 3
projections = {}  # (line,dir,seq) -> dist_along
for (lc, d), stops in line_stops.items():
    poly = shapes.get((lc,d))
    if not poly: continue
    cum = cum_distances(poly)
    for s in stops:
        if s["lat"] is not None:
            da, sd, _ = project_point_on_polyline((s["lat"], s["lng"]), poly, cum)
            projections[(lc, d, s["seq"])] = (da, sd)

def resolve_one(lc, d, seq, name, code, allow_fallback=False):
    rec = {"line":lc, "dir":d, "seq":seq, "code":code, "name":name,
           "new_lat":None, "new_lng":None, "source":None, "conf":0.0, "warn":""}
    # Phase 2: name match
    m = find_name_match(name)
    if m:
        rec["new_lat"], rec["new_lng"], rec["source"], rec["conf"], _ = m
        return rec
    # Phase 3: shape interpolation
    poly = shapes.get((lc, d))
    if poly:
        cum = cum_distances(poly)
        stops = line_stops[(lc, d)]
        max_seq = max(s["seq"] for s in stops)
        prev_known = next_known = None
        for s in stops:
            if s["seq"] < seq and s["lat"] is not None: prev_known = s
            if s["seq"] > seq and s["lat"] is not None and next_known is None: next_known = s
        pa_seq = pa_dist = pb_seq = pb_dist = None
        if prev_known:
            p = projections.get((lc, d, prev_known["seq"]))
            if p: pa_seq, pa_dist = prev_known["seq"], p[0]
        if pa_dist is None and seq == 1:
            pa_seq, pa_dist = 0, 0.0
        if next_known:
            p = projections.get((lc, d, next_known["seq"]))
            if p: pb_seq, pb_dist = next_known["seq"], p[0]
        if pb_dist is None and seq == max_seq:
            pb_seq, pb_dist = max_seq+1, cum[-1]
        if pa_dist is not None and pb_dist is not None and pb_dist > pa_dist and pb_seq > pa_seq:
            ratio = (seq - pa_seq) / (pb_seq - pa_seq)
            target = pa_dist + ratio*(pb_dist-pa_dist)
            pt = point_at_distance(poly, cum, target)
            rec["new_lat"], rec["new_lng"] = pt
            is_terminal = (seq == 1 and not prev_known) or (seq == max_seq and not next_known)
            rec["source"] = "shape_terminal" if is_terminal else "interpolated_shape"
            rec["conf"] = 0.90 if is_terminal else 0.80
            for nb in [prev_known, next_known]:
                if nb and nb["lat"]:
                    gap = hav(pt, (nb["lat"], nb["lng"]))
                    if gap < 30: rec["warn"] = (rec["warn"]+" neighbor<30m").strip()
                    elif gap > 1200: rec["warn"] = (rec["warn"]+f" gap{int(gap)}m").strip()
            return rec
        if allow_fallback:
            nearest = None; best_dseq = 1e9
            for s in stops:
                if s["lat"] is not None and abs(s["seq"]-seq) < best_dseq:
                    best_dseq = abs(s["seq"]-seq); nearest = s
            if nearest:
                pa = projections.get((lc, d, nearest["seq"]))
                if pa:
                    offset = (seq - nearest["seq"]) * 250
                    target = max(0, min(cum[-1], pa[0] + offset))
                    pt = point_at_distance(poly, cum, target)
                    rec["new_lat"], rec["new_lng"] = pt
                    rec["source"] = "fallback_shape"; rec["conf"] = 0.55
                    rec["warn"] = "single-anchor fallback"
                    return rec
    if allow_fallback:
        rec["source"] = "unresolved"; rec["warn"] = "no shape/anchors"
    return rec

# Iterative passes: each newly-resolved stop becomes an anchor for the next pass.
pending = [(lc, int(d), int(seq), name, code) for lc, d, seq, name, code in orphans]
resolved_map = {}  # (lc, d, seq) -> rec
for pass_num in range(1, 5):
    progressed = False
    still_pending = []
    for tup in pending:
        lc, d, seq, name, code = tup
        rec = resolve_one(lc, d, seq, name, code, allow_fallback=False)
        if rec["new_lat"] is not None:
            resolved_map[(lc, d, seq)] = rec
            # promote into anchors for the next pass
            for s in line_stops[(lc, d)]:
                if s["seq"] == seq:
                    s["lat"], s["lng"] = rec["new_lat"], rec["new_lng"]
                    projections[(lc, d, seq)] = (
                        project_point_on_polyline((s["lat"], s["lng"]),
                                                  shapes[(lc, d)],
                                                  cum_distances(shapes[(lc, d)]))[0],
                        0
                    )
                    break
            progressed = True
        else:
            still_pending.append(tup)
    pending = still_pending
    print(f"Pass {pass_num}: resolved={len(resolved_map)} pending={len(pending)}", file=sys.stderr)
    if not progressed: break

# Final pass with fallback for anything left
for tup in pending:
    lc, d, seq, name, code = tup
    rec = resolve_one(lc, d, seq, name, code, allow_fallback=True)
    resolved_map[(lc, d, seq)] = rec

# Re-emit in original orphan order
results = [resolved_map[(lc, int(d), int(seq))] for lc, d, seq, _, _ in orphans]


# ---------- 7. Report ----------
print(f"\n{'CODE':<10}{'LINE':<6}{'DIR':<5}{'SEQ':<5}{'SOURCE':<24}{'CONF':<6}{'WARN':<24}{'NAME'}")
print("-"*120)
for r in results:
    print(f"{(r['code'] or '?'):<10}{r['line']:<6}{r['dir']:<5}{r['seq']:<5}"
          f"{(r['source'] or ''):<24}{r['conf']:<6}{(r['warn'] or ''):<24}{r['name']}")

# Summary
by_src = defaultdict(int)
for r in results: by_src[r['source']] += 1
print("\nResumen:")
for k,v in by_src.items(): print(f"  {k}: {v}")

# ---------- Emit SQL ----------
with open("/tmp/orphans_update.sql","w") as f:
    for r in results:
        if r["new_lat"] is None or not r["code"]: continue
        lat = round(r["new_lat"], 7); lng = round(r["new_lng"], 7)
        # ensure bus_stops row exists then UPDATE
        name_safe = r["name"].replace("'", "''")
        f.write(
            f"INSERT INTO bus_stops (code, name, lat, lng) VALUES "
            f"('{r['code']}', '{name_safe}', {lat}, {lng}) "
            f"ON CONFLICT (code) DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng, "
            f"name=COALESCE(bus_stops.name, EXCLUDED.name);\n"
        )
print(f"\nSQL written to /tmp/orphans_update.sql ({sum(1 for r in results if r['new_lat'])} updates)")
