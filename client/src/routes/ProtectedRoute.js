import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { businessAPI } from '../services/api';
import usePermissions from '../hooks/usePermissions';

// Maps a route's first path segment -> the canAccess permission key it requires.
// Any authenticated user is still allowed on segments not listed here (e.g. '' home,
// calendar, support, edit-profile). Keys MUST exist on `canAccess` (usePermissions).
const SEGMENT_PERMISSION = {
  'user-management': 'users',
  'staff': 'users',
  'settings': 'settings',
  'company': 'settings',
  'utilities': 'settings',
  'sync-share': 'settings',
  'backup': 'settings',
  'journal-entry': 'accounting',
  'chart-of-accounts': 'accounting',
  'account-statements': 'accounting',
  'accounting': 'accounting',
  'budgets': 'accounting',
  'gst-filing': 'accounting',
  'reports': 'reports',
  'sales': 'sales',
  'purchases': 'purchases',
  'products': 'products',
  'godowns': 'products',
  'godown-transfer': 'products',
  'stock-reconciliation': 'products',
  'manufacturing': 'products',
  'customers': 'customers',
  'parties': 'customers',
  'party-groups': 'customers',
  'party-transfer': 'cashbank',
  'suppliers': 'suppliers',
  'cash-bank': 'cashbank',
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { canAccess, isOwner } = usePermissions();
  const [businessChecking, setBusinessChecking] = useState(true);
  const [hasBusiness, setHasBusiness] = useState(true);
  const checked = useRef(false);

  // A staff member joins an existing business (user.business is set) — they must NEVER be
  // sent to the business-setup page (that's for owners creating their company). Owners
  // registered without user.business, so they still go through the setup check.
  const isMember = !!user?.business;

  useEffect(() => {
    if (!user) {
      setBusinessChecking(false);
      return;
    }
    if (isMember) {
      // Members always belong to a business — skip the owner-only status check entirely.
      setHasBusiness(true);
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
  }, [user, isMember]);

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

  if (!hasBusiness && !isMember && location.pathname !== '/business-setup') {
    return <Navigate to="/business-setup" replace />;
  }

  // Enforce per-segment permissions for EVERY sensitive route (not just a few), so a
  // hidden page can't be reached by typing the URL. Unlisted segments stay open to any
  // authenticated user; home ('/') is always allowed, so there is no redirect loop.
  const path = location.pathname.replace(/^\//, '').split('/')[0];
  const requiredKey = SEGMENT_PERMISSION[path];
  if (requiredKey && !canAccess[requiredKey]) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
