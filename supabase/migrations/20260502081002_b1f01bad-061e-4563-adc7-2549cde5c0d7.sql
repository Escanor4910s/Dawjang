
-- =========================================================
-- 1) user_gamification: restrict writes to row owner
-- =========================================================
CREATE POLICY "Users can insert their own gamification"
ON public.user_gamification
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification"
ON public.user_gamification
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 2) user_badges: remove client self-insert; use SECURITY DEFINER RPC
-- =========================================================
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;

-- Server-validated badge awarding. Returns true if newly awarded, false otherwise.
CREATE OR REPLACE FUNCTION public.award_badge(p_badge_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_gam record;
  v_eligible boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Already earned? noop
  IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_user_id AND badge_id = p_badge_id) THEN
    RETURN false;
  END IF;

  SELECT xp, level, current_streak, longest_streak,
         total_quizzes_completed, total_flashcards_reviewed
    INTO v_gam
    FROM public.user_gamification
   WHERE user_id = v_user_id;

  IF v_gam IS NULL THEN
    RETURN false;
  END IF;

  -- Validate eligibility based on the badge id
  v_eligible := CASE p_badge_id
    WHEN 'level_5'  THEN v_gam.level >= 5
    WHEN 'level_10' THEN v_gam.level >= 10
    WHEN 'level_20' THEN v_gam.level >= 20
    WHEN 'level_30' THEN v_gam.level >= 30
    WHEN 'streak_3'  THEN v_gam.current_streak >= 3  OR v_gam.longest_streak >= 3
    WHEN 'streak_7'  THEN v_gam.current_streak >= 7  OR v_gam.longest_streak >= 7
    WHEN 'streak_14' THEN v_gam.current_streak >= 14 OR v_gam.longest_streak >= 14
    WHEN 'streak_30' THEN v_gam.current_streak >= 30 OR v_gam.longest_streak >= 30
    WHEN 'quiz_1'    THEN v_gam.total_quizzes_completed >= 1
    WHEN 'quiz_10'   THEN v_gam.total_quizzes_completed >= 10
    WHEN 'quiz_50'   THEN v_gam.total_quizzes_completed >= 50
    WHEN 'quiz_100'  THEN v_gam.total_quizzes_completed >= 100
    WHEN 'flashcard_10'  THEN v_gam.total_flashcards_reviewed >= 10
    WHEN 'flashcard_50'  THEN v_gam.total_flashcards_reviewed >= 50
    WHEN 'flashcard_100' THEN v_gam.total_flashcards_reviewed >= 100
    WHEN 'duel_winner' THEN EXISTS (
      SELECT 1 FROM public.duels
       WHERE status = 'completed'
         AND ((creator_id = v_user_id AND creator_score > opponent_score)
           OR (opponent_id = v_user_id AND opponent_score > creator_score))
    )
    ELSE false
  END;

  IF NOT v_eligible THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (v_user_id, p_badge_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.award_badge(text) FROM public;
GRANT EXECUTE ON FUNCTION public.award_badge(text) TO authenticated;

-- =========================================================
-- 3) Realtime: scope channel subscriptions
-- =========================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to subscribe only to topics they own
CREATE POLICY "Authenticated users can read their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Public topics
  realtime.topic() IN ('community', 'leaderboard')
  -- Personal user topic: user:{uid}
  OR realtime.topic() = 'user:' || auth.uid()::text
  -- Duel topic: duel:{duel_id} where caller is a participant
  OR (
    realtime.topic() LIKE 'duel:%'
    AND EXISTS (
      SELECT 1 FROM public.duels d
      WHERE d.id::text = substring(realtime.topic() from 6)
        AND (d.creator_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  )
  -- QCM session topic: qcm:{session_id} where caller owns the session
  OR (
    realtime.topic() LIKE 'qcm:%'
    AND EXISTS (
      SELECT 1 FROM public.qcm_sessions s
      WHERE s.id::text = substring(realtime.topic() from 5)
        AND s.user_id = auth.uid()
    )
  )
);

-- Allow authenticated users to broadcast/presence on the same topics
CREATE POLICY "Authenticated users can write to their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN ('community', 'leaderboard')
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR (
    realtime.topic() LIKE 'duel:%'
    AND EXISTS (
      SELECT 1 FROM public.duels d
      WHERE d.id::text = substring(realtime.topic() from 6)
        AND (d.creator_id = auth.uid() OR d.opponent_id = auth.uid())
    )
  )
  OR (
    realtime.topic() LIKE 'qcm:%'
    AND EXISTS (
      SELECT 1 FROM public.qcm_sessions s
      WHERE s.id::text = substring(realtime.topic() from 5)
        AND s.user_id = auth.uid()
    )
  )
);
