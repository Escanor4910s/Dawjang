-- Create summaries table for storing generated summaries
CREATE TABLE public.summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary_type TEXT NOT NULL DEFAULT 'structured',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER TABLE public.summaries REPLICA IDENTITY FULL;

-- Create RLS policies
CREATE POLICY "Users can view their own summaries"
ON public.summaries
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own summaries"
ON public.summaries
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own summaries"
ON public.summaries
FOR UPDATE
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own summaries"
ON public.summaries
FOR DELETE
USING ((SELECT auth.uid()) = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_summaries_updated_at
BEFORE UPDATE ON public.summaries
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();