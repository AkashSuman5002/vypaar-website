import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { businessAPI } from '../services/api';
import usePermissions from '../hooks/usePermissions';

const ROLE_ROUTES = {
  'user-management': ['admin', 'Admin', 'owner'],
  'settings': ['admin', 'Admin', 'Manager', 'owner'],
  'journal-entry': ['admin', 'Admin', 'Manager', 'Accountant', 'owner'],
  'chart-of-accounts': ['admin', 'Admin', 'Manager', 'Accountant', 'owner'],
  'account-statements': ['admin', 'Admin', 'Manager', 'Accountant', 'owner'],
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { canAccess, isOwner } = usePermissions();
  const [businessChecking, setBusinessChecking] = useState(true);
  const [hasBusiness, setHasBusiness] = useState(true);
  const checked = useRef(false);

  useEffect(() => {
    if (!user) {
      setBusinessChecking(false);
      return;
    }
    if (checked.current) return;
    checked.current = true;
    businessAPI.getStatus()
      .then(res => {
        setHasBusiness(res.data.hasBusiness);
        setBusinessChecking(false);
      })
      .catch(() => {
        setHasBusiness(false);
        setBusinessChecking(false);
      });
  }, [user]);

  if (loading || businessChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasBusiness && location.pathname !== '/business-setup') {
    return <Navigate to="/business-setup" replace />;
  }

  const path = location.pathname.replace(/^\//, '').split('/')[0];

  if (path === 'user-management' && !canAccess.users) {
    return <Navigate to="/" replace />;
  }
  if (path === 'settings' && !canAccess.settings) {
    return <Navigate to="/" replace />;
  }
  if ((path === 'journal-entry' || path === 'chart-of-accounts' || path === 'account-statements') && !canAccess.accounting) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
