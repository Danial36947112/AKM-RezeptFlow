export interface CrmCase {
  id: string;
  externalId: string;
  status: string;
  patientRef?: string;
}

export interface PrescriptionCaseInput {
  externalId: string;
  patientRef?: string;
  physicianRef?: string;
  deliveryRef?: string;
  materialRef?: string;
  fieldEmployeeRef?: string;
  status: string;
}

export interface CrmTaskInput {
  caseId: string;
  subject: string;
  owner?: string;
  dueAt?: string;
}

export interface TimelineEvent {
  caseId: string;
  eventType: string;
  description: string;
  occurredAt: string;
}

export interface CrmAdapter {
  findCaseByExternalId(externalId: string): Promise<CrmCase | null>;
  upsertPrescriptionCase(input: PrescriptionCaseInput): Promise<CrmCase>;
  createTask(input: CrmTaskInput): Promise<{ id: string }>;
  appendTimelineEvent(caseId: string, event: TimelineEvent): Promise<void>;
}
