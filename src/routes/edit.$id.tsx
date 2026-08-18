import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Paintbrush, Star as StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board } from "@/components/star-battle/Board";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  createPuzzle,
  deletePuzzle,
  getPuzzle,
  toDateKey,
  updatePuzzle,
  type PuzzleInput,
} from "@/lib/puzzles";
import { REGION_PALETTE, emptyGrid, idx, type Grid, type Puzzle } from "@/lib/starbattle";

export const Route = createFileRoute("/edit/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search["date"] === "string" ? (search["date"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Grid editor — Star Battle Studio" },
      {
        name: "description",
        content:
          "Build a Star Battle grid from 5×5 up to 12×12: paint regions, pick region colours, set the unique solution and publish it to the puzzle calendar.",
      },
      { property: "og:title", content: "Grid editor — Star Battle Studio" },
      {
        property: "og:description",
        content: "Owner-only editor for creating and editing Star Battle grids and solutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditPage,
});

type Draft = {
  playDate: string;
  name: string;
  source: string;
  size: number;
  regions: number[][];
  colors: string[];
  solution: number[];
};

const blankRegions = (size: number) => Array.from({ length: size }, () => Array(size).fill(0));
const defaultColors = (size: number) =>
  Array.from({ length: size }, (_, i) => REGION_PALETTE[i % REGION_PALETTE.length]!);

