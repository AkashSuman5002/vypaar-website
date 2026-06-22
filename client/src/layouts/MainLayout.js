import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Sidebar/Header';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ErrorBoundary from '../components/ErrorBoundary';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 xl:p-8 max-w-7xl mx-auto">
            <Breadcrumbs />
            {/* Per-route error boundary: a crash in the routed page shows a
                localized fallback while the sidebar/header stay usable. The
                key resets the boundary on navigation so a new route can render
                after a previous page crashed. */}
            <ErrorBoundary variant="page" key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
