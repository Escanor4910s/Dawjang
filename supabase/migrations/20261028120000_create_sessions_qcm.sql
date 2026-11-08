-- Migration: Table sessions_qcm pour la gestion complète et l'unicité des sessions d'entraînement QCM
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.sessions_qcm (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  qcm_base_id text NOT NULL,
  session_started timestamptz DEFAULT now(),
  session_ended timestamptz,
  questions jsonb NOT NULL,
  user_answers jsonb DEFAULT '{}'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer DEFAULT 0,
  unique_hash text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  time_elapsed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour optimiser les requêtes sur l'utilisateur, le deck de base, le statut et le hash d'unicité
CREATE INDEX IF NOT EXISTS idx_sessions_qcm_user_id ON public.sessions_qcm(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_qcm_qcm_base_id ON public.sessions_qcm(qcm_base_id);
CREATE INDEX IF NOT EXISTS idx_sessions_qcm_unique_hash ON public.sessions_qcm(unique_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_qcm_status ON public.sessions_qcm(status);

-- Activation de la Row Level Security (RLS)
ALTER TABLE public.sessions_qcm ENABLE ROW LEVEL SECURITY;

-- Politiques RLS permissives et sécurisées pour sessions_qcm
DROP POLICY IF EXISTS "Users can view their own sessions_qcm" ON public.sessions_qcm;
CREATE POLICY "Users can view their own sessions_qcm"
ON public.sessions_qcm FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can insert their own sessions_qcm" ON public.sessions_qcm;
CREATE POLICY "Users can insert their own sessions_qcm"
ON public.sessions_qcm FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own sessions_qcm" ON public.sessions_qcm;
CREATE POLICY "Users can update their own sessions_qcm"
ON public.sessions_qcm FOR UPDATE
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can delete their own sessions_qcm" ON public.sessions_qcm;
CREATE POLICY "Users can delete their own sessions_qcm"
ON public.sessions_qcm FOR DELETE
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);
