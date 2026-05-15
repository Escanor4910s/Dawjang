-- ============================================================
-- Migration: Create payments table for transaction history
-- Date: 2026-05-15
-- Description: Stores PayTech payment records for audit trail
-- ============================================================

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('premium', 'pro')),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF',
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paytech_ref text,
  paytech_token text,
  payment_method text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);

-- Add subscription expiration to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

-- RLS: Users can only read their own payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payments"
  ON public.payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant access
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
