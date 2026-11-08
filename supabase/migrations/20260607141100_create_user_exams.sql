CREATE TABLE public.user_exams (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    exam_date date NOT NULL,
    target_score numeric,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exams"
    ON public.user_exams FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exams"
    ON public.user_exams FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exams"
    ON public.user_exams FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exams"
    ON public.user_exams FOR DELETE
    USING (auth.uid() = user_id);
