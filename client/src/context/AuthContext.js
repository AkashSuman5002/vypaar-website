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
      // Cookie-only auth: no token is stored in JS anymore. A stored `user` is only a
      // "probably logged in" hint; the httpOnly cookie is the real credential. So we confirm
      // the session by calling the cookie-authenticated /refresh rather than checking a token.
      const stored = localStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        // Optimistically render as logged-in, then validate via the cookie.
        setUser(parsed);
        const { data } = await authAPI.refresh();
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        await fetchCsrfToken().catch(() => null);
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
    fetchCsrfToken().catch(() => null);
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
    // If 2FA is enabled the server withholds the token and asks for a TOTP code. Bubble the
    // flag up so the UI can prompt for the 6-digit code; do NOT store a (non-existent) session.
    if (data?.twoFactorRequired) return data;
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    clearCache();
    fetchCsrfToken().catch(() => null);
    setTimeout(() => loadActiveBusiness(), 500);
    return data;
  };

  // Complete login by submitting the second factor (TOTP). On success the server returns the
  // full user + token exactly like a normal login.
  const loginTwoFactor = async ({ userId, token }) => {
    const { data } = await authAPI.loginTwoFactor({ userId, token });
    return finishAuth(data);
  };

  const register = async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password });
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    fetchCsrfToken().catch(() => null);
    setTimeout(() => loadActiveBusiness(), 500);
    return data;
  };

  // --- Passwordless OTP ---
  const finishAuth = (data) => {
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    clearCache();
    fetchCsrfToken().catch(() => null);
    setTimeout(() => loadActiveBusiness(), 500);
    return data;
  };
  // Returns the server response (may include devOtp in non-production).
  const registerStart = async ({ name, email, phone }) => {
    const { data } = await authAPI.registerStart({ name, email, phone });
    return data;
  };
  const registerVerify = async ({ email, otp }) => {
    const { data } = await authAPI.registerVerify({ email, otp });
    return finishAuth(data);
  };
  const loginOtp = async (identifier) => {
    const { data } = await authAPI.loginOtp({ identifier });
    return data;
  };
  const loginVerify = async ({ identifier, otp }) => {
    const { data } = await authAPI.loginVerify({ identifier, otp });
    // 2FA enabled: server withholds the token and requests a TOTP code. Pass the flag through.
    if (data?.twoFactorRequired) return data;
    return finishAuth(data);
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, registerStart, registerVerify, loginOtp, loginVerify, loginTwoFactor }}>
      {children}
    </AuthContext.Provider>
  );
};
