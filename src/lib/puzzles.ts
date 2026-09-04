import { supabase } from "@/integrations/supabase/client";
import type { Puzzle } from "@/lib/starbattle";
import type { Note } from "@/components/star-battle/Notes";

export type PuzzleCategory = "walkthrough" | "uniqueness";

export const CATEGORY_LABEL: Record<PuzzleCategory, string> = {
  walkthrough: "Walkthroughs of difficult puzzles",
  uniqueness: "Spotting uniqueness in Star Battle",
};

export type PuzzleRecord = Puzzle & {
  playDate: string;
  category: PuzzleCategory;
  steps: Note[];
};

export type PuzzleInput = {
  playDate: string;
  name: string;
  source: string;
  size: number;
  category: PuzzleCategory;
  regions: number[][];
  colors: string[];
  solution: number[];
};

type Row = {
  id: string;
  play_date: string;
  name: string;
  source: string;
  size: number;
  category?: string | null;
  regions: unknown;
  colors: unknown;
  solution: unknown;
  steps: unknown;
};

const toRecord = (row: Row): PuzzleRecord => ({
  id: row.id,
  playDate: row.play_date,
  name: row.name,
  source: row.source,
  size: row.size,
  category: (row.category === "uniqueness" ? "uniqueness" : "walkthrough") as PuzzleCategory,
  regions: row.regions as number[][],
  colors: row.colors as string[],
  solution: row.solution as number[],
  steps: (row.steps ?? []) as Note[],
});

const toRow = (input: PuzzleInput) => ({
  play_date: input.playDate,
  name: input.name,
  source: input.source,
  size: input.size,
  category: input.category,
  regions: input.regions,
  colors: input.colors,
  solution: input.solution,
});

export async function listPuzzles(): Promise<PuzzleRecord[]> {
  const { data, error } = await supabase
    .from("puzzles")
    .select("*")
    .order("play_date", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(toRecord);
}

export async function getPuzzle(id: string): Promise<PuzzleRecord | null> {
  const { data, error } = await supabase.from("puzzles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as unknown as Row) : null;
}

export async function createPuzzle(input: PuzzleInput): Promise<PuzzleRecord> {
  const { data, error } = await supabase.from("puzzles").insert(toRow(input)).select("*").single();
  if (error) throw error;
  return toRecord(data as unknown as Row);
}

export async function updatePuzzle(id: string, input: PuzzleInput): Promise<PuzzleRecord> {
  const { data, error } = await supabase
    .from("puzzles")
    .update(toRow(input))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toRecord(data as unknown as Row);
}

export async function saveSteps(id: string, steps: Note[]) {
  const { error } = await supabase
    .from("puzzles")
    .update({ steps: steps as unknown as never })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePuzzle(id: string) {
  const { error } = await supabase.from("puzzles").delete().eq("id", id);
  if (error) throw error;
}

/** yyyy-mm-dd in local time (no UTC shifting). */
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "5 May 2026" from a yyyy-mm-dd key. */
export const formatPlayDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
