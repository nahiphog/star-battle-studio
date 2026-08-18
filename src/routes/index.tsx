import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { listPuzzles, toDateKey } from "@/lib/puzzles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Star Battle Studio — Nefarious Puzzles, Solved Step by Step" },
      {
        name: "description",
        content:
          "A calendar of nefarious Star Battle puzzles — especially Netflix's — each with a detailed, hand-solved walkthrough you can replay, present or export.",
      },
      { property: "og:title", content: "Star Battle Studio — Nefarious Puzzles, Solved Step by Step" },
      {
        property: "og:description",
        content:
          "Browse Star Battle puzzles by date and follow the full reasoning behind every deduction, crux step included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HomePage() {
  const { isEditor } = useAuth();
  const { data: puzzles = [], isLoading } = useQuery({
    queryKey: ["puzzles"],
    queryFn: listPuzzles,
  });

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const byDate = useMemo(() => {
    const map = new Map<string, typeof puzzles>();
    for (const p of puzzles) {
      const list = map.get(p.playDate) ?? [];
      list.push(p);
      map.set(p.playDate, list);
    }
    return map;
  }, [puzzles]);

  const days = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) cells.push(new Date(cursor.year, cursor.month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const step = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const todayKey = toDateKey(new Date());

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <SiteHeader />

        <header className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Star Battle</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Nefarious Star Battle puzzles, solved in full
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            I enjoy solving nefarious Star Battle puzzles — in particular the daily ones published
            by Netflix — and I show exactly how I solve them by hand. Every puzzle here comes with a
            step-by-step walkthrough: the eliminations I make, the deductions they unlock, and the
            crux step that finally trivialises the grid.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground/80">
            Disclaimer: no copyright infringement is intended. Puzzle names and dates are cited
            purely to credit their original publishers. The grids here are hand-recreated for
            educational commentary and solving instruction, and this site is not affiliated with,
            endorsed by, or sponsored by Netflix or any other publisher. If you own a puzzle
            reproduced here and would like it removed, please get in touch and I will take it down.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="rounded-lg border border-input bg-secondary p-2 text-secondary-foreground hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {MONTHS[cursor.month]} {cursor.year}
            </h2>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="rounded-lg border border-input bg-secondary p-2 text-secondary-foreground hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-20 rounded-lg" />;
              const key = toDateKey(day);
              const list = byDate.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-20 rounded-lg border border-border bg-background/40 p-1.5",
                    key === todayKey && "border-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {day.getDate()}
                    </span>
                    {isEditor && (
                      <Link
                        to="/edit/$id"
                        params={{ id: "new" }}
                        search={{ date: key }}
                        aria-label={`Add a puzzle on ${key}`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {list.map((p) => (
                      <Link
                        key={p.id}
                        to="/puzzle/$id"
                        params={{ id: p.id }}
                        className="block truncate rounded bg-primary/15 px-1.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/25"
                        title={p.name}
                      >
                        {p.size}×{p.size} · {p.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            All puzzles
          </h2>
          {isLoading && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
          <ul className="mt-3 space-y-2">
            {puzzles.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link
                  to="/puzzle/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
                >
                  <Star className="h-3.5 w-3.5 text-primary" />
                  {p.name}
                  <span className="text-xs text-muted-foreground">
                    {p.size}×{p.size} · {p.steps.length} steps
                  </span>
                </Link>
                {isEditor && (
                  <Link
                    to="/edit/$id"
                    params={{ id: p.id }}
                    search={{ date: undefined }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit grid
                  </Link>
                )}
              </li>
            ))}
            {!isLoading && puzzles.length === 0 && (
              <li className="text-xs text-muted-foreground">No puzzles yet.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
