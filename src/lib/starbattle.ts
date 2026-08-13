export const SIZE = 9;

/** Netflix Star Battle, published 5 May 2026. Region id per cell (row-major). */
export const REGIONS: number[][] = [
  [0, 0, 0, 0, 1, 1, 1, 1, 2],
  [0, 0, 0, 0, 3, 1, 2, 2, 2],
  [0, 0, 0, 4, 3, 1, 1, 5, 2],
  [0, 0, 6, 4, 3, 1, 5, 5, 5],
  [0, 0, 6, 4, 3, 3, 3, 3, 5],
  [7, 0, 6, 4, 4, 4, 4, 8, 8],
  [7, 0, 6, 6, 6, 6, 8, 8, 8],
  [7, 0, 0, 0, 0, 8, 8, 8, 8],
  [7, 7, 7, 7, 8, 8, 8, 8, 8],
];

export const REGION_NAMES = [
  "Purple",
  "Brown",
  "Green",
  "Tan",
  "Yellow",
  "Rose",
  "Blue",
  "Grey",
  "Terracotta",
];

/** Unique solution: column index of the star in each row. */
export const SOLUTION = [5, 7, 4, 2, 8, 3, 1, 6, 0];

export type MarkKind = "empty" | "x" | "star";

export type Cell = {
  kind: MarkKind;
  /** Guess colour (hex/oklch token) when placed in guess mode. */
  color?: string;
};

export type Grid = Cell[];

export const idx = (r: number, c: number) => r * SIZE + c;
export const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;

export const emptyGrid = (): Grid =>
  Array.from({ length: SIZE * SIZE }, () => ({ kind: "empty" as MarkKind }));

export const cloneGrid = (g: Grid): Grid => g.map((c) => ({ ...c }));

export function neighbors(r: number, c: number) {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push([nr, nc]);
    }
  return out;
}

/** Cells that cannot hold a star once (r,c) has one. */
export function eliminatedBy(r: number, c: number) {
  const set = new Set<number>();
  for (let k = 0; k < SIZE; k++) {
    set.add(idx(r, k));
    set.add(idx(k, c));
  }
  const region = regionAt(r, c);
  for (let rr = 0; rr < SIZE; rr++)
    for (let cc = 0; cc < SIZE; cc++) if (regionAt(rr, cc) === region) set.add(idx(rr, cc));
  for (const [nr, nc] of neighbors(r, c)) set.add(idx(nr, nc));
  set.delete(idx(r, c));
  return set;
}

export const regionAt = (r: number, c: number) => REGIONS[r]![c]!;

export function isSolved(g: Grid) {
  for (let r = 0; r < SIZE; r++) {
    const c = SOLUTION[r]!;
    if (g[idx(r, c)]!.kind !== "star") return false;
  }
  return g.filter((cell) => cell.kind === "star").length === SIZE;
}

export function conflicts(g: Grid) {
  const bad = new Set<number>();
  const stars: Array<[number, number]> = [];
  g.forEach((cell, i) => {
    const [r, c] = rc(i);
    if (cell.kind === "star") stars.push([r, c]);
  });
  for (let a = 0; a < stars.length; a++)
    for (let b = a + 1; b < stars.length; b++) {
      const [r1, c1] = stars[a]!;
      const [r2, c2] = stars[b]!;
      const same =
        r1 === r2 ||
        c1 === c2 ||
        regionAt(r1, c1) === regionAt(r2, c2) ||
        (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1);
      if (same) {
        bad.add(idx(r1, c1));
        bad.add(idx(r2, c2));
      }
    }
  return bad;
}

/** Edge segments (in cell units) making up the perimeter of a region. */
export function regionPerimeter(region: number) {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (regionAt(r, c) !== region) continue;
      const up = r === 0 || regionAt(r - 1, c) !== region;
      const down = r === SIZE - 1 || regionAt(r + 1, c) !== region;
      const left = c === 0 || regionAt(r, c - 1) !== region;
      const right = c === SIZE - 1 || regionAt(r, c + 1) !== region;
      if (up) segs.push({ x1: c, y1: r, x2: c + 1, y2: r });
      if (down) segs.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
      if (left) segs.push({ x1: c, y1: r, x2: c, y2: r + 1 });
      if (right) segs.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
    }
  return segs;
}

/** Turn a straight unit segment into a zigzag polyline. */
export function zigzag(
  seg: { x1: number; y1: number; x2: number; y2: number },
  teeth = 5,
  amp = 0.07,
) {
  const horizontal = seg.y1 === seg.y2;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const off = (i % 2 === 0 ? -1 : 1) * amp;
    const x = seg.x1 + (seg.x2 - seg.x1) * t + (horizontal ? 0 : off);
    const y = seg.y1 + (seg.y2 - seg.y1) * t + (horizontal ? off : 0);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
}

export const GUESS_COLORS = [
  { name: "Cyan", value: "#22d3ee" },
  { name: "Lime", value: "#a3e635" },
  { name: "Magenta", value: "#f472b6" },
  { name: "Orange", value: "#fb923c" },
  { name: "Violet", value: "#c084fc" },
];
