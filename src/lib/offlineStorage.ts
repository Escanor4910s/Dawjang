const DB_NAME = 'hippocampus-offline';
const DB_VERSION = 1;

const STORES = ['courses', 'flashcards', 'quiz_results', 'qcm_sessions', 'user_gamification', 'pending_actions'] as const;
type StoreName = typeof STORES[number];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
  });
}

export async function saveToOffline<T extends { id: string }>(storeName: StoreName, data: T[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  
  // Clear existing data and replace with fresh data
  store.clear();
  data.forEach((item) => store.put(item));
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFromOffline<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Pending actions queue for offline mutations
interface PendingAction {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  data: any;
  created_at: string;
}

export async function addPendingAction(action: Omit<PendingAction, 'id' | 'created_at'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('pending_actions', 'readwrite');
  const store = tx.objectStore('pending_actions');
  store.put({
    ...action,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingActions(): Promise<PendingAction[]> {
  return getFromOffline<PendingAction>('pending_actions');
}

export async function clearPendingActions(): Promise<void> {
  return clearOfflineStore('pending_actions');
}
