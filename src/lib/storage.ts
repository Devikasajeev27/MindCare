const isBrowser = typeof window !== "undefined";

export function getStoredItem<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setStoredItem<T>(key: string, value: T) {
  if (!isBrowser) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota and privacy mode errors.
  }
}
