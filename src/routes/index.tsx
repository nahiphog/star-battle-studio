import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Undo2,
  RotateCcw,
  Download,
  MoveUpRight,
  Eraser,
  Shapes,
  Star as StarIcon,
  X as XIcon,
  HelpCircle,
  LassoSelect,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, type CellArrow } from "@/components/star-battle/Board";
import { Notes, SnapshotBoard, type Note, type Snapshot } from "@/components/star-battle/Notes";
import { SlideDeck } from "@/components/star-battle/SlideDeck";
import {
  GUESS_COLORS,
  PUZZLES,
  cloneGrid,
  conflicts,
  eliminatedBy,
  emptyGrid,
  idx,
  isSolved,
  regionAt,
  type Grid,
  type MarkKind,
} from "@/lib/starbattle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Star Battle Puzzle Editor — Solve & Annotate" },
      {
        name: "description",
        content:
          "Interactive Star Battle editor: place stars, Xs and question marks, auto-eliminate, highlight rows, columns, regions and custom cell groups, then present your solution as slides or a PDF.",
      },
      { property: "og:title", content: "Star Battle Puzzle Editor — Solve & Annotate" },
      {
        property: "og:description",
        content:
          "Solve Star Battle puzzles with guess mode, zigzag region highlights, custom regions, arrows and step-by-step reasoning you can present or export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StarBattlePage,
});

type Mode = "mark" | "arrow" | "region" | "custom";
type Tool = "star" | "x" | "q" | "erase";
const STORE_KEY = "star-battle-state-v2";

