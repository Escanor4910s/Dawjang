-- Création de la table ecos_sessions
CREATE TABLE IF NOT EXISTS public.ecos_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id TEXT NOT NULL,
    case_title TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours', 'termine'
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour la performance des requêtes (afficher l'historique d'un utilisateur)
CREATE INDEX IF NOT EXISTS idx_ecos_sessions_user_id ON public.ecos_sessions(user_id);

-- Activation de RLS (Row Level Security)
ALTER TABLE public.ecos_sessions ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (RLS) : Un utilisateur ne peut voir et modifier que ses propres sessions
CREATE POLICY "Les utilisateurs peuvent voir leurs propres sessions ECOS"
    ON public.ecos_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent insérer leurs propres sessions ECOS"
    ON public.ecos_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres sessions ECOS"
    ON public.ecos_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres sessions ECOS"
    ON public.ecos_sessions FOR DELETE
    USING (auth.uid() = user_id);
