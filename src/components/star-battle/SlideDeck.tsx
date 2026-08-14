import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SnapshotBoard, type Note } from "./Notes";

type Props = {
  title: string;
  notes: Note[];
  onClose: () => void;
};

export function SlideDeck({ title, notes, onClose }: Props) {
  const [i, setI] = useState(0);
  const total = notes.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((v) => Math.min(v + 1, total - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose]);

  const note = notes[i];
  if (!note) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 p-4 backdrop-blur sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">{title}</p>
          <h2 className="text-lg font-bold text-foreground">
            Step {i + 1} of {total}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-input bg-secondary p-2 text-secondary-foreground hover:bg-accent"
          aria-label="Exit presentation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto w-full max-w-[min(70vh,100%)]">
          <SnapshotBoard snapshot={note.snapshot} />
        </div>
        <div className="overflow-y-auto">
          {note.crux && (
            <span className="mb-3 inline-block rounded bg-primary/15 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Crux step
            </span>
          )}
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground sm:text-xl">
            {note.text}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setI((v) => Math.max(v - 1, 0))}
          disabled={i === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-accent disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <div className="flex gap-1">
          {notes.map((n, k) => (
            <button
              key={n.id}
              type="button"
              aria-label={`Go to step ${k + 1}`}
              onClick={() => setI(k)}
              className={`h-2 w-2 rounded-full ${k === i ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setI((v) => Math.min(v + 1, total - 1))}
          disabled={i === total - 1}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
