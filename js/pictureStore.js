const DB_NAME = "dailyecolife-pictures";
const DB_VERSION = 1;
const STORE_NAME = "pictures";

export function generatePictureId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `p${Date.now().toString(36)}${random}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDBを開けませんでした"));
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    tx.onerror = () => reject(tx.error || new Error("IndexedDBの操作に失敗しました"));
  });
}

export function getPictureBlob(pid) {
  return withStore("readonly", (store) => store.get(pid));
}

export function putPictureBlob(pid, dataUrl) {
  return withStore("readwrite", (store) => store.put(dataUrl, pid));
}

export function deletePictureBlob(pid) {
  return withStore("readwrite", (store) => store.delete(pid));
}

export async function getAllPictureBlobs() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keysReq = store.getAllKeys();
    const valuesReq = store.getAll();
    tx.oncomplete = () => {
      const result = {};
      keysReq.result.forEach((key, i) => {
        result[key] = valuesReq.result[i];
      });
      resolve(result);
    };
    tx.onerror = () => reject(tx.error || new Error("IndexedDBの読み取りに失敗しました"));
  });
}