function StarBattlePage() {
  const [puzzleId, setPuzzleId] = useState(PUZZLES[0]!.id);
  const puzzle = useMemo(() => PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0]!, [puzzleId]);
  const SIZE = puzzle.size;

  const [grid, setGrid] = useState<Grid>(() => emptyGrid(PUZZLES[0]!.size));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [autoX, setAutoX] = useState(true);
  const [guessMode, setGuessMode] = useState(false);
  const [guessColor, setGuessColor] = useState(GUESS_COLORS[0]!.value);
  const [mode, setMode] = useState<Mode>("mark");
  const [tool, setTool] = useState<Tool>("star");
  const [rows, setRows] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<number>>(new Set());
  const [regions, setRegions] = useState<Set<number>>(new Set());
  const [customCells, setCustomCells] = useState<Set<number>>(new Set());
  const [arrows, setArrows] = useState<CellArrow[]>([]);
  const [pendingArrow, setPendingArrow] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const solved = useMemo(() => isSolved(puzzle, grid), [puzzle, grid]);
  const conflictCells = useMemo(() => conflicts(puzzle, grid), [puzzle, grid]);

  // restore / persist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const p = PUZZLES.find((x) => x.id === d.puzzleId);
      if (p) setPuzzleId(p.id);
      if (p && d.grid?.length === p.size * p.size) setGrid(d.grid);
      setRows(new Set(d.rows ?? []));
      setCols(new Set(d.cols ?? []));
      setRegions(new Set(d.regions ?? []));
      setCustomCells(new Set(d.customCells ?? []));
      setArrows(d.arrows ?? []);
      setNotes(d.notes ?? []);
      setAutoX(d.autoX ?? true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        puzzleId,
        grid,
        rows: [...rows],
        cols: [...cols],
        regions: [...regions],
        customCells: [...customCells],
        arrows,
        notes,
        autoX,
      }),
    );
  }, [puzzleId, grid, rows, cols, regions, customCells, arrows, notes, autoX]);

  const snapshot = useCallback(
    (): Snapshot => ({
      puzzleId,
      grid: cloneGrid(grid),
      rows: [...rows],
      cols: [...cols],
      regions: [...regions],
      customCells: [...customCells],
      arrows: arrows.map((a) => ({ ...a })),
    }),
    [puzzleId, grid, rows, cols, regions, customCells, arrows],
  );

  const pushHistory = useCallback(() => {
    const snap = snapshot();
    setHistory((h) => [...h.slice(-99), snap]);
  }, [snapshot]);

  const applySnapshot = (s: Snapshot) => {
    setPuzzleId(s.puzzleId);
    setGrid(cloneGrid(s.grid));
    setRows(new Set(s.rows));
    setCols(new Set(s.cols));
    setRegions(new Set(s.regions));
    setCustomCells(new Set(s.customCells ?? []));
    setArrows(s.arrows.map((a) => ({ ...a })));
  };

  const undo = () => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last) applySnapshot(last);
      return h.slice(0, -1);
    });
  };

  const switchPuzzle = (id: string) => {
    const p = PUZZLES.find((x) => x.id === id);
    if (!p) return;
    pushHistory();
    setPuzzleId(id);
    setGrid(emptyGrid(p.size));
    setRows(new Set());
    setCols(new Set());
    setRegions(new Set());
    setCustomCells(new Set());
    setArrows([]);
    setPendingArrow(null);
  };

  const handleCellClick = (i: number) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;

    if (mode === "region") {
      pushHistory();
      const region = regionAt(puzzle, r, c);
      setRegions((prev) => {
        const next = new Set(prev);
        if (next.has(region)) next.delete(region);
        else next.add(region);
        return next;
      });
      return;
    }

    if (mode === "custom") {
      pushHistory();
      setCustomCells((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
      return;
    }

    if (mode === "arrow") {
      if (pendingArrow === null) {
        setPendingArrow(i);
      } else if (pendingArrow === i) {
        setPendingArrow(null);
      } else {
        pushHistory();
        setArrows((a) => [...a, { from: pendingArrow, to: i }]);
        setPendingArrow(null);
      }
      return;
    }

    pushHistory();
    setGrid((prev) => {
      const next = cloneGrid(prev);
      const color = guessMode || tool === "q" ? guessColor : undefined;
      if (tool === "erase") {
        next[i] = { kind: "empty" };
        return next;
      }
      const kind: MarkKind = tool;
      next[i] = { kind, ...(color ? { color } : {}) };
      if (kind === "star" && autoX) {
        for (const j of eliminatedBy(puzzle, r, c)) {
          if (next[j]!.kind === "empty") next[j] = { kind: "x", ...(color ? { color } : {}) };
        }
      }
      return next;
    });
  };

  const toggleRow = (r: number) => {
    pushHistory();
    setRows((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });
  };

  const toggleCol = (c: number) => {
    pushHistory();
    setCols((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const resetGrid = () => {
    pushHistory();
    setGrid(emptyGrid(SIZE));
    setArrows([]);
    setRows(new Set());
    setCols(new Set());
    setRegions(new Set());
    setCustomCells(new Set());
    setPendingArrow(null);
  };

  const clearGuesses = () => {
    pushHistory();
    setGrid((prev) => prev.map((cell) => (cell.color ? { kind: "empty" as const } : cell)));
  };

  const saveImage = async () => {
    if (!boardRef.current) return;
    const url = await toPng(boardRef.current, { pixelRatio: 2, backgroundColor: "#0a0d16" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `star-battle-${puzzle.id}.png`;
    a.click();
  };

  const addNote = (text: string, crux: boolean) =>
    setNotes((n) => [...n, { id: crypto.randomUUID(), text, crux, snapshot: snapshot() }]);

  // PDF export: render slides offscreen, capture each, stitch into a PDF.
  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    const run = async () => {
      const container = pdfRef.current;
      if (!container) return;
      await new Promise((res) => setTimeout(res, 250));
      const slides = Array.from(container.children) as HTMLElement[];
      const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });
      for (let i = 0; i < slides.length; i++) {
        const png = await toPng(slides[i]!, { pixelRatio: 2, backgroundColor: "#0a0d16" });
        if (i > 0) doc.addPage([1280, 720], "landscape");
        doc.addImage(png, "PNG", 0, 0, 1280, 720);
      }
      if (!cancelled) {
        doc.save(`star-battle-walkthrough-${puzzle.id}.pdf`);
        setExporting(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [exporting, puzzle.id]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <header>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">{puzzle.source}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Star Battle Editor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One star per row, column and region. Stars may never touch — not even diagonally.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PUZZLES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchPuzzle(p.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    p.id === puzzleId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                  )}
                >
                  {p.name} · {p.size}×{p.size}
                </button>
              ))}
            </div>
          </header>

          {/* mark tools */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            {(
              [
                { id: "star", label: "Star", icon: StarIcon },
                { id: "x", label: "X", icon: XIcon },
                { id: "q", label: "Question", icon: HelpCircle },
                { id: "erase", label: "Erase", icon: Eraser },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTool(t.id);
                  setMode("mark");
                  setPendingArrow(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  mode === "mark" && tool === t.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div ref={boardRef} className="rounded-xl border border-border bg-card p-3">
            <Board
              puzzle={puzzle}
              grid={grid}
              conflictCells={conflictCells}
              highlightedRows={rows}
              highlightedCols={cols}
              highlightedRegions={regions}
              customCells={customCells}
              arrows={arrows}
              pendingArrow={pendingArrow}
              onCellClick={handleCellClick}
              onToggleRow={toggleRow}
              onToggleCol={toggleCol}
            />
          </div>

          {(solved || conflictCells.size > 0) && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                solved ? "bg-primary text-primary-foreground" : "bg-arrow/15 text-arrow",
              )}
              role="status"
            >
              {solved
                ? "Solved — every row, column and region has exactly one star."
                : "Two stars conflict (shared row, column, region, or touching)."}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {/* tools */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Highlighting
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "region", label: "Region", icon: Shapes },
                  { id: "custom", label: "Custom", icon: LassoSelect },
                  { id: "arrow", label: "Arrow", icon: MoveUpRight },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(mode === t.id ? "mark" : t.id);
                    setPendingArrow(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    mode === t.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "mark"
                ? `Clicking a cell places ${tool === "erase" ? "nothing (erases)" : tool === "q" ? "a question mark" : `an ${tool === "x" ? "X" : "star"}`}.`
                : mode === "region"
                  ? "Click any cell to outline its region with a zigzag border."
                  : mode === "custom"
                    ? "Click cells to build your own custom region outline."
                    : pendingArrow === null
                      ? "Click the start cell, then the target cell."
                      : "Now click the target cell (click the same cell to cancel)."}
            </p>

            <label className="flex items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm">
              <span className="text-foreground">Auto-fill X after a star</span>
              <input
                type="checkbox"
                checked={autoX}
                onChange={(e) => setAutoX(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
            </label>

            <div className="rounded-lg border border-input bg-background/40 px-3 py-2">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">Guess mode (coloured marks)</span>
                <input
                  type="checkbox"
                  checked={guessMode}
                  onChange={(e) => setGuessMode(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </label>
              <div className="mt-2 flex items-center gap-2">
                {GUESS_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => setGuessColor(c.value)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2",
                      guessColor === c.value ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <input
                  type="color"
                  value={guessColor}
                  onChange={(e) => setGuessColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent"
                  title="Custom colour"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Question marks always use the selected colour.
              </p>
              <button
                type="button"
                onClick={clearGuesses}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear coloured marks
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" /> Undo
              </button>
              <button
                type="button"
                onClick={resetGrid}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
              >
                <RotateCcw className="h-4 w-4" /> Reset grid
              </button>
              <button
                type="button"
                onClick={() => setArrows([])}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
              >
                <MoveUpRight className="h-4 w-4" /> Clear arrows
              </button>
              <button
                type="button"
                onClick={saveImage}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="h-4 w-4" /> Save image
              </button>
            </div>

            {customCells.size > 0 && (
              <button
                type="button"
                onClick={() => setCustomCells(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear custom region ({customCells.size} cells)
              </button>
            )}
          </section>

          <Notes
            notes={notes}
            onAdd={addNote}
            onDelete={(id) => setNotes((n) => n.filter((x) => x.id !== id))}
            onToggleCrux={(id) =>
              setNotes((n) => n.map((x) => (x.id === id ? { ...x, crux: !x.crux } : x)))
            }
            onRestore={(note) => {
              pushHistory();
              applySnapshot(note.snapshot);
            }}
            onPresent={() => setPresenting(true)}
            onExportPdf={() => setExporting(true)}
          />
        </aside>
      </div>

      {presenting && notes.length > 0 && (
        <SlideDeck title={puzzle.name} notes={notes} onClose={() => setPresenting(false)} />
      )}

      {exporting && (
        <div className="fixed left-[-20000px] top-0" aria-hidden>
          <div ref={pdfRef}>
            {notes.map((n, i) => (
              <div
                key={n.id}
                style={{ width: 1280, height: 720, backgroundColor: "#0a0d16" }}
                className="flex gap-10 p-12"
              >
                <div style={{ width: 560 }}>
                  <SnapshotBoard snapshot={n.snapshot} />
                </div>
                <div className="flex-1">
                  <p className="text-sm uppercase tracking-[0.25em] text-primary">
                    {puzzle.name} — Step {i + 1} of {notes.length}
                  </p>
                  {n.crux && (
                    <p className="mt-3 inline-block rounded bg-primary/15 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                      Crux step
                    </p>
                  )}
                  <p className="mt-4 whitespace-pre-wrap text-2xl leading-relaxed text-foreground">
                    {n.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export { idx };
