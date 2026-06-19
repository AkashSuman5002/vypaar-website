import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes/AppRoutes';
import ZoomProvider from './components/ZoomProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { loadSettings } from './hooks/useSettings';
import { registerPush } from './services/push';

// Registers the browser for Web Push once the user is authenticated AND has
// push notifications enabled in their settings. Without this, registerPush()
// was never called and notifications never fired.
const PushRegistrar = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.token) return;
    let cancelled = false;
    loadSettings()
      .then(data => {
        if (cancelled) return;
        const pushEnabled = data?.preferences?.notifications?.push?.enabled;
        if (pushEnabled) {
          registerPush().catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.token]);

  return null;
};

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <ZoomProvider>
              <PushRegistrar />
              <AppRoutes />
              <ToastContainer position="top-right" autoClose={3000} />
            </ZoomProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
