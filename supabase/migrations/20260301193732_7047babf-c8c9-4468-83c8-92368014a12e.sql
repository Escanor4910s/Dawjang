
-- Allow admins to read all profiles (already public), courses, quiz_results, qcm_sessions, flashcards, user_gamification
CREATE POLICY "Admins can view all courses" ON public.courses FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all quiz_results" ON public.quiz_results FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all qcm_sessions" ON public.qcm_sessions FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all flashcards" ON public.flashcards FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all user_gamification" ON public.user_gamification FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all summaries" ON public.summaries FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can view all user_badges" ON public.user_badges FOR SELECT USING (public.is_admin());
