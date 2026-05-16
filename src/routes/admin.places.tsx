import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addPlaceFromGoogle,
  addPlaceManual,
  listPlacesByCategory,
  deletePlace,
} from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/places")({
  head: () => ({
    meta: [
      { title: "Admin · Añadir sitios a la BD" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPlacesPage,
});

const CATEGORIES: { value: string; label: string }[] = [
  { value: "typical", label: "Comida típica alicantina" },
  { value: "rice_fish", label: "Arroces y pescados" },
  { value: "italian", label: "Italiano" },
  { value: "pizzas", label: "Pizzerías" },
  { value: "brunch", label: "Desayunos / Brunch" },
  { value: "asian", label: "Asiático" },
  { value: "drinks", label: "Bebidas / Bares" },
  { value: "lookup", label: "Otro / Comercio" },
];

function AdminPlacesPage() {
  const addFromGoogle = useServerFn(addPlaceFromGoogle);
  const addManual = useServerFn(addPlaceManual);
  const listFn = useServerFn(listPlacesByCategory);
  const delFn = useServerFn(deletePlace);

  const [tab, setTab] = useState<"url" | "manual">("url");
  const [category, setCategory] = useState("typical");
  const [busy, setBusy] = useState(false);

  // URL form
  const [urlInput, setUrlInput] = useState("");

  // Manual form
  const [m, setM] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    phone: "",
    website: "",
    cuisine: "",
    rating: "",
  });

  // List
  const [listCat, setListCat] = useState("typical");
  const [places, setPlaces] = useState<
    Array<{
      google_place_id: string;
      name: string;
      address: string | null;
      rating: number | null;
    }>
  >([]);
  const [loadingList, setLoadingList] = useState(false);

  const refreshList = async (cat: string) => {
    setLoadingList(true);
    try {
      const res = await listFn({ data: { category: cat } });
      setPlaces(
        res.places.map((p) => ({
          google_place_id: p.google_place_id,
          name: p.name,
          address: p.address ?? null,
          rating: (p.rating as number | null) ?? null,
        })),
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la lista");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    refreshList(listCat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCat]);

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setBusy(true);
    try {
      const res = await addFromGoogle({
        data: { input: urlInput.trim(), category },
      });
      if (res.ok) {
        toast.success(`Añadido: ${res.place.name}`);
        setUrlInput("");
        if (listCat === category) refreshList(listCat);
      } else {
        toast.error("No se encontró el sitio en Google. Prueba con el nombre o usa el formulario manual.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleAddManual = async () => {
    if (!m.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setBusy(true);
    try {
      const res = await addManual({
        data: {
          name: m.name,
          category,
          address: m.address || undefined,
          lat: m.lat ? Number(m.lat) : undefined,
          lng: m.lng ? Number(m.lng) : undefined,
          phone: m.phone || undefined,
          website: m.website || undefined,
          cuisine: m.cuisine || undefined,
          rating: m.rating ? Number(m.rating) : undefined,
        },
      });
      if (res.ok) {
        toast.success(`Añadido: ${res.place.name}`);
        setM({
          name: "",
          address: "",
          lat: "",
          lng: "",
          phone: "",
          website: "",
          cuisine: "",
          rating: "",
        });
        if (listCat === category) refreshList(listCat);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (placeId: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}" de la base de datos?`)) return;
    try {
      await delFn({ data: { placeId } });
      toast.success("Eliminado");
      setPlaces((prev) => prev.filter((p) => p.google_place_id !== placeId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Añadir sitios a la BD</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Pega un enlace de Google Maps o introduce los datos a mano. El sitio
        aparecerá en el Dashboard correspondiente según su categoría.
      </p>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "url"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Desde Google Maps
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "manual"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Manual
          </button>
        </div>

        {tab === "url" ? (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>URL de Google Maps, Place ID o nombre</Label>
              <Input
                placeholder="https://maps.app.goo.gl/... o ChIJ... o nombre del sitio"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Funciona con enlaces cortos (maps.app.goo.gl), enlaces largos
                (google.com/maps/place/...) o el Place ID directamente.
              </p>
            </div>
            <Button onClick={handleAddUrl} disabled={busy || !urlInput.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Añadir
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Nombre *</Label>
              <Input
                value={m.name}
                onChange={(e) => setM({ ...m, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Dirección</Label>
              <Input
                value={m.address}
                onChange={(e) => setM({ ...m, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Latitud</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={m.lat}
                  onChange={(e) => setM({ ...m, lat: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Longitud</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={m.lng}
                  onChange={(e) => setM({ ...m, lng: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de cocina</Label>
              <Input
                value={m.cuisine}
                onChange={(e) => setM({ ...m, cuisine: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  value={m.phone}
                  onChange={(e) => setM({ ...m, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Rating (0–5)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={m.rating}
                  onChange={(e) => setM({ ...m, rating: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Web</Label>
              <Input
                value={m.website}
                onChange={(e) => setM({ ...m, website: e.target.value })}
              />
            </div>
            <Button onClick={handleAddManual} disabled={busy || !m.name.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Añadir
            </Button>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sitios en la BD</h2>
          <Select value={listCat} onValueChange={setListCat}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loadingList ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : places.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay sitios en esta categoría.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {places.map((p) => (
              <li
                key={p.google_place_id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  {p.address ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {p.address}
                    </p>
                  ) : null}
                  {p.rating != null ? (
                    <p className="text-xs text-muted-foreground">
                      ★ {p.rating.toFixed(1)}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(p.google_place_id, p.name)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Total: {places.length}
        </p>
      </div>
    </div>
  );
}
