import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  FIELD_LABELS,
  STATUS_LABELS,
  type CaseDetail,
  type ExtractionProposal,
} from "../api";

const DEFAULT_LLM_TEXT =
  "Bitte verknüpfen Sie das angehängte Original mit Fall AKM-DEMO-004 und liefern an die bestehende Pflegedienst-Adresse.\n\nMit freundlichen Grüßen\nDr. Musterpraxis Nord";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [llmText, setLlmText] = useState(DEFAULT_LLM_TEXT);
  const [proposal, setProposal] = useState<ExtractionProposal | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const d = await api.getCase(id);
      setDetail(d);
      setProposal(null);
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(eventType: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await api.transition(detail.case.id, eventType, detail.case.version);
      setDetail(updated);
    } catch (e) {
      setError((e as Error).message);
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
      setError((e as Error).message);
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
      setProposal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) {
    return <p className="text-rf-muted">Laden…</p>;
  }

  if (!detail) {
    return (
      <div>
        <p className="text-rf-danger">{error || "Fall nicht gefunden"}</p>
        <Link to="/" className="text-rf-accent mt-4 inline-block">Zurück zum Leitstand</Link>
      </div>
    );
  }

  const c = detail.case;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-rf-muted hover:text-rf-accent">← Leitstand</Link>
          <h1 className="font-display text-3xl mt-2">{c.external_id}</h1>
          <p className="text-rf-muted mt-1">
            {STATUS_LABELS[c.status] ?? c.status}
            {c.at_risk && <span className="text-rf-danger ml-2">· Gefährdet</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.transitionActions.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={busy}
              onClick={() => handleTransition(t.key)}
              className="px-3 py-2 text-sm rounded-lg border border-rf-border hover:bg-rf-surface-2 disabled:opacity-50 transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rf-danger/40 bg-rf-danger/10 px-4 py-3 text-rf-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-rf-border bg-rf-surface/40 p-5 space-y-4">
          <h2 className="font-semibold text-lg">Referenzen</h2>
          <dl className="grid gap-2 text-sm">
            {[
              ["Patient", c.patient_ref],
              ["Arztpraxis", c.physician_ref],
              ["Lieferziel", c.delivery_ref],
              ["Material", c.material_ref],
              ["Feldmitarbeiter", c.field_employee_ref],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-rf-border/40 pb-2">
                <dt className="text-rf-muted">{label}</dt>
                <dd className="font-mono text-xs">{val ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {detail.missingFields.length > 0 && (
            <div className="pt-2 space-y-3">
              <h3 className="text-sm font-medium text-rf-warn">Fehlende Daten ergänzen</h3>
              {detail.missingFields.map((f) => (
                <div key={f}>
                  <label className="text-xs text-rf-muted block mb-1">
                    {FIELD_LABELS[f] ?? f}
                  </label>
                  <input
                    className="w-full rounded-lg border border-rf-border bg-rf-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rf-accent/50"
                    value={fieldValues[f] ?? ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [f]: e.target.value }))
                    }
                    placeholder={`${FIELD_LABELS[f] ?? f} eingeben`}
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={handleMissingSave}
                className="px-4 py-2 text-sm rounded-lg bg-rf-accent text-white hover:bg-rf-accent-dim disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-rf-border bg-rf-surface/40 p-5">
          <h2 className="font-semibold text-lg mb-4">Zeitleiste</h2>
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {detail.events.length === 0 ? (
              <li className="text-rf-muted text-sm">Noch keine Ereignisse</li>
            ) : (
              detail.events.map((e) => (
                <li
                  key={e.id as string}
                  className="text-sm border-l-2 border-rf-accent/40 pl-3 py-1"
                >
                  <span className="font-medium">{e.event_type as string}</span>
                  <span className="text-rf-muted text-xs ml-2">{e.source as string}</span>
                  <p className="text-xs text-rf-muted mt-0.5">
                    {new Date(e.occurred_at as string).toLocaleString("de-DE")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-rf-accent/30 bg-rf-surface/60 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Unstrukturierten Text auswerten</h2>
          <p className="text-sm text-rf-muted mt-1">
            KI-Extraktion mit menschlicher Bestätigung — nur synthetische Demo-Daten
          </p>
        </div>
        <textarea
          className="w-full min-h-[120px] rounded-lg border border-rf-border bg-rf-bg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rf-accent/50"
          value={llmText}
          onChange={(e) => setLlmText(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={handleExtract}
          className="px-4 py-2 text-sm rounded-lg bg-rf-accent text-white hover:bg-rf-accent-dim disabled:opacity-50"
        >
          Text analysieren
        </button>

        {proposal && (
          <div className="rounded-lg border border-rf-border bg-rf-bg/80 p-4 space-y-3">
            <h3 className="font-medium">Vorschlag ({proposal.source})</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-rf-muted">Intent</dt>
                <dd>{proposal.intent}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-rf-muted">Fallreferenz</dt>
                <dd className="font-mono">{proposal.caseReference ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-rf-muted">Konfidenz</dt>
                <dd>{(proposal.confidence * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt className="text-rf-muted text-xs">Evidenz</dt>
                <dd className="mt-1 text-rf-muted">{proposal.evidence}</dd>
              </div>
            </dl>
            {proposal.requiresHumanReview && (
              <p className="text-xs text-rf-warn">Bestätigung erforderlich</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmExtract}
              className="px-4 py-2 text-sm rounded-lg border border-rf-accent text-rf-accent hover:bg-rf-accent/10 disabled:opacity-50"
            >
              Vorschlag bestätigen und anwenden
            </button>
          </div>
        )}
      </section>

      {detail.exceptions.some((ex) => !ex.resolved_at) && (
        <section className="rounded-xl border border-rf-warn/30 bg-rf-warn/5 p-5">
          <h2 className="font-semibold">Offene Ausnahmen</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {detail.exceptions
              .filter((ex) => !ex.resolved_at)
              .map((ex) => (
                <li key={ex.id as string} className="text-rf-warn">
                  {ex.reason as string}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
