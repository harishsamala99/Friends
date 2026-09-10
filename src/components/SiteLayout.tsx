import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/fixtures", label: "Fixtures & Results" },
  { to: "/standings", label: "Standings" },
  { to: "/scorers", label: "Top Scorers" },
  { to: "/saves", label: "Top Saves" },
  { to: "/teams", label: "Teams" },
  { to: "/code-of-conduct", label: "Code of Conduct" },
] as const;

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : false;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="bg-[#fff1d6] text-[#182235] hover:bg-[#ffe5bd] hover:text-[#182235]"
      aria-label="Toggle theme"
      onClick={() => {
        const next = !dark;
        setDark(next);
        localStorage.setItem("theme", next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/friendsleague.jpeg" alt="FRIENDS LEAGUE logo" className="size-9 rounded-sm object-cover" />
            <span className="hidden font-display text-lg font-bold uppercase tracking-wide sm:block">
              FRIENDS LEAGUE
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 rounded-2xl border border-white/50 bg-white/55 p-1 shadow-sm backdrop-blur-xl md:flex dark:border-white/10 dark:bg-white/10">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-xl px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/15"
                activeProps={{ className: "rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <Link to="/final">
              <Button
                variant="default"
                size="sm"
                className="hidden gap-2 bg-accent text-accent-foreground shadow-sm hover:bg-accent/80 sm:flex"
                aria-label="Create Tournament"
              >
                <Zap className="size-4" />
                Create Tournament
              </Button>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/60 text-foreground shadow-sm hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20 md:hidden"
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
        {open && (
          <nav className="grid gap-1 border-t border-white/40 bg-white/40 px-4 py-2 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-white/5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/15"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/final"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/80"
            >
              <div className="flex items-center gap-2">
                <Zap className="size-4" />
                Create Tournament
              </div>
            </Link>
          </nav>
        )}
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        FRIENDS LEAGUE &middot; Fixtures, results and statistics
      </footer>
    </div>
  );
}
