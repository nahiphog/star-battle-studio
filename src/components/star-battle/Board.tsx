import { Star, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  idx,
  perimeterOfCells,
  regionAt,
  regionPerimeter,
  zigzag,
  type Grid,
  type Puzzle,
} from "@/lib/starbattle";

export type CellArrow = { from: number; to: number; color?: string };

export type BoardStyleSettings = {
  customColor: string;
  customOpacity: number;
  arrowColor: string;
  arrowOpacity: number;
};

export const DEFAULT_BOARD_STYLE: BoardStyleSettings = {
  customColor: "#8b5cf6",
  customOpacity: 1,
  arrowColor: "#ef4444",
  arrowOpacity: 1,
};

type Props = {
  puzzle: Puzzle;
  grid: Grid;
  conflictCells: Set<number>;
  highlightedRows: Set<number>;
  highlightedCols: Set<number>;
  highlightedRegions: Set<number>;
  customCells: Set<number>;
  customColors?: Record<number, string>;
  arrows: CellArrow[];
  pendingArrow?: number | null;
  interactive?: boolean;
  showLabels?: boolean;
  style?: BoardStyleSettings;
  onCellClick?: (i: number) => void;
  onToggleRow?: (r: number) => void;
  onToggleCol?: (c: number) => void;
};

export function Board({
  puzzle,
  grid,
  conflictCells,
  highlightedRows,
  highlightedCols,
  highlightedRegions,
  customCells,
  customColors,
  arrows,
  pendingArrow = null,
  interactive = true,
  showLabels = true,
  style = DEFAULT_BOARD_STYLE,
  onCellClick,
  onToggleRow,
  onToggleCol,
}: Props) {
  const SIZE = puzzle.size;
  const center = (i: number) => ({ x: (i % SIZE) + 0.5, y: Math.floor(i / SIZE) + 0.5 });
  const gutter = showLabels ? "w-9 shrink-0 sm:w-11" : "w-6 shrink-0 sm:w-7";

  // group custom cells by their colour so each coloured region gets its own outline
  const customGroups = new Map<string, Set<number>>();
  for (const i of customCells) {
    const color = customColors?.[i] ?? style.customColor;
    if (!customGroups.has(color)) customGroups.set(color, new Set());
    customGroups.get(color)!.add(i);
  }

  const arrowColors = [...new Set([style.arrowColor, ...arrows.map((a) => a.color ?? style.arrowColor)])];
  const markerId = (color: string) => `sb-arrowhead-${arrowColors.indexOf(color)}`;


  return (
    <div className="w-full select-none">
      {/* column labels */}
      {showLabels && (
        <div className="flex">
          <div className={gutter} />
          <div
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: SIZE }, (_, c) => (
              <span
                key={c}
                className="text-center text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-xs"
              >
                {c + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* column arrow gutter */}
      <div className="flex">
        <div className={gutter} />
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE }, (_, c) => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight column ${c + 1}`}
              onClick={() => onToggleCol?.(c)}
              className="flex h-6 items-end justify-center sm:h-7"
            >
              <svg viewBox="0 0 12 20" className="h-5 w-3">
                {highlightedCols.has(c) ? (
                  <path
                    d="M6 19 L1 9 H4 V1 H8 V9 H11 Z"
                    fill={style.arrowColor}
                    stroke={style.arrowColor}
                    opacity={style.arrowOpacity}
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
        {/* row label + arrow gutter */}
        <div className={cn("flex flex-col", gutter)}>
          {Array.from({ length: SIZE }, (_, r) => (
            <button
              key={r}
              type="button"
              aria-label={`Highlight row ${r + 1}`}
              onClick={() => onToggleRow?.(r)}
              className="flex flex-1 items-center justify-end gap-1 pr-0.5"
            >
              {showLabels && (
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
                  {r + 1}
                </span>
              )}
              <svg viewBox="0 0 20 12" className="h-3 w-5">
                {highlightedRows.has(r) ? (
                  <path
                    d="M19 6 L9 1 V4 H1 V8 H9 V11 Z"
                    fill={style.arrowColor}
                    stroke={style.arrowColor}
                    opacity={style.arrowOpacity}
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
          <div
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE);
              const c = i % SIZE;
              const region = regionAt(puzzle, r, c);
              const thick = "border-grid-line";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onCellClick?.(i)}
                  aria-label={`Row ${r + 1} column ${c + 1}`}
                  style={{ backgroundColor: puzzle.colors[region] }}
                  className={cn(
                    "relative flex items-center justify-center border-[0.5px] border-grid-line/40 transition-[filter]",
                    r > 0 && regionAt(puzzle, r - 1, c) !== region && `border-t-2 ${thick}`,
                    c > 0 && regionAt(puzzle, r, c - 1) !== region && `border-l-2 ${thick}`,
                    r < SIZE - 1 && regionAt(puzzle, r + 1, c) !== region && `border-b-2 ${thick}`,
                    c < SIZE - 1 && regionAt(puzzle, r, c + 1) !== region && `border-r-2 ${thick}`,
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
                      stroke={conflictCells.has(i) ? style.arrowColor : "currentColor"}
                    />
                  )}
                  {cell.kind === "x" && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <XIcon
                        className="h-[55%] w-[55%]"
                        style={{ color: cell.color ?? "var(--mark)" }}
                        strokeWidth={3}
                      />
                    </span>
                  )}

                  {cell.kind === "q" && (
                    <span
                      className="text-[min(4vw,1.5rem)] font-black leading-none"
                      style={{ color: cell.color ?? "var(--mark)" }}
                    >
                      ?
                    </span>
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
                <path d="M0,0 L4,2 L0,4 Z" fill={style.arrowColor} />
              </marker>
            </defs>

            {[...highlightedRegions].flatMap((region) =>
              regionPerimeter(puzzle, region).map((seg, k) => (
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

            {perimeterOfCells(SIZE, customCells).map((seg, k) => (
              <polyline
                key={`custom-${k}`}
                points={zigzag(seg)}
                fill="none"
                stroke={style.customColor}
                strokeOpacity={style.customOpacity}
                strokeWidth={0.07}
                strokeLinejoin="round"
              />
            ))}

            <g opacity={style.arrowOpacity}>
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
                    stroke={style.arrowColor}
                    strokeWidth={0.07}
                    strokeLinecap="round"
                    markerEnd="url(#sb-arrowhead)"
                  />
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export { idx };
