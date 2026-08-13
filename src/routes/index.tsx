import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  Undo2,
  RotateCcw,
  Timer as TimerIcon,
  Pause,
  Play,
  Download,
  MoveUpRight,
  Wand2,
  Eraser,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, type CellArrow } from "@/components/star-battle/Board";
import { Notes, type Note, type Snapshot } from "@/components/star-battle/Notes";
import {
  GUESS_COLORS,
  REGION_NAMES,
  SIZE,
  cloneGrid,
  conflicts,
  eliminatedBy,
  emptyGrid,
  idx,
  isSolved,
  regionAt,
  type Grid,
} from "@/lib/starbattle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Star Battle Puzzle Editor — Solve & Annotate" },
      {
        name: "description",
        content:
          "Interactive Star Battle editor: place stars and Xs, auto-eliminate, highlight rows, columns and regions, draw arrows, time your solve and annotate each deduction.",
      },
      { property: "og:title", content: "Star Battle Puzzle Editor — Solve & Annotate" },
      {
        property: "og:description",
        content:
          "Solve the Netflix Star Battle from 5 May 2026 with guess mode, zigzag region highlights, arrows, a timer and step-by-step reasoning notes.",
      },
    ],
  }),
  component: StarBattlePage,
});

type Mode = "mark" | "arrow" | "region";
const STORE_KEY = "star-battle-state-v1";

