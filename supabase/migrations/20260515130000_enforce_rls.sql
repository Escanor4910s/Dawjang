-- ============================================================
-- Migration: Enforce Row Level Security (RLS) on all tables
-- Date: 2026-05-15
-- Description: Ensures all tables have RLS enabled and adds standard policies.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 1. Profiles (Users can read/update their own profile)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Courses (Users can CRUD their own courses)
DROP POLICY IF EXISTS "Users can view own courses" ON public.courses;
CREATE POLICY "Users can view own courses" ON public.courses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own courses" ON public.courses;
CREATE POLICY "Users can insert own courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own courses" ON public.courses;
CREATE POLICY "Users can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own courses" ON public.courses;
CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- 3. QCM Sessions
DROP POLICY IF EXISTS "Users can view own qcm sessions" ON public.qcm_sessions;
CREATE POLICY "Users can view own qcm sessions" ON public.qcm_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own qcm sessions" ON public.qcm_sessions;
CREATE POLICY "Users can insert own qcm sessions" ON public.qcm_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own qcm sessions" ON public.qcm_sessions;
CREATE POLICY "Users can update own qcm sessions" ON public.qcm_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own qcm sessions" ON public.qcm_sessions;
CREATE POLICY "Users can delete own qcm sessions" ON public.qcm_sessions FOR DELETE USING (auth.uid() = user_id);

-- 4. Quiz Results
DROP POLICY IF EXISTS "Users can view own quiz results" ON public.quiz_results;
CREATE POLICY "Users can view own quiz results" ON public.quiz_results FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz results" ON public.quiz_results;
CREATE POLICY "Users can insert own quiz results" ON public.quiz_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Flashcards
DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;
CREATE POLICY "Users can insert own flashcards" ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own flashcards" ON public.flashcards;
CREATE POLICY "Users can delete own flashcards" ON public.flashcards FOR DELETE USING (auth.uid() = user_id);

-- 6. Summaries
DROP POLICY IF EXISTS "Users can view own summaries" ON public.summaries;
CREATE POLICY "Users can view own summaries" ON public.summaries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own summaries" ON public.summaries;
CREATE POLICY "Users can insert own summaries" ON public.summaries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own summaries" ON public.summaries;
CREATE POLICY "Users can update own summaries" ON public.summaries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own summaries" ON public.summaries;
CREATE POLICY "Users can delete own summaries" ON public.summaries FOR DELETE USING (auth.uid() = user_id);

-- 7. Gamification & Preferences
DROP POLICY IF EXISTS "Users can view own gamification" ON public.user_gamification;
CREATE POLICY "Users can view own gamification" ON public.user_gamification FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gamification" ON public.user_gamification;
CREATE POLICY "Users can update own gamification" ON public.user_gamification FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- 8. Community & Shared (Public Read, Authenticated Write)
DROP POLICY IF EXISTS "Anyone can view community messages" ON public.community_messages;
CREATE POLICY "Anyone can view community messages" ON public.community_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post community messages" ON public.community_messages;
CREATE POLICY "Authenticated users can post community messages" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view shared quizzes" ON public.shared_quizzes;
CREATE POLICY "Anyone can view shared quizzes" ON public.shared_quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can share quizzes" ON public.shared_quizzes;
CREATE POLICY "Authenticated users can share quizzes" ON public.shared_quizzes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Give service role full access to all tables
-- This ensures Edge Functions and backend admin tasks don't get blocked by RLS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
