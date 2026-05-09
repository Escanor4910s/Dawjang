-- Create user_preferences table for storing user settings
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Display preferences
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  text_size text DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large')),
  font_family text DEFAULT 'sans-serif' CHECK (font_family IN ('sans-serif', 'serif')),
  summary_display text DEFAULT 'standard' CHECK (summary_display IN ('compact', 'standard', 'extended')),
  language text DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
  
  -- Notification preferences
  notify_weekly_results boolean DEFAULT true,
  notify_revision_reminders boolean DEFAULT true,
  notify_new_qcm boolean DEFAULT true,
  notify_flashcard_alerts boolean DEFAULT true,
  notify_subscription_alerts boolean DEFAULT true,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences
FOR UPDATE
USING ((SELECT auth.uid()) = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create preferences when user signs up (update existing trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$;