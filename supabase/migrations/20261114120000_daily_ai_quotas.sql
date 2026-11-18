CREATE TABLE IF NOT EXISTS public.daily_ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  feature text NOT NULL CHECK (feature IN ('qcm', 'summary')),
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date, feature)
);

ALTER TABLE public.daily_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_ai_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.daily_ai_usage TO service_role;

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_feature text,
  p_amount integer,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
BEGIN
  IF p_feature NOT IN ('qcm', 'summary') OR p_amount < 1 OR p_amount > p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0);
  END IF;

  INSERT INTO public.daily_ai_usage (user_id, feature, amount)
  VALUES (p_user_id, p_feature, p_amount)
  ON CONFLICT (user_id, usage_date, feature)
  DO UPDATE SET amount = daily_ai_usage.amount + EXCLUDED.amount, updated_at = now()
  WHERE daily_ai_usage.amount + EXCLUDED.amount <= p_limit
  RETURNING amount INTO v_amount;

  IF NOT FOUND THEN
    SELECT amount INTO v_amount
    FROM public.daily_ai_usage
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE AND feature = p_feature;
    RETURN jsonb_build_object('allowed', false, 'remaining', GREATEST(0, p_limit - COALESCE(v_amount, 0)));
  END IF;

  RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, p_limit - v_amount));
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) TO service_role;
