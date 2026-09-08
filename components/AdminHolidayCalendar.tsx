import React, { useState, useEffect, useRef } from 'react';
import { Holiday } from '../types';
import http from '../api/http';


export const AdminHolidayCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayNote, setHolidayNote] = useState('');
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  /* =========================
     FETCH HOLIDAYS - Using Admin API (with debouncing)
  ========================= */
  const fetchHolidays = async (immediate = false) => {
    // ✅ RACE CONDITION FIX: Clear any pending fetch FIRST before debounce check
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null as any;
    }

    // Debounce rapid calls - ignore requests within 1 second
    const now = Date.now();
    if (!immediate && now - lastFetchRef.current < 1000) {
      // Debounce
      return;
    }

    lastFetchRef.current = now;

    setIsLoading(true);
    try {
      // Use admin endpoint for admin calendar
      const res = await http.getAdminHolidays(year, month + 1);
      if (!isMountedRef.current) return;
      const holidayData = Array.isArray(res) ? res : [];
      // Holidays fetched
      if (isMountedRef.current) { setHolidays(holidayData); }
    } catch (err) {
      if (isMountedRef.current) { console.error("Failed to fetch holidays", err); }
      if (isMountedRef.current) { setHolidays([]); }
    } finally {
      if (isMountedRef.current) { setIsLoading(false); }
    }
  };

  /* =========================
     INITIAL LOAD
  ========================= */
  useEffect(() => {
    fetchHolidays();
  }, [year, month]);

  /* =========================
     REAL-TIME SYNC (with debouncing)
  ========================= */


  /* =========================
     ADD/UPDATE HOLIDAY
  ========================= */
  const handleSaveHoliday = async () => {
    if (!selectedDate || !holidayName.trim()) {
      alert('Please fill in date and holiday name');
      return;
    }

    setIsLoading(true);
    try {
      const res = await http.saveAdminHoliday({
        date: selectedDate,
        name: holidayName.trim(),
        note: holidayNote.trim(),
      });

      // Holiday saved

      setShowAddModal(false);
      setSelectedDate('');
      setHolidayName('');
      setHolidayNote('');
      setEditingHoliday(null);
      
      // Refresh with immediate flag to bypass debounce
      await fetchHolidays(true);
    } catch (err: any) {
      console.error('Failed to save holiday', err);
      alert(err.message || err?.error || 'Failed to save holiday');
    } finally {
      if (isMountedRef.current) { setIsLoading(false); }
    }
  };

  /* =========================
     DELETE HOLIDAY
  ========================= */
  const handleDeleteHoliday = async (date: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    setIsLoading(true);
    try {
      const res = await http.deleteAdminHoliday(date);
      // Holiday deleted
      // Refresh with immediate flag to bypass debounce
      await fetchHolidays(true);
    } catch (err: any) {
      console.error('Failed to delete holiday', err);

      // If server returned a JSON body with 'nearby' rows, expose them for debugging
      if (err && err.body) {
        // Delete error
        if (Array.isArray(err.body.nearby) && err.body.nearby.length) {
          const list = err.body.nearby
            .map((r: any) => `${r.id || ''} ${r.name || ''} ${r.date ? new Date(r.date).toISOString().split('T')[0] : r.date}`.trim())
            .join('\n');
          alert((err.message || 'Failed to delete holiday') + '\nNearby rows in DB:\n' + list);
        } else {
          alert((err.message || 'Failed to delete holiday') + '\n' + JSON.stringify(err.body));
        }
      } else {
        alert(err.message || err?.error || 'Failed to delete holiday');
      }
    } finally {
      if (isMountedRef.current) { setIsLoading(false); }
    }
  };

  /* =========================
     OPEN ADD MODAL
  ========================= */
  const openAddModal = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const existing = holidays.find(h => h.date === dateStr);

    if (existing) {
      setEditingHoliday(existing);
      setSelectedDate(existing.date);
      setHolidayName(existing.name);
      setHolidayNote(existing.note || '');
    } else {
      setEditingHoliday(null);
      setSelectedDate(dateStr);
      setHolidayName('');
      setHolidayNote('');
    }

    setShowAddModal(true);
  };

  /* =========================
     HELPERS
  ========================= */
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();

  // ✅ BUG FIX: Include Saturday (6) alongside Sunday (0) — consistent with AttendanceCalendar
  const isWeekend = (d: number) =>
    [0, 6].includes(new Date(year, month, d).getDay());

  const getHoliday = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return holidays.find(h => h.date === dateStr);
  };

  const changeMonth = (offset: number) =>
    setCurrentDate(new Date(year, month + offset, 1));

  /* =========================
     UI
  ========================= */
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-slate-200/60 flex justify-between items-center bg-slate-50/50">
        <button 
          onClick={() => changeMonth(-1)}
          className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-sm border border-slate-200/60 transition-all text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="font-black text-xl text-slate-800 tracking-tight">
          {monthNames[month]} {year}
        </h3>
        <button 
          onClick={() => changeMonth(1)}
          className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-sm border border-slate-200/60 transition-all text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* CALENDAR GRID */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="mt-3 text-sm">Loading holidays...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 mb-3 text-center">
              {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                <div key={d} className="text-sm font-bold text-gray-600 py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const holiday = getHoliday(day);
                const weekend = isWeekend(day);

                return (
                  <div
                    key={day}
                    onClick={() => openAddModal(day)}
                    className={`
                      min-h-[80px] sm:min-h-[100px] rounded-xl p-2 sm:p-3 cursor-pointer border-2 transition-all duration-200
                      ${holiday ? 'bg-blue-50 border-blue-200 hover:bg-blue-100/80 shadow-inner shadow-blue-900/5' : 
                        weekend ? 'bg-slate-50/50 border-slate-100 hover:bg-slate-100' :
                        'bg-white border-slate-100 hover:border-blue-400 hover:shadow-lg hover:scale-[1.02]'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <span className={`font-black text-base sm:text-lg ${holiday ? 'text-blue-700' : 'text-slate-600'}`}>
                        {day}
                      </span>
                      {holiday && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHoliday(holiday.date);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 text-[10px] transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {holiday && (
                      <div className="space-y-1">
                        <p className="font-bold text-blue-800 text-[10px] sm:text-xs leading-tight line-clamp-2">{holiday.name}</p>
                        {holiday.note && (
                          <p className="text-slate-500 text-[8px] sm:text-[10px] leading-tight truncate">{holiday.note}</p>
                        )}
                      </div>
                    )}

                    {!holiday && !weekend && (
                      <div className="mt-auto pt-2 hidden sm:block">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Add Holiday</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g., Independence Day"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (Optional)
                </label>
                <textarea
                  value={holidayNote}
                  onChange={(e) => setHolidayNote(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHoliday}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                {editingHoliday ? 'Update' : 'Add'} Holiday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-600">
        <p>
          📅 Total Holidays: <strong>{holidays.length}</strong>
          <span className="ml-4 text-xs text-gray-500">
            Click on any date to add/edit holidays
          </span>
        </p>
      </div>
    </div>
  );
};
