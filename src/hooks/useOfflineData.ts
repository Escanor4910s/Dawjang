import { useState, useEffect, useCallback } from 'react';
import { saveToOffline, getFromOffline } from '@/lib/offlineStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type StoreName = 'courses' | 'flashcards' | 'quiz_results' | 'qcm_sessions' | 'user_gamification';

interface UseOfflineDataOptions<T> {
  storeName: StoreName;
  fetchFn: () => Promise<T[]>;
  enabled?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T[];
  loading: boolean;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

export function useOfflineData<T extends { id: string }>({
  storeName,
  fetchFn,
  enabled = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  const loadData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      if (isOnline) {
        // Try fetching from network
        const freshData = await fetchFn();
        setData(freshData);
        // Cache to IndexedDB
        await saveToOffline(storeName, freshData).catch(console.warn);
      } else {
        // Offline: read from IndexedDB
        const cached = await getFromOffline<T>(storeName);
        setData(cached);
      }
    } catch {
      // Network failed, try offline cache
      try {
        const cached = await getFromOffline<T>(storeName);
        setData(cached);
      } catch {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [storeName, fetchFn, isOnline, enabled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    isOffline: !isOnline,
    refresh: loadData,
  };
}
