export type Puzzle = {
  id: string;
  name: string;
  source: string;
  size: number;
  /** Region id per cell (row-major). */
  regions: number[][];
  /** Fill colour per region id. */
  colors: string[];
  /** Unique solution: column index of the star in each row. */
  solution: number[];
};

const PALETTE = [
  "#7b7ac6",
  "#887360",
  "#8ba065",
  "#b48664",
  "#ceb46a",
  "#b1727a",
  "#8094cf",
  "#909b9f",
  "#b4735a",
  "#8860b6",
];

const paletteFor = (n: number) => Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]!);

export const PUZZLES: Puzzle[] = [
  {
    id: "may-5-2026",
    name: "Netflix · 5 May 2026",
    source: "Netflix Star Battle",
    size: 9,
    regions: [
      [0, 0, 0, 0, 1, 1, 1, 1, 2],
      [0, 0, 0, 0, 3, 1, 2, 2, 2],
      [0, 0, 0, 4, 3, 1, 1, 5, 2],
      [0, 0, 6, 4, 3, 1, 5, 5, 5],
      [0, 0, 6, 4, 3, 3, 3, 3, 5],
      [7, 0, 6, 4, 4, 4, 4, 8, 8],
      [7, 0, 6, 6, 6, 6, 8, 8, 8],
      [7, 0, 0, 0, 0, 8, 8, 8, 8],
      [7, 7, 7, 7, 8, 8, 8, 8, 8],
    ],
    colors: paletteFor(9),
    solution: [5, 7, 4, 2, 8, 3, 1, 6, 0],
  },
  {
    id: "dec-14-2025",
    name: "Scooter · 14 Dec 2025",
    source: "Daily Hard Starstruck",
    size: 10,
    regions: [
      [0, 0, 1, 1, 2, 2, 2, 2, 2, 2],
      [3, 0, 0, 1, 1, 1, 1, 1, 1, 2],
      [3, 3, 0, 0, 0, 1, 4, 4, 4, 2],
      [3, 5, 5, 1, 1, 1, 1, 4, 2, 2],
      [3, 3, 5, 5, 5, 1, 1, 4, 2, 6],
      [5, 5, 5, 7, 7, 1, 1, 4, 2, 6],
      [8, 8, 9, 7, 7, 7, 7, 7, 2, 6],
      [8, 9, 9, 9, 9, 9, 9, 7, 2, 6],
      [8, 2, 9, 9, 2, 2, 2, 2, 2, 6],
      [8, 2, 2, 2, 2, 2, 2, 2, 6, 6],
    ],
    colors: [
      "#7b7ac6",
      "#887360",
      "#8ba065",
      "#b48664",
      "#ceb46a",
      "#b1727a",
      "#8094cf",
      "#909b9f",
      "#b4735a",
      "#8860b6",
    ],
    solution: [5, 2, 8, 0, 4, 6, 1, 7, 3, 9],
  },
  {
    id: "dec-18-2025",
    name: "Hexomino Frame · 18 Dec 2025",
    source: "Daily Hard Starstruck",
    size: 8,
    regions: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 2, 2, 3],
      [0, 1, 4, 5, 2, 2, 2, 3],
      [0, 1, 4, 5, 5, 5, 2, 3],
      [0, 4, 4, 4, 6, 5, 7, 3],
      [0, 4, 6, 6, 6, 5, 7, 3],
      [0, 6, 6, 7, 7, 7, 7, 3],
      [0, 3, 3, 3, 3, 3, 3, 3],
    ],
    colors: [
      "#7b7ac6",
      "#8094cf",
      "#b48664",
      "#887360",
      "#8ba065",
      "#b1727a",
      "#ceb46a",
      "#909b9f",
    ],
    solution: [0, 2, 6, 4, 1, 3, 5, 7],
  },
  {
    id: "dec-26-2025",
    name: "Mountain · 26 Dec 2025",
    source: "Daily Hard Starstruck",
    size: 8,
    regions: [
      [0, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 2, 2],
      [0, 0, 0, 1, 2, 2, 2, 2],
      [3, 3, 3, 1, 2, 2, 2, 2],
      [4, 4, 4, 4, 2, 2, 2, 2],
      [5, 5, 5, 5, 5, 2, 2, 2],
      [6, 6, 6, 6, 6, 6, 2, 2],
      [7, 7, 7, 7, 7, 7, 7, 2],
    ],
    colors: [
      "#7b7ac6",
      "#887360",
      "#8ba065",
      "#b48664",
      "#ceb46a",
      "#b1727a",
      "#8094cf",
      "#909b9f",
    ],
    solution: [5, 7, 2, 0, 3, 1, 4, 6],
  },
];

