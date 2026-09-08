import React, { useState, useEffect } from 'react';
import { AddEmployeeModal } from '../components/AddEmployeeModal';

import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { EmployeeFormData, User } from '../types';
import * as api from '../api/http';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [counts, setCounts] = useState({ active: 0, trash: 0, todayActive: 0 });

  // View Mode: Active vs Trash
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  // Confirmation Modal State
  const [trashConfirmation, setTrashConfirmation] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });

  // ✅ BUG FIX #11: Accept viewMode as param to avoid race condition when switching tabs rapidly
  // ✅ FIX: Only consider users with ACTIVE sessions (no end_time) as online
  const loadData = async (mode: 'active' | 'trash' = viewMode) => {
    // Fetch lists, today's active count, and active sessions
    const [activeDataRaw, trashDataRaw, todayActiveCount, activeSessionsRaw] = await Promise.all([
      api.getEmployees(),
      api.getTrashedEmployees(),
      // @ts-ignore - Fetching the new stat
      api.getActiveEmployeesToday(),
      api.getAdminSessions()
    ]);

    // Filter to only ACTIVE sessions (those without end_time)
    const allSessions = Array.isArray(activeSessionsRaw) ? activeSessionsRaw : [];
    const activeSessions = allSessions.filter((s: any) => !s.endTime && !s.end_time);
    const onlineUserIds = new Set(activeSessions.map((s: any) => String(s.userId || s.user_id)));

    // Session stats

    // Normalize server fields (snake_case) to frontend `User` model
    const normalizeUser = (u: any): User => ({
      id: String(u.id),
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      designation: u.designation || '',
      department: u.department || '',
      employeeId: u.employeeId || u.employee_id || '',
      role: (u.role as any) || 'employee',
      salaryType: (u.salaryType as any) || 'Monthly Salary',
      monthlySalary: u.monthly_salary || u.monthlySalary || '',
      loginTime: u.login_time || u.loginTime || '',
      logoutTime: u.logout_time || u.logoutTime || '',
      online: onlineUserIds.has(String(u.id)),
      bankAccountNumber: u.bank_account_number || u.bankAccountNumber || '',
      bankName: u.bank_name || u.bankName || '',
      bankIfscCode: u.bank_ifsc_code || u.bankIfscCode || '',
      panCardNumber: u.pan_card_number || u.panCardNumber || ''
    });

    const activeData = Array.isArray(activeDataRaw) ? activeDataRaw.map(normalizeUser) : [];
    const trashData = Array.isArray(trashDataRaw) ? trashDataRaw.map(normalizeUser) : [];

    // Hide Super Admin from lists (by known employeeId or email)
    const isSuperAdmin = (u: User) => {
      const email = (u.email || '').toLowerCase();
      return u.employeeId === 'ADMIN-001' || email === 'admin@samtaresearch.com';
    };

    const visibleActive = activeData.filter(u => !isSuperAdmin(u));
    const visibleTrash = trashData.filter(u => !isSuperAdmin(u));

    setCounts({
      active: visibleActive.length,
      trash: visibleTrash.length,
      todayActive: todayActiveCount
    });

    // ✅ BUG FIX #11: use the passed mode, not the potentially-stale viewMode closure
    if (mode === 'active') {
      setEmployees(visibleActive);
    } else {
      setEmployees(visibleTrash);
    }
  };

  useEffect(() => {
    // ✅ BUG FIX #10: wrap in try/catch to surface errors to the user
    (async () => {
      try {
        await loadData(viewMode);
      } catch (err) {
        console.error('Failed to load employee data:', err);
      }
    })();
  }, [viewMode]);



  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (employee: User) => {
    setEditingEmployee(employee);
    setIsAddModalOpen(true);
  };

  const handleSaveEmployee = async (data: EmployeeFormData) => {
    // ✅ BUG FIX #10: await loadData and handle errors
    // Note: The actual API call (addEmployee/updateEmployee) is handled inside AddEmployeeModal
    try {
      await loadData(viewMode);
    } catch (err) {
      console.error('Failed to reload after save:', err);
    }
  };

  const initiateMoveToTrash = (employee: User) => {
    setTrashConfirmation({
      isOpen: true,
      id: employee.id,
      name: employee.name
    });
  };

  const handleConfirmTrash = async () => {
    if (trashConfirmation.id) {
      try {
        await api.moveToTrash(trashConfirmation.id);
        setTrashConfirmation({ isOpen: false, id: null, name: '' });
        // ✅ BUG FIX #10: await and handle error
        await loadData(viewMode);
      } catch (err) {
        console.error('Failed to deactivate employee:', err);
        alert('Failed to deactivate employee. Please try again.');
      }
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.restoreFromTrash(id);
      // ✅ BUG FIX #10: await and handle error
      await loadData(viewMode);
    } catch (err) {
      console.error('Failed to restore employee:', err);
      alert('Failed to restore employee. Please try again.');
    }
  };

  const formatCurrency = (amount: string | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(parseFloat(amount));
  };

  return (
    <Layout title="Employee Management">

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">

        {/* Total Workforce Card */}
        <div className="glass-panel p-6 rounded-3xl hover-lift flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Workforce</h3>
            <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{counts.active}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Today Active Employees Card */}
        <div className="glass-panel p-6 rounded-3xl hover-lift flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Today</h3>
            <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{counts.todayActive}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </div>
        </div>

      </div>

      {/* Top Bar: Tabs & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">

        {/* View Toggles */}
        <div className="glass-panel p-1.5 rounded-xl shadow-sm flex items-center">
          <button
            onClick={() => setViewMode('active')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'active'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
          >
            Active Employees
            <span className={`py-0.5 px-2 rounded-full text-[10px] font-black ${viewMode === 'active' ? 'bg-blue-100/50 text-blue-700' : 'bg-slate-200/50 text-slate-500'}`}>
              {counts.active}
            </span>
          </button>
          <button
            onClick={() => setViewMode('trash')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'trash'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Archived
            <span className={`py-0.5 px-2 rounded-full text-[10px] font-black ${viewMode === 'trash' ? 'bg-rose-100/50 text-rose-700' : 'bg-slate-200/50 text-slate-500'}`}>
              {counts.trash}
            </span>
          </button>
        </div>

        {viewMode === 'active' && (
          <Button onClick={handleOpenAddModal} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 border-none px-6 py-2.5 hover-lift">
            <span className="mr-2 font-black text-lg leading-none">+</span> Add Employee
          </Button>
        )}
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        {viewMode === 'trash' && (
          <div className="bg-amber-50/80 backdrop-blur-sm border-b border-amber-100/50 px-6 py-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-amber-800">
              <strong className="font-bold">Archive:</strong> These employees are deactivated and hidden from the active list. You can restore them anytime.
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50/50 border-b border-slate-200/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Job Role</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Emp ID</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Salary</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {viewMode === 'active' ? 'Actions' : 'Archive Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        {viewMode === 'active'
                          ? 'No active employees found. Click "Add Employee" to create one.'
                          : 'No archived employees found.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className={`group hover:bg-slate-50/50 transition-colors ${viewMode === 'trash' ? 'opacity-75 grayscale-[0.2]' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shadow-sm">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{employee.name}</div>
                          <div className="mt-0.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${employee.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                              {employee.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                              {employee.online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-700">{employee.email}</div>
                      <div className="text-xs font-medium text-slate-400 mt-0.5">{employee.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-600">{employee.designation || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black tracking-wide ${viewMode === 'trash' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'}`}>
                        {employee.employeeId || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-black">
                      {formatCurrency(employee.monthlySalary)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {viewMode === 'active' ? (
                        <div className="flex justify-end gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-4 py-1.5 rounded-lg transition-colors border border-blue-100"
                            onClick={() => handleOpenEditModal(employee)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-4 py-1.5 rounded-lg transition-colors border border-rose-100"
                            onClick={() => initiateMoveToTrash(employee)}
                            title="Deactivate and Archive"
                          >
                            Deactivate
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-lg transition-colors border border-emerald-100 shadow-sm shadow-emerald-500/10"
                            onClick={() => handleRestore(employee.id)}
                          >
                            Restore to Active
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveEmployee}
        employeeToEdit={editingEmployee}
      />

      {/* Move to Trash Confirmation Modal */}
      <Modal
        isOpen={trashConfirmation.isOpen}
        onClose={() => setTrashConfirmation({ ...trashConfirmation, isOpen: false })}
        title="Deactivate Employee"
        footer={
          <>
            <Button variant="danger" onClick={handleConfirmTrash}>
              Yes, Deactivate
            </Button>
            <Button variant="secondary" onClick={() => setTrashConfirmation({ ...trashConfirmation, isOpen: false })}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="p-2">
          <p className="text-gray-700 mb-4">
            Are you sure you want to deactivate <strong>{trashConfirmation.name}</strong>?
          </p>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This employee will be moved to the archive. They will not be able to log in, but their data will remain in the database. You can restore them later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

    </Layout>
  );
};
