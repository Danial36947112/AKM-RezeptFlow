export const CASE_STATUSES = [
  "NEW",
  "INCOMPLETE",
  "REQUEST_READY",
  "AWAITING_ORIGINAL",
  "READY_TO_ORDER",
  "ORDERED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export type EventSource = "webhook" | "n8n" | "human" | "system" | "llm";

export interface PrescriptionCase {
  id: string;
  external_id: string;
  patient_ref: string | null;
  physician_ref: string | null;
  delivery_ref: string | null;
  material_ref: string | null;
  field_employee_ref: string | null;
  status: CaseStatus;
  owner: string | null;
  at_risk: boolean;
  next_action_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEvent {
  id: string;
  case_id: string;
  event_type: string;
  source: EventSource;
  idempotency_key: string | null;
  payload: string;
  occurred_at: string;
}

export interface FollowUpTask {
  id: string;
  case_id: string;
  type: string;
  owner: string | null;
  due_at: string | null;
  status: "open" | "done" | "cancelled";
  created_at: string;
}

export interface MaterialOrder {
  id: string;
  case_id: string;
  supplier_ref: string | null;
  status: string;
  ordered_at: string | null;
  delivered_at: string | null;
}

export interface Exception {
  id: string;
  case_id: string;
  reason: string;
  severity: "low" | "medium" | "high";
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}

export interface PrescriptionRequestPayload {
  sourceEventId: string;
  patientRef?: string;
  physicianRef?: string;
  deliveryRef?: string;
  materialRef?: string;
  fieldEmployeeRef?: string;
  idempotencyKey?: string;
}

export interface OrderStatusPayload {
  supplierRef: string;
  status: string;
  idempotencyKey?: string;
}

export interface ExtractionProposal {
  caseReference: string | null;
  intent: string;
  deliveryDestination: string | null;
  confidence: number;
  requiresHumanReview: boolean;
  evidence: string;
  source: "zen" | "fixture";
}

export const REQUIRED_FIELDS = [
  "patientRef",
  "physicianRef",
  "deliveryRef",
  "materialRef",
  "fieldEmployeeRef",
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export const FIELD_LABELS: Record<RequiredField, string> = {
  patientRef: "Patientenreferenz",
  physicianRef: "Arztpraxis-Referenz",
  deliveryRef: "Lieferziel-Referenz",
  materialRef: "Materialgruppe-Referenz",
  fieldEmployeeRef: "Feldmitarbeiter-Referenz",
};
