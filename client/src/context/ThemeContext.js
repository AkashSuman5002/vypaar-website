import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { themeAPI } from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = 'vyapar_dark_mode';

// Read the persisted preference synchronously so the first paint matches the
// pre-paint script in index.html (no flash). Falls back to the .dark class that
// the inline script may already have applied.
const readInitialDarkMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark');
  }
  return false;
};

const applyDarkClass = (enabled) => {
  if (typeof document === 'undefined') return;
  if (enabled) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(readInitialDarkMode);

  // Keep the DOM class and localStorage in sync on every change (instant paint).
  useEffect(() => {
    applyDarkClass(darkMode);
    try { localStorage.setItem(STORAGE_KEY, String(darkMode)); } catch {}
  }, [darkMode]);

  // Reconcile with the server value once (the server is the source of truth
  // across devices). localStorage gave us the instant paint above.
  useEffect(() => {
    let cancelled = false;
    themeAPI.get()
      .then(res => {
        if (cancelled) return;
        const serverValue = res?.data?.darkMode === true;
        setDarkMode(serverValue);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Update local state immediately and persist to the server.
  const setDark = useCallback((value) => {
    setDarkMode(value);
    themeAPI.update(value).catch(() => {});
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      themeAPI.update(next).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, setDark, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
