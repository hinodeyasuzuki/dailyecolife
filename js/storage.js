export function loadJSON(store, key, fallback) {
  const raw = store.getItem(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(store, key, value) {
  store.setItem(key, JSON.stringify(value));
}
