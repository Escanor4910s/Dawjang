-- Création de la table pour les cartes débloquées par l'utilisateur
CREATE TABLE IF NOT EXISTS public.user_unlocked_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, card_id)
);

-- Active RLS sur la table
ALTER TABLE public.user_unlocked_cards ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (Sécurité)
-- Les utilisateurs peuvent voir leurs propres cartes
CREATE POLICY "Les utilisateurs peuvent voir leurs propres cartes" 
ON public.user_unlocked_cards FOR SELECT 
USING (auth.uid() = user_id);

-- Les utilisateurs peuvent insérer leurs propres cartes (Option B: Logique Frontend)
CREATE POLICY "Les utilisateurs peuvent débloquer des cartes" 
ON public.user_unlocked_cards FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Notification en temps réel optionnelle
alter publication supabase_realtime add table public.user_unlocked_cards;
