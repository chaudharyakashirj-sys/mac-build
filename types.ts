
export enum SalaryType {
  MONTHLY = 'Monthly Salary',
}

export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  USER = 'user',
  EMPLOYEE = 'employee',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department?: string;
  employeeId: string;
  role: UserRole;
  loginTime?: string;
  logoutTime?: string;
  isDeleted?: boolean;
  // Presence
  online?: boolean;
  // Admin-only fields (Banking/PII) - Returned only for Admins
  salaryType?: string;
  monthlySalary?: string;
  salaryCurrency?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfscCode?: string;
  panCardNumber?: string;
}

export interface TimeSession {
  id: string;
  userId: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  activeSeconds: number;
  idleSeconds: number;
  meetingSeconds?: number;
  meetingCount?: number;
}

export interface DailyWorkRecord {
  userId: string;
  date: string; // YYYY-MM-DD
  activeSeconds: number;
  idleSeconds: number;
  meetingSeconds: number;
  meetingCount: number;
  totalHours?: number;
  isApproved: boolean;
  adminNote?: string;
}

export interface EmployeeFormData extends Omit<User, 'id' | 'role'> {
  password?: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  note?: string;
}

// --- Leave Management Types ---

export enum LeaveType {
  PERSONAL = 'Personal Leave',
  HALF_DAY = 'Half Day',
  EMERGENCY = 'Emergency Leave'
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled'
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string; // Denormalized for easier display
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  appliedOn: string; // ISO String
}
// --- Payroll & Salary Types ---

export enum PayrollStatus {
  PENDING = 'Pending',
  PROCESSED = 'Processed',
  PAID = 'Paid'
}

export enum SalaryComponentType {
  EARNING = 'earning',
  DEDUCTION = 'deduction'
}

export interface SalaryComponent {
  id?: string;
  payrollId: string;
  type: SalaryComponentType | string;
  name: string;
  amount: number;
}

export interface Payroll {
  id?: string;
  userId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  grossPay: number;
  netPay: number;
  currency: string; // Default: 'USD'
  status: PayrollStatus | string;
  generatedOn?: string;
  processedBy?: string;
  processedOn?: string;
  components?: SalaryComponent[];
}