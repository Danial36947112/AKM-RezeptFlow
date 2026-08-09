import type { CaseStatus } from "./types.js";

const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["INCOMPLETE", "REQUEST_READY", "CANCELLED"],
  INCOMPLETE: ["REQUEST_READY", "CANCELLED"],
  REQUEST_READY: ["AWAITING_ORIGINAL", "CANCELLED"],
  AWAITING_ORIGINAL: ["READY_TO_ORDER", "CANCELLED"],
  READY_TO_ORDER: ["ORDERED", "CANCELLED"],
  ORDERED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: CaseStatus): CaseStatus[] {
  return TRANSITIONS[status] ?? [];
}

export const TRANSITION_EVENTS: Record<string, { to: CaseStatus; label: string }> = {
  MARK_REQUEST_READY: { to: "REQUEST_READY", label: "Anfrage bereit" },
  SEND_REQUEST: { to: "AWAITING_ORIGINAL", label: "Anfrage gesendet" },
  ORIGINAL_RECEIVED: { to: "READY_TO_ORDER", label: "Original erhalten" },
  PLACE_ORDER: { to: "ORDERED", label: "Bestellung aufgegeben" },
  CONFIRM_SHIPMENT: { to: "SHIPPED", label: "Versand bestätigt" },
  CONFIRM_DELIVERY: { to: "DELIVERED", label: "Lieferung bestätigt" },
  CANCEL: { to: "CANCELLED", label: "Stornieren" },
};

export function transitionForEvent(eventType: string): CaseStatus | null {
  return TRANSITION_EVENTS[eventType]?.to ?? null;
}
