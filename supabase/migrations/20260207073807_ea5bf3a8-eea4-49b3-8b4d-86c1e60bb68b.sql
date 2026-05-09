
-- Add SM-2 spaced repetition columns to flashcards
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS ease_factor REAL NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add UPDATE policy for flashcards (needed for SM-2 updates)
CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create community_messages table
CREATE TABLE public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view messages"
  ON public.community_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own messages"
  ON public.community_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.community_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Create shared_quizzes table
CREATE TABLE public.shared_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  qcm_session_id UUID NOT NULL REFERENCES public.qcm_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view shared quizzes"
  ON public.shared_quizzes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can share their own quizzes"
  ON public.shared_quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared quizzes"
  ON public.shared_quizzes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared quizzes"
  ON public.shared_quizzes FOR UPDATE
  USING (auth.uid() = user_id);

-- Create quiz_likes table
CREATE TABLE public.quiz_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shared_quiz_id UUID NOT NULL REFERENCES public.shared_quizzes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, shared_quiz_id)
);

ALTER TABLE public.quiz_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
  ON public.quiz_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own likes"
  ON public.quiz_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.quiz_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Add realtime for new tables
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
ALTER TABLE public.shared_quizzes REPLICA IDENTITY FULL;

-- Add index for next_review queries
CREATE INDEX idx_flashcards_next_review ON public.flashcards(user_id, next_review);
