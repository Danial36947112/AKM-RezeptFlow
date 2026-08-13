import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleAlert,
  ClipboardCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  DEMO_OWNERS,
  FIELD_LABELS,
  STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  type CaseDetail,
  type ExtractionProposal,
} from "../api";
import { ArmToConfirmButton } from "@/components/ArmToConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_LLM_TEXT =
  "Bitte verknüpfen Sie das angehängte Original mit Fall AKM-DEMO-004 und liefern an die bestehende Pflegedienst-Adresse.\n\nMit freundlichen Grüßen\nDr. Musterpraxis Nord";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [llmText, setLlmText] = useState(DEFAULT_LLM_TEXT);
  const [proposal, setProposal] = useState<ExtractionProposal | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const d = await api.getCase(id);
      setDetail(d);
      setProposal(null);
      setOwner(d.case.owner ?? "");
      const vals: Record<string, string> = {};
      if (!d.case.patient_ref) vals.patientRef = "";
      if (!d.case.physician_ref) vals.physicianRef = "";
      if (!d.case.delivery_ref) vals.deliveryRef = "";
      if (!d.case.material_ref) vals.materialRef = "";
      if (!d.case.field_employee_ref) vals.fieldEmployeeRef = "";
      setFieldValues(vals);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMissingSave() {
    if (!detail) return;
    setBusy(true);
    try {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(fieldValues)) {
        if (v) data[k] = v;
      }
      const updated = await api.updateMissingData(detail.case.id, detail.case.version, data);
      setDetail(updated);
      setOwner(updated.case.owner ?? "");
      toast.success("Fehlende Daten gespeichert");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(eventType: string, label: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await api.transition(detail.case.id, eventType, detail.case.version);
      setDetail(updated);
      setOwner(updated.case.owner ?? "");
      toast.success(`Status geändert: ${label}`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract() {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const p = await api.extract(detail.case.id, llmText);
      setProposal(p);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmExtract() {
    if (!detail || !proposal) return;
    setBusy(true);
    try {
      const updated = await api.confirmExtract(detail.case.id, detail.case.version, proposal);
      setDetail(updated);
      setOwner(updated.case.owner ?? "");
      setProposal(null);
      toast.success("Vorschlag angewendet");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignOwner() {
    if (!detail || !owner) return;
    setBusy(true);
    try {
      const updated = await api.assignOwner(detail.case.id, detail.case.version, owner);
      setDetail(updated);
      setOwner(updated.case.owner ?? "");
      toast.success("Zuständigkeit gespeichert");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleAcknowledge(exceptionId: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await api.acknowledgeException(
        detail.case.id,
        exceptionId,
        detail.case.version,
      );
      setDetail(updated);
      setOwner(updated.case.owner ?? "");
      toast.success("Ausnahme zur Kenntnis genommen");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) {
    return <p className="text-muted-foreground">Laden…</p>;
  }

  if (!detail) {
    return (
      <div>
        <p className="text-destructive">{error || "Fall nicht gefunden"}</p>
        <Link to="/" className="mt-4 inline-block text-primary">
          Zurück zum Leitstand
        </Link>
      </div>
    );
  }

  const c = detail.case;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Identity rail */}
      <aside className="space-y-6 lg:w-72 lg:shrink-0">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Leitstand
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            {c.external_id}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {STATUS_LABELS[c.status] ?? c.status}
            {c.at_risk && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <TriangleAlert className="size-3.5" strokeWidth={2} />
                Gefährdet
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner" className="text-xs text-muted-foreground">
            Zuständig
          </Label>
          <div className="flex gap-2">
            <select
              id="owner"
              value={owner}
              disabled={busy}
              onChange={(e) => setOwner(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {Array.from(new Set([...DEMO_OWNERS, c.owner].filter(Boolean) as string[])).map(
                (name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ),
              )}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !owner || owner === (c.owner ?? "")}
              onClick={handleAssignOwner}
            >
              Speichern
            </Button>
          </div>
        </div>

        {detail.transitionActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {detail.transitionActions.map((t) => (
              <ArmToConfirmButton
                key={t.key}
                label={t.label}
                disabled={busy}
                onConfirm={() => handleTransition(t.key, t.label)}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Referenzen
          </h2>
          <dl className="mt-2 divide-y divide-border">
            {[
              ["Patient", c.patient_ref],
              ["Arztpraxis", c.physician_ref],
              ["Lieferziel", c.delivery_ref],
              ["Material", c.material_ref],
              ["Feldmitarbeiter", c.field_employee_ref],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xs">{val ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Aufgaben
          </h2>
          {detail.tasks.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Keine Aufgaben</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {detail.tasks.map((task) => (
                <li key={task.id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{TASK_TYPE_LABELS[task.type] ?? task.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {TASK_STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.owner ?? "—"}
                    {task.due_at
                      ? ` · ${new Date(task.due_at).toLocaleString("de-DE")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {detail.missingFields.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-warn-foreground">
              <CircleAlert className="size-4" strokeWidth={2} />
              Fehlende Daten ergänzen
            </h3>
            {detail.missingFields.map((f) => (
              <div key={f} className="space-y-1">
                <Label htmlFor={f} className="text-xs text-muted-foreground">
                  {FIELD_LABELS[f] ?? f}
                </Label>
                <Input
                  id={f}
                  value={fieldValues[f] ?? ""}
                  onChange={(e) =>
                    setFieldValues((prev) => ({ ...prev, [f]: e.target.value }))
                  }
                  placeholder={`${FIELD_LABELS[f] ?? f} eingeben`}
                />
              </div>
            ))}
            <Button size="sm" disabled={busy} onClick={handleMissingSave}>
              Speichern
            </Button>
          </div>
        )}
      </aside>

      {/* Content column */}
      <div className="min-w-0 flex-1 space-y-6">
        <section className="rounded-lg border border-border">
          <h2 className="border-b border-border px-5 py-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Zeitleiste
          </h2>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto px-5">
            {detail.events.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">Noch keine Ereignisse</li>
            ) : (
              detail.events.map((e) => (
                <li key={e.id as string} className="py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{e.event_type as string}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(e.occurred_at as string).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.source as string}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4 text-primary" strokeWidth={2} />
              Unstrukturierten Text auswerten
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              KI-Extraktion mit menschlicher Bestätigung — nur synthetische Demo-Daten
            </p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={llmText}
              onChange={(e) => setLlmText(e.target.value)}
            />
            <Button disabled={busy} onClick={handleExtract}>
              Text analysieren
            </Button>

            {proposal && (
              <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
                <h3 className="font-medium">Vorschlag ({proposal.source})</h3>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Intent</dt>
                    <dd>{proposal.intent}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Fallreferenz</dt>
                    <dd className="font-mono">{proposal.caseReference ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Konfidenz</dt>
                    <dd className="font-mono tabular-nums">
                      {(proposal.confidence * 100).toFixed(0)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Evidenz</dt>
                    <dd className="mt-1 text-muted-foreground">{proposal.evidence}</dd>
                  </div>
                </dl>
                {proposal.requiresHumanReview && (
                  <p className="flex items-center gap-1.5 text-xs text-warn-foreground">
                    <CircleAlert className="size-3.5" strokeWidth={2} />
                    Bestätigung erforderlich
                  </p>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleConfirmExtract}
                >
                  <ClipboardCheck className="size-4" strokeWidth={2} />
                  Vorschlag bestätigen und anwenden
                </Button>
              </div>
            )}
          </div>
        </section>

        {detail.exceptions.some((ex) => !ex.resolved_at) && (
          <section className="rounded-lg border border-warn/40 bg-warn/5 p-5">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <TriangleAlert className="size-4 text-warn-foreground" strokeWidth={2} />
              Offene Ausnahmen
            </h2>
            <ul className="mt-2 space-y-2 text-sm">
              {detail.exceptions
                .filter((ex) => !ex.resolved_at)
                .map((ex) => (
                  <li key={ex.id} className="flex items-start justify-between gap-3">
                    <span className="text-warn-foreground">{ex.reason}</span>
                    <ArmToConfirmButton
                      label="Zur Kenntnis"
                      disabled={busy}
                      onConfirm={() => handleAcknowledge(ex.id)}
                    />
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
