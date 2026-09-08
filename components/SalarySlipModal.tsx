import React, { useRef, useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { User } from '../types';

interface SalarySlipData {
  month: string;
  year: string;
  payPeriod: string;
  totalDays: number;
  attendedDays: number;
  leaves: number;
  workingHours: number; // formatted string or number
  minWorkingHours: number;
  basicSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  lateDays?: number; 
  hourlyRate?: number; // Added
  perDaySalary?: number; // Added
}

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: User | null;
  data: SalarySlipData | null;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ isOpen, onClose, employee, data }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [bonusInput, setBonusInput] = useState<number>(0);

  // Sync state when data changes/opens
  useEffect(() => {
    if (data) {
      setBonusInput(data.bonus || 0);
    }
  }, [data, isOpen]);

  if (!isOpen || !employee || !data) return null;

  // Deduction Logic:
  // If lateDays > 6, deduct half day salary
  const lateCount = data.lateDays || 0;
  let latePenalty = 0;
  if (lateCount > 6 && data.perDaySalary) {
    latePenalty = data.perDaySalary * 0.5; // Half day salary cut off
  } else if (lateCount > 6 && !data.perDaySalary) {
    // ✅ SAFETY: Check basicSalary exists and is non-zero before division
    if (data.basicSalary && data.basicSalary > 0) {
      const perDay = data.basicSalary / 26;
      latePenalty = perDay * 0.5;
    }
  }

  const totalDeductions = data.deductions + latePenalty;
  
  // NOTE: data.netSalary already contains (HourlyRate * HoursWorked). 
  // We just add bonus and subtract deductions from that base earned value.
  const currentNetSalary = data.netSalary + bonusInput - totalDeductions;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
      const win = window.open('', '', 'height=800,width=1000');
      if (win) {
        win.document.write('<html><head><title>Salary Slip - ' + employee.name + '</title>');
        win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        win.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } }</style>'); 
        win.document.write('</head><body class="p-8 bg-white">');
        win.document.write(printContent.outerHTML);
        win.document.write('</body></html>');
        win.document.close();
        // Wait for Tailwind to load
        setTimeout(() => {
           win.print();
        }, 1000);
      }
    }
  };

  const handleDownloadCSV = () => {
    if (!employee || !data) return;

    // Define CSV Headers
    const headers = [
      "Employee Name",
      "Employee ID",
      "Designation",
      "Department",
      "Pay Period",
      "Total Working Days",
      "Days Attended",
      "Leaves Taken",
      "Late Days",
      "Working Hours",
      "Hourly Rate",
      "Basic Monthly Salary",
      "Earned Salary",
      "Bonus",
      "Deductions",
      "Net Payable",
      "Bank Account",
      "Bank Name",
      "IFSC Code",
      "PAN Card"
    ];

    // Define Row Values
    const values = [
      employee.name,
      employee.employeeId,
      employee.designation,
      employee.department || 'N/A',
      data.payPeriod,
      data.totalDays,
      data.attendedDays,
      data.leaves,
      lateCount,
      typeof data.workingHours === 'number' ? data.workingHours.toFixed(2) : data.workingHours,
      data.hourlyRate ? data.hourlyRate.toFixed(2) : '0',
      data.basicSalary,
      data.netSalary,
      bonusInput,
      totalDeductions,
      currentNetSalary,
      employee.bankAccountNumber || 'N/A',
      employee.bankName || 'N/A',
      employee.bankIfscCode || 'N/A',
      employee.panCardNumber || 'N/A'
    ];

    // Construct CSV String
    const csvContent = [
      headers.join(","),
      values.map(v => `"${v}"`).join(",") // Wrap values in quotes to handle commas safely
    ].join("\n");

    // Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Salary_Slip_${employee.employeeId}_${data.month}_${data.year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to format currency
  const fmt = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Salary Slip Preview" 
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDownloadCSV}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </Button>
          <Button onClick={handlePrint}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </Button>
        </div>
      }
    >
       <div className="flex flex-col gap-6">
         
         {/* Control Panel (Not Printed) */}
         <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-end gap-4">
            <div className="flex-1">
              <Input 
                label="Performance Bonus (₹)"
                type="number"
                min="0"
                value={bonusInput}
                onChange={(e) => setBonusInput(parseFloat(e.target.value) || 0)}
                placeholder="Enter bonus amount"
              />
            </div>
            <div className="pb-2 text-sm text-blue-800">
               <span className="font-bold">Net Payable:</span> {fmt(currentNetSalary)}
            </div>
         </div>

         {/* Printable Area */}
         <div className="overflow-x-auto border border-gray-200 shadow-sm">
           <div ref={printRef} className="font-sans text-xs text-black min-w-[700px] p-2 bg-white">
             
             <div className="border-2 border-black">
                {/* Header */}
                <div className="bg-[#ea9999] text-center py-2 border-b border-black">
                   <h1 className="font-bold text-lg uppercase">Samta Research Alliance Pvt. Ltd.</h1>
                </div>
                <div className="bg-[#ea9999] text-center py-1 border-b border-black text-[10px] italic">
                   <p>Jai shree complex, 1st floor, 105, Chandralok Colony, Krishna Nagar, Mathura 281004</p>
                </div>

                {/* Title Row */}
                <div className="flex border-b border-black bg-gray-100">
                  <div className="w-2/3 border-r border-black px-2 py-1 font-bold">Pay Salary Slip</div>
                  <div className="w-1/6 border-r border-black px-2 py-1 font-bold">Month</div>
                  <div className="w-1/6 px-2 py-1">{data.month}-{data.year.slice(-2)}</div>
                </div>

                {/* Employee Details Grid */}
                <div className="grid grid-cols-2 border-b border-black">
                  {/* Left Column */}
                  <div className="border-r border-black">
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Employee Name</div>
                       <div className="w-1/2 px-2 py-1">{employee.name}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Employee ID</div>
                       <div className="w-1/2 px-2 py-1">{employee.employeeId}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Department</div>
                       <div className="w-1/2 px-2 py-1">{employee.department || 'N/A'}</div> 
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Designation</div>
                       <div className="w-1/2 px-2 py-1">{employee.designation}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">PAN</div>
                       <div className="w-1/2 px-2 py-1">{employee.panCardNumber || 'N/A'}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Bank Account Number</div>
                       <div className="w-1/2 px-2 py-1">{employee.bankAccountNumber || 'N/A'}</div>
                     </div>
                     <div className="flex">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Bank Name</div>
                       <div className="w-1/2 px-2 py-1">{employee.bankName || 'N/A'}</div>
                     </div>
                  </div>

                  {/* Right Column */}
                  <div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Working Days (No Sun)</div>
                       <div className="w-1/2 px-2 py-1">{data.totalDays}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Hourly Rate</div>
                       <div className="w-1/2 px-2 py-1">{data.hourlyRate ? fmt(data.hourlyRate) : '-'}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Hours Worked</div>
                       <div className="w-1/2 px-2 py-1 font-bold text-green-700">{typeof data.workingHours === 'number' ? data.workingHours.toFixed(2) : data.workingHours}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Days Attended</div>
                       <div className="w-1/2 px-2 py-1">{data.attendedDays}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Leaves Taken</div>
                       <div className="w-1/2 px-2 py-1">{data.leaves}</div>
                     </div>
                     <div className="flex border-b border-black">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Standard Salary</div>
                       <div className="w-1/2 px-2 py-1">{fmt(data.basicSalary)}</div>
                     </div>
                     <div className="flex">
                       <div className="w-1/2 px-2 py-1 font-bold border-r border-black">Pay Period</div>
                       <div className="w-1/2 px-2 py-1">{data.payPeriod}</div>
                     </div>
                  </div>
                </div>

                {/* Financials Header */}
                <div className="grid grid-cols-2 bg-[#ea9999] border-b border-black font-bold">
                   <div className="border-r border-black px-2 py-1">Income</div>
                   <div className="px-2 py-1">Deductions</div>
                </div>

                {/* Financials Content */}
                <div className="grid grid-cols-2 border-b border-black">
                   {/* Income Table */}
                   <div className="border-r border-black">
                      <div className="flex border-b border-black font-bold bg-gray-50">
                         <div className="w-2/3 px-2 py-1 border-r border-black">Particulars</div>
                         <div className="w-1/3 px-2 py-1">Amount</div>
                      </div>
                      <div className="flex border-b border-black">
                         <div className="w-2/3 px-2 py-1 border-r border-black">Earned Salary (Hours)</div>
                         <div className="w-1/3 px-2 py-1 font-bold">{fmt(data.netSalary)}</div>
                      </div>
                      <div className="flex border-b border-black">
                         <div className="w-2/3 px-2 py-1 border-r border-black">Bonus</div>
                         <div className="w-1/3 px-2 py-1">{fmt(bonusInput)}</div>
                      </div>
                      <div className="flex">
                         <div className="w-2/3 px-2 py-1 border-r border-black font-bold">Total Gross</div>
                         <div className="w-1/3 px-2 py-1 font-bold">{fmt(data.netSalary + bonusInput)}</div>
                      </div>
                   </div>

                   {/* Deductions Table */}
                   <div>
                      <div className="flex border-b border-black font-bold bg-gray-50">
                         <div className="w-2/3 px-2 py-1 border-r border-black">Particulars</div>
                         <div className="w-1/3 px-2 py-1">Amount</div>
                      </div>
                      <div className="flex border-b border-black">
                         <div className="w-2/3 px-2 py-1 border-r border-black">PF</div>
                         <div className="w-1/3 px-2 py-1">N/A</div>
                      </div>
                      <div className="flex border-b border-black">
                         <div className="w-2/3 px-2 py-1 border-r border-black">Late Penalty</div>
                         <div className="w-1/3 px-2 py-1">
                           {fmt(latePenalty)}
                           {lateCount > 6 && <span className="block text-[8px] text-red-600 leading-tight">({lateCount} Lates &gt; 6 Limit)</span>}
                         </div>
                      </div>
                       <div className="flex">
                         <div className="w-2/3 px-2 py-1 border-r border-black font-bold">Total</div>
                         <div className="w-1/3 px-2 py-1 font-bold">{fmt(totalDeductions)}</div>
                      </div>
                   </div>
                </div>

                {/* Net Salary */}
                <div className="flex bg-[#d9ead3] font-bold">
                   <div className="w-1/2 px-2 py-2 border-r border-black">Net Salary</div>
                   <div className="w-1/2 px-2 py-2">{fmt(currentNetSalary)}</div>
                </div>

             </div>
           </div>
         </div>
       </div>
    </Modal>
  );
}
