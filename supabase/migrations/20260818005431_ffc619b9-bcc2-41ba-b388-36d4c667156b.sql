
CREATE TABLE public.puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_date date NOT NULL,
  name text NOT NULL,
  source text NOT NULL DEFAULT '',
  size int NOT NULL CHECK (size BETWEEN 5 AND 12),
  regions jsonb NOT NULL,
  colors jsonb NOT NULL,
  solution jsonb NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX puzzles_play_date_idx ON public.puzzles (play_date);

GRANT SELECT ON public.puzzles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.puzzles TO authenticated;
GRANT ALL ON public.puzzles TO service_role;

ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_site_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', auth.jwt() ->> 'email', '')) = 'gohpihan@gmail.com'
$fn$;

CREATE POLICY "Puzzles are publicly readable" ON public.puzzles FOR SELECT USING (true);
CREATE POLICY "Editor can create puzzles" ON public.puzzles FOR INSERT TO authenticated WITH CHECK (public.is_site_editor());
CREATE POLICY "Editor can update puzzles" ON public.puzzles FOR UPDATE TO authenticated USING (public.is_site_editor()) WITH CHECK (public.is_site_editor());
CREATE POLICY "Editor can delete puzzles" ON public.puzzles FOR DELETE TO authenticated USING (public.is_site_editor());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

CREATE TRIGGER puzzles_set_updated_at BEFORE UPDATE ON public.puzzles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.puzzles (play_date, name, source, size, regions, colors, solution) VALUES
('2026-05-05','Netflix · 5 May 2026','Netflix Star Battle',9,'[[0, 0, 0, 0, 1, 1, 1, 1, 2], [0, 0, 0, 0, 3, 1, 2, 2, 2], [0, 0, 0, 4, 3, 1, 1, 5, 2], [0, 0, 6, 4, 3, 1, 5, 5, 5], [0, 0, 6, 4, 3, 3, 3, 3, 5], [7, 0, 6, 4, 4, 4, 4, 8, 8], [7, 0, 6, 6, 6, 6, 8, 8, 8], [7, 0, 0, 0, 0, 8, 8, 8, 8], [7, 7, 7, 7, 8, 8, 8, 8, 8]]'::jsonb,'["#7b7ac6", "#887360", "#8ba065", "#b48664", "#ceb46a", "#b1727a", "#8094cf", "#909b9f", "#b4735a"]'::jsonb,'[5, 7, 4, 2, 8, 3, 1, 6, 0]'::jsonb),
('2025-12-14','Scooter · 14 Dec 2025','Daily Hard Starstruck',10,'[[0, 0, 1, 1, 2, 2, 2, 2, 2, 2], [3, 0, 0, 1, 1, 1, 1, 1, 1, 2], [3, 3, 0, 0, 0, 1, 4, 4, 4, 2], [3, 5, 5, 1, 1, 1, 1, 4, 2, 2], [3, 3, 5, 5, 5, 1, 1, 4, 2, 6], [5, 5, 5, 7, 7, 1, 1, 4, 2, 6], [8, 8, 9, 7, 7, 7, 7, 7, 2, 6], [8, 9, 9, 9, 9, 9, 9, 7, 2, 6], [8, 2, 9, 9, 2, 2, 2, 2, 2, 6], [8, 2, 2, 2, 2, 2, 2, 2, 6, 6]]'::jsonb,'["#7b7ac6", "#887360", "#8ba065", "#b48664", "#ceb46a", "#b1727a", "#8094cf", "#909b9f", "#b4735a", "#8860b6"]'::jsonb,'[5, 2, 8, 0, 4, 6, 1, 7, 3, 9]'::jsonb),
('2025-12-18','Hexomino Frame · 18 Dec 2025','Daily Hard Starstruck',8,'[[0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 1, 1, 1, 2, 2, 3], [0, 1, 4, 5, 2, 2, 2, 3], [0, 1, 4, 5, 5, 5, 2, 3], [0, 4, 4, 4, 6, 5, 7, 3], [0, 4, 6, 6, 6, 5, 7, 3], [0, 6, 6, 7, 7, 7, 7, 3], [0, 3, 3, 3, 3, 3, 3, 3]]'::jsonb,'["#7b7ac6", "#8094cf", "#b48664", "#887360", "#8ba065", "#b1727a", "#ceb46a", "#909b9f"]'::jsonb,'[0, 2, 6, 4, 1, 3, 5, 7]'::jsonb),
('2025-12-26','Mountain · 26 Dec 2025','Daily Hard Starstruck',8,'[[0, 1, 1, 1, 1, 1, 1, 1], [0, 0, 1, 1, 1, 1, 2, 2], [0, 0, 0, 1, 2, 2, 2, 2], [3, 3, 3, 1, 2, 2, 2, 2], [4, 4, 4, 4, 2, 2, 2, 2], [5, 5, 5, 5, 5, 2, 2, 2], [6, 6, 6, 6, 6, 6, 2, 2], [7, 7, 7, 7, 7, 7, 7, 2]]'::jsonb,'["#7b7ac6", "#887360", "#8ba065", "#b48664", "#ceb46a", "#b1727a", "#8094cf", "#909b9f"]'::jsonb,'[5, 7, 2, 0, 3, 1, 4, 6]'::jsonb);
