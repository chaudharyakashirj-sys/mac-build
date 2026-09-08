import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { LeaveType, LeaveRequest } from '../types';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: Pick<LeaveRequest, 'fromDate' | 'toDate' | 'type' | 'reason'>
  ) => Promise<void>; // 🔥 MUST be async
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [type, setType] = useState<LeaveType>(LeaveType.PERSONAL);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFromDate('');
    setToDate('');
    setType(LeaveType.PERSONAL);
    setReason('');
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    if (!fromDate || !toDate) {
      setError('Please select both From and To dates.');
      return;
    }

    if (new Date(toDate) < new Date(fromDate)) {
      setError('To Date cannot be before From Date.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the leave.');
      return;
    }

    try {
      setSubmitting(true);

      await onSubmit({
        fromDate,
        toDate,
        type,
        reason: reason.trim()
      });

      // ✅ Only close on SUCCESS
      resetForm();
      onClose();
    } catch (err: any) {
      // ✅ Show backend error
      setError(err?.message || 'Failed to apply for leave. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const leaveOptions = [
    { value: LeaveType.PERSONAL, label: 'Personal Leave' },
    { value: LeaveType.HALF_DAY, label: 'Half Day' },
    { value: LeaveType.EMERGENCY, label: 'Emergency Leave' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!submitting) {
          resetForm();
          onClose();
        }
      }}
      title="Apply for Leave"
      footer={
        <>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </Button>

          <Button
            variant="secondary"
            // ✅ BUG FIX #15: reset form before closing so stale values don't persist on reopen
            onClick={() => {
              if (!submitting) {
                resetForm();
                onClose();
              }
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
          />

          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
          />
        </div>

        <Select
          label="Leave Type"
          options={leaveOptions}
          value={type}
          onChange={(e) => setType(e.target.value as LeaveType)}
          required
        />

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>

          <textarea
            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
            rows={4}
            placeholder="Please explain why you need leave..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};
