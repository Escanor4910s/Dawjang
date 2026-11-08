-- Migration: Registre Fantôme Anti-Répétition (SHA-256) & Support Prisme
CREATE TABLE IF NOT EXISTS public.qcm_ghost_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_content_hash TEXT NOT NULL,
  fact_signature TEXT NOT NULL,
  question_type TEXT NOT NULL,
  question_stem_hash TEXT NOT NULL,
  question_stem_preview TEXT NOT NULL,
  generation_epoch INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ghost_ledger_lookup 
  ON public.qcm_ghost_ledger(user_id, course_content_hash);

ALTER TABLE public.qcm_ghost_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qcm_ghost_ledger' AND policyname = 'Users can manage their own ghost ledger'
  ) THEN
    CREATE POLICY "Users can manage their own ghost ledger"
      ON public.qcm_ghost_ledger
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
