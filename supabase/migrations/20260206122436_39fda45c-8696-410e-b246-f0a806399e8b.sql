
-- Function to get leaderboard data (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 20)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  xp integer,
  level integer,
  current_streak integer,
  total_quizzes_completed integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ug.user_id,
    COALESCE(p.first_name, p.name, 'Étudiant anonyme') as display_name,
    p.avatar_url,
    ug.xp,
    ug.level,
    ug.current_streak,
    ug.total_quizzes_completed
  FROM user_gamification ug
  LEFT JOIN profiles p ON p.id = ug.user_id
  WHERE ug.xp > 0
  ORDER BY ug.xp DESC
  LIMIT limit_count;
$$;
