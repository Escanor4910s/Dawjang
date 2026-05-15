-- Migration : Mode Collaboratif et Notifications Push
-- A exécuter dans le SQL Editor de Supabase

-- 1. Table des sessions collaboratives
CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, active, completed
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    max_participants INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des abonnements Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Activation de RLS
ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Politiques de sécurité (RLS)
-- Sessions collaboratives
DROP POLICY IF EXISTS "Anyone can view collaborative sessions" ON public.collaborative_sessions;
CREATE POLICY "Anyone can view collaborative sessions" ON public.collaborative_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.collaborative_sessions;
CREATE POLICY "Authenticated users can create sessions" ON public.collaborative_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Host can update session" ON public.collaborative_sessions;
CREATE POLICY "Host can update session" ON public.collaborative_sessions FOR UPDATE USING (auth.uid() = host_id);

-- Abonnements Push
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 5. Autorisations pour Edge Functions (service_role)
GRANT ALL ON public.collaborative_sessions TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Terminé !
