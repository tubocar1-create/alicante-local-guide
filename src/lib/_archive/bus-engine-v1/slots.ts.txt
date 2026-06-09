// Franjas horarias operacionales. Permiten que headway, cycle, dwell y
// segment_speed se calculen contextualmente. El motor predictivo elige el
// slot activo al construir el plan de la línea.

export type ServiceSlot = "07-09" | "09-12" | "12-15" | "15-18" | "18-22" | "22-06";

export const SERVICE_SLOTS: ServiceSlot[] = [
  "07-09",
  "09-12",
  "12-15",
  "15-18",
  "18-22",
  "22-06",
];

export function getServiceSlot(at: Date = new Date()): ServiceSlot {
  const h = at.getHours();
  if (h >= 7 && h < 9) return "07-09";
  if (h >= 9 && h < 12) return "09-12";
  if (h >= 12 && h < 15) return "12-15";
  if (h >= 15 && h < 18) return "15-18";
  if (h >= 18 && h < 22) return "18-22";
  return "22-06";
}

// Mapea slot → bucket horario "típico" para encajar con stats existentes que
// usan ventanas (morning/midday/afternoon/night) sin slot explícito.
export function slotToLegacyBucket(slot: ServiceSlot): "morning" | "midday" | "afternoon" | "night" {
  if (slot === "07-09") return "morning";
  if (slot === "09-12" || slot === "12-15") return "midday";
  if (slot === "15-18" || slot === "18-22") return "afternoon";
  return "night";
}
