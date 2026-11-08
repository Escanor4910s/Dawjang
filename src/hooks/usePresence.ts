import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePresence(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    // Connect to the shared 'online-users' channel
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = new Set<string>();
        Object.keys(state).forEach((key) => {
          users.add(key);
        });
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track the user's presence when successfully subscribed
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      // Unsubscribe and remove presence when component unmounts
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return onlineUsers;
}
