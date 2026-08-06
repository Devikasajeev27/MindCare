import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React from 'react';

interface TimeRangeSelectProps {
  active: boolean;
  start: string;
  end: string;
  onChange: (newStart: string, newEnd: string) => void;
}

// Professional time range selector used on therapist availability page.
export const TimeRangeSelect: React.FC<TimeRangeSelectProps> = ({ active, start, end, onChange }) => {
  const timeOptions = [
    '07:00 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM',
    '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM',
  ];

  const handleStartChange = (newStart: string) => {
    onChange(newStart, end);
  };

  const handleEndChange = (newEnd: string) => {
    onChange(start, newEnd);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Start Time */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400">From:</span>
        <Select disabled={!active} value={start} onValueChange={handleStartChange}>
          <SelectTrigger className="h-10 w-32 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
            <SelectValue placeholder="Start Time" />
          </SelectTrigger>
          <SelectContent className="max-h-56 overflow-y-auto">
            {timeOptions.map((t) => (
              <SelectItem key={t} value={t} className="text-xs font-semibold">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* End Time */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400">To:</span>
        <Select disabled={!active} value={end} onValueChange={handleEndChange}>
          <SelectTrigger className="h-10 w-32 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
            <SelectValue placeholder="End Time" />
          </SelectTrigger>
          <SelectContent className="max-h-56 overflow-y-auto">
            {timeOptions.map((t) => (
              <SelectItem key={t} value={t} className="text-xs font-semibold">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
