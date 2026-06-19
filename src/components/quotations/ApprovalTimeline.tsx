import type { QuotationStatus } from '../../types';
import { Check, Clock, X } from 'lucide-react';

interface TimelineStep {
  status: QuotationStatus;
  date: string;
  user: string;
  remarks?: string;
}

interface ApprovalTimelineProps {
  steps: TimelineStep[];
  currentStatus: QuotationStatus;
}

export function ApprovalTimeline({ steps }: ApprovalTimelineProps) {
  const getIcon = (status: QuotationStatus) => {
    switch(status) {
      case 'Approved': return <Check className="w-4 h-4 text-white" />;
      case 'Rejected': return <X className="w-4 h-4 text-white" />;
      case 'Pending Approval': return <Clock className="w-4 h-4 text-white" />;
      default: return <div className="w-2 h-2 rounded-full bg-white" />;
    }
  };

  const getBgColor = (status: QuotationStatus) => {
    switch(status) {
      case 'Approved': return 'bg-green-500';
      case 'Rejected': return 'bg-red-500';
      case 'Pending Approval': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col space-y-4 py-4">
      <h3 className="text-sm font-semibold text-corp-text uppercase tracking-wider mb-2">Approval History</h3>
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-4 relative">
          {/* Timeline Line */}
          {idx !== steps.length - 1 && (
            <div className="absolute left-3 top-8 bottom-[-16px] w-0.5 bg-gray-200"></div>
          )}
          
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${getBgColor(step.status)}`}>
            {getIcon(step.status)}
          </div>
          
          <div className="flex-1 pb-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-corp-text">{step.status}</p>
              <span className="text-xs text-gray-500">{new Date(step.date).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">by {step.user}</p>
            {step.remarks && (
              <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 border border-gray-100 rounded">
                "{step.remarks}"
              </div>
            )}
          </div>
        </div>
      ))}
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 italic">No approval history available.</p>
      )}
    </div>
  );
}
