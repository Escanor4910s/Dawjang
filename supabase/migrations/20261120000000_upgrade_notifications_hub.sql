-- Mise à niveau de public.notifications pour le DawJang Notification Hub
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Active Realtime sur public.notifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;
