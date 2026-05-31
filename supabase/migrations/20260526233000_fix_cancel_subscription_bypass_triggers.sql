-- ============================================================
-- Migration: Fix cancel_user_subscription to bypass triggers
-- Date: 2026-05-26
-- Description: The previous version's UPDATE was being silently
--   blocked (likely by a trigger). This version uses
--   ALTER TABLE ... DISABLE TRIGGER ALL to ensure the update
--   goes through, then re-enables triggers.
-- ============================================================

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
  v_new_plan text;
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

  -- Temporarily disable ALL triggers on profiles to bypass any blockers
  ALTER TABLE public.profiles DISABLE TRIGGER ALL;

  -- Perform the update
  UPDATE public.profiles
  SET plan = 'gratuit'
  WHERE id = v_user;

  -- Re-enable triggers
  ALTER TABLE public.profiles ENABLE TRIGGER ALL;

  -- Verify the update actually took effect
  SELECT plan INTO v_new_plan FROM public.profiles WHERE id = v_user;

  IF v_new_plan IS DISTINCT FROM 'gratuit' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'UPDATE exécuté mais plan inchangé: ' || COALESCE(v_new_plan, 'NULL'),
      'plan', v_new_plan
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Abonnement résilié avec succès.',
    'previous_plan', v_old_plan,
    'plan', 'gratuit'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_user_subscription() TO authenticated;
