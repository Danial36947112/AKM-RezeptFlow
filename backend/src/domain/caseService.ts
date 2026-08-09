import type { AppDatabase } from "../db/index.js";
import { randomUUID } from "node:crypto";
import type { CrmAdapter } from "../adapters/crm/types.js";
import type { LlmExtractor } from "../adapters/llm/types.js";
import {
  canTransition,
  getAllowedTransitions,
  transitionForEvent,
  TRANSITION_EVENTS,
} from "../domain/stateMachine.js";
import type {
  CaseStatus,
  EventSource,
  ExtractionProposal,
  PrescriptionCase,
  PrescriptionRequestPayload,
  OrderStatusPayload,
  RequiredField,
  REQUIRED_FIELDS,
} from "../domain/types.js";
import { config } from "../config.js";

function now(): string {
  return new Date().toISOString();
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export class CaseService {
  constructor(
    private db: AppDatabase,
    private crm: CrmAdapter,
    private llm: LlmExtractor,
  ) {}

  private mapCase(row: Record<string, unknown>): PrescriptionCase {
    return {
      id: row.id as string,
      external_id: row.external_id as string,
      patient_ref: row.patient_ref as string | null,
      physician_ref: row.physician_ref as string | null,
      delivery_ref: row.delivery_ref as string | null,
      material_ref: row.material_ref as string | null,
      field_employee_ref: row.field_employee_ref as string | null,
      status: row.status as CaseStatus,
      owner: row.owner as string | null,
      at_risk: Boolean(row.at_risk),
      next_action_at: row.next_action_at as string | null,
      version: row.version as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  getMissingFields(caseRow: PrescriptionCase): RequiredField[] {
    const missing: RequiredField[] = [];
    if (!caseRow.patient_ref) missing.push("patientRef");
    if (!caseRow.physician_ref) missing.push("physicianRef");
    if (!caseRow.delivery_ref) missing.push("deliveryRef");
    if (!caseRow.material_ref) missing.push("materialRef");
    if (!caseRow.field_employee_ref) missing.push("fieldEmployeeRef");
    return missing;
  }

  private recordEvent(
    caseId: string,
    eventType: string,
    source: EventSource,
    payload: unknown,
    idempotencyKey?: string | null,
  ): string | null {
    if (idempotencyKey) {
      const existing = this.db
        .prepare("SELECT id FROM workflow_events WHERE idempotency_key = ?")
        .get(idempotencyKey) as { id: string } | undefined;
      if (existing) return null;
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO workflow_events (id, case_id, event_type, source, idempotency_key, payload, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, caseId, eventType, source, idempotencyKey ?? null, JSON.stringify(payload), now());

  void this.crm.appendTimelineEvent(caseId, {
      caseId,
      eventType,
      description: eventType,
      occurredAt: now(),
    });

    return id;
  }

  listCases(filters: {
    status?: string;
    atRisk?: boolean;
    exception?: boolean;
    owner?: string;
  } = {}): PrescriptionCase[] {
    let sql = "SELECT * FROM prescription_cases WHERE 1=1";
    const params: (string | number)[] = [];

    if (filters.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.atRisk) {
      sql += " AND at_risk = 1";
    }
    if (filters.owner) {
      sql += " AND owner = ?";
      params.push(filters.owner);
    }
    if (filters.exception) {
      sql += ` AND id IN (SELECT case_id FROM exceptions WHERE resolved_at IS NULL)`;
    }

    sql += " ORDER BY next_action_at IS NULL, next_action_at ASC, updated_at DESC";
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapCase(r));
  }

  getCaseById(id: string) {
    const row = this.db
      .prepare("SELECT * FROM prescription_cases WHERE id = ? OR external_id = ?")
      .get(id, id) as Record<string, unknown> | undefined;
    if (!row) return null;

    const caseData = this.mapCase(row);
    const events = this.db
      .prepare("SELECT * FROM workflow_events WHERE case_id = ? ORDER BY occurred_at ASC")
      .all(caseData.id) as Array<Record<string, unknown>>;
    const tasks = this.db
      .prepare("SELECT * FROM follow_up_tasks WHERE case_id = ? ORDER BY created_at DESC")
      .all(caseData.id);
    const orders = this.db
      .prepare("SELECT * FROM material_orders WHERE case_id = ?")
      .all(caseData.id);
    const exceptions = this.db
      .prepare("SELECT * FROM exceptions WHERE case_id = ? ORDER BY created_at DESC")
      .all(caseData.id);

    return {
      case: caseData,
      events,
      tasks,
      orders,
      exceptions,
      missingFields: this.getMissingFields(caseData),
      allowedTransitions: getAllowedTransitions(caseData.status),
      transitionActions: Object.entries(TRANSITION_EVENTS)
        .filter(([, v]) => getAllowedTransitions(caseData.status).includes(v.to))
        .map(([key, v]) => ({ key, label: v.label, to: v.to })),
    };
  }

  async handlePrescriptionRequest(payload: PrescriptionRequestPayload) {
    const idempotencyKey =
      payload.idempotencyKey ?? `prescription-${payload.sourceEventId}`;
    const existingEvent = this.db
      .prepare("SELECT case_id FROM workflow_events WHERE idempotency_key = ?")
      .get(idempotencyKey) as { case_id: string } | undefined;

    if (existingEvent) {
      const existing = this.getCaseById(existingEvent.case_id);
      return { duplicate: true, case: existing };
    }

    const externalId = payload.sourceEventId.startsWith("AKM-")
      ? payload.sourceEventId
      : `AKM-${payload.sourceEventId}`;

    let caseRow = this.db
      .prepare("SELECT * FROM prescription_cases WHERE external_id = ?")
      .get(externalId) as Record<string, unknown> | undefined;

    const timestamp = now();
    const caseId = caseRow ? (caseRow.id as string) : randomUUID();

    if (!caseRow) {
      this.db
        .prepare(
          `INSERT INTO prescription_cases (
            id, external_id, patient_ref, physician_ref, delivery_ref, material_ref,
            field_employee_ref, status, owner, at_risk, next_action_at, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', 'Nora KRS', 0, ?, 1, ?, ?)`,
        )
        .run(
          caseId,
          externalId,
          payload.patientRef ?? null,
          payload.physicianRef ?? null,
          payload.deliveryRef ?? null,
          payload.materialRef ?? null,
          payload.fieldEmployeeRef ?? null,
          hoursFromNow(config.reminderHours),
          timestamp,
          timestamp,
        );
      caseRow = this.db
        .prepare("SELECT * FROM prescription_cases WHERE id = ?")
        .get(caseId) as Record<string, unknown>;
    }

    const mapped = this.mapCase(caseRow);
    const missing = this.getMissingFields(mapped);
    let newStatus: CaseStatus = mapped.status;

    if (missing.length > 0) {
      newStatus = "INCOMPLETE";
      this.createException(caseId, `Fehlende Felder: ${missing.join(", ")}`, "high");
      await this.crm.createTask({
        caseId: externalId,
        subject: "Unvollständige Rezeptanfrage prüfen",
        owner: "Nora KRS",
        dueAt: hoursFromNow(4),
      });
    } else if (mapped.status === "NEW" || mapped.status === "INCOMPLETE") {
      newStatus = "REQUEST_READY";
      this.resolveOpenExceptions(caseId, "Automatisch vollständig");
    }

    this.updateCaseStatus(caseId, newStatus, mapped.version);

    await this.crm.upsertPrescriptionCase({
      externalId,
      patientRef: payload.patientRef ?? mapped.patient_ref ?? undefined,
      physicianRef: payload.physicianRef ?? mapped.physician_ref ?? undefined,
      deliveryRef: payload.deliveryRef ?? mapped.delivery_ref ?? undefined,
      materialRef: payload.materialRef ?? mapped.material_ref ?? undefined,
      fieldEmployeeRef: payload.fieldEmployeeRef ?? mapped.field_employee_ref ?? undefined,
      status: newStatus,
    });

    this.recordEvent(caseId, "PRESCRIPTION_REQUESTED", "webhook", payload, idempotencyKey);

    return { duplicate: false, case: this.getCaseById(caseId) };
  }

  async handleOrderStatus(payload: OrderStatusPayload, supplierSecret?: string) {
    if (supplierSecret && supplierSecret !== config.orderWebhookSecret) {
      throw new Error("Invalid webhook secret");
    }

    const idempotencyKey = payload.idempotencyKey ?? `order-${payload.supplierRef}-${payload.status}`;
    const dup = this.db
      .prepare("SELECT id FROM workflow_events WHERE idempotency_key = ?")
      .get(idempotencyKey);
    if (dup) return { duplicate: true };

    const order = this.db
      .prepare("SELECT * FROM material_orders WHERE supplier_ref = ?")
      .get(payload.supplierRef) as Record<string, unknown> | undefined;

    let caseId: string | undefined;
    if (order) {
      caseId = order.case_id as string;
    } else {
      const caseRow = this.db
        .prepare(
          `SELECT pc.* FROM prescription_cases pc
           JOIN material_orders mo ON mo.case_id = pc.id
           WHERE mo.supplier_ref = ?`,
        )
        .get(payload.supplierRef) as Record<string, unknown> | undefined;
      caseId = caseRow?.id as string | undefined;
    }

    if (!caseId) {
      const openCase = this.db
        .prepare("SELECT id FROM prescription_cases WHERE status = 'ORDERED' LIMIT 1")
        .get() as { id: string } | undefined;
      caseId = openCase?.id;
    }

    if (!caseId) {
      throw new Error("No matching case for supplier reference");
    }

    const caseData = this.mapCase(
      this.db.prepare("SELECT * FROM prescription_cases WHERE id = ?").get(caseId) as Record<
        string,
        unknown
      >,
    );

    const statusLower = payload.status.toLowerCase();
    let eventType = "ORDER_STATUS_CHANGED";
    let targetStatus: CaseStatus | null = null;

    if (statusLower.includes("ship") || statusLower === "shipped") {
      eventType = "SHIPMENT_CONFIRMED";
      targetStatus = "SHIPPED";
    } else if (statusLower.includes("deliver") || statusLower === "delivered") {
      eventType = "DELIVERY_REPORTED";
      targetStatus = "SHIPPED";
    } else if (statusLower.includes("confirm")) {
      eventType = "ORDER_CONFIRMED";
    }

    if (targetStatus && canTransition(caseData.status, targetStatus)) {
      this.updateCaseStatus(caseId, targetStatus, caseData.version);
    }

    this.db
      .prepare(
        `UPDATE material_orders SET status = ? WHERE case_id = ?
         OR id = (SELECT id FROM material_orders WHERE case_id = ? LIMIT 1)`,
      )
      .run(payload.status, caseId, caseId);

    this.recordEvent(caseId, eventType, "webhook", payload, idempotencyKey);
    return { duplicate: false, case: this.getCaseById(caseId) };
  }

  updateMissingData(
    caseId: string,
    data: Partial<Record<RequiredField, string>>,
    version: number,
  ) {
    const row = this.db
      .prepare("SELECT * FROM prescription_cases WHERE id = ? OR external_id = ?")
      .get(caseId, caseId) as Record<string, unknown> | undefined;
    if (!row) throw new Error("Case not found");
    if ((row.version as number) !== version) throw new Error("Version conflict");

    const fieldMap: Record<RequiredField, string> = {
      patientRef: "patient_ref",
      physicianRef: "physician_ref",
      deliveryRef: "delivery_ref",
      materialRef: "material_ref",
      fieldEmployeeRef: "field_employee_ref",
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [key, col] of Object.entries(fieldMap)) {
      const val = data[key as RequiredField];
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) throw new Error("No fields to update");

    updates.push("updated_at = ?");
    updates.push("version = version + 1");
    const rowId = row.id as string;
    values.push(now());
    values.push(rowId);

    this.db
      .prepare(`UPDATE prescription_cases SET ${updates.join(", ")} WHERE id = ? AND version = ?`)
      .run(...values, version);

    const updated = this.mapCase(
      this.db.prepare("SELECT * FROM prescription_cases WHERE id = ?").get(rowId) as Record<
        string,
        unknown
      >,
    );

    const missing = this.getMissingFields(updated);
    if (missing.length === 0 && updated.status === "INCOMPLETE") {
      this.updateCaseStatus(rowId, "REQUEST_READY", updated.version + 1);
      this.resolveOpenExceptions(rowId, "Daten ergänzt");
    }

    this.recordEvent(rowId, "MISSING_DATA_UPDATED", "human", data);
    return this.getCaseById(rowId);
  }

  applyTransition(caseId: string, eventType: string, version: number, source: EventSource = "human") {
    const row = this.db
      .prepare("SELECT * FROM prescription_cases WHERE id = ? OR external_id = ?")
      .get(caseId, caseId) as Record<string, unknown> | undefined;
    if (!row) throw new Error("Case not found");
    if ((row.version as number) !== version) throw new Error("Version conflict");

    const current = this.mapCase(row);
    const target = transitionForEvent(eventType);
    if (!target || !canTransition(current.status, target)) {
      throw new Error(`Transition ${eventType} not allowed from ${current.status}`);
    }

    const internalCaseId = row.id as string;

    this.updateCaseStatus(internalCaseId, target, current.version);

    if (eventType === "PLACE_ORDER") {
      const orderId = randomUUID();
      this.db
        .prepare(
          `INSERT INTO material_orders (id, case_id, supplier_ref, status, ordered_at)
           VALUES (?, ?, ?, 'ordered', ?)`,
        )
        .run(orderId, internalCaseId, `SUP-${Date.now()}`, now());
    }

    if (eventType === "CONFIRM_DELIVERY") {
      this.db
        .prepare(
          `UPDATE material_orders SET status = 'delivered', delivered_at = ? WHERE case_id = ?`,
        )
        .run(now(), internalCaseId);
      this.resolveOpenExceptions(internalCaseId, "Lieferung bestätigt");
    }

    if (eventType === "CANCEL") {
      this.resolveOpenExceptions(internalCaseId, "Storniert");
    }

    this.recordEvent(internalCaseId, eventType, source, { eventType });

    void this.crm.upsertPrescriptionCase({
      externalId: current.external_id,
      status: target,
      patientRef: current.patient_ref ?? undefined,
    });

    return this.getCaseById(internalCaseId);
  }

  scanDueCases() {
    const due = this.db
      .prepare(
        `SELECT * FROM prescription_cases
         WHERE next_action_at IS NOT NULL AND next_action_at <= ?
         AND status NOT IN ('DELIVERED', 'CANCELLED')`,
      )
      .all(now()) as Record<string, unknown>[];

    const results: Array<{ caseId: string; action: string }> = [];

    for (const row of due) {
      const caseData = this.mapCase(row);
      const caseId = caseData.id;
      const reminderKey = `reminder-${caseId}-${new Date().toISOString().slice(0, 13)}`;
      const existingReminder = this.db
        .prepare("SELECT id FROM workflow_events WHERE idempotency_key = ?")
        .get(reminderKey);

      if (!existingReminder) {
        this.recordEvent(caseId, "REMINDER_CREATED", "system", { caseId }, reminderKey);
        this.db
          .prepare(
            `INSERT INTO follow_up_tasks (id, case_id, type, owner, due_at, status, created_at)
             VALUES (?, ?, 'follow_up', ?, ?, 'open', ?)`,
          )
          .run(randomUUID(), caseId, caseData.owner ?? "Nora KRS", hoursFromNow(4), now());
        results.push({ caseId, action: "reminder" });
      }

      const createdAt = new Date(caseData.created_at).getTime();
      const hoursElapsed = (Date.now() - createdAt) / 3600_000;
      if (hoursElapsed >= config.escalationHours && !caseData.at_risk) {
        this.db
          .prepare("UPDATE prescription_cases SET at_risk = 1, updated_at = ? WHERE id = ?")
          .run(now(), caseId);
        this.createException(caseId, "Schwellenwert überschritten — Eskalation", "high");
        this.recordEvent(caseId, "ESCALATED_AT_RISK", "system", { hoursElapsed });
        results.push({ caseId, action: "escalated" });
      }
    }

    return { scanned: due.length, actions: results };
  }

  getDueCases() {
    return this.listCases().filter(
      (c) =>
        c.next_action_at &&
        new Date(c.next_action_at) <= new Date() &&
        c.status !== "DELIVERED" &&
        c.status !== "CANCELLED",
    );
  }

  async extractFromText(caseId: string, text: string): Promise<ExtractionProposal> {
    const detail = this.getCaseById(caseId);
    if (!detail) throw new Error("Case not found");
    return this.llm.extract(text, detail.case.external_id);
  }

  confirmExtraction(caseId: string, proposal: ExtractionProposal, version: number) {
    const intentMap: Record<string, string> = {
      ORIGINAL_PRESCRIPTION_RECEIVED: "ORIGINAL_RECEIVED",
      CONFIRM_DELIVERY: "CONFIRM_DELIVERY",
      PLACE_ORDER: "PLACE_ORDER",
      CANCEL: "CANCEL",
    };
    const eventType = intentMap[proposal.intent] ?? proposal.intent;
    this.recordEvent(
      this.getCaseById(caseId)!.case.id,
      "LLM_EXTRACTION_CONFIRMED",
      "llm",
      proposal,
    );
    return this.applyTransition(caseId, eventType, version, "llm");
  }

  createDemoEvent(template: "happy-path" | "incomplete") {
    const id = template === "happy-path" ? `AKM-DEMO-016-${Date.now()}` : `AKM-DEMO-NEW-${Date.now()}`;
    const payload: PrescriptionRequestPayload =
      template === "happy-path"
        ? {
            sourceEventId: id,
            patientRef: "PAT-DEMO-016",
            physicianRef: "PRAX-DEMO-NORD",
            deliveryRef: "LIEF-DEMO-PFLEGE",
            materialRef: "MAT-WUNDVERBAND-A",
            fieldEmployeeRef: "FM-DEMO-03",
            idempotencyKey: `demo-${Date.now()}`,
          }
        : {
            sourceEventId: id,
            patientRef: "PAT-DEMO-NEW",
            deliveryRef: "LIEF-DEMO-X",
            materialRef: "MAT-WUNDVERBAND-B",
            fieldEmployeeRef: "FM-DEMO-01",
            idempotencyKey: `demo-incomplete-${Date.now()}`,
          };

    return this.handlePrescriptionRequest(payload);
  }

  private updateCaseStatus(caseId: string, status: CaseStatus, expectedVersion: number) {
    const result = this.db
      .prepare(
        `UPDATE prescription_cases SET status = ?, updated_at = ?, version = version + 1,
         next_action_at = ? WHERE id = ? AND version = ?`,
      )
      .run(status, now(), hoursFromNow(config.reminderHours), caseId, expectedVersion);
    if (result.changes === 0) throw new Error("Version conflict on status update");
  }

  private createException(caseId: string, reason: string, severity: "low" | "medium" | "high") {
    const open = this.db
      .prepare(
        "SELECT id FROM exceptions WHERE case_id = ? AND reason = ? AND resolved_at IS NULL",
      )
      .get(caseId, reason);
    if (open) return;

    this.db
      .prepare(
        `INSERT INTO exceptions (id, case_id, reason, severity, resolved_at, resolution, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      )
      .run(randomUUID(), caseId, reason, severity, now());
  }

  private resolveOpenExceptions(caseId: string, resolution: string) {
    this.db
      .prepare(
        `UPDATE exceptions SET resolved_at = ?, resolution = ?
         WHERE case_id = ? AND resolved_at IS NULL`,
      )
      .run(now(), resolution, caseId);
  }

  getKpis() {
    const cases = this.listCases();
    const open = cases.filter((c) => !["DELIVERED", "CANCELLED"].includes(c.status));
    const atRisk = cases.filter((c) => c.at_risk);
    const overdue = this.getDueCases();

    const byStage: Record<string, number> = {};
    for (const c of cases) {
      byStage[c.status] = (byStage[c.status] ?? 0) + 1;
    }

    const events = this.db
      .prepare("SELECT * FROM workflow_events ORDER BY occurred_at ASC")
      .all() as Array<Record<string, unknown>>;

    const automated = events.filter((e) =>
      ["webhook", "system", "n8n", "llm"].includes(e.source as string),
    ).length;
    const human = events.filter((e) => e.source === "human").length;
    const automationRate = events.length ? automated / events.length : 0;

    const delivered = cases.filter((c) => c.status === "DELIVERED");
    const withinTarget = delivered.filter((c) => {
      const created = new Date(c.created_at).getTime();
      const updated = new Date(c.updated_at).getTime();
      return (updated - created) / 3600_000 <= config.deliveryTargetHours;
    });

    const openExceptions = this.db
      .prepare("SELECT COUNT(*) as c FROM exceptions WHERE resolved_at IS NULL")
      .get() as { c: number };

    const incompleteCount = cases.filter((c) => c.status === "INCOMPLETE").length;
    const firstPassCompleteness =
      cases.length > 0 ? (cases.length - incompleteCount) / cases.length : 1;

    return {
      openCount: open.length,
      atRiskCount: atRisk.length,
      overdueCount: overdue.length,
      completedToday: delivered.filter(
        (c) => c.updated_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
      ).length,
      byStage,
      agingBuckets: {
        under8h: open.filter(
          (c) => Date.now() - new Date(c.created_at).getTime() < 8 * 3600_000,
        ).length,
        h8to24: open.filter((c) => {
          const h = (Date.now() - new Date(c.created_at).getTime()) / 3600_000;
          return h >= 8 && h < 24;
        }).length,
        over24h: open.filter(
          (c) => Date.now() - new Date(c.created_at).getTime() >= 24 * 3600_000,
        ).length,
      },
      firstPassCompleteness,
      deliveredWithinTarget:
        delivered.length > 0 ? withinTarget.length / delivered.length : 0,
      automationRate,
      openExceptions: openExceptions.c,
      exceptionReasons: this.db
        .prepare(
          `SELECT reason, COUNT(*) as count FROM exceptions
           WHERE resolved_at IS NULL GROUP BY reason`,
        )
        .all(),
      medianStageHours: this.computeMedianStageHours(),
    };
  }

  private computeMedianStageHours(): Record<string, number> {
    const result: Record<string, number> = {};
    const statuses = [
      "REQUEST_READY",
      "AWAITING_ORIGINAL",
      "READY_TO_ORDER",
      "ORDERED",
      "SHIPPED",
      "DELIVERED",
    ];

    for (const status of statuses) {
      const casesAtStatus = this.db
        .prepare("SELECT created_at, updated_at FROM prescription_cases WHERE status = ?")
        .all(status) as Array<{ created_at: string; updated_at: string }>;
      if (!casesAtStatus.length) continue;
      const hours = casesAtStatus.map(
        (c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 3600_000,
      );
      hours.sort((a, b) => a - b);
      result[status] = hours[Math.floor(hours.length / 2)];
    }
    return result;
  }

  exportKpisCsv(): string {
    const kpis = this.getKpis();
    const lines = [
      "metric,value",
      `openCount,${kpis.openCount}`,
      `atRiskCount,${kpis.atRiskCount}`,
      `overdueCount,${kpis.overdueCount}`,
      `completedToday,${kpis.completedToday}`,
      `firstPassCompleteness,${kpis.firstPassCompleteness}`,
      `deliveredWithinTarget,${kpis.deliveredWithinTarget}`,
      `automationRate,${kpis.automationRate}`,
      `openExceptions,${kpis.openExceptions}`,
    ];
    for (const [stage, count] of Object.entries(kpis.byStage)) {
      lines.push(`stage_${stage},${count}`);
    }
    return lines.join("\n");
  }
}

export { hoursAgo, hoursFromNow };
