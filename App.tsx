import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { AdminReports } from './pages/AdminReports';
import { AdminLeaveRequests } from './pages/AdminLeaveRequests';
import { AdminCalendarManager } from './pages/AdminCalendarManager';
import { EmployeeManagement } from './pages/EmployeeManagement';
import api from './api/http';

type AdminPage = 'reports' | 'leaves' | 'calendar' | 'employees';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [adminPage, setAdminPage] = useState<AdminPage>('reports');
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  // Fetch pending leave requests count using dedicated endpoint
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchPendingLeaveCount = async () => {
    try {
      const count = await api.getPendingLeaveCount();
      setPendingLeaveCount(count);
    } catch (err) {
      console.error('Failed to fetch pending leaves count:', err);
    }
  };

  // Treat super_admin / superadmin as admin
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';

  // Load pending leave count on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchPendingLeaveCount();
      // Refresh count every 30 seconds
      const interval = setInterval(fetchPendingLeaveCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isAdmin]);

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Employee Dashboard — handles both 'user' and 'employee' roles
  if (user.role === 'employee' || user.role === 'user') {
    return <EmployeeDashboard />;
  }

  // Treat super_admin / superadmin as admin
  // (Moved up for useEffect)

  // Admin Dashboard with Navigation
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50/50 relative overflow-hidden flex">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Admin Navigation Sidebar */}
        <nav className={`fixed inset-y-0 left-0 z-50 w-72 glass-panel border-r border-white/40 shadow-2xl lg:shadow-none lg:relative lg:flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-8 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">Tracker<span className="text-slate-800">OS</span></h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin Portal</p>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-2">
            <button
              onClick={() => { setAdminPage('reports'); setIsSidebarOpen(false); }}
              className={`w-full text-left px-5 py-3.5 rounded-2xl transition-all duration-300 flex items-center gap-4 hover-lift ${
                adminPage === 'reports'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30'
                  : 'text-slate-600 hover:bg-white/60 font-medium'
              }`}
            >
              <svg className={`w-5 h-5 ${adminPage === 'reports' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Reports</span>
            </button>

            <button
              onClick={() => { setAdminPage('leaves'); setIsSidebarOpen(false); }}
              className={`w-full text-left px-5 py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-between gap-4 hover-lift ${
                adminPage === 'leaves'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30'
                  : 'text-slate-600 hover:bg-white/60 font-medium'
              }`}
            >
              <div className="flex items-center gap-4">
                <svg className={`w-5 h-5 ${adminPage === 'leaves' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Leave Requests</span>
              </div>
              {pendingLeaveCount > 0 && (
                <span className={`${adminPage === 'leaves' ? 'bg-white text-blue-600' : 'bg-rose-500 text-white'} text-[10px] font-black rounded-full h-5 px-2 flex items-center justify-center min-w-[20px] shadow-sm`}>
                  {pendingLeaveCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setAdminPage('calendar'); setIsSidebarOpen(false); }}
              className={`w-full text-left px-5 py-3.5 rounded-2xl transition-all duration-300 flex items-center gap-4 hover-lift ${
                adminPage === 'calendar'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30'
                  : 'text-slate-600 hover:bg-white/60 font-medium'
              }`}
            >
              <svg className={`w-5 h-5 ${adminPage === 'calendar' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Holidays</span>
            </button>

            <button
              onClick={() => { setAdminPage('employees'); setIsSidebarOpen(false); }}
              className={`w-full text-left px-5 py-3.5 rounded-2xl transition-all duration-300 flex items-center gap-4 hover-lift ${
                adminPage === 'employees'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30'
                  : 'text-slate-600 hover:bg-white/60 font-medium'
              }`}
            >
              <svg className={`w-5 h-5 ${adminPage === 'employees' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Employees</span>
            </button>
          </div>

          {/* User info + Logout */}
          <div className="p-6 border-t border-white/50 bg-white/30 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">
                {user?.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Administrator</p>
                <p className="text-sm font-black text-slate-800 truncate">{user?.name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 bg-white/60 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all duration-300 border border-white shadow-sm hover-lift"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {/* Mobile Header (Hamburger) */}
          <div className="lg:hidden sticky top-0 z-30 glass border-b border-slate-200/60 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <h2 className="text-lg font-black text-slate-800">TrackerOS</h2>
            </div>
          </div>
          
          <div className="flex-1 w-full relative">
            {adminPage === 'reports' && <AdminReports />}
            {adminPage === 'leaves' && <AdminLeaveRequests onLeaveStatusChanged={fetchPendingLeaveCount} />}
            {adminPage === 'calendar' && <AdminCalendarManager />}
            {adminPage === 'employees' && <EmployeeManagement />}
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return <Login />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
