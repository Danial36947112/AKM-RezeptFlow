import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api, STATUS_LABELS, type Kpis } from "../api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const CHART_COLORS = ["#3d9a8b", "#4cb87a", "#e8a54b", "#5b8fd9", "#8b9cb3", "#e05c5c"];

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    api.getKpis().then(setKpis);
  }, []);

  if (!kpis) {
    return <p className="text-rf-muted">Kennzahlen laden…</p>;
  }

  const stageData = Object.entries(kpis.byStage).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    count,
  }));

  const agingData = [
    { name: "<8h", count: kpis.agingBuckets.under8h },
    { name: "8–24h", count: kpis.agingBuckets.h8to24 },
    { name: ">24h", count: kpis.agingBuckets.over24h },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Kennzahlen</h1>
        <p className="text-rf-muted mt-1">Operative Transparenz für KRS und Leitung</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Erstprüfung vollständig",
            value: `${(kpis.firstPassCompleteness * 100).toFixed(0)}%`,
          },
          {
            label: "Lieferung im Ziel",
            value: `${(kpis.deliveredWithinTarget * 100).toFixed(0)}%`,
          },
          {
            label: "Automatisierungsrate",
            value: `${(kpis.automationRate * 100).toFixed(0)}%`,
          },
          { label: "Offene Ausnahmen", value: kpis.openExceptions },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-rf-border bg-rf-surface/50 p-4"
          >
            <p className="text-xs text-rf-muted uppercase tracking-wider">{item.label}</p>
            <p className="text-2xl font-semibold mt-2">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-rf-border bg-rf-surface/40 p-5">
          <h2 className="font-semibold mb-4">Fälle nach Phase</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stageData}>
              <XAxis dataKey="name" tick={{ fill: "#8b9cb3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b9cb3", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#1a222d",
                  border: "1px solid #2e3d52",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stageData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-rf-border bg-rf-surface/40 p-5">
          <h2 className="font-semibold mb-4">Alter offener Fälle</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agingData}>
              <XAxis dataKey="name" tick={{ fill: "#8b9cb3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b9cb3", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#1a222d",
                  border: "1px solid #2e3d52",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" fill="#3d9a8b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {kpis.exceptionReasons.length > 0 && (
        <div className="rounded-xl border border-rf-border bg-rf-surface/40 p-5">
          <h2 className="font-semibold mb-3">Ausnahmeursachen</h2>
          <ul className="space-y-2 text-sm">
            {kpis.exceptionReasons.map((r) => (
              <li key={r.reason} className="flex justify-between border-b border-rf-border/40 pb-2">
                <span className="text-rf-muted">{r.reason}</span>
                <span>{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`${API_BASE}/api/kpis/export.csv`}
        className="inline-flex px-4 py-2 text-sm rounded-lg border border-rf-border hover:bg-rf-surface-2 transition-colors"
      >
        CSV exportieren
      </a>
    </div>
  );
}
