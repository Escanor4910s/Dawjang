-- Create user_gamification table to store XP, level, and streak data
CREATE TABLE public.user_gamification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  total_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  total_flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_badges table to track earned badges
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_gamification
CREATE POLICY "Users can view their own gamification data"
ON public.user_gamification FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gamification data"
ON public.user_gamification FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification data"
ON public.user_gamification FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for user_badges
CREATE POLICY "Users can view their own badges"
ON public.user_badges FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges"
ON public.user_badges FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_gamification_updated_at
BEFORE UPDATE ON public.user_gamification
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to initialize gamification for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_gamification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create gamification record on user signup
CREATE TRIGGER on_auth_user_created_gamification
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_gamification();