import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionProps {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onUpdate: () => void;
  filter?: string;
}

export const useRealtimeSubscription = ({
  table,
  event = '*',
  onUpdate,
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
          'postgres_changes' as any,
          {
            event,
            schema: 'public',
            table,
            filter: filter || `user_id=eq.${user.id}`,
          },
          (payload) => {
            onUpdate();
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
  }, [table, event, onUpdate, filter]);
};
