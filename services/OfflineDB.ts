import { generateUUID } from '../utils/uuid';

const DB_NAME = 'LasPalmas_POS_Offline';
const DB_VERSION = 2;

export interface OfflineRecord {
    id: string; // Client-generated UUID
    type: 'ORDER' | 'EXPENSE' | 'CASH_INIT' | 'CASH_CLOSE' | 'CREDIT_PAYMENT';
    data: any;
    timestamp: number;
    synced: boolean;
    retryCount: number;
}

class OfflineDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('pending_sync')) {
                    const store = db.createObjectStore('pending_sync', { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve(this.db!);
            };

            request.onerror = (event: any) => {
                reject('Error opening IndexedDB: ' + event.target.error);
            };
        });
    }

    async saveRecord(type: OfflineRecord['type'], data: any): Promise<string> {
        const db = await this.init();
        const id = data.id || generateUUID();
        const record: OfflineRecord = {
            id,
            type,
            data,
            timestamp: Date.now(),
            synced: false,
            retryCount: 0
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['pending_sync'], 'readwrite');
            const store = transaction.objectStore('pending_sync');
            const request = store.put(record);

            request.onsuccess = () => resolve(id);
            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    async getPendingRecords(): Promise<OfflineRecord[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['pending_sync'], 'readonly');
            const store = transaction.objectStore('pending_sync');
            // v1.6.11 - Si está en el store, está pendiente (ya que borramos al sincronizar exitosamente)
            const request = store.getAll(); 

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    async markAsSynced(id: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['pending_sync'], 'readwrite');
            const store = transaction.objectStore('pending_sync');
            const request = store.delete(id); // Delete after success as requested

            request.onsuccess = () => resolve();
            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    async incrementRetry(id: string): Promise<void> {
        const db = await this.init();
        const transaction = db.transaction(['pending_sync'], 'readwrite');
        const store = transaction.objectStore('pending_sync');
        const request = store.get(id);

        request.onsuccess = () => {
            const record = request.result;
            if (record) {
                record.retryCount++;
                store.put(record);
            }
        };
    }

    async getPendingCount(): Promise<number> {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['pending_sync'], 'readonly');
                const store = transaction.objectStore('pending_sync');
                const request = store.count();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
            });
        } catch (e) {
            return 0;
        }
    }
    async clearAll(): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['pending_sync'], 'readwrite');
            const store = transaction.objectStore('pending_sync');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = (event: any) => reject(event.target.error);
        });
    }
}

export const offlineDB = new OfflineDB();
