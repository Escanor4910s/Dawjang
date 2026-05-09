
-- 1. Drop exposed view that leaks auth.users.email
DROP FUNCTION IF EXISTS public.admin_list_profiles();
DROP VIEW IF EXISTS public.admin_profiles_overview;

-- 2. Revoke EXECUTE from anon and public on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_gamification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_shared_quiz_likes_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_shared_quiz_likes_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_duel_question_integrity_error(uuid, text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_duel_by_invite_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_duel_by_invite_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_duel_answer(uuid, integer, text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.advance_duel_question(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_user_xp(integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_gamification_activity(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.award_badge(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, integer, text, text, text) FROM anon, public;

-- Re-grant to authenticated where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duel_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_duel_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_duel_answer(uuid, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_duel_question(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_xp(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_gamification_activity(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_badge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, integer, text, text, text) TO authenticated;
