import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface EditWorkHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hours: number, minutes: number, notes: string) => void;
  employeeName: string;
  currentHours: number;
  currentMinutes: number;
  date: string;
}

export const EditWorkHoursModal: React.FC<EditWorkHoursModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employeeName,
  currentHours,
  currentMinutes,
  date,
}) => {
  const [hours, setHours] = useState(currentHours);
  const [minutes, setMinutes] = useState(currentMinutes);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Update state when props change (when modal opens with new data)
  useEffect(() => {
    if (isOpen) {
      setHours(currentHours);
      setMinutes(currentMinutes);
      setNotes('');
    }
  }, [isOpen, currentHours, currentMinutes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(hours, minutes, notes);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setHours(currentHours);
    setMinutes(currentMinutes);
    setNotes('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Work Hours">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            Employee: <span className="font-semibold">{employeeName}</span>
          </p>
          <p className="text-sm text-gray-600">
            Date: <span className="font-semibold">{date}</span>
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Manually adjust the active working hours for {date}. This will override the tracked system time and mark the day as Approved.</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hours
              </label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minutes
              </label>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                min="0"
                max="59"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this adjustment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Note:</span> Approving will lock this value for the daily report and add it to the monthly active hours count.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save & Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
