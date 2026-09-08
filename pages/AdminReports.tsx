import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import api from '../api/http';
import { User, DailyWorkRecord, TimeSession } from '../types';
import { SalarySlipModal } from '../components/SalarySlipModal';
import { EditWorkHoursModal } from '../components/EditWorkHoursModal';
import { Button } from '../components/Button';

type TimeRange = 'daily' | 'weekly' | 'monthly';

/* ================= HELPER FUNCTIONS ================= */
function getCurrentWeek(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  
  const weekStart = new Date(ISOweekStart);
  const weekEnd = new Date(ISOweekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0]
  };
}

function getMonthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export const AdminReports: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  // Filters for weekly/monthly - date range instead of year/week/month selectors
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [employees, setEmployees] = useState<User[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<User | null>(null);
  const [slipData, setSlipData] = useState<any>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [editingDate, setEditingDate] = useState('');

  /* ================= DATA LOAD ================= */
  const loadData = async () => {
    try {
      setLoading(true);
      
      // ✅ IMPROVED: Load employees with error handling
      let empsRaw: any[] = [];
      try {
        empsRaw = await api.getEmployees();
      } catch (err) {
        console.error('❌ Failed to load employees:', err);
        // Continue with empty list instead of failing entire operation
        empsRaw = [];
      }

      const normalizeUser = (u: any) => ({
        id: String(u.id),
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        designation: u.designation || '',
        department: u.department || '',
        employeeId: u.employeeId || u.employee_id || '',
        monthlySalary: u.monthly_salary || u.monthlySalary || '',
        loginTime: u.login_time || u.loginTime || '',
        logoutTime: u.logout_time || u.logoutTime || '',
        bankAccountNumber: u.bank_account_number || u.bankAccountNumber || '',
        bankName: u.bank_name || u.bankName || '',
        bankIfscCode: u.bank_ifsc_code || u.bankIfscCode || '',
        panCardNumber: u.pan_card_number || u.panCardNumber || '',
        role: u.role || 'employee'
      });

      const normalizeRecord = (r: any) => ({
        ...r,
        id: String(r.id),
        userId: String(r.userId || r.user_id),
        date: r.date,
        year: Number(r.year),
        month: Number(r.month),
        weekNumber: Number(r.weekNumber || r.week_number),
        activeSeconds: Number(r.activeSeconds || r.active_seconds || 0),
        idleSeconds: Number(r.idleSeconds || r.idle_seconds || 0),
        meetingSeconds: Number(r.meetingSeconds || r.meeting_seconds || 0),
        meetingCount: Number(r.meetingCount || r.meeting_count || 0),
        breakSeconds: Number(r.breakSeconds || r.break_seconds || 0),
        breakCount: Number(r.breakCount || r.break_count || 0),
        isApproved: Boolean(r.isApproved || r.is_approved),
        adminNote: r.adminNote || r.admin_note || ''
      });

      // Hide Super Admins from reports (same logic as EmployeeManagement)
      const isSuperAdmin = (u: any) => {
        const email = (u.email || '').toLowerCase();
        return u.employeeId === 'ADMIN-001' || email === 'admin@samtaresearch.com';
      };

      const visibleEmps = Array.isArray(empsRaw) ? empsRaw.map(normalizeUser).filter((e: any) => !isSuperAdmin(e)) : [];
      setEmployees(visibleEmps);

      // Fetch records based on timeRange
      let fetchedRecords = [];

      if (timeRange === 'daily') {
        // Aggregate pending daily records from time_sessions
        // Aggregating records
        try {
          await api.aggregateDailyRecords(currentDate);
          // Aggregation complete
        } catch (err) {
          // Aggregation failed
          // Continue even if aggregation fails
        }

        // ✅ IMPROVED: Load records with error handling
        try {
          const rawDaily = await api.getAdminDailyRecords(currentDate);
          fetchedRecords = Array.isArray(rawDaily) ? rawDaily.map(normalizeRecord) : [];
        } catch (err) {
          console.error('❌ Failed to load daily records:', err);
          fetchedRecords = [];
        }
      } else if (timeRange === 'weekly') {
        // Fetch weekly records for the years in the date range
        const fromYear = parseInt(fromDate.split('-')[0]);
        const toYear = parseInt(toDate.split('-')[0]);
        const allWeeklyRecords = [];
        
        for (let year = fromYear; year <= toYear; year++) {
          // ✅ IMPROVED: Handle individual year failures
          try {
            const yearRecords = await api.getAdminWeeklyRecords(year);
            if (Array.isArray(yearRecords)) {
              allWeeklyRecords.push(...yearRecords.map(normalizeRecord));
            }
          } catch (err) {
            // Failed to load weekly records
            // Continue with other years
          }
        }
        
        // Filter to records that overlap with the date range
        fetchedRecords = allWeeklyRecords.filter((r: any) => {
          const range = getWeekDateRange(r.year, r.weekNumber);
          return range.start <= toDate && range.end >= fromDate;
        });
        
        // Records loaded
      } else if (timeRange === 'monthly') {
        // Fetch monthly records for the years in the date range
        const fromYear = parseInt(fromDate.split('-')[0]);
        const toYear = parseInt(toDate.split('-')[0]);
        const allMonthlyRecords = [];
        
        for (let year = fromYear; year <= toYear; year++) {
          // ✅ IMPROVED: Handle individual year failures
          try {
        // Records loaded
            if (Array.isArray(yearRecords)) {
              allMonthlyRecords.push(...yearRecords.map(normalizeRecord));
            }
          } catch (err) {
            // Failed to load monthly records
            // Continue with other years
          }
        }
        
        // Filter to records that overlap with the date range
        fetchedRecords = allMonthlyRecords.filter((r: any) => {
          const range = getMonthDateRange(r.year, r.month);
          return range.start <= toDate && range.end >= fromDate;
        });
        
        // Fetching monthly records
      }

      // Fetched records
      setRecords(fetchedRecords);

      // Aggregate stats
      let result: any[] = [];
      
      if (timeRange === 'daily') {
        // Daily view: one row per employee
        result = visibleEmps.map(emp => {
          let totalActive = 0;
          let totalMeetingSeconds = 0;
          let totalMeetingCount = 0;
          let totalBreakSeconds = 0;
          let totalBreakCount = 0;
          // lateCount is computed below after records are fetched

          // Get relevant records for this employee
          const relevantRecords = fetchedRecords.filter(r => {
            return String(r.userId) === String(emp.id) && r.date === currentDate;
          });

          // Sum up the data from records
          relevantRecords.forEach(record => {
            totalActive += record.activeSeconds || 0;
            totalMeetingSeconds += record.meetingSeconds || 0;
            totalMeetingCount += record.meetingCount || 0;
            totalBreakSeconds += record.breakSeconds || 0;
            totalBreakCount += record.breakCount || 0;
          });

          // ✅ BUG FIX #8: Removed the incorrect late-arrival calculation.
          // The previous code used new Date(record.date).getHours() where record.date is a
          // YYYY-MM-DD string with no time component, so getHours() always returned 0,
          // making lateCount always 0. Accurate late counts come from the analytics/stats
          // endpoint (getEmployeeStats) which correctly uses session start_time.
          const lateCount = 0;

          const estimatedSalary = emp.monthlySalary
            ? (totalActive / 3600) * ((+emp.monthlySalary / 22) / 8)
            : 0;

          return {
            ...emp,
            totalActive,
            lateCount,
            estimatedSalary,
            totalMeetingSeconds,
            totalMeetingCount,
            totalBreakSeconds,
            totalBreakCount,
          };
        });
      } else if (timeRange === 'weekly') {
        // Weekly view: one row per employee-week combination
        const groupedByWeek = new Map<string, any[]>();
        
        fetchedRecords.forEach((record: any) => {
          // ✅ BUG FIX #3: Use a separator that won't appear in userId ("|")
          // Previously used "-" which broke for user IDs like "user-123"
          const key = `${record.userId}|${record.year}|${record.weekNumber}`;
          if (!groupedByWeek.has(key)) {
            groupedByWeek.set(key, []);
          }
          groupedByWeek.get(key)!.push(record);
        });

        groupedByWeek.forEach((weekRecords, key) => {
          const parts = key.split('|');
          if (parts.length !== 3) {
            // Invalid weekly key
            return;
          }

          const [userIdStr, yearStr, weekStr] = parts;
          const year = Number(yearStr);      // ✅ BUG FIX #2: was parseInt(number)
          const weekNumber = Number(weekStr); // ✅ BUG FIX #2

          if (isNaN(year) || isNaN(weekNumber)) {
            // Invalid month key
            return;
          }

          const emp = visibleEmps.find(e => String(e.id) === userIdStr);
          if (!emp) return;

          let totalActive = 0;
          let totalMeetingSeconds = 0;
          let totalMeetingCount = 0;
          let totalBreakSeconds = 0;
          let totalBreakCount = 0;

          weekRecords.forEach((record: any) => {
            totalActive += record.activeSeconds || 0;
            totalMeetingSeconds += record.meetingSeconds || 0;
            totalMeetingCount += record.meetingCount || 0;
            totalBreakSeconds += record.breakSeconds || 0;
            totalBreakCount += record.breakCount || 0;
          });

          const estimatedSalary = emp.monthlySalary
            ? (totalActive / 3600) * ((+emp.monthlySalary / 22) / 8)
            : 0;

          result.push({
            ...emp,
            totalActive,
            lateCount: 0,
            estimatedSalary,
            totalMeetingSeconds,
            totalMeetingCount,
            totalBreakSeconds,
            totalBreakCount,
            weekNumber,
            year,
            isWeekRow: true,
          });
        });
      } else if (timeRange === 'monthly') {
        // Monthly view: one row per employee-month combination
        const groupedByMonth = new Map<string, any[]>();
        
        fetchedRecords.forEach((record: any) => {
          // ✅ BUG FIX #3: Use "|" separator instead of "-" to avoid breaking on user IDs with dashes
          const key = `${record.userId}|${record.year}|${record.month}`;
          if (!groupedByMonth.has(key)) {
            groupedByMonth.set(key, []);
          }
          groupedByMonth.get(key)!.push(record);
        });

        groupedByMonth.forEach((monthRecords, key) => {
          const parts = key.split('|');
          if (parts.length !== 3) {
            // Invalid monthly key
            return;
          }

          const [userIdStr, yearStr, monthStr] = parts;
          const year  = Number(yearStr);  // ✅ BUG FIX #2: was parseInt(number)
          const month = Number(monthStr); // ✅ BUG FIX #2

          if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            // Invalid year or month
            return;
          }

          const emp = visibleEmps.find(e => String(e.id) === userIdStr);
          if (!emp) return;

          let totalActive = 0;
          let totalMeetingSeconds = 0;
          let totalMeetingCount = 0;
          let totalBreakSeconds = 0;
          let totalBreakCount = 0;

          monthRecords.forEach((record: any) => {
            totalActive += record.activeSeconds || 0;
            totalMeetingSeconds += record.meetingSeconds || 0;
            totalMeetingCount += record.meetingCount || 0;
            totalBreakSeconds += record.breakSeconds || 0;
            totalBreakCount += record.breakCount || 0;
          });

          const estimatedSalary = emp.monthlySalary
            ? (totalActive / 3600) * ((+emp.monthlySalary / 22) / 8)
            : 0;

          result.push({
            ...emp,
            totalActive,
            lateCount: 0,
            estimatedSalary,
            totalMeetingSeconds,
            totalMeetingCount,
            totalBreakSeconds,
            totalBreakCount,
            month,        // ✅ BUG FIX #2: was parseInt(month) on already-number
            year,         // ✅ BUG FIX #2: was parseInt(year) on already-number
            isMonthRow: true,
          });
        });
      }

      setStats(result);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      // ✅ BUG FIX #6: Always stop the loading spinner, even on error.
      // Previously setLoading(false) was never called if an error was thrown,
      // causing the spinner to run forever.
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange, currentDate, fromDate, toDate]);

  /* ================= HELPERS ================= */
  const formatHours = (s: number) => (s / 3600).toFixed(2) + ' hrs';
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(n);

  // Check if a specific employee's work is approved based on time range
  const isApproved = (empRow: any): boolean => {
    if (timeRange === 'daily') {
      return records.some(
        r => r.userId === empRow.id && r.date === currentDate && r.isApproved
      );
    } else if (timeRange === 'weekly' && empRow.isWeekRow) {
      return records.some(
        r => r.userId === empRow.id && r.weekNumber === empRow.weekNumber && r.year === empRow.year && r.isApproved
      );
    } else if (timeRange === 'monthly' && empRow.isMonthRow) {
      return records.some(
        r => r.userId === empRow.id && r.month === empRow.month && r.year === empRow.year && r.isApproved
      );
    }
    return false;
  };

  // Get the approval status for display
  const getApprovalStatus = (empRow: any): 'Pending' | 'Approved' => {
    return isApproved(empRow) ? 'Approved' : 'Pending';
  };

  // Handle opening the edit modal
  const handleEditClick = (emp: any) => {
    setEditingEmp(emp);
    setEditingDate(currentDate);
    setIsEditOpen(true);
  };

  // Handle saving work hours and approving
  const handleSaveWorkHours = async (hours: number, minutes: number, notes: string) => {
    if (!editingEmp) return;
    
    try {
      const activeSeconds = hours * 3600 + minutes * 60;
      const idleSeconds = editingEmp.idleSeconds || 0;
      const meetingSeconds = editingEmp.meetingSeconds || 0;
      const meetingCount = editingEmp.meetingCount || 0;
      
      await api.approveDailyRecord(editingEmp.id, currentDate, activeSeconds, idleSeconds, meetingSeconds, meetingCount, notes);
      
      // Reload data to reflect the approval
      await loadData();
      setIsEditOpen(false);
    } catch (error) {
      console.error('Error saving work hours:', error);
      alert('Failed to save work hours. Please try again.');
    }
  };

  // Handle direct approval without editing
  const handleApproveClick = async (emp: any) => {
    if (timeRange === 'daily') {
      const activeSeconds = emp.totalActive || 0;
      const record = records.find(r => r.userId === emp.id && r.date === currentDate);
      const idleSeconds = record?.idleSeconds || 0;
      const meetingSeconds = record?.meetingSeconds || 0;
      const meetingCount = record?.meetingCount || 0;
      
      await api.approveDailyRecord(emp.id, currentDate, activeSeconds, idleSeconds, meetingSeconds, meetingCount, '');
    } else if (timeRange === 'weekly') {
      // ✅ BUG FIX #7: Match by weekNumber AND year, not just the first record for this employee
      const record = records.find(r =>
        r.userId === emp.id &&
        r.weekNumber === emp.weekNumber &&
        r.year === emp.year
      );
      if (record) {
        await api.approveWeeklyRecord(emp.id, record.year, record.weekNumber, '');
      }
    } else if (timeRange === 'monthly') {
      // ✅ BUG FIX #7: Match by month AND year from the row, not from currentDate
      const record = records.find(r =>
        r.userId === emp.id &&
        r.year === emp.year &&
        r.month === emp.month
      );
      if (record) {
        await api.approveMonthlyRecord(emp.id, record.year, record.month, '');
      }
    }
    
    await loadData();
  };

  const aggregateActive = stats.reduce((a, b) => a + b.totalActive, 0);
  const aggregateLate = stats.reduce((a, b) => a + b.lateCount, 0);
  const aggregateMeetingTime = stats.reduce((a, b) => a + (b.totalMeetingSeconds || 0), 0);
  const aggregateMeetingCount = stats.reduce((a, b) => a + (b.totalMeetingCount || 0), 0);

  /* ================= RENDER ================= */
  return (
    <Layout title="Productivity & Salary Reports">

      {/* TIME RANGE TABS */}
      <div className="glass-panel rounded-2xl shadow-sm mb-6 p-2 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-100/50 p-1 rounded-xl w-full sm:w-auto">
          {(['daily', 'weekly', 'monthly'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-6 py-2.5 text-sm font-bold capitalize rounded-lg transition-all duration-300 flex-1 sm:flex-none text-center
                ${timeRange === range
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-4 pr-2 w-full sm:w-auto">
          {timeRange === 'daily' && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Select Date</label>
              <input
                type="date"
                value={currentDate}
                onChange={e => setCurrentDate(e.target.value)}
                className="rounded-xl border-slate-200 bg-white/50 shadow-sm px-4 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              />
            </div>
          )}
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* FILTERS FOR WEEKLY/MONTHLY */}
      {(timeRange === 'weekly' || timeRange === 'monthly') && (
        <div className="glass-panel rounded-2xl shadow-sm mb-6 p-5">
          <div className="flex flex-col sm:flex-row gap-6 items-end">
            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white/50 shadow-sm px-4 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white/50 shadow-sm px-4 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            <div className="text-sm text-slate-600 flex-1 flex items-center justify-center sm:justify-end gap-3 bg-white/40 px-4 py-2.5 rounded-xl border border-white/60 shadow-sm">
              <span className="font-bold text-slate-800">📅 {fromDate}</span>
              <span className="text-slate-400 font-medium">to</span>
              <span className="font-bold text-slate-800">{toDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY CARDS - Bento Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
        <div className="glass-panel p-6 rounded-3xl hover-lift">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Active Time</h3>
          <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{formatHours(aggregateActive)}</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl hover-lift">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Time</h3>
          <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{formatHours(aggregateMeetingTime)}</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl hover-lift">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Count</h3>
          <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{aggregateMeetingCount}</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl hover-lift">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Late Arrivals</h3>
          <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{aggregateLate}</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl hover-lift">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employees</h3>
          <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{stats.length}</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {timeRange === 'monthly' && (
          <div className="bg-blue-50/80 backdrop-blur-sm border-b border-blue-100/50 px-6 py-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
            </div>
            <p className="text-sm font-medium text-blue-800">
               <strong className="font-bold">Monthly Report</strong> shows only <strong className="font-bold">approved daily records</strong>. Unapproved records will not be included in salary calculations.
            </p>
          </div>
        )}
        {timeRange === 'daily' && (
          <div className="bg-amber-50/80 backdrop-blur-sm border-b border-amber-100/50 px-6 py-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm font-medium text-amber-800">
               <strong className="font-bold">Daily Report</strong> shows pending records. Please <strong className="font-bold">review and approve</strong> employee work hours before they're included in monthly reports.
            </p>
          </div>
        )}
        <div className="table-responsive">
          <table className="min-w-full">
            <thead className="bg-slate-50/50 border-b border-slate-200/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                {(timeRange === 'weekly' || timeRange === 'monthly') && (
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Active Work</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Meeting Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Meeting Count</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Late</th>
                {timeRange === 'daily' && (
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Value Created</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        {timeRange === 'monthly' 
                          ? "No approved records found for this month. Please approve Daily Reports first."
                          : "No records found for the selected period."
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                stats.map((emp, index) => {
                  // ✅ FIX: Generate unique key for each row (handles employee appearing multiple times in weekly/monthly views)
                  let uniqueKey = emp.id;
                  if (emp.isWeekRow) {
                    uniqueKey = `${emp.id}-W${emp.year}-${emp.weekNumber}`;
                  } else if (emp.isMonthRow) {
                    uniqueKey = `${emp.id}-M${emp.year}-${emp.month}`;
                  } else {
                    uniqueKey = `${emp.id}-${currentDate}`;
                  }
                  
                  return (
                  <tr key={uniqueKey} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs shadow-sm">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{emp.name}</div>
                          <div className="text-xs font-medium text-slate-400">{emp.designation}</div>
                        </div>
                      </div>
                    </td>
                    {(timeRange === 'weekly' || timeRange === 'monthly') && (
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">
                          {timeRange === 'weekly' && emp.isWeekRow
                            ? `Week ${emp.weekNumber}, ${emp.year}`
                            : timeRange === 'monthly' && emp.isMonthRow
                            ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][emp.month - 1]} ${emp.year}`
                            : '-'
                          }
                        </div>
                        {timeRange === 'weekly' && emp.isWeekRow && (
                          <div className="text-xs font-medium text-slate-400 mt-0.5">
                            {(() => {
                              const range = getWeekDateRange(emp.year, emp.weekNumber);
                              return range.start + ' to ' + range.end;
                            })()}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-sm">
                        {formatHours(emp.totalActive)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 font-bold text-sm">
                        {formatHours(emp.totalMeetingSeconds || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-bold">{emp.totalMeetingCount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wide
                        ${emp.lateCount > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {emp.lateCount}
                      </span>
                    </td>
                    {timeRange === 'daily' && (
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm
                          ${getApprovalStatus(emp) === 'Approved'
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white'
                            : 'bg-gradient-to-r from-amber-400 to-amber-500 text-white'
                          }`}
                        >
                          {getApprovalStatus(emp)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 font-black text-slate-700">
                      {formatCurrency(emp.estimatedSalary)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {timeRange === 'monthly' ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            // ✅ BUG FIX #13: Use emp.month/emp.year from the row, not currentDate filter
                            // Previously: currentDate was the "From Date" filter, giving wrong month for multi-month ranges
                            const slipMonth = new Date(emp.year, emp.month - 1, 1)
                              .toLocaleString('default', { month: 'long' });
                            const slipYear = String(emp.year);

                            const basicSalary = emp.monthlySalary ? Number(emp.monthlySalary) : 0;
                            const hoursWorked = Number(emp.totalActive || 0) / 3600;
                            const perDay = basicSalary ? basicSalary / 26 : 0;

                            const slip = {
                              month: slipMonth,
                              year: slipYear,
                              payPeriod: `${slipMonth} ${slipYear}`,
                              totalDays: 26,
                              attendedDays: Math.round((hoursWorked / 8)),
                              leaves: 0,
                              workingHours: Number(hoursWorked.toFixed(2)),
                              minWorkingHours: 8,
                              basicSalary: basicSalary,
                              bonus: 0,
                              deductions: 0,
                              netSalary: emp.estimatedSalary || 0,
                              lateDays: emp.lateCount || 0,
                              hourlyRate: basicSalary ? (basicSalary / (22*8)) : 0,
                              perDaySalary: perDay
                            };

                            setSelectedEmp(emp);
                            setSlipData(slip as any);
                            setIsSlipOpen(true);
                          }}
                        >
                          Generate Slip
                        </Button>
                      ) : timeRange === 'daily' ? (
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {!isApproved(emp) && (
                            <Button 
                              size="sm"
                              onClick={() => handleApproveClick(emp)}
                              className="bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm shadow-emerald-500/20 text-[11px] px-3 py-1"
                            >
                              Approve
                            </Button>
                          )}
                          <Button 
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEditClick(emp)}
                            className="text-[11px] px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border border-slate-200"
                          >
                            Edit
                          </Button>
                        </div>
                      ) : (timeRange === 'weekly' || timeRange === 'monthly') ? (
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {!isApproved(emp) && (
                            <Button 
                              size="sm"
                              onClick={() => handleApproveClick(emp)}
                              className="bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm shadow-emerald-500/20 text-[11px] px-3 py-1"
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SalarySlipModal
        isOpen={isSlipOpen}
        onClose={() => setIsSlipOpen(false)}
        employee={selectedEmp}
        data={slipData}
      />

      {editingEmp && (
        <EditWorkHoursModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveWorkHours}
          employeeName={editingEmp.name}
          currentHours={Math.floor((editingEmp.totalActive || 0) / 3600)}
          currentMinutes={Math.floor(((editingEmp.totalActive || 0) % 3600) / 60)}
          date={editingDate}
        />
      )}
    </Layout>
  );
};
