/* =====================================================
   HTTP API CLIENT
===================================================== */

/* =========================
   BASE URL
========================= */

// ✅ Reads from VITE_API_URL env variable (set in .env or .env.production)
// Falls back to localStorage override for user-configured server address
const ENV_API_URL = (import.meta.env.VITE_API_URL as string || 'http://localhost:3001').replace(/\/+$/, '');

function getBaseUrl(): string {
  return ENV_API_URL;
}


/* =========================
   HEADERS
========================= */
function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token && String(token || '').trim()) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { ...headers, ...(extra || {}) };
}

/* =========================
   RESPONSE SANITIZER - Convert all numeric IDs to strings
========================= */
function sanitizeResponse(data: any): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      const value = data[key];
      // Convert any ID field to string
      if ((key === 'id' || key.endsWith('_id') || key.endsWith('Id')) && typeof value === 'number') {
        // ✅ BUG FIX #12: removed console.log — was spamming console on every API response
        sanitized[key] = String(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeResponse(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/* =========================
   CORE REQUEST
========================= */
async function httpRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getBaseUrl(); // Get fresh base URL on each request
  const url = `${baseUrl}${safePath}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers),
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      // Handle unauthorized centrally: clear token and redirect to login for a clean UX
      if (res.status === 401) {
        // Remove stored credentials
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // ✅ Dispatch a custom event — safe for both Electron (file://) and browser
        // AuthContext listens for this to clear user state without any URL navigation
        try { window.dispatchEvent(new CustomEvent('auth:unauthorized')); } catch (_) { }
        const errJson = contentType.includes('application/json')
          ? await res.json().catch(() => ({}))
          : { message: 'Session expired. Please log in again.' };
        const e: any = new Error(errJson?.message || errJson?.error || 'Session expired. Please log in again.');
        e.body = errJson;
        e.status = 401;
        throw e;
      }

      if (contentType.includes('application/json')) {
        const err = await res.json();
        // ✅ Sanitize error response body too
        const sanitizedErr = sanitizeResponse(err);
        const message = sanitizedErr?.message || sanitizedErr?.error || JSON.stringify(sanitizedErr);
        const e: any = new Error(message);
        e.body = sanitizedErr;  // Use sanitized version
        e.status = res.status;
        throw e;
      }
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }

    // ✅ BUG FIX #6: Handle non-JSON success responses gracefully (e.g. plain text "OK", "Session stopped")
    // Previously this threw "Invalid JSON response" even when the request succeeded
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return (text || true) as unknown as T;
    }

    // Parse and sanitize response to ensure all IDs are strings
    const jsonData = await res.json();
    const sanitized = sanitizeResponse(jsonData);
    return sanitized;
  } catch (err) {
    // Handle network/connection errors
    if (err instanceof TypeError) {
      const errorMsg = err.message.toLowerCase();
      if (errorMsg.includes('failed to fetch') || errorMsg.includes('network request failed')) {
        const e: any = new Error(`Failed to fetch - Server not reachable at ${baseUrl}`);
        throw e;
      }
    }
    // Re-throw any other errors with proper error handling
    if (err instanceof Error) {
      throw err;
    }
    // If error is not an Error object, convert it to one
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
  }
}

/* =========================
   AUTH
========================= */
export const login = (email: string, password: string) =>
  httpRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

// ✅ Token refresh endpoint - gets new token without re-authenticating
export const refreshToken = () =>
  httpRequest('/auth/refresh', {
    method: 'POST',
  });

// ✅ Logout endpoint - revokes the current Sanctum token on the backend
export const logout = async () => {
  try {
    await httpRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Silently ignore logout errors (token may already be expired/invalid)
    console.warn('Logout API call failed (token may already be invalid):', err);
  }
};

/* =========================
   EMPLOYEES
========================= */
export const getEmployees = () => httpRequest('/employees');
export const getTrashedEmployees = () => httpRequest('/employees/trash');

export const addEmployee = (data: any) =>
  httpRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEmployee = (id: string, data: any) =>
  httpRequest(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const moveToTrash = (id: string) =>
  httpRequest(`/employees/trash/${id}`, { method: 'POST' });

export const restoreFromTrash = (id: string) =>
  httpRequest(`/employees/${id}/restore`, { method: 'POST' });

/* =========================
   HOLIDAYS
========================= */
export const getHolidays = (year: number, month: number) =>
  httpRequest(`/holidays?year=${year}&month=${month}`);

export const getAdminHolidays = (year: number, month: number) =>
  httpRequest(`/admin/holidays?year=${year}&month=${month}`);

export const saveAdminHoliday = (data: {
  date: string;
  name: string;
  note?: string;
}) =>
  httpRequest('/admin/holidays', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteAdminHoliday = (date: string) =>
  httpRequest(`/admin/holidays/${encodeURIComponent(date)}`, { method: 'DELETE' });


/* =========================
   LEAVES
========================= */
export const applyLeave = (data: {
  fromDate: string;
  toDate: string;
  type: string;
  reason?: string;
}) =>
  httpRequest('/leaves', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getMyLeaves = () => httpRequest('/leaves/my');
export const getAllLeaves = () => httpRequest('/admin/leaves');

export const updateLeaveStatus = (
  id: string,
  status: 'approved' | 'rejected'
) => {
  // Capitalize status for API (Approved/Rejected)
  const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
  return httpRequest(`/admin/leaves/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: capitalizedStatus }),
  });
};

