import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendLocalNotification, getNotificationPermissionStatus } from '@/lib/notifications';

export function useRevisionReminder(enabled: boolean = true) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || getNotificationPermissionStatus() !== 'granted') return;

    const checkFlashcards = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        const { count, error } = await supabase
          .from('flashcards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .lte('next_review', today);

        if (!error && count && count > 0) {
          sendLocalNotification(
            '📚 Révision du jour',
            `Vous avez ${count} flashcard${count > 1 ? 's' : ''} à réviser aujourd'hui !`
          );
        }
      } catch {
        // Silently fail
      }
    };

    // Check every 2 hours
    checkFlashcards();
    intervalRef.current = setInterval(checkFlashcards, 2 * 60 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);
}