/** Region colours available when building a grid (taken from the published puzzles). */
export const REGION_PALETTE = PALETTE;

/** Puzzles loaded from the database, registered so snapshots can resolve them. */
const registry = new Map<string, Puzzle>();

export function registerPuzzles(puzzles: Puzzle[]) {
  for (const p of puzzles) registry.set(p.id, p);
}

export const puzzleById = (id: string) =>
  registry.get(id) ?? PUZZLES.find((p) => p.id === id) ?? PUZZLES[0]!;

export type MarkKind = "empty" | "x" | "star" | "q";

export type Cell = {
  kind: MarkKind;
  /** Colour override (guess mode / question labels). */
  color?: string;
};

export type Grid = Cell[];

export const idx = (size: number, r: number, c: number) => r * size + c;
export const rc = (size: number, i: number) => [Math.floor(i / size), i % size] as const;

export const emptyGrid = (size: number): Grid =>
  Array.from({ length: size * size }, () => ({ kind: "empty" as MarkKind }));

export const cloneGrid = (g: Grid): Grid => g.map((c) => ({ ...c }));

export const regionAt = (p: Puzzle, r: number, c: number) => p.regions[r]![c]!;

export function neighbors(size: number, r: number, c: number) {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push([nr, nc]);
    }
  return out;
}

/** Cells that cannot hold a star once (r,c) has one. */
export function eliminatedBy(p: Puzzle, r: number, c: number) {
  const size = p.size;
  const set = new Set<number>();
  for (let k = 0; k < size; k++) {
    set.add(idx(size, r, k));
    set.add(idx(size, k, c));
  }
  const region = regionAt(p, r, c);
  for (let rr = 0; rr < size; rr++)
    for (let cc = 0; cc < size; cc++)
      if (regionAt(p, rr, cc) === region) set.add(idx(size, rr, cc));
  for (const [nr, nc] of neighbors(size, r, c)) set.add(idx(size, nr, nc));
  set.delete(idx(size, r, c));
  return set;
}

export function isSolved(p: Puzzle, g: Grid) {
  for (let r = 0; r < p.size; r++) {
    const c = p.solution[r]!;
    if (g[idx(p.size, r, c)]?.kind !== "star") return false;
  }
  return g.filter((cell) => cell.kind === "star").length === p.size;
}

export function conflicts(p: Puzzle, g: Grid) {
  const bad = new Set<number>();
  const stars: Array<[number, number]> = [];
  g.forEach((cell, i) => {
    const [r, c] = rc(p.size, i);
    if (cell.kind === "star") stars.push([r, c]);
  });
  for (let a = 0; a < stars.length; a++)
    for (let b = a + 1; b < stars.length; b++) {
      const [r1, c1] = stars[a]!;
      const [r2, c2] = stars[b]!;
      const clash =
        r1 === r2 ||
        c1 === c2 ||
        regionAt(p, r1, c1) === regionAt(p, r2, c2) ||
        (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1);
      if (clash) {
        bad.add(idx(p.size, r1, c1));
        bad.add(idx(p.size, r2, c2));
      }
    }
  return bad;
}

/** Edge segments (in cell units) making up the perimeter of a set of cells. */
export function perimeterOfCells(size: number, cells: Set<number>) {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const has = (r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && cells.has(idx(size, r, c));
  for (const i of cells) {
    const [r, c] = rc(size, i);
    if (!has(r - 1, c)) segs.push({ x1: c, y1: r, x2: c + 1, y2: r });
    if (!has(r + 1, c)) segs.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
    if (!has(r, c - 1)) segs.push({ x1: c, y1: r, x2: c, y2: r + 1 });
    if (!has(r, c + 1)) segs.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
  }
  return segs;
}

export function regionCells(p: Puzzle, region: number) {
  const set = new Set<number>();
  for (let r = 0; r < p.size; r++)
    for (let c = 0; c < p.size; c++) if (regionAt(p, r, c) === region) set.add(idx(p.size, r, c));
  return set;
}

export function regionPerimeter(p: Puzzle, region: number) {
  return perimeterOfCells(p.size, regionCells(p, region));
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
