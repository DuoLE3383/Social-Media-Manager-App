import { useCallback, useSyncExternalStore } from 'react';

// Tiny language store: any component can switch VI/EN and every subscriber
// re-renders. Persisted per browser in localStorage (default: Vietnamese).
const KEY = 'aiSocialLang';
const listeners = new Set();

function readStored() {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch { return 'vi'; }
}

let current = typeof window === 'undefined' ? 'vi' : readStored();
let snapshot = current;

export function getLang() {
  return snapshot;
}

export function setLang(next) {
  current = next === 'en' ? 'en' : 'vi';
  snapshot = current;
  try { localStorage.setItem(KEY, current); } catch { /* private mode */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns [lang, setLang]. Usage in a component:
//   const [lang] = useLang();
//   const L = STRINGS[lang];
export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  const set = useCallback((next) => setLang(next), []);
  return [lang, set];
}
