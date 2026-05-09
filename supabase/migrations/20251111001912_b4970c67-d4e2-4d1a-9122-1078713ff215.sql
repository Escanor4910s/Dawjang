-- Créer la table qcm_sessions pour stocker les sessions de quiz
CREATE TABLE IF NOT EXISTS public.qcm_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  question_count integer NOT NULL DEFAULT 0,
  question_type text,
  ai_model text,
  metadata jsonb,
  score integer,
  total_questions integer,
  answers jsonb,
  time_elapsed integer,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_user_id ON public.qcm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_course_id ON public.qcm_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_status ON public.qcm_sessions(status);

-- RLS pour qcm_sessions
ALTER TABLE public.qcm_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own qcm sessions"
ON public.qcm_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own qcm sessions"
ON public.qcm_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own qcm sessions"
ON public.qcm_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own qcm sessions"
ON public.qcm_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.qcm_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();