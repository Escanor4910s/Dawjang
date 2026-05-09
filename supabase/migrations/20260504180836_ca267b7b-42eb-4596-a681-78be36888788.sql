
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1) DUELS: lock down direct UPDATEs; route writes via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Participants can update duels" ON public.duels;

-- Allow ONLY safe column changes by participants directly (none of the sensitive ones)
-- We still need creator to be able to cancel/delete; delete policy already exists.
-- All score / question_index / status / questions / scores changes go through RPCs below.

-- Server-side answer submission RPC
CREATE OR REPLACE FUNCTION public.submit_duel_answer(
  p_duel_id uuid,
  p_question_index integer,
  p_answer text,
  p_time_taken_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_duel public.duels%ROWTYPE;
  v_question jsonb;
  v_correct text;
  v_is_correct boolean := false;
  v_time_bonus integer;
  v_points integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_duel FROM public.duels WHERE id = p_duel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_user <> v_duel.creator_id AND v_user <> COALESCE(v_duel.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF v_duel.status <> 'active' THEN
    RAISE EXCEPTION 'Duel not active';
  END IF;

  IF p_question_index < 0 OR p_question_index >= v_duel.question_count THEN
    RAISE EXCEPTION 'Invalid question index';
  END IF;

  -- Prevent double answer
  IF EXISTS (SELECT 1 FROM public.duel_answers
             WHERE duel_id = p_duel_id AND user_id = v_user AND question_index = p_question_index) THEN
    RAISE EXCEPTION 'Already answered';
  END IF;

  v_question := v_duel.questions -> p_question_index;
  v_correct := COALESCE(v_question ->> 'correct_answer', v_question ->> 'correctAnswer', '');
  v_is_correct := (p_answer IS NOT NULL AND v_correct IS NOT NULL AND p_answer = v_correct);

  INSERT INTO public.duel_answers (duel_id, user_id, question_index, answer, is_correct, time_taken_ms)
  VALUES (p_duel_id, v_user, p_question_index, p_answer, v_is_correct, GREATEST(0, p_time_taken_ms));

  IF v_is_correct THEN
    v_time_bonus := GREATEST(0, 100 - (GREATEST(0, p_time_taken_ms) / 100));
    v_points := 100 + v_time_bonus;
    IF v_user = v_duel.creator_id THEN
      UPDATE public.duels SET creator_score = COALESCE(creator_score,0) + v_points WHERE id = p_duel_id;
    ELSE
      UPDATE public.duels SET opponent_score = COALESCE(opponent_score,0) + v_points WHERE id = p_duel_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct, 'points', v_points);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_duel_answer(uuid, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_duel_answer(uuid, integer, text, integer) TO authenticated;

-- Server-side advance question RPC (any participant)
CREATE OR REPLACE FUNCTION public.advance_duel_question(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_duel public.duels%ROWTYPE;
  v_next int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_duel FROM public.duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel not found'; END IF;
  IF v_user <> v_duel.creator_id AND v_user <> COALESCE(v_duel.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  v_next := COALESCE(v_duel.current_question_index, 0) + 1;
  IF v_next >= v_duel.question_count THEN
    UPDATE public.duels
       SET current_question_index = v_next,
           status = 'completed',
           completed_at = now()
     WHERE id = p_duel_id;
  ELSE
    UPDATE public.duels SET current_question_index = v_next WHERE id = p_duel_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_duel_question(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_duel_question(uuid) TO authenticated;

-- 2) USER_GAMIFICATION: remove direct UPDATE policy; only RPCs may write
DROP POLICY IF EXISTS "Users can update their own gamification" ON public.user_gamification;

-- 3) SHARED_QUIZZES: prevent owners from tampering with likes_count
-- Trigger to lock likes_count on direct updates
CREATE OR REPLACE FUNCTION public.protect_shared_quiz_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.likes_count IS DISTINCT FROM OLD.likes_count THEN
    NEW.likes_count := OLD.likes_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shared_quiz_likes_count ON public.shared_quizzes;
CREATE TRIGGER trg_protect_shared_quiz_likes_count
BEFORE UPDATE ON public.shared_quizzes
FOR EACH ROW EXECUTE FUNCTION public.protect_shared_quiz_likes_count();

-- Auto-recompute likes_count from quiz_likes
CREATE OR REPLACE FUNCTION public.sync_shared_quiz_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shared_quizzes
       SET likes_count = (SELECT COUNT(*) FROM public.quiz_likes WHERE shared_quiz_id = NEW.shared_quiz_id)
     WHERE id = NEW.shared_quiz_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.shared_quizzes
       SET likes_count = (SELECT COUNT(*) FROM public.quiz_likes WHERE shared_quiz_id = OLD.shared_quiz_id)
     WHERE id = OLD.shared_quiz_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_likes_sync_ins ON public.quiz_likes;
DROP TRIGGER IF EXISTS trg_quiz_likes_sync_del ON public.quiz_likes;
CREATE TRIGGER trg_quiz_likes_sync_ins
AFTER INSERT ON public.quiz_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_shared_quiz_likes_count();
CREATE TRIGGER trg_quiz_likes_sync_del
AFTER DELETE ON public.quiz_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_shared_quiz_likes_count();
