#!/usr/bin/env python3
"""Reconstruye shape de L12 conectando paradas vía OSRM público.
Inserta en bus_line_shapes (GeoJSON jsonb) y segmentos en bus_line_stop_distances.
"""
import subprocess, json, urllib.request, sys, time

def q(sql):
    r = subprocess.run(["psql","-At","-F","\t","-c", sql], capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.strip().split("\n") if l]

def osrm_route(coords):
    locs = ";".join(f"{lng},{lat}" for lng,lat in coords)
    url = f"http://router.project-osrm.org/route/v1/driving/{locs}?overview=full&geometries=geojson&steps=false"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())

rows = q("SELECT direction, seq, bls.stop_code, bs.lng, bs.lat FROM bus_line_stops bls JOIN bus_stops bs ON bs.code=bls.stop_code WHERE line_code='12' ORDER BY direction::int, seq::int")
by_dir = {}
for d, seq, code, lng, lat in rows:
    by_dir.setdefault(int(d), []).append((int(seq), code, float(lng), float(lat)))

with open("/tmp/l12_shape.sql","w") as f:
    f.write("DELETE FROM bus_line_shapes WHERE line_code='12';\n")
    f.write("DELETE FROM bus_line_stop_distances WHERE line_code='12';\n")
    for d, stops in sorted(by_dir.items()):
        coords = [(lng,lat) for _,_,lng,lat in stops]
        print(f"dir {d}: {len(coords)} paradas", file=sys.stderr)
        data = osrm_route(coords)
        if data.get("code") != "Ok":
            print(f"OSRM error dir {d}: {data}", file=sys.stderr); sys.exit(1)
        route = data["routes"][0]
        geom = route["geometry"]
        total_m = route["distance"]
        pt_count = len(geom["coordinates"])
        legs = route["legs"]
        geom_json = json.dumps(geom).replace("'", "''")
        f.write(
          f"INSERT INTO bus_line_shapes (line_code, direction, geometry, total_length_m, point_count, source) "
          f"VALUES ('12', {d}, '{geom_json}'::jsonb, {total_m:.1f}, {pt_count}, 'osrm_stops_v1');\n"
        )
        cum = 0.0
        for i, leg in enumerate(legs):
            from_seq, from_code, _, _ = stops[i]
            to_seq, to_code, _, _ = stops[i+1]
            dist = leg["distance"]
            cum += dist
            f.write(
              f"INSERT INTO bus_line_stop_distances "
              f"(line_code, direction, from_seq, to_seq, from_stop_code, to_stop_code, distance_m, cumulative_m) "
              f"VALUES ('12', {d}, {from_seq}, {to_seq}, '{from_code}', '{to_code}', {dist:.1f}, {cum:.1f});\n"
            )
        print(f"  total {total_m:.0f} m, {len(legs)} segmentos", file=sys.stderr)
        time.sleep(1.2)
print("OK -> /tmp/l12_shape.sql")
