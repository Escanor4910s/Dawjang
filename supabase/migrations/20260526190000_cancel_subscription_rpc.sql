-- ============================================================
-- Migration: Add cancel_subscription RPC function
-- Date: 2026-05-26
-- Description: Creates a SECURITY DEFINER function that allows
--   authenticated users to downgrade their own plan to 'gratuit'.
--   This bypasses any RLS restrictions on the 'plan' column
--   while remaining secure (users can only cancel THEIR OWN plan).
-- ============================================================

-- Drop if exists to make migration idempotent
DROP FUNCTION IF EXISTS public.cancel_user_subscription();

CREATE OR REPLACE FUNCTION public.cancel_user_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old_plan text;
BEGIN
  -- Must be authenticated
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current plan
  SELECT plan INTO v_old_plan FROM public.profiles WHERE id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Already on free plan
  IF v_old_plan IS NULL OR v_old_plan = 'gratuit' OR v_old_plan = 'freemium' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Vous êtes déjà sur le plan gratuit.',
      'plan', COALESCE(v_old_plan, 'gratuit')
    );
  END IF;

  -- Downgrade to gratuit
  UPDATE public.profiles
  SET plan = 'gratuit'
  WHERE id = v_user;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Abonnement résilié avec succès.',
    'previous_plan', v_old_plan,
    'plan', 'gratuit'
  );
END;
$$;

-- Restrict access: only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_user_subscription() TO authenticated;
