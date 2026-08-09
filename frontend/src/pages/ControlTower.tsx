import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, STATUS_LABELS, type CaseRow, type Kpis } from "../api";

function ageHours(date: string): number {
  return (Date.now() - new Date(date).getTime()) / 3600_000;
}

function AgeBadge({ createdAt, atRisk }: { createdAt: string; atRisk: boolean }) {
  const h = ageHours(createdAt);
  const color =
    atRisk || h >= 24
      ? "bg-rf-danger/20 text-rf-danger border-rf-danger/30"
      : h >= 8
        ? "bg-rf-warn/20 text-rf-warn border-rf-warn/30"
        : "bg-rf-ok/15 text-rf-ok border-rf-ok/25";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>
      {h < 1 ? "<1h" : `${Math.floor(h)}h`}
    </span>
  );
}

export default function ControlTower() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [filter, setFilter] = useState<"all" | "exception" | "atRisk">("all");
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (filter === "exception") params.exception = "true";
      if (filter === "atRisk") params.atRisk = "true";
      const [c, k] = await Promise.all([api.getCases(params), api.getKpis()]);
      setCases(c);
      setKpis(k);
    } catch (e) {
      setCases([]);
      setKpis(null);
      setError(
        (e as Error).message ||
          "API nicht erreichbar — Backend auf Port 3001 starten (npm run dev:backend).",
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDemoEvent() {
    setActionMsg("Erzeuge Demo-Ereignis…");
    const res = await api.createDemoEvent("happy-path");
    setActionMsg(`Fall ${res.case.case.external_id} erstellt`);
    await load();
  }

  async function handleScanDue() {
    setActionMsg("Fällige Fälle prüfen…");
    const res = await api.scanDue();
    setActionMsg(`${res.scanned} geprüft, ${res.actions.length} Aktionen`);
    await load();
  }

  async function handleReset() {
    await api.resetDemo();
    setActionMsg("Demo-Daten zurückgesetzt");
    await load();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rf-danger/40 bg-rf-danger/10 px-4 py-3 text-rf-danger text-sm">
          {error}
        </div>
      )}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Offen", value: kpis.openCount },
            { label: "Gefährdet", value: kpis.atRiskCount, warn: true },
            { label: "Überfällig", value: kpis.overdueCount, warn: true },
            { label: "Heute erledigt", value: kpis.completedToday },
          ].map((k, i) => (
            <div
              key={k.label}
              className="rounded-xl border border-rf-border bg-rf-surface/60 p-4 backdrop-blur-sm animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-rf-muted text-xs uppercase tracking-wider">{k.label}</p>
              <p
                className={`text-2xl font-semibold mt-1 ${k.warn ? "text-rf-warn" : "text-rf-text"}`}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-rf-border bg-rf-surface/50 p-1">
          {(["all", "exception", "atRisk"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f ? "bg-rf-accent text-white" : "text-rf-muted hover:text-rf-text"
              }`}
            >
              {f === "all" ? "Alle" : f === "exception" ? "Ausnahmen" : "Gefährdet"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDemoEvent}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-rf-accent hover:bg-rf-accent-dim text-white transition-colors"
        >
          Demo-Ereignis erzeugen
        </button>
        <button
          type="button"
          onClick={handleScanDue}
          className="px-4 py-2 text-sm rounded-lg border border-rf-border hover:bg-rf-surface-2 transition-colors"
        >
          Fällige prüfen
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm rounded-lg border border-rf-border text-rf-muted hover:text-rf-text transition-colors"
        >
          Reset
        </button>
        {actionMsg && <span className="text-sm text-rf-muted">{actionMsg}</span>}
      </div>

      <div className="rounded-xl border border-rf-border bg-rf-surface/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rf-border text-rf-muted text-left">
              <th className="px-4 py-3 font-medium">Fall</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Alter</th>
              <th className="px-4 py-3 font-medium">Zuständig</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-rf-muted">Laden…</td>
              </tr>
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-rf-muted">
                  Keine Fälle für diesen Filter
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-rf-border/50 hover:bg-rf-surface-2/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/fall/${c.external_id}`} className="hover:text-rf-accent">
                      {c.external_id}
                    </Link>
                    {c.at_risk && (
                      <span className="ml-2 text-xs text-rf-danger">Gefährdet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[c.status] ?? c.status}</td>
                  <td className="px-4 py-3">
                    <AgeBadge createdAt={c.created_at} atRisk={c.at_risk} />
                  </td>
                  <td className="px-4 py-3 text-rf-muted">{c.owner ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/fall/${c.external_id}`}
                      className="text-rf-accent hover:underline text-sm"
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
