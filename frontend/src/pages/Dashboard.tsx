import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Download } from "lucide-react";
import { api, STATUS_LABELS, type Kpis } from "../api";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const chartConfig = {
  count: { label: "Fälle", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    api.getKpis().then(setKpis);
  }, []);

  if (!kpis) {
    return <p className="text-muted-foreground">Kennzahlen laden…</p>;
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

  const stats = [
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Kennzahlen</h1>
        <p className="mt-1 text-muted-foreground">Operative Transparenz für KRS und Leitung</p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-border pb-4 text-sm">
        {stats.map((item) => (
          <div key={item.label} className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-semibold tabular-nums">{item.value}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Fälle nach Phase
        </h2>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <BarChart data={stageData} margin={{ left: 28, right: 12, bottom: 24 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={96}
              fontFamily="var(--font-mono)"
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={2} maxBarSize={56} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Alter offener Fälle
          </h2>
          <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
            <BarChart data={agingData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                fontFamily="var(--font-mono)"
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={2} maxBarSize={56} />
            </BarChart>
          </ChartContainer>
        </div>

        {kpis.exceptionReasons.length > 0 && (
          <div className="rounded-lg border border-border">
            <h2 className="border-b border-border px-5 py-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Ausnahmeursachen
            </h2>
            <ul className="divide-y divide-border px-5">
              {kpis.exceptionReasons.map((r) => (
                <li key={r.reason} className="flex justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{r.reason}</span>
                  <span className="font-mono tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Button variant="outline" asChild>
        <a href={`${API_BASE}/api/kpis/export.csv`}>
          <Download className="size-4" strokeWidth={2} />
          CSV exportieren
        </a>
      </Button>
    </div>
  );
}
