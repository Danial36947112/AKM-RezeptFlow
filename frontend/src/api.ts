const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface CaseRow {
  id: string;
  external_id: string;
  patient_ref: string | null;
  physician_ref: string | null;
  delivery_ref: string | null;
  material_ref: string | null;
  field_employee_ref: string | null;
  status: string;
  owner: string | null;
  at_risk: boolean;
  next_action_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail {
  case: CaseRow;
  events: Array<Record<string, unknown>>;
  tasks: FollowUpTask[];
  orders: Array<Record<string, unknown>>;
  exceptions: CaseException[];
  missingFields: string[];
  allowedTransitions: string[];
  transitionActions: Array<{ key: string; label: string; to: string }>;
}

export interface FollowUpTask {
  id: string;
  case_id: string;
  type: string;
  owner: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
}

export interface CaseException {
  id: string;
  case_id: string;
  reason: string;
  severity: string;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}

export interface Kpis {
  openCount: number;
  atRiskCount: number;
  overdueCount: number;
  completedToday: number;
  byStage: Record<string, number>;
  agingBuckets: { under8h: number; h8to24: number; over24h: number };
  firstPassCompleteness: number;
  deliveredWithinTarget: number;
  automationRate: number;
  openExceptions: number;
  exceptionReasons: Array<{ reason: string; count: number }>;
  medianStageHours: Record<string, number>;
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  getCases: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : "";
    return request<CaseRow[]>(`/api/cases${q}`);
  },
  getCase: (id: string) => request<CaseDetail>(`/api/cases/${id}`),
  getKpis: () => request<Kpis>("/api/kpis"),
  updateMissingData: (id: string, version: number, data: Record<string, string>) =>
    request<CaseDetail>(`/api/cases/${id}/missing-data`, {
      method: "PATCH",
      body: JSON.stringify({ version, data }),
    }),
  transition: (id: string, eventType: string, version: number) =>
    request<CaseDetail>(`/api/cases/${id}/transitions`, {
      method: "POST",
      body: JSON.stringify({ eventType, version }),
    }),
  extract: (id: string, text: string) =>
    request<ExtractionProposal>(`/api/cases/${id}/extract`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  confirmExtract: (id: string, version: number, proposal: ExtractionProposal) =>
    request<CaseDetail>(`/api/cases/${id}/extract/confirm`, {
      method: "POST",
      body: JSON.stringify({ version, proposal }),
    }),
  assignOwner: (id: string, version: number, owner: string) =>
    request<CaseDetail>(`/api/cases/${id}/owner`, {
      method: "PATCH",
      body: JSON.stringify({ version, owner }),
    }),
  acknowledgeException: (id: string, exceptionId: string, version: number) =>
    request<CaseDetail>(`/api/cases/${id}/exceptions/${exceptionId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  scanDue: () => request<{ scanned: number; actions: unknown[] }>("/api/demo/scan-due", { method: "POST" }),
  createDemoEvent: (template: "happy-path" | "incomplete") =>
    request<{ case: CaseDetail }>("/api/demo/create-event", {
      method: "POST",
      body: JSON.stringify({ template }),
    }),
  resetDemo: () => request<{ ok: boolean }>("/api/demo/reset", { method: "POST" }),
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: "Neu",
  INCOMPLETE: "Unvollständig",
  REQUEST_READY: "Anfrage bereit",
  AWAITING_ORIGINAL: "Original ausstehend",
  READY_TO_ORDER: "Bereit zur Bestellung",
  ORDERED: "Bestellt",
  SHIPPED: "Versendet",
  DELIVERED: "Geliefert",
  CANCELLED: "Storniert",
};

export const FIELD_LABELS: Record<string, string> = {
  patientRef: "Patientenreferenz",
  physicianRef: "Arztpraxis-Referenz",
  deliveryRef: "Lieferziel-Referenz",
  materialRef: "Materialgruppe",
  fieldEmployeeRef: "Feldmitarbeiter",
};

export const DEMO_OWNERS = ["Nora KRS", "Tim KRS", "Lea KRS"];

export const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up: "Nachfassen",
  missing_data: "Fehlende Daten",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  done: "Erledigt",
  cancelled: "Storniert",
};