/* =========================
   ANALYTICS
========================= */
export const getActiveEmployeesToday = async () => {
  const res = await httpRequest<{ count?: number }>(
    '/analytics/active-today'
  );
  return Number(res?.count) || 0;
};

/* =========================
   GET WRAPPER
========================= */
export const get = (path: string) => httpRequest(path);

/* =========================
   SESSIONS
========================= */
export const startSession = async (userId: string) => {
  // ✅ VALIDATION: userId is required
  const userIdStr = String(userId || '').trim();
  if (!userIdStr) {
    throw new Error('User ID is required to start a session');
  }

  try {
    const res = await httpRequest('/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ userId: userIdStr }),
    });

    // ✅ VALIDATION: Ensure response contains required fields
    if (!res || typeof res !== 'object') {
      throw new Error('Server returned invalid response format');
    }

    // ✅ EXTRA: Force convert ID fields in case sanitizer missed them
    if (res.id && typeof res.id === 'number') {
      console.warn('⚠️ [startSession] Response ID was numeric, converting:', res.id);
      res.id = String(res.id);
    }
    if (res.sessionId && typeof res.sessionId === 'number') {
      console.warn('⚠️ [startSession] Response sessionId was numeric, converting:', res.sessionId);
      res.sessionId = String(res.sessionId);
    }

    if (!res.id && !res.sessionId) {
      throw new Error('Server did not return a valid session ID');
    }

    return res;
  } catch (err: any) {
    console.error('❌ [startSession] Error:', err);
    throw err;
  }
};

export const getActiveSession = async () => {
  const res = await httpRequest('/sessions/active');
  // ✅ VALIDATION: Ensure response is valid session object or null
  if (res && typeof res !== 'object') {
    console.warn('Invalid active session response:', res);
    return null;
  }
  return res;
};

export const stopSession = async (
  sessionId: string,
  metrics?: Partial<{ activeSeconds: number; idleSeconds: number; meetingSeconds: number; meetingCount: number }>
) => {
  // ✅ VALIDATION: sessionId is required
  const sessionIdStr = String(sessionId || '').trim();
  if (!sessionIdStr) {
    throw new Error('Session ID is required to stop a session');
  }

  const res = await httpRequest(`/sessions/${sessionIdStr}/stop`, {
    method: 'POST',
    body: JSON.stringify({
      activeSeconds: metrics?.activeSeconds ?? 0,
      idleSeconds: metrics?.idleSeconds ?? 0,
      meetingSeconds: metrics?.meetingSeconds ?? 0,
      meetingCount: metrics?.meetingCount ?? 0,
    }),
  });

  // ✅ VALIDATION: Ensure response is valid
  if (!res || typeof res !== 'object') {
    throw new Error('Server returned invalid response when stopping session');
  }

  return res;
};

export const updateSession = async (
  sessionId: string,
  metrics: { activeSeconds: number; idleSeconds: number; meetingSeconds: number; meetingCount: number }
) => {
  const sessionIdStr = String(sessionId || '').trim();
  if (!sessionIdStr) {
    throw new Error('Session ID is required to update a session');
  }

  try {
    const res = await httpRequest('/sessions/update', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sessionIdStr, ...metrics }),
    });
    return res;
  } catch (err: any) {
    console.error(`❌ [updateSession] Error for ID ${sessionIdStr}:`, err);
    throw err;
  }
};

/* =========================
   ANALYTICS / ATTENDANCE
========================= */
export const getEmployeeStats = (userId: string) =>
  httpRequest(`/analytics/employee/${userId}/stats`);

export const getMonthlyAttendance = (userId: string, year: number, month: number) =>
  httpRequest(`/attendance/monthly?userId=${encodeURIComponent(userId)}&year=${year}&month=${month}`);

/* =========================
   ADMIN UTILITIES
========================= */
export const getPendingLeaveCount = async (): Promise<number> => {
  const res = await httpRequest<{ count: number }>('/admin/leaves/pending-count');
  return Number(res?.count) || 0;
};

export const getAdminSessions = () => httpRequest('/admin/sessions');

