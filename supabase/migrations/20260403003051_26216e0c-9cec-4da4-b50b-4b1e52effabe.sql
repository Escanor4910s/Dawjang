
-- Table des duels
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  opponent_id uuid,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'waiting',
  question_count integer NOT NULL DEFAULT 5,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_type text NOT NULL DEFAULT 'existing',
  qcm_session_id uuid,
  creator_score integer DEFAULT 0,
  opponent_score integer DEFAULT 0,
  current_question_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

-- Participants can view their own duels
CREATE POLICY "Users can view their duels" ON public.duels
  FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Anyone authenticated can view a duel by invite code (for joining)
CREATE POLICY "Anyone can view duel by invite code" ON public.duels
  FOR SELECT TO authenticated
  USING (status = 'waiting');

-- Creator can insert
CREATE POLICY "Users can create duels" ON public.duels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Participants can update their own duels
CREATE POLICY "Participants can update duels" ON public.duels
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Creator can delete waiting duels
CREATE POLICY "Creator can delete waiting duels" ON public.duels
  FOR DELETE TO authenticated
  USING (auth.uid() = creator_id AND status = 'waiting');

-- Table des réponses de duel
CREATE TABLE public.duel_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_index integer NOT NULL,
  answer text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  time_taken_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duel_id, user_id, question_index)
);

ALTER TABLE public.duel_answers ENABLE ROW LEVEL SECURITY;

-- Users can view answers from duels they participate in
CREATE POLICY "Users can view duel answers" ON public.duel_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.duels
      WHERE id = duel_id
      AND (creator_id = auth.uid() OR opponent_id = auth.uid())
    )
  );

-- Users can insert their own answers
CREATE POLICY "Users can insert their answers" ON public.duel_answers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER TABLE public.duels REPLICA IDENTITY FULL;
ALTER TABLE public.duel_answers REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_answers;
