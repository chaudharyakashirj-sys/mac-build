import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import {
  EmployeeFormData,
  ValidationErrors,
  User
} from '../types';
import { addEmployee, updateEmployee } from '../api/http';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: EmployeeFormData) => Promise<void>; // ✅ BUG FIX #1: was missing — parent's reload never fired
  employeeToEdit?: User | null;
}

const INITIAL_STATE: EmployeeFormData = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  employeeId: '',
  password: '',
  loginTime: '',
  logoutTime: '',
  salaryType: 'Monthly Salary', // Changed from SalaryType.MONTHLY
  monthlySalary: '',
  // Banking / PAN fields
  bankName: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  panCardNumber: ''
};

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employeeToEdit
}) => {
  const [formData, setFormData] = useState<EmployeeFormData>(INITIAL_STATE);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* =====================
     INIT
  ===================== */
  useEffect(() => {
    if (!isOpen) return;

    if (employeeToEdit) {
      setFormData({
        name: employeeToEdit.name || '',
        email: employeeToEdit.email || '',
        phone: employeeToEdit.phone || '',
        designation: employeeToEdit.designation || '',
        department: employeeToEdit.department || '',
        employeeId: employeeToEdit.employeeId || '',
        password: '',
        loginTime: employeeToEdit.loginTime || '',
        logoutTime: employeeToEdit.logoutTime || '',
        salaryType: employeeToEdit.salaryType || 'Monthly Salary',
        monthlySalary: employeeToEdit.monthlySalary || '',
        bankName: employeeToEdit.bankName || '',
        bankAccountNumber: employeeToEdit.bankAccountNumber || '',
        bankIfscCode: employeeToEdit.bankIfscCode || '',
        panCardNumber: employeeToEdit.panCardNumber || ''
      });
    } else {
      setFormData(INITIAL_STATE);
    }

    setErrors({});
    setIsSubmitting(false);
  }, [isOpen, employeeToEdit]);

  /* =====================
     CHANGE
  ===================== */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  /* =====================
     VALIDATION
  ===================== */
  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name || !formData.name.trim()) newErrors.name = 'Name is required';

    if (!formData.email || !formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.employeeId || !formData.employeeId.trim()) {
      newErrors.employeeId = 'Employee ID is required';
    }

    // Password required only for new employees
    if (!employeeToEdit) {
      if (!formData.password || !formData.password.trim()) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }

    if (!formData.monthlySalary || Number(formData.monthlySalary) <= 0) {
      newErrors.monthlySalary = 'Monthly salary must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* =====================
     SUBMIT
  ===================== */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);

    try {
      const basePayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        designation: formData.designation.trim(),
        department: formData.department.trim(),
        employeeId: formData.employeeId.trim(),
        salaryType: formData.salaryType,
        salary_type: formData.salaryType,
        // Keep both formats for compatibility with server fields
        monthlySalary: String(Number(formData.monthlySalary)),
        monthly_salary: String(Number(formData.monthlySalary)),
        loginTime: formData.loginTime || '',
        logoutTime: formData.logoutTime || '',
        login_time: formData.loginTime || '',
        logout_time: formData.logoutTime || '',
        // Banking / PAN
        bankName: formData.bankName?.trim() || '',
        bank_account_number: formData.bankAccountNumber?.trim() || '',
        bankAccountNumber: formData.bankAccountNumber?.trim() || '',
        bank_name: formData.bankName?.trim() || '',
        bank_ifsc_code: formData.bankIfscCode?.trim() || '',
        bankIfscCode: formData.bankIfscCode?.trim() || '',
        pan_card_number: formData.panCardNumber?.trim() || '',
        panCardNumber: formData.panCardNumber?.trim() || ''
      };

      if (employeeToEdit && employeeToEdit.id) {
        // ✅ UPDATE → PUT /api/employees/:id
        await updateEmployee(employeeToEdit.id, {
          ...basePayload,
          monthly_salary: basePayload.monthlySalary,
          employee_id: basePayload.employeeId,
          bank_name: basePayload.bank_name,
          bank_account_number: basePayload.bank_account_number,
          bank_ifsc_code: basePayload.bank_ifsc_code,
          pan_card_number: basePayload.pan_card_number
        });
      } else {
        // ✅ CREATE → POST /api/employees
        await addEmployee({
          ...basePayload,
          monthly_salary: basePayload.monthlySalary,
          employee_id: basePayload.employeeId,
          bank_name: basePayload.bank_name,
          bank_account_number: basePayload.bank_account_number,
          bank_ifsc_code: basePayload.bank_ifsc_code,
          pan_card_number: basePayload.pan_card_number,
          password: formData.password.trim()
        });
      }

      // ✅ BUG FIX #1: Call onSave so parent can reload the employee list
      if (onSave && typeof onSave === 'function') {
        try {
          await onSave(formData);
        } catch (saveErr) {
          console.error('Error in onSave callback:', saveErr);
        }
      }

      // Close the modal
      try {
        if (onClose && typeof onClose === 'function') {
          onClose();
        }
      } catch (closeErr) {
        console.error('Error in onClose callback:', closeErr);
      }
    } catch (err: any) {
      console.error('Save employee failed:', err);
      alert(err?.message || 'Failed to save employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =====================
     UI
  ===================== */
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employeeToEdit ? 'Edit Employee' : 'Add Employee'}
      footer={
        <>
          <Button type="submit" form="employee-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
        </>
      }
    >
      <form
        id="employee-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
      >
        <Input label="Name" name="name" value={formData.name} onChange={handleChange} error={errors.name} />
        <Input label="Email" name="email" value={formData.email} onChange={handleChange} error={errors.email} />
        <Input label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
        <Input label="Department" name="department" value={formData.department} onChange={handleChange} />
        <Input label="Designation" name="designation" value={formData.designation} onChange={handleChange} />
        <Input label="Employee ID" name="employeeId" value={formData.employeeId} onChange={handleChange} error={errors.employeeId} />

        {!employeeToEdit && (
          <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} error={errors.password} />
        )}

        <Input label="Login Time" name="loginTime" type="time" value={formData.loginTime} onChange={handleChange} />
        <Input label="Logout Time" name="logoutTime" type="time" value={formData.logoutTime} onChange={handleChange} />
        <Input label="Monthly Salary" name="monthlySalary" type="number" value={formData.monthlySalary} onChange={handleChange} error={errors.monthlySalary} />

        {/* Banking & PAN */}
        <Input label="Bank Name" name="bankName" value={formData.bankName} onChange={handleChange} />
        <Input label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} />
        <Input label="Bank IFSC Code" name="bankIfscCode" value={formData.bankIfscCode} onChange={handleChange} />
        <Input label="PAN Card Number" name="panCardNumber" value={formData.panCardNumber} onChange={handleChange} />
      </form>
    </Modal>
  );
};