function fmt(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StarBattlePage() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [autoX, setAutoX] = useState(true);
  const [guessMode, setGuessMode] = useState(false);
  const [guessColor, setGuessColor] = useState(GUESS_COLORS[0]!.value);
  const [mode, setMode] = useState<Mode>("mark");
  const [rows, setRows] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<number>>(new Set());
  const [regions, setRegions] = useState<Set<number>>(new Set());
  const [arrows, setArrows] = useState<CellArrow[]>([]);
  const [pendingArrow, setPendingArrow] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  const solved = useMemo(() => isSolved(grid), [grid]);
  const conflictCells = useMemo(() => conflicts(grid), [grid]);
  const starCount = useMemo(() => grid.filter((c) => c.kind === "star").length, [grid]);

  useEffect(() => {
    if (!running || solved) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, solved]);

  // restore / persist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.grid?.length === SIZE * SIZE) setGrid(d.grid);
      setRows(new Set(d.rows ?? []));
      setCols(new Set(d.cols ?? []));
      setRegions(new Set(d.regions ?? []));
      setArrows(d.arrows ?? []);
      setNotes(d.notes ?? []);
      setSeconds(d.seconds ?? 0);
      setAutoX(d.autoX ?? true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const payload = {
      grid,
      rows: [...rows],
      cols: [...cols],
      regions: [...regions],
      arrows,
      notes,
      seconds,
      autoX,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  }, [grid, rows, cols, regions, arrows, notes, seconds, autoX]);

  const snapshot = useCallback(
    (): Snapshot => ({
      grid: cloneGrid(grid),
      rows: [...rows],
      cols: [...cols],
      regions: [...regions],
      arrows: arrows.map((a) => ({ ...a })),
    }),
    [grid, rows, cols, regions, arrows],
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
      const region = regionAt(r, c);
      setRegions((prev) => {
        const next = new Set(prev);
        next.has(region) ? next.delete(region) : next.add(region);
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
      const cur = next[i]!.kind;
      const color = guessMode ? guessColor : undefined;
      if (cur === "empty") {
        next[i] = { kind: "x", ...(color ? { color } : {}) };
      } else if (cur === "x") {
        next[i] = { kind: "star", ...(color ? { color } : {}) };
        if (autoX) {
          for (const j of eliminatedBy(r, c)) {
            if (next[j]!.kind === "empty") next[j] = { kind: "x", ...(color ? { color } : {}) };
          }
        }
      } else {
        next[i] = { kind: "empty" };
      }
      return next;
    });
  };

  const toggleRow = (r: number) => {
    pushHistory();
    setRows((prev) => {
      const n = new Set(prev);
      n.has(r) ? n.delete(r) : n.add(r);
      return n;
    });
  };

  const toggleCol = (c: number) => {
    pushHistory();
    setCols((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  };

  const resetGrid = () => {
    pushHistory();
    setGrid(emptyGrid());
    setArrows([]);
    setRows(new Set());
    setCols(new Set());
    setRegions(new Set());
    setPendingArrow(null);
  };

  const clearGuesses = () => {
    pushHistory();
    setGrid((prev) => prev.map((cell) => (cell.color ? { kind: "empty" as const } : cell)));
  };

  const saveImage = async () => {
    if (!boardRef.current) return;
    const url = await toPng(boardRef.current, {
      pixelRatio: 2,
      backgroundColor: "#0a0d16",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `star-battle-${fmt(seconds).replace(":", "m")}s.png`;
    a.click();
  };

  const addNote = (text: string, crux: boolean) =>
    setNotes((n) => [
      ...n,
      { id: crypto.randomUUID(), text, crux, at: seconds, snapshot: snapshot() },
    ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <header>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">Netflix · 5 May 2026</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Star Battle Editor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One star per row, column and region. Stars may never touch — not even diagonally.
            </p>
          </header>

          <div ref={boardRef} className="rounded-xl border border-border bg-card p-3">
            <Board
              grid={grid}
              conflictCells={conflictCells}
              highlightedRows={rows}
              highlightedCols={cols}
              highlightedRegions={regions}
              arrows={arrows}
              pendingArrow={pendingArrow}
              onCellClick={handleCellClick}
              onToggleRow={toggleRow}
              onToggleCol={toggleCol}
            />
          </div>

          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              solved
                ? "bg-primary text-primary-foreground"
                : conflictCells.size
                  ? "bg-arrow/15 text-arrow"
                  : "bg-secondary text-muted-foreground",
            )}
            role="status"
          >
            {solved
              ? `Solved in ${fmt(seconds)} — every row, column and region has exactly one star.`
              : conflictCells.size
                ? "Two stars conflict (shared row, column, region, or touching)."
                : `${starCount} of ${SIZE} stars placed.`}
          </div>
        </div>

        <aside className="space-y-4">
          {/* timer */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TimerIcon className="h-4 w-4 text-primary" />
                <span className="font-mono text-2xl tabular-nums text-foreground">
                  {fmt(seconds)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRunning((v) => !v)}
                  className="rounded-lg border border-input bg-secondary p-2 text-secondary-foreground hover:bg-accent"
                  title={running ? "Pause timer" : "Start timer"}
                >
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSeconds(0)}
                  className="rounded-lg border border-input bg-secondary p-2 text-secondary-foreground hover:bg-accent"
                  title="Reset timer"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* tools */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Tools
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "mark", label: "Mark", icon: Wand2 },
                  { id: "region", label: "Region", icon: Shapes },
                  { id: "arrow", label: "Arrow", icon: MoveUpRight },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(t.id);
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
                ? "Click a cell to cycle empty → X → star → empty."
                : mode === "region"
                  ? "Click any cell to outline its region with a zigzag border."
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
                <span className="text-foreground">Guess mode</span>
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
                    onClick={() => {
                      setGuessColor(c.value);
                      setGuessMode(true);
                    }}
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
                  onChange={(e) => {
                    setGuessColor(e.target.value);
                    setGuessMode(true);
                  }}
                  className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent"
                  title="Custom guess colour"
                />
              </div>
              <button
                type="button"
                onClick={clearGuesses}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear guess marks
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
                className="col-span-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
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

            {regions.size > 0 && (
              <p className="text-xs text-muted-foreground">
                Highlighted regions: {[...regions].map((r) => REGION_NAMES[r]).join(", ")}
              </p>
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
          />
        </aside>
      </div>
    </main>
  );
}

export { idx };
