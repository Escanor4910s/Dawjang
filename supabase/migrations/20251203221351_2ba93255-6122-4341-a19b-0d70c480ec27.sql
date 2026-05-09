-- Enable REPLICA IDENTITY FULL for realtime updates
ALTER TABLE public.quiz_results REPLICA IDENTITY FULL;
ALTER TABLE public.flashcards REPLICA IDENTITY FULL;
ALTER TABLE public.qcm_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.courses REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qcm_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;