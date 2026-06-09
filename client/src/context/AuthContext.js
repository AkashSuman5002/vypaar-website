import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, fetchCsrfToken, businessAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.token) {
          setUser(parsed);
          loadActiveBusiness();
        } else {
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
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

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('activeBusiness');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
