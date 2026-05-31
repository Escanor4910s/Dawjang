-- ============================================================
-- Migration: Fix RLS gaps identified during security audit
-- Date: 2026-05-26
-- ============================================================

-- 1. Enable RLS on tables where it was missing
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. duels (Users can read/update their own duels)
DROP POLICY IF EXISTS "Users can view own duels" ON public.duels;
CREATE POLICY "Users can view own duels" ON public.duels FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "Users can insert own duels" ON public.duels;
CREATE POLICY "Users can insert own duels" ON public.duels FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update own duels" ON public.duels;
CREATE POLICY "Users can update own duels" ON public.duels FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- 3. duel_answers
DROP POLICY IF EXISTS "Users can view own duel answers" ON public.duel_answers;
CREATE POLICY "Users can view own duel answers" ON public.duel_answers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own duel answers" ON public.duel_answers;
CREATE POLICY "Users can insert own duel answers" ON public.duel_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. user_roles (Read-only for users, managed by service_role)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- 5. user_gamification (INSERT missing)
DROP POLICY IF EXISTS "Users can insert own gamification" ON public.user_gamification;
CREATE POLICY "Users can insert own gamification" ON public.user_gamification FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. user_preferences (INSERT missing)
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. user_badges (INSERT missing)
DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;
CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;
CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. quiz_likes (UPDATE/DELETE missing)
DROP POLICY IF EXISTS "Users can view all quiz likes" ON public.quiz_likes;
CREATE POLICY "Users can view all quiz likes" ON public.quiz_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own quiz likes" ON public.quiz_likes;
CREATE POLICY "Users can insert own quiz likes" ON public.quiz_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quiz likes" ON public.quiz_likes;
CREATE POLICY "Users can delete own quiz likes" ON public.quiz_likes FOR DELETE USING (auth.uid() = user_id);

-- 9. edge_diagnostics (Protect from standard users)
DROP POLICY IF EXISTS "Service role only for edge diagnostics" ON public.edge_diagnostics;
CREATE POLICY "Service role only for edge diagnostics" ON public.edge_diagnostics FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 10. Grant access to service_role on all new policies (in case they don't have it by default)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
