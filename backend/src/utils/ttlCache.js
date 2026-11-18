// Bounded per-process TTL cache for shortCode -> link ID, never for click responses.
export function createTtlCache({ ttlMs = 30_000, maxEntries = 2000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const item = entries.get(key);
      if (!item) return undefined;
      if (item.expires <= now()) { entries.delete(key); return undefined; }
      // Refresh LRU order, not TTL.
      entries.delete(key); entries.set(key, item);
      return item.value;
    },
    set(key, value) {
      entries.delete(key);
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      entries.set(key, { value, expires: now() + ttlMs });
    },
    delete(key) { entries.delete(key); },
    clear() { entries.clear(); },
    get size() { return entries.size; }
  };
}
