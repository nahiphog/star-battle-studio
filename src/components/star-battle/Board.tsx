import { Star, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SIZE,
  idx,
  regionAt,
  regionPerimeter,
  zigzag,
  type Grid,
} from "@/lib/starbattle";

export type CellArrow = { from: number; to: number };

type Props = {
  grid: Grid;
  conflictCells: Set<number>;
  highlightedRows: Set<number>;
  highlightedCols: Set<number>;
  highlightedRegions: Set<number>;
  arrows: CellArrow[];
  pendingArrow: number | null;
  onCellClick: (i: number) => void;
  onToggleRow: (r: number) => void;
  onToggleCol: (c: number) => void;
};

export function Board({
  grid,
  conflictCells,
  highlightedRows,
  highlightedCols,
  highlightedRegions,
  arrows,
  pendingArrow,
  onCellClick,
  onToggleRow,
  onToggleCol,
}: Props) {
  const center = (i: number) => ({ x: (i % SIZE) + 0.5, y: Math.floor(i / SIZE) + 0.5 });

  return (
    <div className="w-full select-none">
      {/* column arrow gutter */}
      <div className="flex">
        <div className="w-6 shrink-0 sm:w-7" />
        <div className="grid flex-1 grid-cols-9">
          {Array.from({ length: SIZE }, (_, c) => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight column ${c + 1}`}
              onClick={() => onToggleCol(c)}
              className="flex h-6 items-end justify-center sm:h-7"
            >
              <svg viewBox="0 0 12 20" className="h-5 w-3">
                {highlightedCols.has(c) ? (
                  <path
                    d="M6 19 L1 9 H4 V1 H8 V9 H11 Z"
                    fill="var(--arrow)"
                    stroke="var(--arrow)"
                  />
                ) : (
                  <circle cx="6" cy="14" r="1.6" fill="var(--muted-foreground)" opacity="0.5" />
                )}
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* row arrow gutter */}
        <div className="flex w-6 shrink-0 flex-col sm:w-7">
          {Array.from({ length: SIZE }, (_, r) => (
            <button
              key={r}
              type="button"
              aria-label={`Highlight row ${r + 1}`}
              onClick={() => onToggleRow(r)}
              className="flex flex-1 items-center justify-end pr-0.5"
            >
              <svg viewBox="0 0 20 12" className="h-3 w-5">
                {highlightedRows.has(r) ? (
                  <path
                    d="M19 6 L9 1 V4 H1 V8 H9 V11 Z"
                    fill="var(--arrow)"
                    stroke="var(--arrow)"
                  />
                ) : (
                  <circle cx="14" cy="6" r="1.6" fill="var(--muted-foreground)" opacity="0.5" />
                )}
              </svg>
            </button>
          ))}
        </div>

        {/* board */}
        <div className="relative aspect-square flex-1 overflow-hidden rounded-md ring-2 ring-grid-line">
          <div className="grid h-full w-full grid-cols-9 grid-rows-9">
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE);
              const c = i % SIZE;
              const region = regionAt(r, c);
              const thick = "border-grid-line";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onCellClick(i)}
                  aria-label={`Row ${r + 1} column ${c + 1}`}
                  className={cn(
                    `rgn-${region}`,
                    "relative flex items-center justify-center border-[0.5px] border-grid-line/40 transition-[filter]",
                    r > 0 && regionAt(r - 1, c) !== region && `border-t-2 ${thick}`,
                    c > 0 && regionAt(r, c - 1) !== region && `border-l-2 ${thick}`,
                    r < SIZE - 1 && regionAt(r + 1, c) !== region && `border-b-2 ${thick}`,
                    c < SIZE - 1 && regionAt(r, c + 1) !== region && `border-r-2 ${thick}`,
                    (highlightedRows.has(r) || highlightedCols.has(c)) && "brightness-125",
                    pendingArrow === i && "ring-2 ring-inset ring-primary",
                  )}
                >
                  {cell.kind === "star" && (
                    <Star
                      className={cn(
                        "h-[70%] w-[70%] drop-shadow",
                        conflictCells.has(i) && "animate-pulse",
                      )}
                      style={{ color: cell.color ?? "var(--mark)" }}
                      fill="currentColor"
                      strokeWidth={1}
                      stroke={conflictCells.has(i) ? "var(--arrow)" : "currentColor"}
                    />
                  )}
                  {cell.kind === "x" && (
                    <XIcon
                      className="h-[55%] w-[55%]"
                      style={{ color: cell.color ?? "var(--mark)" }}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* overlays */}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <defs>
              <marker
                id="sb-arrowhead"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <path d="M0,0 L4,2 L0,4 Z" fill="var(--arrow)" />
              </marker>
            </defs>

            {[...highlightedRegions].flatMap((region) =>
              regionPerimeter(region).map((seg, k) => (
                <polyline
                  key={`${region}-${k}`}
                  points={zigzag(seg)}
                  fill="none"
                  stroke="var(--mark)"
                  strokeWidth={0.055}
                  strokeLinejoin="round"
                />
              )),
            )}

            {arrows.map((a, k) => {
              const p1 = center(a.from);
              const p2 = center(a.to);
              return (
                <line
                  key={k}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="var(--arrow)"
                  strokeWidth={0.07}
                  strokeLinecap="round"
                  markerEnd="url(#sb-arrowhead)"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

export { idx };
