import { NavLink, Outlet } from "react-router-dom";
import { Gauge, LineChart } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Mark } from "@/components/Mark";

const NAV_ITEMS = [
  { to: "/", label: "Leitstand", icon: Gauge },
  { to: "/kennzahlen", label: "Kennzahlen", icon: LineChart },
];

export function Layout() {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md border border-primary/25 bg-primary/5 text-primary">
              <Mark className="size-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-medium leading-none tracking-tight text-foreground">
                RezeptFlow
              </p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">
                Ausnahmen statt Dauerprüfung
              </p>
            </div>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <item.icon className="size-4" strokeWidth={2} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 animate-fade-up">
        <Outlet />
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
