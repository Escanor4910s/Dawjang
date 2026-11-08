import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionProps {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onUpdate: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
  filter?: string;
}

export const useRealtimeSubscription = ({
  table,
  event = '*',
  onUpdate,
  onInsert,
  onDelete,
  filter,
}: UseRealtimeSubscriptionProps) => {
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`${table}-changes`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event,
            schema: 'public',
            table,
            filter: filter || `user_id=eq.${user.id}`,
          },
          (payload: { eventType?: string }) => {
            if (payload?.eventType === 'INSERT' && onInsert) {
              onInsert();
            } else if (payload?.eventType === 'DELETE' && onDelete) {
              onDelete();
            } else {
              onUpdate();
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, event, onUpdate, onInsert, onDelete, filter]);
};
