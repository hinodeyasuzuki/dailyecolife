const DEFAULT_API_URL = new URL("../api/mysql-api.php", import.meta.url).href;
const DEFAULT_TIMEOUT = 10000;

export async function initializeSession(apiUrl = DEFAULT_API_URL) {
  return {};
}

function readJson(storage, key, fallback) {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

async function request(apiUrl, resource, options = {}) {
  return {};
}

function metadataKey(storageKey) {
  return `${storageKey}.__sync`;
}

/**
 * localStorageを通常の保存先にし、APIとは必要時だけ同期する共通層。
 * entriesは [{ key, field, fallback }]。fieldをnullにするとresource全体を1キーで扱う。
 */
export async function createSyncStore({
  resource,
  entries,
  apiUrl = DEFAULT_API_URL,
  storage = window.localStorage,
}) {
  const syncKey = metadataKey(entries[0].key);
  const cache = new Map();
  const meta = readJson(storage, syncKey, { dirty: false, serverUpdatedAt: null });
  let syncing = null;

  for (const entry of entries) {
    cache.set(entry.key, readJson(storage, entry.key, entry.fallback));
  }

  async function fetchMeta() {
    return request(apiUrl, resource, { query: "meta=1", headers: { Accept: "application/json" } });
  }

  function payload() {
    if (entries.length === 1 && entries[0].field === null) return cache.get(entries[0].key);
    return Object.fromEntries(entries.map((entry) => [entry.field, cache.get(entry.key)]));
  }

  function applyRemote(data) {
    if (entries.length === 1 && entries[0].field === null) {
      cache.set(entries[0].key, data ?? entries[0].fallback);
      writeJson(storage, entries[0].key, cache.get(entries[0].key));
      return;
    }
    for (const entry of entries) {
      if (data && Object.prototype.hasOwnProperty.call(data, entry.field)) {
        cache.set(entry.key, data[entry.field]);
        writeJson(storage, entry.key, cache.get(entry.key));
      }
    }
  }

  async function sync({ keepalive = false } = {}) {
    return {};
  }

  async function initialize() {
    return {};
  }

  function setItem(key, value) {
    const entry = entries.find((candidate) => candidate.key === key);
    if (!entry) {
      storage.setItem(key, value);
      return;
    }
    cache.set(key, readJson({ getItem: () => value }, key, entry.fallback));
    storage.setItem(key, value);
    meta.dirty = true;
    writeJson(storage, syncKey, meta);
  }

  function getItem(key) {
    const entry = entries.find((candidate) => candidate.key === key);
    return entry ? storage.getItem(key) : storage.getItem(key);
  }

  function removeItem(key) {
    const entry = entries.find((candidate) => candidate.key === key);
    storage.removeItem(key);
    if (entry) {
      cache.set(key, entry.fallback);
      meta.dirty = true;
      writeJson(storage, syncKey, meta);
    }
  }

  const controller = {
    getItem,
    setItem,
    removeItem,
    sync,
    initialize,
    isDirty: () => meta.dirty,
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden" && meta.dirty) sync({ keepalive: true }).catch(() => {});
  };
  const onPageHide = () => {
    if (meta.dirty) sync({ keepalive: true }).catch(() => {});
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);

  await initialize();
  return controller;
}

if (typeof window !== "undefined") window.EcolifeSync = { createSyncStore };