export const getAdminDailyRecords = (date?: string) =>
  httpRequest(`/admin/daily-records${date ? `?date=${encodeURIComponent(date)}` : ''}`);

export const aggregateDailyRecords = (date: string, userId?: string) =>
  httpRequest('/admin/aggregate-daily-records', {
    method: 'POST',
    body: JSON.stringify({ date, userId: userId || undefined }),
  });

export const approveDailyRecord = (userId: string, date: string, activeSeconds: number, idleSeconds?: number, meetingSeconds?: number, meetingCount?: number, adminNote?: string) =>
  httpRequest('/admin/daily-records/approve', {
    method: 'POST',
    body: JSON.stringify({ userId, date, activeSeconds, idleSeconds, meetingSeconds, meetingCount, adminNote }),
  });

export const getAdminWeeklyRecords = (year?: number, week?: number) => {
  let url = '/admin/weekly-records';
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  if (week) params.append('week', String(week));
  if (params.toString()) url += `?${params.toString()}`;
  return httpRequest(url);
};

export const approveWeeklyRecord = (userId: string, year: number, weekNumber: number, adminNote?: string) =>
  httpRequest('/admin/weekly-records/approve', {
    method: 'POST',
    body: JSON.stringify({ userId, year, weekNumber, adminNote }),
  });

export const getAdminMonthlyRecords = (year?: number, month?: number) => {
  let url = '/admin/monthly-records';
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  if (month) params.append('month', String(month));
  if (params.toString()) url += `?${params.toString()}`;
  return httpRequest(url);
};

export const approveMonthlyRecord = (userId: string, year: number, month: number, adminNote?: string) =>
  httpRequest('/admin/monthly-records/approve', {
    method: 'POST',
    body: JSON.stringify({ userId, year, month, adminNote }),
  });

// New aggregation endpoints
export const aggregateWeeklyRecords = (year?: number) =>
  httpRequest('/admin/aggregate-weekly', {
    method: 'POST',
    body: JSON.stringify({ year: year || new Date().getFullYear() }),
  });

export const aggregateMonthlyRecords = (year?: number) =>
  httpRequest('/admin/aggregate-monthly', {
    method: 'POST',
    body: JSON.stringify({ year: year || new Date().getFullYear() }),
  });

/* =========================
   PAYROLL ROUTES
========================= */
export const createPayroll = (userId: string, periodStart: string, periodEnd: string, grossPay: number, netPay?: number, currency?: string, salaryComponents?: any[]) =>
  httpRequest('/payroll', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      periodStart,
      periodEnd,
      grossPay,
      netPay,
      currency: currency || 'USD',
      salaryComponents
    }),
  });

export const getUserPayroll = (userId: string, year?: number, month?: number) => {
  let url = `/payroll/user/${encodeURIComponent(userId)}`;
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  if (month) params.append('month', String(month));
  if (params.toString()) url += `?${params.toString()}`;
  return httpRequest(url);
};

export const getPayrollDetails = (payrollId: string) =>
  httpRequest(`/payroll/${encodeURIComponent(payrollId)}`);

export const updatePayroll = (payrollId: string, grossPay?: number, netPay?: number, currency?: string, status?: string) =>
  httpRequest(`/payroll/${encodeURIComponent(payrollId)}`, {
    method: 'PUT',
    body: JSON.stringify({ grossPay, netPay, currency, status }),
  });

export const processPayroll = (payrollId: string) =>
  httpRequest(`/payroll/${encodeURIComponent(payrollId)}/process`, {
    method: 'POST',
  });

export const markPayrollAsPaid = (payrollId: string) =>
  httpRequest(`/payroll/${encodeURIComponent(payrollId)}/mark-paid`, {
    method: 'POST',
  });

/* =========================
   DEFAULT EXPORT
========================= */
export default {
  login,
  logout,
  refreshToken,

  getEmployees,
  getTrashedEmployees,
  addEmployee,
  updateEmployee,
  moveToTrash,
  restoreFromTrash,

  getHolidays,
  getAdminHolidays,
  saveAdminHoliday,
  deleteAdminHoliday,

  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,

  getActiveEmployeesToday,

  // Helpers / session
  get,
  startSession,
  stopSession,
  updateSession,
  getActiveSession,
  getEmployeeStats,
  getMonthlyAttendance,
  getPendingLeaveCount,
  getAdminSessions,
  getAdminDailyRecords,
  aggregateDailyRecords,
  approveDailyRecord,
  getAdminWeeklyRecords,
  approveWeeklyRecord,
  getAdminMonthlyRecords,
  approveMonthlyRecord,

  createPayroll,
  getUserPayroll,
  getPayrollDetails,
  updatePayroll,
  processPayroll,
  markPayrollAsPaid,

  // Aggregation
  aggregateWeeklyRecords,
  aggregateMonthlyRecords,
};
