import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, fetchCsrfToken, businessAPI } from '../services/api';
import { clearCache } from '../hooks/useSettings';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const stored = localStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!parsed?.token) {
          localStorage.removeItem('user');
          setLoading(false);
          return;
        }

        setUser(parsed);
        const { data } = await authAPI.refresh();
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        await fetchCsrfToken().catch(() => {});
        await loadActiveBusiness();
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('activeBusiness');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    fetchCsrfToken().catch(() => {});
  }, []);

  const loadActiveBusiness = async () => {
    try {
      const res = await businessAPI.getStatus();
      if (res.data.business) {
        localStorage.setItem('activeBusiness', res.data.business._id);
      }
    } catch {}
  };

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    clearCache();
    fetchCsrfToken().catch(() => {});
    setTimeout(() => loadActiveBusiness(), 500);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    fetchCsrfToken().catch(() => {});
    setTimeout(() => loadActiveBusiness(), 500);
    return data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    sessionStorage.removeItem('vyapar_csrf_token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeBusiness');
    clearCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
