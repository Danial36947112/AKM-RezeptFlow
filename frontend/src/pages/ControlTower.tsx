import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { api, STATUS_LABELS, type CaseRow, type Kpis } from "../api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ageHours(date: string): number {
  return (Date.now() - new Date(date).getTime()) / 3600_000;
}

function AgeBadge({ createdAt, atRisk }: { createdAt: string; atRisk: boolean }) {
  const h = ageHours(createdAt);
  const color =
    atRisk || h >= 24
      ? "border-destructive/30 text-destructive"
      : h >= 8
        ? "border-warn/40 text-warn-foreground"
        : "border-ok/35 text-ok-foreground";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${color}`}>
      {h < 1 ? "<1h" : `${Math.floor(h)}h`}
    </span>
  );
}

const columns: ColumnDef<CaseRow>[] = [
  {
    accessorKey: "external_id",
    header: "Fall",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 font-mono text-sm font-medium">
        {row.original.external_id}
        {row.original.at_risk && (
          <TriangleAlert className="size-3.5 text-destructive" strokeWidth={2} />
        )}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue<string>();
      return STATUS_LABELS[status] ?? status;
    },
  },
  {
    id: "age",
    header: "Alter",
    accessorFn: (row) => ageHours(row.created_at),
    cell: ({ row }) => (
      <AgeBadge createdAt={row.original.created_at} atRisk={row.original.at_risk} />
    ),
  },
  {
    accessorKey: "owner",
    header: "Zuständig",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    id: "open",
    header: "",
    enableSorting: false,
    cell: () => <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2} />,
  },
];

export default function ControlTower() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [filter, setFilter] = useState<"all" | "exception" | "atRisk">("all");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loading, setLoading] = useState(true);
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

  const table = useReactTable({
    data: cases,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const needle = String(value).toLowerCase();
      const r = row.original as CaseRow;
      return (
        r.external_id.toLowerCase().includes(needle) ||
        (r.owner ?? "").toLowerCase().includes(needle) ||
        (STATUS_LABELS[r.status] ?? r.status).toLowerCase().includes(needle)
      );
    },
  });

  async function handleDemoEvent() {
    const t = toast.loading("Erzeuge Demo-Ereignis…");
    try {
      const res = await api.createDemoEvent("happy-path");
      toast.success(`Fall ${res.case.case.external_id} erstellt`, { id: t });
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Demo-Ereignis fehlgeschlagen", { id: t });
    }
  }

  async function handleScanDue() {
    const t = toast.loading("Fällige Fälle prüfen…");
    try {
      const res = await api.scanDue();
      toast.success(`${res.scanned} geprüft, ${res.actions.length} Aktionen`, { id: t });
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Prüfung fehlgeschlagen", { id: t });
    }
  }

  async function handleReset() {
    try {
      await api.resetDemo();
      toast.success("Demo-Daten zurückgesetzt");
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Reset fehlgeschlagen");
    }
  }

  const stats = kpis
    ? [
        { label: "Offen", value: kpis.openCount },
        { label: "Gefährdet", value: kpis.atRiskCount, warn: true },
        { label: "Überfällig", value: kpis.overdueCount, warn: true },
        { label: "Heute erledigt", value: kpis.completedToday },
      ]
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {stats.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-border pb-4 text-sm">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  s.warn ? "text-warn-foreground" : "text-foreground"
                }`}
              >
                {s.value}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          {(["all", "exception", "atRisk"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-[5px] px-3 py-1.5 text-sm transition-colors active:scale-[0.98] ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Alle" : f === "exception" ? "Ausnahmen" : "Gefährdet"}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche…"
            className="w-40 pl-8"
          />
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={handleDemoEvent}>
            <PlayCircle className="size-4" strokeWidth={2} />
            Demo-Ereignis
          </Button>
          <Button variant="outline" onClick={handleScanDue}>
            <RefreshCw className="size-4" strokeWidth={2} />
            Fällige prüfen
          </Button>
          <ConfirmDialog
            title="Demo-Daten zurücksetzen?"
            description="Alle Fälle, Ereignisse und Ausnahmen werden auf den Ausgangszustand zurückgesetzt. Dies kann nicht rückgängig gemacht werden."
            confirmLabel="Zurücksetzen"
            onConfirm={handleReset}
            trigger={
              <Button variant="outline">
                <RotateCcw className="size-4" strokeWidth={2} />
                Reset
              </Button>
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  Laden…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  Keine Fälle für diesen Filter
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  onClick={() => navigate(`/fall/${row.original.external_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/fall/${row.original.external_id}`);
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
