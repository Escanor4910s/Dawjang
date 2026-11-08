-- 1. Correction des politiques RLS pour les Duels (Création)
-- S'assure que l'utilisateur peut créer une arène (insérer dans la table duels)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'duels' AND policyname = 'Les utilisateurs peuvent créer des duels'
    ) THEN
        CREATE POLICY "Les utilisateurs peuvent créer des duels" 
        ON public.duels 
        FOR INSERT 
        WITH CHECK (auth.uid() = creator_id);
    END IF;
END
$$;

-- S'assure que la table duels est bien sécurisée
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

-- 2. Création de la table Notifications pour persister les états de lecture
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Les utilisateurs peuvent voir leurs propres notifications'
    ) THEN
        CREATE POLICY "Les utilisateurs peuvent voir leurs propres notifications" 
        ON public.notifications 
        FOR SELECT 
        USING (auth.uid() = user_id);

        CREATE POLICY "Les utilisateurs peuvent insérer leurs propres notifications" 
        ON public.notifications 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres notifications" 
        ON public.notifications 
        FOR UPDATE 
        USING (auth.uid() = user_id);

        CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres notifications" 
        ON public.notifications 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 3. Mise à jour de la fonction get_leaderboard pour retourner 50 utilisateurs (et non 5)
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count INT DEFAULT 50)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    xp INT,
    total_quizzes_completed INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        COALESCE(p.first_name || ' ' || p.last_name, p.first_name, 'Étudiant') as display_name,
        COALESCE(s.xp, 0) as xp,
        COALESCE(s.quizzes_completed, 0) as total_quizzes_completed
    FROM public.profiles p
    LEFT JOIN public.user_stats s ON p.id = s.user_id
    ORDER BY xp DESC, total_quizzes_completed DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
