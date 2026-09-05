import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  Undo2,
  Redo2,
  RotateCcw,
  Download,
  MoveUpRight,
  Eraser,
  Shapes,
  Star as StarIcon,
  X as XIcon,
  HelpCircle,
  LassoSelect,
  Hash,
  Save,
  Pencil,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Board,
  DEFAULT_BOARD_STYLE,
  type BoardStyleSettings,
  type CellArrow,
} from "@/components/star-battle/Board";
import { Notes, SnapshotBoard, type Note, type Snapshot } from "@/components/star-battle/Notes";
import { SlideDeck } from "@/components/star-battle/SlideDeck";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { getPuzzle, saveSteps, type InitialMark } from "@/lib/puzzles";
import {
  GUESS_COLORS,
  cloneGrid,
  conflicts,
  eliminatedBy,
  emptyGrid,
  isSolved,
  regionAt,
  registerPuzzles,
  type Grid,
  type MarkKind,
  type Puzzle,
} from "@/lib/starbattle";

export const Route = createFileRoute("/puzzle/$id")({
  head: () => ({
    meta: [
      { title: "Solve a Star Battle puzzle — Star Battle Studio" },
      {
        name: "description",
        content:
          "Solve a Star Battle puzzle with auto-elimination, guess mode, zigzag region highlights, custom regions, arrows and a recorded step-by-step walkthrough.",
      },
      { property: "og:title", content: "Solve a Star Battle puzzle — Star Battle Studio" },
      {
        property: "og:description",
        content:
          "Interactive Star Battle solver with annotated deductions you can replay, present as slides or export to PDF.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PuzzlePage,
});

type Mode = "mark" | "arrow" | "region" | "custom";
type Tool = "star" | "x" | "q" | "erase";
const STYLE_KEY = "star-battle-style-v1";

/** Every input the user can pick, collated into one control. */
const INPUTS = [
  { id: "star", mode: "mark", tool: "star", label: "Star", icon: StarIcon },
  { id: "x", mode: "mark", tool: "x", label: "X", icon: XIcon },
  { id: "q", mode: "mark", tool: "q", label: "Question mark", icon: HelpCircle },
  { id: "erase", mode: "mark", tool: "erase", label: "Erase", icon: Eraser },
  { id: "region", mode: "region", tool: "star", label: "Region", icon: Shapes },
  { id: "custom", mode: "custom", tool: "star", label: "Custom region", icon: LassoSelect },
  { id: "arrow", mode: "arrow", tool: "star", label: "Arrow", icon: MoveUpRight },
] as const;

const MARK_COLORS = [
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
  ...GUESS_COLORS,
];

function PuzzlePage() {
  const { id } = useParams({ from: "/puzzle/$id" });
  const { isEditor } = useAuth();
  const { data: record, isLoading } = useQuery({
    queryKey: ["puzzle", id],
    queryFn: () => getPuzzle(id),
  });

  const puzzle: Puzzle | null = useMemo(() => {
    if (!record) return null;
    const p: Puzzle = {
      id: record.id,
      name: record.name,
      source: record.source,
      size: record.size,
      regions: record.regions,
      colors: record.colors,
      solution: record.solution,
    };
    registerPuzzles([p]);
    return p;
  }, [record]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <p className="text-sm text-muted-foreground">Loading puzzle…</p>
        </div>
      </main>
    );
  }

  if (!puzzle || !record) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <p className="text-sm text-muted-foreground">
            This puzzle no longer exists.{" "}
            <Link to="/" className="text-primary">
              Back to the calendar
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <Solver
      key={puzzle.id}
      puzzle={puzzle}
      initialSteps={record.steps}
      initialMarks={record.initialMarks}
      isEditor={isEditor}
    />
  );
}

function Solver({
  puzzle,
  initialSteps,
  initialMarks,
  isEditor,
}: {
  puzzle: Puzzle;
  initialSteps: Note[];
  initialMarks: InitialMark[];
  isEditor: boolean;
}) {
  const SIZE = puzzle.size;
  const STORE_KEY = `star-battle-progress-${puzzle.id}`;

  const startingGrid = useCallback((): Grid => {
    const g = emptyGrid(puzzle.size);
    for (const m of initialMarks) {
      if (g[m.i]) g[m.i] = m.color ? { kind: m.kind, color: m.color } : { kind: m.kind };
    }
    return g;
  }, [puzzle.size, initialMarks]);

  const [grid, setGrid] = useState<Grid>(() => startingGrid());
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [autoX, setAutoX] = useState(true);
  const [drawColor, setDrawColor] = useState(MARK_COLORS[0]!.value);
  const [mode, setMode] = useState<Mode>("mark");
  const [tool, setTool] = useState<Tool>("star");
  const [rows, setRows] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<number>>(new Set());
  const [regions, setRegions] = useState<Set<number>>(new Set());
  const [customCells, setCustomCells] = useState<Set<number>>(new Set());
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const [arrows, setArrows] = useState<CellArrow[]>([]);
  const [pendingArrow, setPendingArrow] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>(initialSteps);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [boardStyle, setBoardStyle] = useState<BoardStyleSettings>(DEFAULT_BOARD_STYLE);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const boardRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const fullSolution = puzzle.solution.length === puzzle.size && !puzzle.solution.includes(-1);
  const solved = useMemo(
    () => fullSolution && isSolved(puzzle, grid),
    [fullSolution, puzzle, grid],
  );
  const conflictCells = useMemo(() => conflicts(puzzle, grid), [puzzle, grid]);

  // restore local progress + editor style settings
  useEffect(() => {
    try {
      const rawStyle = localStorage.getItem(STYLE_KEY);
      if (rawStyle) setBoardStyle({ ...DEFAULT_BOARD_STYLE, ...JSON.parse(rawStyle) });
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.grid?.length === puzzle.size * puzzle.size) setGrid(d.grid);
      setRows(new Set(d.rows ?? []));
      setCols(new Set(d.cols ?? []));
      setRegions(new Set(d.regions ?? []));
      setCustomCells(new Set(d.customCells ?? []));
      setCustomColors(d.customColors ?? {});
      setArrows(d.arrows ?? []);
      setAutoX(d.autoX ?? true);
      setShowLabels(d.showLabels ?? true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORE_KEY]);

  useEffect(() => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        grid,
        rows: [...rows],
        cols: [...cols],
        regions: [...regions],
        customCells: [...customCells],
        customColors,
        arrows,
        autoX,
        showLabels,
      }),
    );
  }, [STORE_KEY, grid, rows, cols, regions, customCells, customColors, arrows, autoX, showLabels]);

  useEffect(() => {
    localStorage.setItem(STYLE_KEY, JSON.stringify(boardStyle));
  }, [boardStyle]);

  const snapshot = useCallback(
    (): Snapshot => ({
      puzzleId: puzzle.id,
      grid: cloneGrid(grid),
      rows: [...rows],
      cols: [...cols],
      regions: [...regions],
      customCells: [...customCells],
      customColors: { ...customColors },
      arrows: arrows.map((a) => ({ ...a })),
    }),
    [puzzle.id, grid, rows, cols, regions, customCells, customColors, arrows],
  );

  const pushHistory = useCallback(() => {
    const snap = snapshot();
    setHistory((h) => [...h.slice(-99), snap]);
    setFuture([]);
  }, [snapshot]);

  const applySnapshot = (s: Snapshot) => {
    setGrid(cloneGrid(s.grid));
    setRows(new Set(s.rows));
    setCols(new Set(s.cols));
    setRegions(new Set(s.regions));
    setCustomCells(new Set(s.customCells ?? []));
    setCustomColors({ ...(s.customColors ?? {}) });
    setArrows(s.arrows.map((a) => ({ ...a })));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    const current = snapshot();
    setFuture((f) => [current, ...f].slice(0, 100));
    applySnapshot(last);
    setHistory((h) => h.slice(0, -1));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    const current = snapshot();
    setHistory((h) => [...h.slice(-99), current]);
    applySnapshot(next);
    setFuture((f) => f.slice(1));
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
      const already = customCells.has(i) && (customColors[i] ?? drawColor) === drawColor;
      setCustomCells((prev) => {
        const next = new Set(prev);
        if (already) next.delete(i);
        else next.add(i);
        return next;
      });
      setCustomColors((prev) => {
        const next = { ...prev };
        if (already) delete next[i];
        else next[i] = drawColor;
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
        setArrows((a) => [...a, { from: pendingArrow, to: i, color: drawColor }]);
        setPendingArrow(null);
      }
      return;
    }

    pushHistory();
    setGrid((prev) => {
      const next = cloneGrid(prev);
      const color = drawColor;
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
    setGrid(startingGrid());
    setArrows([]);
    setRows(new Set());
    setCols(new Set());
    setRegions(new Set());
    setCustomCells(new Set());
    setCustomColors({});
    setPendingArrow(null);
  };

  const recolourMarks = (color: string) => {
    pushHistory();
    setGrid((prev) =>
      prev.map((cell) => (cell.kind === "empty" ? cell : { kind: cell.kind, color })),
    );
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

  const persistWalkthrough = async () => {
    setSaveState("saving");
    try {
      await saveSteps(puzzle.id, notes);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  // Export: render each step offscreen, capture as PNG, bundle into a ZIP.
  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    const run = async () => {
      const container = pdfRef.current;
      if (!container) return;
      await new Promise((res) => setTimeout(res, 250));
      const slides = Array.from(container.children) as HTMLElement[];
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const png = await toPng(slides[i]!, { pixelRatio: 2, backgroundColor: "#0a0d16" });
        zip.file(`step-${String(i + 1).padStart(2, "0")}.png`, png.split(",")[1]!, {
          base64: true,
        });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `star-battle-walkthrough-${puzzle.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [exporting, puzzle.id]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <SiteHeader />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <header>
              <p className="text-xs uppercase tracking-[0.25em] text-primary">{puzzle.source}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {puzzle.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                One star per row, column and region. Stars may never touch — not even diagonally.
              </p>
              {isEditor && (
                <Link
                  to="/edit/$id"
                  params={{ id: puzzle.id }}
                  search={{ date: undefined }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit this grid
                </Link>
              )}
            </header>

            {/* inputs: every drawing tool plus its colour, in one box */}
            <div className="space-y-3 rounded-xl border border-border bg-card p-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Inputs
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {INPUTS.map((t) => {
                  const active = mode === t.mode && (t.mode !== "mark" || tool === t.tool);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMode(t.mode);
                        setTool(t.tool);
                        setPendingArrow(null);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                      )}
                    >
                      <t.icon className="h-4 w-4" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {tool !== "erase" && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Colour</span>
                  {MARK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => setDrawColor(c.value)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        drawColor.toLowerCase() === c.value.toLowerCase()
                          ? "border-primary"
                          : "border-input",
                      )}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="h-6 w-9 cursor-pointer rounded border border-input bg-transparent"
                    title="Custom colour"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Used for stars, X's, question marks, custom regions and arrows.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {mode === "mark"
                  ? `Clicking a cell ${tool === "erase" ? "erases it" : tool === "q" ? "places a question mark" : `places ${tool === "x" ? "an X" : "a star"}`}.`
                  : mode === "region"
                    ? "Click any cell to outline its region with a zigzag border."
                    : mode === "custom"
                      ? "Click cells to build your own custom region outline."
                      : pendingArrow === null
                        ? "Click the start cell, then the target cell."
                        : "Now click the target cell (click the same cell to cancel)."}
              </p>
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
                customColors={customColors}
                arrows={arrows}
                pendingArrow={pendingArrow}
                showLabels={showLabels}
                style={boardStyle}
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

            <Notes
              notes={notes}
              editingId={editingNoteId}
              onAdd={addNote}
              onDelete={(id) => {
                setNotes((n) => n.filter((x) => x.id !== id));
                if (editingNoteId === id) setEditingNoteId(null);
              }}
              onToggleCrux={(id) =>
                setNotes((n) => n.map((x) => (x.id === id ? { ...x, crux: !x.crux } : x)))
              }
              onRestore={(note) => {
                pushHistory();
                applySnapshot(note.snapshot);
              }}
              onStartEdit={(note) => {
                pushHistory();
                applySnapshot(note.snapshot);
                setEditingNoteId(note.id);
              }}
              onSaveEdit={(noteId, text) => {
                const snap = snapshot();
                setNotes((n) =>
                  n.map((x) => (x.id === noteId ? { ...x, text, snapshot: snap } : x)),
                );
                setEditingNoteId(null);
              }}
              onCancelEdit={() => setEditingNoteId(null)}
              onMove={(id, delta) =>
                setNotes((n) => {
                  const from = n.findIndex((x) => x.id === id);
                  const to = from + delta;
                  if (from < 0 || to < 0 || to >= n.length) return n;
                  const next = [...n];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved!);
                  return next;
                })
              }
              onPresent={() => setPresenting(true)}
              onExportZip={() => setExporting(true)}
            />
          </div>

          <aside className="space-y-4">
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Board controls
              </h2>

              <label className="flex items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm">
                <span className="text-foreground">Auto-fill X after a star</span>
                <input
                  type="checkbox"
                  checked={autoX}
                  onChange={(e) => setAutoX(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </label>

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
                  onClick={redo}
                  disabled={future.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent disabled:opacity-40"
                >
                  <Redo2 className="h-4 w-4" /> Redo
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
                  onClick={() => recolourMarks("#ffffff")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
                >
                  <Palette className="h-4 w-4" /> All marks white
                </button>
                <button
                  type="button"
                  onClick={() => recolourMarks("#000000")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
                >
                  <Palette className="h-4 w-4" /> All marks black
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabels((v) => !v)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                    showLabels
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                  )}
                >
                  <Hash className="h-4 w-4" /> {showLabels ? "Hide" : "Show"} numbers
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
                  onClick={() => {
                    setCustomCells(new Set());
                    setCustomColors({});
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear custom region ({customCells.size} cells)
                </button>
              )}
            </section>

            {/* editor settings: colours & opacity */}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Editor settings
              </h2>
              <StyleRow
                label="Custom region"
                color={boardStyle.customColor}
                opacity={boardStyle.customOpacity}
                onColor={(customColor) => setBoardStyle((s) => ({ ...s, customColor }))}
                onOpacity={(customOpacity) => setBoardStyle((s) => ({ ...s, customOpacity }))}
              />
              <StyleRow
                label="Arrows & row/column markers"
                color={boardStyle.arrowColor}
                opacity={boardStyle.arrowOpacity}
                onColor={(arrowColor) => setBoardStyle((s) => ({ ...s, arrowColor }))}
                onOpacity={(arrowOpacity) => setBoardStyle((s) => ({ ...s, arrowOpacity }))}
              />
              <button
                type="button"
                onClick={() => setBoardStyle(DEFAULT_BOARD_STYLE)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset to defaults
              </button>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              {isEditor ? (
                <>
                  <button
                    type="button"
                    onClick={() => void persistWalkthrough()}
                    disabled={saveState === "saving"}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saveState === "saving" ? "Saving…" : "Publish walkthrough"}
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {saveState === "saved"
                      ? "Walkthrough saved for everyone."
                      : saveState === "error"
                        ? "Could not save — please try again."
                        : "Saved steps become the published solution path for this puzzle."}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your marks and steps stay in this browser.{" "}
                  <Link to="/auth" className="text-primary">
                    Sign in
                  </Link>{" "}
                  as the owner to publish walkthroughs.
                </p>
              )}
            </section>
          </aside>
        </div>
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

function StyleRow({
  label,
  color,
  opacity,
  onColor,
  onOpacity,
}: {
  label: string;
  color: string;
  opacity: number;
  onColor: (v: string) => void;
  onOpacity: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-input bg-background/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="h-6 w-9 cursor-pointer rounded border border-input bg-transparent"
          aria-label={`${label} colour`}
        />
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        Opacity
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacity(Number(e.target.value))}
          className="flex-1 accent-[var(--primary)]"
        />
        <span className="w-8 text-right tabular-nums">{Math.round(opacity * 100)}%</span>
      </label>
    </div>
  );
}
