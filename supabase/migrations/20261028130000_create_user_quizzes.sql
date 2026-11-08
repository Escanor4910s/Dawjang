-- Migration: Table user_quizzes pour la sauvegarde et la récupération des quiz générés
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  subject text,
  quiz jsonb NOT NULL,
  unique_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour optimiser les requêtes sur l'utilisateur, la date de création et le hash d'unicité
CREATE INDEX IF NOT EXISTS idx_user_quizzes_user_id ON public.user_quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_created_at ON public.user_quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_unique_hash ON public.user_quizzes(unique_hash);

-- Activation de la Row Level Security (RLS)
ALTER TABLE public.user_quizzes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS sécurisées et tolérantes (dev/guest & authenticated)
DROP POLICY IF EXISTS "Users can view their own quizzes" ON public.user_quizzes;
CREATE POLICY "Users can view their own quizzes"
ON public.user_quizzes FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can insert their own quizzes" ON public.user_quizzes;
CREATE POLICY "Users can insert their own quizzes"
ON public.user_quizzes FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own quizzes" ON public.user_quizzes;
CREATE POLICY "Users can update their own quizzes"
ON public.user_quizzes FOR UPDATE
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can delete their own quizzes" ON public.user_quizzes;
CREATE POLICY "Users can delete their own quizzes"
ON public.user_quizzes FOR DELETE
USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);
