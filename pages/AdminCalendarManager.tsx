import React from 'react';
import { Layout } from '../components/Layout';
import { AdminHolidayCalendar } from '../components/AdminHolidayCalendar';

export const AdminCalendarManager: React.FC = () => {
  return (
    <Layout title="Holiday Calendar Management">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-gray-600">
            Manage company holidays here. Holidays added below will be reflected on all employee dashboards instantly.
            Employees are not marked as "Absent" on designated holidays.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-2 h-[500px]">
             <AdminHolidayCalendar />
           </div>
           
           <div className="md:col-span-1 space-y-4">
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/30">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                 <h3 className="font-black text-amber-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Instructions
                 </h3>
                 <ul className="text-sm font-medium text-amber-800/80 space-y-3 relative z-10">
                   <li className="flex items-start gap-2">
                      <span className="mt-1 text-amber-500">•</span>
                      <span><strong className="text-amber-900 font-bold">Click</strong> any date to add a new holiday.</span>
                   </li>
                   <li className="flex items-start gap-2">
                      <span className="mt-1 text-amber-500">•</span>
                      <span><strong className="text-amber-900 font-bold">Click</strong> an existing holiday to remove it.</span>
                   </li>
                   <li className="flex items-start gap-2">
                      <span className="mt-1 text-amber-500">•</span>
                      <span>Holidays override "Absent" status in attendance reports.</span>
                   </li>
                 </ul>
              </div>
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                 <h3 className="font-black text-slate-800 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Upcoming Holidays
                 </h3>
                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">Static preview of major holidays</p>
                 <ul className="space-y-3 text-sm font-bold">
                    <li className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-slate-700">Republic Day</span>
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs">Jan 26</span>
                    </li>
                    <li className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-slate-700">Independence Day</span>
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs">Aug 15</span>
                    </li>
                    <li className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-slate-700">Gandhi Jayanti</span>
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs">Oct 02</span>
                    </li>
                    <li className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-slate-700">Christmas</span>
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs">Dec 25</span>
                    </li>
                 </ul>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
};