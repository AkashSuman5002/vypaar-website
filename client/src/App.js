import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import ZoomProvider from './components/ZoomProvider';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ZoomProvider>
          <AppRoutes />
          <ToastContainer position="top-right" autoClose={3000} />
        </ZoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
