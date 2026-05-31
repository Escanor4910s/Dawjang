-- ============================================================
-- Migration: Fix cancel_user_subscription - use DISABLE TRIGGER USER
-- Date: 2026-05-26
-- Description: Previous version failed because DISABLE TRIGGER ALL
--   tries to disable system triggers (foreign key constraints).
--   This version uses DISABLE TRIGGER USER to only disable
--   user-defined triggers, and uses UPDATE...RETURNING to verify.
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
  v_rows_affected integer;
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

  -- Disable user-defined triggers only (NOT system/FK triggers)
  ALTER TABLE public.profiles DISABLE TRIGGER USER;

  -- Perform the update and capture the new value
  UPDATE public.profiles
  SET plan = 'gratuit'
  WHERE id = v_user
  RETURNING plan INTO v_new_plan;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- Re-enable user triggers
  ALTER TABLE public.profiles ENABLE TRIGGER USER;

  -- Double-verify by re-reading
  IF v_new_plan IS DISTINCT FROM 'gratuit' OR v_rows_affected = 0 THEN
    -- Failsafe: try raw UPDATE without RETURNING
    UPDATE public.profiles SET plan = 'gratuit' WHERE id = v_user;
    
    -- Read again
    SELECT plan INTO v_new_plan FROM public.profiles WHERE id = v_user;
    
    IF v_new_plan IS DISTINCT FROM 'gratuit' THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'UPDATE échoué malgré DISABLE TRIGGER USER. Plan=' || COALESCE(v_new_plan, 'NULL') || ', rows=' || v_rows_affected,
        'plan', v_new_plan,
        'rows_affected', v_rows_affected
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Abonnement résilié avec succès.',
    'previous_plan', v_old_plan,
    'plan', 'gratuit',
    'rows_affected', v_rows_affected
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_user_subscription() TO authenticated;
