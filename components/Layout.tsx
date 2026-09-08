import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();

   const handleRefresh = () => {
    window.location.reload();
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';

  return (
    <div className={`flex flex-col font-sans w-full relative ${isAdmin ? 'h-full' : 'min-h-screen bg-slate-50 overflow-x-hidden'}`}>
      {/* Premium Glass Header - Only for employees, since Admin has sidebar in App.tsx */}
      {!isAdmin && (
        <header className="sticky top-0 z-50 glass border-b border-slate-200/60 shadow-sm shadow-blue-900/5">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between transition-all">
            <div className="flex items-center gap-3 sm:gap-6">
              <h1 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">
                TrackerOS
              </h1>
              {user && (
                <span className="hidden sm:inline-block px-3 py-1 bg-blue-50/80 backdrop-blur-sm border border-blue-100 rounded-full text-xs font-bold text-blue-700 shadow-inner">
                  Employee Portal
                </span>
              )}
            </div>
            {user && (
              <div className="flex items-center gap-2 sm:gap-5">
                 <button 
                   onClick={handleRefresh}
                   className="p-2 sm:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-100"
                   title="Refresh Page"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                   </svg>
                 </button>
                  <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
                 <span className="hidden sm:block text-sm font-bold text-slate-600">Hi, {user?.name?.split(" ")?.[0] || "User"}</span>
                 <Button variant="secondary" size="sm" onClick={logout} className="shadow-sm border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 font-bold ml-1 hover-lift">
                   Sign Out
                 </Button>
              </div>
            )}
          </div>
        </header>
      )}
      
      {/* Main Content Area */}
      <main className={`flex-1 w-full ${isAdmin ? 'max-w-none px-4 sm:px-8 py-4 sm:py-6' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10'}`}>
        {title && (
          <div className="mb-6 sm:mb-8 flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{title}</h2>
          </div>
        )}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
