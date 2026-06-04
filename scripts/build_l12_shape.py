#!/usr/bin/env python3
"""Reconstruye shape de L12 conectando paradas vía OSRM público.
Inserta en bus_line_shapes (LINESTRING) y calcula bus_line_stop_distances.
"""
import subprocess, json, urllib.request, urllib.parse, sys, time

def q(sql):
    r = subprocess.run(["psql","-At","-F","\t","-c", sql], capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.strip().split("\n") if l]

def osrm_route(coords):
    # coords: list of (lng, lat)
    locs = ";".join(f"{lng},{lat}" for lng,lat in coords)
    url = f"http://router.project-osrm.org/route/v1/driving/{locs}?overview=full&geometries=geojson&steps=false&annotations=distance"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())

rows = q("SELECT direction, seq, bs.lng, bs.lat FROM bus_line_stops bls JOIN bus_stops bs ON bs.code=bls.stop_code WHERE line_code='12' ORDER BY direction::int, seq::int")
by_dir = {}
for d, seq, lng, lat in rows:
    by_dir.setdefault(int(d), []).append((int(seq), float(lng), float(lat)))

with open("/tmp/l12_shape.sql","w") as f:
    f.write("DELETE FROM bus_line_shapes WHERE line_code='12';\n")
    f.write("DELETE FROM bus_line_stop_distances WHERE line_code='12';\n")
    for d, stops in sorted(by_dir.items()):
        coords = [(lng,lat) for _,lng,lat in stops]
        print(f"dir {d}: {len(coords)} paradas", file=sys.stderr)
        data = osrm_route(coords)
        if data.get("code") != "Ok":
            print(f"OSRM error dir {d}: {data}", file=sys.stderr); sys.exit(1)
        route = data["routes"][0]
        geom = route["geometry"]  # GeoJSON LineString
        total_m = route["distance"]
        # waypoint distances along the route (sum of legs)
        cum_m = [0.0]
        for leg in route["legs"]:
            cum_m.append(cum_m[-1] + leg["distance"])
        # ensure len == len(stops)
        if len(cum_m) != len(stops):
            print(f"WARN dir {d}: cum {len(cum_m)} vs stops {len(stops)}", file=sys.stderr)
        geom_json = json.dumps(geom).replace("'", "''")
        f.write(
          f"INSERT INTO bus_line_shapes (line_code, direction, geometry, length_m, source) "
          f"VALUES ('12', {d}, ST_GeomFromGeoJSON('{geom_json}'), {total_m:.1f}, 'osrm_stops_v1');\n"
        )
        for (seq,_,_), cm in zip(stops, cum_m):
            f.write(
              f"INSERT INTO bus_line_stop_distances (line_code, direction, seq, cum_distance_m, source) "
              f"VALUES ('12', {d}, {seq}, {cm:.1f}, 'osrm_stops_v1');\n"
            )
        time.sleep(1.2)  # respeta OSRM público
print("OK -> /tmp/l12_shape.sql")
