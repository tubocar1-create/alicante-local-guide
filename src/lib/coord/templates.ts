// Catálogo de mensajes estructurados. La UI renderiza chips a partir de aquí.
import { z } from "zod";

export type Role = "user" | "business";

export type TemplateDef = {
  key: string;
  label: string;
  role: Role;
  // Estado del hilo tras enviar este mensaje
  nextThreadStatus?: "awaiting_user" | "awaiting_business" | "closed";
  // Cambia el estado del booking
  nextBookingStatus?: "confirmed" | "cancelled" | "completed" | "no_show";
  payloadSchema?: z.ZodTypeAny;
  requiresAction?: boolean;
};

export const TEMPLATES: Record<string, TemplateDef> = {
  // negocio
  "business.confirm": {
    key: "business.confirm",
    label: "Confirmar reserva",
    role: "business",
    nextThreadStatus: "awaiting_user",
    nextBookingStatus: "confirmed",
  },
  "business.propose_slot": {
    key: "business.propose_slot",
    label: "Proponer otra hora",
    role: "business",
    nextThreadStatus: "awaiting_user",
    payloadSchema: z.object({ scheduled_at: z.string().datetime() }),
    requiresAction: true,
  },
  "business.decline": {
    key: "business.decline",
    label: "Rechazar",
    role: "business",
    nextThreadStatus: "closed",
    nextBookingStatus: "cancelled",
    payloadSchema: z.object({ reason: z.string().max(280).optional() }),
  },
  "business.service_ready": {
    key: "business.service_ready",
    label: "Listo para atenderte",
    role: "business",
    nextThreadStatus: "awaiting_user",
  },
  "business.running_late": {
    key: "business.running_late",
    label: "Vamos con retraso",
    role: "business",
    payloadSchema: z.object({ delay_minutes: z.number().int().min(1).max(180) }),
  },
  // usuario
  "user.accept": {
    key: "user.accept",
    label: "Aceptar",
    role: "user",
    nextThreadStatus: "closed",
    nextBookingStatus: "confirmed",
  },
  "user.reject_proposal": {
    key: "user.reject_proposal",
    label: "Rechazar propuesta",
    role: "user",
    nextThreadStatus: "closed",
    nextBookingStatus: "cancelled",
  },
  "user.on_my_way": {
    key: "user.on_my_way",
    label: "Voy en camino",
    role: "user",
    nextThreadStatus: "awaiting_business",
    payloadSchema: z.object({ eta_minutes: z.number().int().min(0).max(180).optional() }),
  },
  "user.running_late": {
    key: "user.running_late",
    label: "Llegaré tarde",
    role: "user",
    payloadSchema: z.object({ delay_minutes: z.number().int().min(1).max(120) }),
  },
  "user.arrived": {
    key: "user.arrived",
    label: "He llegado",
    role: "user",
    nextThreadStatus: "awaiting_business",
    payloadSchema: z.object({ qr_code: z.string().optional() }),
  },
  "user.cancel": {
    key: "user.cancel",
    label: "Cancelar reserva",
    role: "user",
    nextThreadStatus: "closed",
    nextBookingStatus: "cancelled",
  },
};

// Quick replies sugeridos según estado del hilo y rol del actor
export function suggestionsFor(
  role: Role,
  threadStatus: string,
  bookingStatus: string,
): TemplateDef[] {
  const all = Object.values(TEMPLATES).filter((t) => t.role === role);
  if (bookingStatus === "cancelled" || bookingStatus === "completed") return [];
  if (role === "business") {
    if (bookingStatus === "pending") {
      return all.filter((t) =>
        ["business.confirm", "business.propose_slot", "business.decline"].includes(t.key),
      );
    }
    return all.filter((t) =>
      ["business.service_ready", "business.running_late"].includes(t.key),
    );
  }
  // user
  if (threadStatus === "awaiting_user" && bookingStatus === "pending") {
    // Hay una propuesta del negocio pendiente: la respuesta se da con los
    // botones inline de la propuesta, no desde el composer.
    return [];
  }
  if (bookingStatus === "confirmed") {
    return all.filter((t) =>
      ["user.on_my_way", "user.running_late", "user.arrived", "user.cancel"].includes(t.key),
    );
  }
  return all.filter((t) => ["user.cancel"].includes(t.key));
}
