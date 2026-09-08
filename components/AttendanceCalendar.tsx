import React, { useState, useEffect, useRef } from 'react';
import { Holiday } from '../types';
import http from '../api/http';

interface AttendanceCalendarProps {
  userId: string;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceMap, setAttendanceMap] = useState<Map<number, 'present' | 'late'>>(new Map());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  // BUG FIX: Added isMountedRef to prevent state updates on unmounted component
  const isMountedRef = useRef<boolean>(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fetchHolidays = async (immediate = false) => {
    const now = Date.now();
    if (!immediate && now - lastFetchRef.current < 1000) { return; }
    lastFetchRef.current = now;
    try {
      if (!isMountedRef.current) return;
      const res = await http.getHolidays(year, month + 1);
      if (!isMountedRef.current) return;
      setHolidays(Array.isArray(res) ? res : []);
    } catch (err) {
      if (!isMountedRef.current) return;
      setHolidays([]);
    }
  };

  const fetchAttendance = async () => {
    if (!userId) {
      if (isMountedRef.current) { setAttendanceMap(new Map()); }
      return;
    }
    try {
      const res = await http.getMonthlyAttendance(userId, year, month + 1);
      if (!isMountedRef.current) return;
      const map = new Map<number, 'present' | 'late'>();
      if (Array.isArray(res)) {
        res.forEach((d: any) => {
          map.set(Number(d.day), d.status?.toLowerCase() === 'late' ? 'late' : 'present');
        });
      }
      if (isMountedRef.current) { setAttendanceMap(map); }
    } catch (err) {
      if (isMountedRef.current) { setAttendanceMap(new Map()); }
    }
  };

  const fetchData = async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    try {
      await Promise.all([fetchHolidays(), fetchAttendance()]);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      if (isMountedRef.current) { setIsLoading(false); }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => { isMountedRef.current = false; };
  }, [userId, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  // BUG FIX: Added Saturday (6) to weekend check
  const isWeekend = (d: number) => [0, 6].includes(new Date(year, month, d).getDay());
  const isFuture = (d: number) => {
    const check = new Date(year, month, d);
    const today = new Date();
    today.setHours(0,0,0,0);
    return check > today;
  };
  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
  const todayDate = new Date().getDate();
  // BUG FIX: Fixed date string construction
  const formatDate = (y: number, m: number, d: number): string => {
    const monthStr = String(m + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    return y + '-' + monthStr + '-' + dayStr;
  };
  const getStatus = (day: number): string => {
    if (isFuture(day)) return 'future';
    if (isWeekend(day)) return 'weekend';
    const dateStr = formatDate(year, month, day);
    if (holidays.some(h => h.date === dateStr)) return 'holiday';
    if (attendanceMap.has(day)) return attendanceMap.get(day) || 'present';
    return 'absent';
  };
  const getHoliday = (day: number): Holiday | undefined => {
    return holidays.find(h => h.date === formatDate(year, month, day));
  };
  const navigateMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };
  const stats = {
    present: Array.from(attendanceMap.values()).filter(v => v === 'present').length,
    late: Array.from(attendanceMap.values()).filter(v => v === 'late').length,
    holidays: holidays.filter(h => {
      const d = new Date(h.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length,
    absent: daysInMonth - Array.from(attendanceMap.values()).filter(v => v === 'present' || v === 'late').length
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigateMonth(-1)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
        <h3 className="text-lg font-bold text-white">{monthNames[month]} {year}</h3>
        <button onClick={() => navigateMonth(1)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (<div key={d} className="text-center text-xs font-bold text-gray-500 uppercase">{d}</div>))}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({length: startDay}).map((_, i) => (<div key={'empty-'+i} />))}
            {Array.from({length: daysInMonth}).map((_, i) => {
              const day = i + 1;
              const status = getStatus(day);
              const isToday = isCurrentMonth && day === todayDate;
              const holiday = getHoliday(day);
              let bg = 'bg-gray-50'; let textColor = 'text-gray-700'; let icon = '';
              if (status === 'present') { bg = 'bg-green-100 border-green-300'; textColor = 'text-green-800'; icon = '\u2713'; }
              else if (status === 'late') { bg = 'bg-yellow-100 border-yellow-300'; textColor = 'text-yellow-800'; icon = '\u23F1'; }
              else if (status === 'absent') { bg = 'bg-red-50 border-red-200'; textColor = 'text-red-700'; icon = '\u2717'; }
              else if (status === 'holiday') { bg = 'bg-blue-100 border-blue-300'; textColor = 'text-blue-800'; icon = '\u{1F38A}'; }
              else if (status === 'weekend') { bg = 'bg-gray-100 border-gray-200'; textColor = 'text-gray-500'; }
              else if (status === 'future') { bg = 'bg-white border-gray-200'; textColor = 'text-gray-400'; }
              return (
                <div key={day} className={'aspect-square rounded-lg flex flex-col items-center justify-center p-2 border-2 ' + bg + ' ' + textColor + (isToday ? ' ring-2 ring-blue-500 ring-offset-2' : '')} title={holiday ? holiday.name + (holiday.note ? '\\n' + holiday.note : '') : undefined}>
                  <div className="flex items-center gap-1"><span className="font-bold text-base">{day}</span>{icon && <span className="text-xs">{icon}</span>}</div>
                  {holiday && (<span className="text-[9px] font-semibold mt-1">{holiday.name}</span>)}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300"></div><span>Present: <strong className="text-green-700">{stats.present}</strong></span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-300"></div><span>Late: <strong className="text-yellow-700">{stats.late}</strong></span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-300"></div><span>Holidays: <strong className="text-blue-700">{stats.holidays}</strong></span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-50 border-2 border-red-200"></div><span>Absent: <strong className="text-red-700">{stats.absent}</strong></span></div>
        </div>
      </div>
    </div>
  );
};
