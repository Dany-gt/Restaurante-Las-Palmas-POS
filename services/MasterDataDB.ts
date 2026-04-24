const DB_NAME = 'LasPalmas_POS_MasterData';
const DB_VERSION = 3;

class MasterDataDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                const stores = ['sections', 'tables', 'products', 'categories', 'profiles', 'printers', 'system_settings', 'roles', 'branch_prices', 'branch_inventory'];

                stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve(this.db!);
            };

            request.onerror = (event: any) => {
                reject('Error opening MasterDataDB: ' + event.target.error);
            };
        });
    }

    async saveData(storeName: string, data: any[] | any): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            // Clear existing data before saving new to ensure it's a seed
            const clearReq = store.clear();

            clearReq.onsuccess = () => {
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        // Ensure it has an id, fallback to a random UUID if not (though master data usually has one)
                        if (!item.id) item.id = crypto.randomUUID();
                        store.put(item);
                    });
                } else if (data && typeof data === 'object') {
                    if (!data.id) data.id = 'singleton'; // For settings
                    store.put(data);
                }
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event: any) => reject(event.target.error);
        });
    }

    async getAll(storeName: string): Promise<any[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    async getById(storeName: string, id: string): Promise<any> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    async getSingleton(storeName: string): Promise<any> {
        const data = await this.getAll(storeName);
        return data.length > 0 ? data[0] : null;
    }
}

export const masterDataDB = new MasterDataDB();
