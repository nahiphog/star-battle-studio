import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Star } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  CATEGORY_LABEL,
  formatPlayDate,
  listPuzzles,
  type PuzzleCategory,
  type PuzzleRecord,
} from "@/lib/puzzles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Star Battle Studio — Nefarious Puzzles, Solved Step by Step" },
      {
        name: "description",
        content:
          "Nefarious Star Battle puzzles — especially Netflix's — each with a detailed, hand-solved walkthrough you can replay, present or export, plus studies of puzzle uniqueness.",
      },
      {
        property: "og:title",
        content: "Star Battle Studio — Nefarious Puzzles, Solved Step by Step",
      },
      {
        property: "og:description",
        content:
          "Follow the full reasoning behind every deduction in hard Star Battle puzzles, crux step included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const CATEGORIES: PuzzleCategory[] = ["walkthrough", "uniqueness"];

function HomePage() {
  const { isEditor } = useAuth();
  const { data: puzzles = [], isLoading } = useQuery({
    queryKey: ["puzzles"],
    queryFn: listPuzzles,
  });

  const grouped = useMemo(() => {
    const map = new Map<PuzzleCategory, PuzzleRecord[]>();
    for (const c of CATEGORIES) map.set(c, []);
    for (const p of puzzles) map.get(p.category)?.push(p);
    for (const list of map.values())
      list.sort((a, b) => (a.playDate ?? "").localeCompare(b.playDate ?? ""));
    return map;
  }, [puzzles]);


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
            crux step that finally trivialises the grid. A second collection studies what makes a
            Star Battle grid uniquely solvable, using partial grids where some cells belong to no
            region at all.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground/80">
            Disclaimer: no copyright infringement is intended. Puzzle names and dates are cited
            purely to credit their original publishers. The grids here are hand-recreated for
            educational commentary and solving instruction, and this site is not affiliated with,
            endorsed by, or sponsored by Netflix or any other publisher. If you own a puzzle
            reproduced here and would like it removed, please get in touch and I will take it down.
          </p>
        </header>

        {isEditor && (
          <Link
            to="/edit/$id"
            params={{ id: "new" }}
            search={{ date: undefined }}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add another grid
          </Link>
        )}

        {isLoading && <p className="mt-6 text-xs text-muted-foreground">Loading puzzles…</p>}

        {CATEGORIES.map((category) => {
          const list = grouped.get(category) ?? [];
          return (
            <section key={category} className="mt-6 rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABEL[category]}
              </h2>
              <ul className="mt-3 space-y-2">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link
                      to="/puzzle/$id"
                      params={{ id: p.id }}
                      className="flex flex-wrap items-center gap-2 text-sm text-foreground hover:text-primary"
                    >
                      <Star className="h-3.5 w-3.5 text-primary" />
                      {p.name}
                      <span className="text-xs text-muted-foreground">
                        Published {formatPlayDate(p.playDate)} · {p.size}×{p.size} ·{" "}
                        {p.steps.length} steps
                      </span>
                    </Link>
                    {isEditor && (
                      <Link
                        to="/edit/$id"
                        params={{ id: p.id }}
                        search={{ date: undefined }}
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit grid
                      </Link>
                    )}
                  </li>
                ))}
                {!isLoading && list.length === 0 && (
                  <li className="text-xs text-muted-foreground">No puzzles here yet.</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
