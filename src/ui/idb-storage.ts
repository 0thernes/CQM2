/**
 * CQM2 v2.1.0 Browser IndexedDB Checkpoint Persistence (`src/ui/idb-storage.ts`).
 * Persists reversible world snapshots locally in `IndexedDB` (`cqm2_checkpoints_v21`) so Universal Browser
 * Edition users (including GitHub Pages & offline sessions) retain checkpoints across page reloads.
 */

export interface StoredBrowserCheckpoint {
  readonly id: string;
  readonly savedAtIso: string;
  readonly tick: number;
  readonly seedHex: string;
  readonly merkleRootHex: string;
  readonly activeCount: number;
  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly posZ: Float32Array;
  readonly pools15: Float64Array;
}

const DB_NAME = 'cqm2_checkpoints_v21';
const STORE_NAME = 'checkpoints';

function openCheckpointDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveBrowserCheckpoint(cp: StoredBrowserCheckpoint): Promise<boolean> {
  const db = await openCheckpointDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(cp);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function listBrowserCheckpoints(): Promise<StoredBrowserCheckpoint[]> {
  const db = await openCheckpointDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result as StoredBrowserCheckpoint[]) ?? [];
        rows.sort((a, b) => b.tick - a.tick);
        db.close();
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}
