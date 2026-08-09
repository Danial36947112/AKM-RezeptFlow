import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rf-border/60 bg-rf-surface/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-3xl sm:text-4xl text-rf-text tracking-tight leading-none">
              RezeptFlow
            </p>
            <p className="text-rf-muted text-sm mt-1">Ausnahmen statt Dauerprüfung</p>
          </div>
          <nav className="flex gap-1 sm:gap-2">
            {[
              { to: "/", label: "Leitstand" },
              { to: "/kennzahlen", label: "Kennzahlen" },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-rf-accent/20 text-rf-accent"
                      : "text-rf-muted hover:text-rf-text hover:bg-rf-surface-2"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 animate-fade-up">
        <Outlet />
      </main>
    </div>
  );
}
