import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  Hash,
  Save,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, DEFAULT_BOARD_STYLE, type BoardStyleSettings, type CellArrow } from "@/components/star-battle/Board";
import { Notes, SnapshotBoard, type Note, type Snapshot } from "@/components/star-battle/Notes";
import { SlideDeck } from "@/components/star-battle/SlideDeck";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { getPuzzle, saveSteps } from "@/lib/puzzles";
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
      playDate={record.playDate}
      initialSteps={record.steps}
      isEditor={isEditor}
    />
  );
}

function Solver({
  puzzle,
  playDate,
  initialSteps,
  isEditor,
}: {
  puzzle: Puzzle;
  playDate: string;
  initialSteps: Note[];
  isEditor: boolean;
}) {
  const SIZE = puzzle.size;
  const STORE_KEY = `star-battle-progress-${puzzle.id}`;

  const [grid, setGrid] = useState<Grid>(() => emptyGrid(puzzle.size));
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
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const [drawCustomColor, setDrawCustomColor] = useState(DEFAULT_BOARD_STYLE.customColor);
  const [drawArrowColor, setDrawArrowColor] = useState(DEFAULT_BOARD_STYLE.arrowColor);
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

  const solved = useMemo(() => isSolved(puzzle, grid), [puzzle, grid]);
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
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last) applySnapshot(last);
      return h.slice(0, -1);
    });
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
      const already = customCells.has(i) && (customColors[i] ?? drawCustomColor) === drawCustomColor;
      setCustomCells((prev) => {
        const next = new Set(prev);
        if (already) next.delete(i);
        else next.add(i);
        return next;
      });
      setCustomColors((prev) => {
        const next = { ...prev };
        if (already) delete next[i];
        else next[i] = drawCustomColor;
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
        setArrows((a) => [...a, { from: pendingArrow, to: i, color: drawArrowColor }]);
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
    setCustomColors({});
    setPendingArrow(null);
  };

  const clearGuesses = () => {
    pushHistory();
    setGrid((prev) => prev.map((cell) => (cell.color ? { kind: "empty" as const } : cell)));
  };

  const whitenXs = () => {
    pushHistory();
    setGrid((prev) =>
      prev.map((cell) => (cell.kind === "x" ? { kind: "x" as const } : cell)),
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
      <div className="mx-auto max-w-6xl">
        <SiteHeader />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <header>
              <p className="text-xs uppercase tracking-[0.25em] text-primary">
                {puzzle.source} · {playDate}
              </p>
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
              <button
                type="button"
                onClick={() => setShowLabels((v) => !v)}
                className={cn(
                  "ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  showLabels
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                <Hash className="h-4 w-4" /> {showLabels ? "Hide" : "Show"} numbers
              </button>
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
              onPresent={() => setPresenting(true)}
              onExportPdf={() => setExporting(true)}
            />
          </div>


          <aside className="space-y-4">
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

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-2 py-2 text-xs text-foreground">
                  Custom region colour
                  <input
                    type="color"
                    value={drawCustomColor}
                    onChange={(e) => setDrawCustomColor(e.target.value)}
                    className="h-6 w-9 cursor-pointer rounded border border-input bg-transparent"
                    aria-label="Colour for new custom regions"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-2 py-2 text-xs text-foreground">
                  Arrow colour
                  <input
                    type="color"
                    value={drawArrowColor}
                    onChange={(e) => setDrawArrowColor(e.target.value)}
                    className="h-6 w-9 cursor-pointer rounded border border-input bg-transparent"
                    aria-label="Colour for new arrows"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pick a colour before drawing to build several differently coloured custom regions and
                arrows on the same grid.
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
                <button
                  type="button"
                  onClick={whitenXs}
                  className="mt-2 block inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3.5 w-3.5" /> Make all X white
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
