import { useState } from "react";
import { Zap, Trash2, RotateCcw, Presentation, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Grid } from "@/lib/starbattle";
import { Board, type CellArrow } from "./Board";
import { puzzleById } from "@/lib/starbattle";

export type Snapshot = {
  puzzleId: string;
  grid: Grid;
  rows: number[];
  cols: number[];
  regions: number[];
  customCells: number[];
  arrows: CellArrow[];
};

export type Note = {
  id: string;
  text: string;
  crux: boolean;
  snapshot: Snapshot;
};

export function SnapshotBoard({ snapshot }: { snapshot: Snapshot }) {
  const puzzle = puzzleById(snapshot.puzzleId);
  return (
    <Board
      puzzle={puzzle}
      grid={snapshot.grid}
      conflictCells={new Set()}
      highlightedRows={new Set(snapshot.rows)}
      highlightedCols={new Set(snapshot.cols)}
      highlightedRegions={new Set(snapshot.regions)}
      customCells={new Set(snapshot.customCells)}
      arrows={snapshot.arrows}
      interactive={false}
    />
  );
}

type Props = {
  notes: Note[];
  onAdd: (text: string, crux: boolean) => void;
  onDelete: (id: string) => void;
  onToggleCrux: (id: string) => void;
  onRestore: (note: Note) => void;
  onPresent: () => void;
  onExportPdf: () => void;
};

export function Notes({
  notes,
  onAdd,
  onDelete,
  onToggleCrux,
  onRestore,
  onPresent,
  onExportPdf,
}: Props) {
  const [text, setText] = useState("");
  const [crux, setCrux] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), crux);
    setText("");
    setCrux(false);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Solution walkthrough
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Each step you add captures the grid exactly as it looks right now.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. If any blue X were a star, it forces a star in the yellow region, leaving the blue region empty."
        className="mt-3 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCrux((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            crux
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Crux step
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Add step + grid
        </button>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPresent}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent"
          >
            <Presentation className="h-4 w-4" /> Present slides
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent"
          >
            <FileDown className="h-4 w-4" /> Save as PDF
          </button>
        </div>
      )}

      <ol className="mt-4 space-y-2">
        {notes.map((n, i) => (
          <li
            key={n.id}
            className={cn(
              "rounded-lg border bg-background/40 p-3",
              n.crux ? "border-primary/70" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Toggle crux"
                  onClick={() => onToggleCrux(n.id)}
                  className={cn(
                    "rounded p-1 hover:bg-accent",
                    n.crux ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Restore this snapshot"
                  onClick={() => onRestore(n)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete step"
                  onClick={() => onDelete(n.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 w-40">
              <SnapshotBoard snapshot={n.snapshot} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.text}</p>
            {n.crux && (
              <span className="mt-2 inline-block rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Crux — trivialises the puzzle
              </span>
            )}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-xs text-muted-foreground">No steps recorded yet.</li>
        )}
      </ol>
    </section>
  );
}
