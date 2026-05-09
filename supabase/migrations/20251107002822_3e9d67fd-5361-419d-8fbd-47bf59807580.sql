-- Table pour stocker les résultats des quiz
CREATE TABLE public.quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- Policies pour quiz_results
CREATE POLICY "Users can view their own quiz results"
ON public.quiz_results
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results"
ON public.quiz_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Table pour stocker les flashcards
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Policies pour flashcards
CREATE POLICY "Users can view their own flashcards"
ON public.flashcards
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flashcards"
ON public.flashcards
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards"
ON public.flashcards
FOR DELETE
USING (auth.uid() = user_id);

-- Index pour améliorer les performances
CREATE INDEX idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX idx_quiz_results_course_id ON public.quiz_results(course_id);
CREATE INDEX idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX idx_flashcards_course_id ON public.flashcards(course_id);