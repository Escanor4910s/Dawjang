import { supabase } from "@/integrations/supabase/client";

const DB_VERSION = 1;
const LEGACY_DB_NAME = "hippocampus-offline";
const STORES = ["courses", "flashcards", "quiz_results", "qcm_sessions", "user_gamification", "pending_actions"] as const;
type StoreName = typeof STORES[number];

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Aucune session active pour le stockage hors ligne.");
  return userId;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

async function openDB(userId?: string): Promise<IDBDatabase> {
  const ownerId = userId || await currentUserId();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`hippocampus-offline-${ownerId}`, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
  });
}

export async function saveToOffline<T extends { id: string }>(storeName: StoreName, data: T[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.clear();
  data.forEach((item) => store.put(item));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getFromOffline<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { db.close(); resolve(request.result as T[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function clearOfflineStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

interface PendingAction {
  id: string;
  table: string;
  type: "insert" | "update" | "delete";
  data: Record<string, unknown>;
  created_at: string;
}

export async function addPendingAction(action: Omit<PendingAction, "id" | "created_at">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pending_actions", "readwrite");
  tx.objectStore("pending_actions").put({
    ...action,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPendingActions(): Promise<PendingAction[]> {
  return getFromOffline<PendingAction>("pending_actions");
}

export async function clearPendingActions(): Promise<void> {
  return clearOfflineStore("pending_actions");
}

export async function clearPrivateOfflineData(userId?: string): Promise<void> {
  const preservedKeys = new Set(["dawjang_auth_status", "dawjang_onboarding_seen"]);
  Object.keys(localStorage)
    .filter((key) => /^(?:dawjang|hippocampus)[_-]/i.test(key) && !preservedKeys.has(key))
    .forEach((key) => localStorage.removeItem(key));
  const deletions = [deleteDatabase(LEGACY_DB_NAME)];
  if (userId) deletions.push(deleteDatabase(`hippocampus-offline-${userId}`));
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !name.includes("workbox-precache")).map((name) => caches.delete(name)));
  }
  await Promise.all(deletions);
}
