-- Fix Linter Warning: SECURITY DEFINER functions should explicitly set search_path
-- This prevents a malicious user from overriding operators or functions used within the SECURITY DEFINER.

ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_new_user_gamification() SET search_path = public;
ALTER FUNCTION public.protect_profile_sensitive_fields() SET search_path = public;
ALTER FUNCTION public.protect_shared_quiz_likes_count() SET search_path = public;
ALTER FUNCTION public.sync_shared_quiz_likes_count() SET search_path = public;
ALTER FUNCTION public.log_duel_question_integrity_error(uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.get_duel_by_invite_code(text) SET search_path = public;
ALTER FUNCTION public.join_duel_by_invite_code(text) SET search_path = public;
ALTER FUNCTION public.submit_duel_answer(uuid, integer, text, integer) SET search_path = public;
ALTER FUNCTION public.advance_duel_question(uuid) SET search_path = public;
ALTER FUNCTION public.increment_user_xp(integer, text) SET search_path = public;
ALTER FUNCTION public.record_gamification_activity(text) SET search_path = public;
ALTER FUNCTION public.award_badge(text) SET search_path = public;
ALTER FUNCTION public.get_leaderboard(integer) SET search_path = public;
ALTER FUNCTION public.admin_update_profile(uuid, text, text, text, integer, text, text, text) SET search_path = public;
