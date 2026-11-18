CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_unique
  ON public.payments (paytech_ref)
  WHERE paytech_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_completed_payment(
  p_user_id uuid,
  p_plan_id text,
  p_amount integer,
  p_currency text,
  p_billing_cycle text,
  p_reference text,
  p_provider_token text,
  p_payment_method text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_current_expiry timestamptz;
  v_expires_at timestamptz;
BEGIN
  IF p_plan_id NOT IN ('premium', 'pro')
    OR p_billing_cycle NOT IN ('monthly', 'yearly')
    OR p_amount <= 0
    OR NULLIF(p_reference, '') IS NULL THEN
    RAISE EXCEPTION 'Invalid payment data';
  END IF;

  INSERT INTO public.payments (
    user_id, plan_id, amount, currency, billing_cycle, status,
    paytech_ref, paytech_token, payment_method, completed_at, metadata
  ) VALUES (
    p_user_id, p_plan_id, p_amount, p_currency, p_billing_cycle, 'completed',
    p_reference, p_provider_token, p_payment_method, now(), p_metadata
  )
  ON CONFLICT (paytech_ref) WHERE paytech_ref IS NOT NULL DO NOTHING
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'alreadyProcessed', true);
  END IF;

  SELECT plan_expires_at INTO v_current_expiry
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_expires_at := GREATEST(now(), COALESCE(v_current_expiry, now()))
    + CASE WHEN p_billing_cycle = 'yearly' THEN interval '365 days' ELSE interval '30 days' END;

  UPDATE public.profiles
  SET plan = p_plan_id,
      plan_updated_at = now(),
      plan_expires_at = v_expires_at
  WHERE id = p_user_id;

  RETURN jsonb_build_object('recorded', true, 'alreadyProcessed', false, 'expiresAt', v_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.record_completed_payment(uuid, text, integer, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_completed_payment(uuid, text, integer, text, text, text, text, text, jsonb) TO service_role;
