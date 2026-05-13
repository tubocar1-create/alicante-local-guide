import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createBusiness } from "@/lib/business/business.functions";
import { supabase } from "@/integrations/supabase/client";

const SECTORS = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "ice_cream",
  "hairdresser",
  "nails",
  "beauty",
  "gym",
  "laundry",
  "shop",
  "tourism",
  "experience",
  "other",
];

export const Route = createFileRoute("/business/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createBusiness);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sector, setSector] = useState("restaurant");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Ensure user has business_user role (self-grant on first business creation)
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase
          .from("user_roles")
          .insert({ user_id: u.user.id, role: "business_user" })
          .select();
      }
      await create({
        data: {
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          sector,
          phone: phone || undefined,
          address: address || undefined,
        },
      });
      toast.success("Negocio creado");
      qc.invalidateQueries({ queryKey: ["my-businesses"] });
      nav({ to: "/business" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Crear tu negocio</h1>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Slug (URL)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="auto desde el nombre"
            className="input"
          />
        </Field>
        <Field label="Sector">
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="input">
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Teléfono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Dirección">
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </Field>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Creando…" : "Crear negocio"}
        </button>
      </form>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:14px;padding:.6rem .75rem;font-size:.875rem;outline:none}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