function EditPage() {
  const { id } = useParams({ from: "/edit/$id" });
  const { date } = useSearch({ from: "/edit/$id" });
  const { isEditor, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";

  const { data: record } = useQuery({
    queryKey: ["puzzle", id],
    queryFn: () => getPuzzle(id),
    enabled: !isNew,
  });

  const [draft, setDraft] = useState<Draft>(() => ({
    playDate: date ?? toDateKey(new Date()),
    name: "",
    source: "Netflix Star Battle",
    size: 9,
    regions: blankRegions(9),
    colors: defaultColors(9),
    solution: Array(9).fill(-1),
  }));
  const [activeRegion, setActiveRegion] = useState(0);
  const [paintMode, setPaintMode] = useState<"regions" | "solution">("regions");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!record) return;
    setDraft({
      playDate: record.playDate,
      name: record.name,
      source: record.source,
      size: record.size,
      regions: record.regions,
      colors: record.colors,
      solution: record.solution,
    });
  }, [record]);

  const puzzle: Puzzle = useMemo(
    () => ({
      id: "draft",
      name: draft.name || "Untitled",
      source: draft.source,
      size: draft.size,
      regions: draft.regions,
      colors: draft.colors,
      solution: draft.solution,
    }),
    [draft],
  );

  const grid: Grid = useMemo(() => {
    const g = emptyGrid(draft.size);
    draft.solution.forEach((c, r) => {
      if (c >= 0) g[idx(draft.size, r, c)] = { kind: "star" };
    });
    return g;
  }, [draft.size, draft.solution]);

  const resize = (size: number) => {
    setDraft((d) => ({
      ...d,
      size,
      regions: blankRegions(size),
      colors: defaultColors(size),
      solution: Array(size).fill(-1),
    }));
    setActiveRegion(0);
  };

  const onCellClick = (i: number) => {
    const r = Math.floor(i / draft.size);
    const c = i % draft.size;
    if (paintMode === "regions") {
      setDraft((d) => {
        const regions = d.regions.map((row) => [...row]);
        regions[r]![c] = activeRegion;
        return { ...d, regions };
      });
      return;
    }
    setDraft((d) => {
      const solution = [...d.solution];
      solution[r] = solution[r] === c ? -1 : c;
      return { ...d, solution };
    });
  };

  const validate = (d: Draft): string | null => {
    if (!d.name.trim()) return "Give the puzzle a name.";
    if (!d.playDate) return "Pick a date for the puzzle.";
    const used = new Set(d.regions.flat());
    for (let k = 0; k < d.size; k++) if (!used.has(k)) return `Region ${k + 1} has no cells yet.`;
    if (d.solution.some((c) => c < 0)) return "Place exactly one star in every row.";
    const cols = new Set(d.solution);
    if (cols.size !== d.size) return "Two stars share a column.";
    const regionsUsed = new Set(d.solution.map((c, r) => d.regions[r]![c]!));
    if (regionsUsed.size !== d.size) return "Two stars share a region.";
    for (let r = 0; r < d.size - 1; r++)
      if (Math.abs(d.solution[r]! - d.solution[r + 1]!) <= 1)
        return "Two stars touch each other diagonally or side by side.";
    return null;
  };

  const save = async () => {
    const problem = validate(draft);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const input: PuzzleInput = { ...draft };
      const saved = isNew ? await createPuzzle(input) : await updatePuzzle(id, input);
      await queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      await queryClient.invalidateQueries({ queryKey: ["puzzle", saved.id] });
      void navigate({ to: "/puzzle/$id", params: { id: saved.id } });
    } catch {
      setError("Could not save. Make sure you are signed in as the owner.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (isNew) return;
    setBusy(true);
    try {
      await deletePuzzle(id);
      await queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      void navigate({ to: "/" });
    } catch {
      setError("Could not delete this puzzle.");
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !isEditor) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <SiteHeader />
          <p className="text-sm text-muted-foreground">
            Only the site owner can edit grids.{" "}
            <Link to="/auth" className="text-primary">
              Sign in
            </Link>{" "}
            to continue.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <SiteHeader />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isNew ? "New puzzle" : "Edit puzzle"}
        </h1>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex gap-2">
              {(["regions", "solution"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaintMode(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium",
                    paintMode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                  )}
                >
                  {m === "regions" ? (
                    <>
                      <Paintbrush className="h-4 w-4" /> Paint regions
                    </>
                  ) : (
                    <>
                      <StarIcon className="h-4 w-4" /> Set solution
                    </>
                  )}
                </button>
              ))}
            </div>
            <Board
              puzzle={puzzle}
              grid={grid}
              conflictCells={new Set()}
              highlightedRows={new Set()}
              highlightedCols={new Set()}
              highlightedRegions={new Set()}
              customCells={new Set()}
              arrows={[]}
              onCellClick={onCellClick}
            />
            <p className="text-xs text-muted-foreground">
              {paintMode === "regions"
                ? "Pick a region colour on the right, then click cells to assign them."
                : "Click one cell per row to mark the star. Click again to clear it."}
            </p>
          </div>

          <aside className="space-y-4">
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <label className="block text-xs font-medium text-muted-foreground">
                Date
                <input
                  type="date"
                  value={draft.playDate}
                  onChange={(e) => setDraft((d) => ({ ...d, playDate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Netflix · 5 May 2026"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Source
                <input
                  value={draft.source}
                  onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Grid size ({draft.size}×{draft.size})
                <select
                  value={draft.size}
                  onChange={(e) => resize(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {Array.from({ length: 8 }, (_, i) => i + 5).map((s) => (
                    <option key={s} value={s}>
                      {s} × {s}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Changing the size clears the regions and solution.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Regions & colours
              </h2>
              <div className="mt-3 space-y-2">
                {draft.colors.map((color, region) => (
                  <div key={region} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRegion(region);
                        setPaintMode("regions");
                      }}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-medium",
                        activeRegion === region
                          ? "border-primary text-foreground"
                          : "border-input text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      Region {region + 1}
                    </button>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) =>
                        setDraft((d) => {
                          const colors = [...d.colors];
                          colors[region] = e.target.value;
                          return { ...d, colors };
                        })
                      }
                      aria-label={`Region ${region + 1} colour`}
                      className="h-7 w-9 cursor-pointer rounded border border-input bg-transparent"
                    />
                  </div>
                ))}
              </div>
            </section>

            {error && (
              <p className="rounded-lg bg-arrow/15 px-3 py-2 text-xs text-arrow" role="alert">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {isNew ? "Create" : "Save"}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
