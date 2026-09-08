import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../api/http';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

// ✅ BUG FIX #15: This local type uses lowercase values ('pending'|'approved'|'rejected')
// because the API response is normalized with .toLowerCase() in loadRequests().
// This is intentionally different from the global LeaveStatus enum in types.ts
// which uses title-case values ('Pending'|'Approved'|etc.) matching the DB storage.
// Do NOT mix the two — this file only uses the local normalized type.
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface LeaveRequest {
  id: string;              // Fixed: API returns string IDs (was: number)
  employee: string;        // ✅ backend field
  leaveType: string;       // ✅ backend field
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

export const AdminLeaveRequests: React.FC<{ onLeaveStatusChanged?: () => void }> = ({ onLeaveStatusChanged }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [viewRequest, setViewRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(false);

  // \u2705 BUG FIX #5: Single load function with isMounted guard — no more duplicate API calls
  // Previously there were two copies of the same logic; the one called by handleStatusChange
  // lacked the isMounted guard, risking state updates on unmounted components.
  const isMountedRef = React.useRef(true);

  const loadRequests = async () => {
    if (!isMountedRef.current) return;
    try {
      setLoading(true);
      const data = await api.getAllLeaves();

      if (!isMountedRef.current) return;

      const mapped = Array.isArray(data)
        ? data.map((r: any) => ({
            id: r.id,
            employee: r.name || r.userName || r.employee || `${r.name || r.email || 'Unknown'}`,
            leaveType: r.type || r.leaveType || 'Unknown',
            fromDate: r.from_date || r.fromDate || '',
            toDate: r.to_date || r.toDate || '',
            reason: r.reason || r.notes || '',
            status: String(r.status || '').toLowerCase(),
            appliedOn: r.applied_on || r.appliedOn || ''
          }))
        : [];

      if (isMountedRef.current) {
        setRequests(mapped);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to load leave requests', err);
        setRequests([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadRequests();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* =========================
     APPROVE / REJECT
  ========================= */
  const handleStatusChange = async (
    id: string,            // Fixed: Changed from number to string
    status: 'approved' | 'rejected'
  ) => {
    try {
      await api.updateLeaveStatus(id, status);
      setViewRequest(null);
      await loadRequests(); // \u2705 now uses the single isMounted-safe function
      if (onLeaveStatusChanged) {
        onLeaveStatusChanged();
      }
    } catch (err) {
      console.error('Failed to update leave status', err);
    }
  };

  /* =========================
     FILTER
  ========================= */
  const filteredRequests =
    filter === 'all'
      ? requests
      : requests.filter(r => r.status === 'pending');

  return (
    <Layout title="Leave Requests">
      {/* FILTER BUTTONS */}
      <div className="mb-6 flex gap-2">
        <div className="glass-panel p-1.5 rounded-xl shadow-sm flex items-center">
          <button
            onClick={() => setFilter('pending')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${
              filter === 'pending'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            Pending Requests
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${
              filter === 'all'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50/50 border-b border-slate-200/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                Leave Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                Applied On
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex justify-center items-center gap-3 text-slate-400 font-bold">
                    <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <p className="text-sm font-bold text-slate-400">
                      No requests found.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequests.map(req => (
                <tr key={req.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shadow-sm">
                        {req.employee.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-800">{req.employee}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-600">
                      {req.leaveType}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-50 text-slate-700 font-bold text-xs border border-slate-100">
                      {req.fromDate === req.toDate
                        ? req.fromDate
                        : `${req.fromDate} → ${req.toDate}`}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm font-bold text-slate-400">
                    {req.appliedOn ? new Date(req.appliedOn).toLocaleDateString() : '—'}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-[10px] uppercase tracking-wider font-black rounded-full shadow-sm ${
                        req.status === 'approved'
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white'
                          : req.status === 'rejected'
                          ? 'bg-gradient-to-r from-rose-400 to-rose-500 text-white'
                          : 'bg-gradient-to-r from-amber-400 to-amber-500 text-white'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setViewRequest(req)}
                        className="text-[11px] px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border border-slate-200"
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Modal
        isOpen={!!viewRequest}
        onClose={() => setViewRequest(null)}
        title="Leave Request Details"
        footer={
          viewRequest && viewRequest.status === 'pending' ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() =>
                  handleStatusChange(viewRequest.id, 'rejected')
                }
              >
                Reject
              </Button>
              <Button
                onClick={() =>
                  handleStatusChange(viewRequest.id, 'approved')
                }
              >
                Approve
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setViewRequest(null)}>
              Close
            </Button>
          )
        }
      >
        {viewRequest && (
          <div className="space-y-3">
            <p><strong>Employee:</strong> {viewRequest.employee}</p>
            <p><strong>Leave Type:</strong> {viewRequest.leaveType}</p>
            <p><strong>Dates:</strong> {viewRequest.fromDate} → {viewRequest.toDate}</p>
            <p><strong>Status:</strong> {viewRequest.status.charAt(0).toUpperCase() + viewRequest.status.slice(1)}</p>
            <p className="text-sm text-gray-700">{viewRequest.reason}</p>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
/* =========================
   EMPLOYEES
========================= */