import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Expand, Calendar, Clock } from "lucide-react";
import html2canvas from 'html2canvas';

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  teacherId: string;
  subjectId: string;
  teacherName?: string;
  subjectName?: string;
  room?: string;
}

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

interface CompactTimetableGridProps {
  className: string;
  timetableEntries: TimetableEntry[];
  workingDays: string[];
  timeSlots: TimeSlot[];
  userRole: string;
  onClose?: () => void;
}

export function CompactTimetableGrid({ 
  className, 
  timetableEntries, 
  workingDays, 
  timeSlots, 
  userRole,
  onClose 
}: CompactTimetableGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Create a map for quick lookup of timetable entries
  const timetableMap = new Map<string, TimetableEntry>();
  timetableEntries.forEach(entry => {
    const key = `${entry.day}-${entry.period}`;
    timetableMap.set(key, entry);
  });

  // Filter out break periods for the display
  const nonBreakTimeSlots = timeSlots.filter(slot => !slot.isBreak);

  // Format day names for display
  const formatDayName = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1, 3);
  };

  // Format time range
  const formatTimeRange = (slot: TimeSlot) => {
    return `${slot.startTime} - ${slot.endTime}`;
  };

  // Get entry for a specific day and period
  const getEntryForSlot = (day: string, period: number): TimetableEntry | null => {
    const key = `${day}-${period}`;
    return timetableMap.get(key) || null;
  };

  // Download timetable as PNG
  const downloadAsPNG = async () => {
    // Always target the expanded grid for PNG export
    const element = document.getElementById('timetable-grid-expanded');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `${className}-timetable.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download timetable:', error);
    }
  };

  const TimetableGrid = ({ isCompact = true }: { isCompact?: boolean }) => (
    <div 
      id={isCompact ? "timetable-grid-compact" : "timetable-grid-expanded"}
      className={`bg-white dark:bg-gray-800/60 rounded-lg ${
        isCompact ? 'p-3' : 'p-6'
      } border border-slate-200 dark:border-gray-700/60`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 ${isCompact ? 'text-sm' : ''}`}>
        <div className="flex items-center space-x-2">
          <Calendar className={`text-blue-600 ${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
          <h3 className={`font-semibold text-slate-900 dark:text-slate-100 ${
            isCompact ? 'text-sm' : 'text-lg'
          }`}>
            Class {className} Timetable
          </h3>
        </div>
        <div className="flex space-x-2">
          {!isCompact && userRole === 'admin' && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadAsPNG}
              className="flex items-center space-x-1"
            >
              <Download className="h-4 w-4" />
              <span>PNG</span>
            </Button>
          )}
          {isCompact && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(true)}
              className="flex items-center space-x-1"
            >
              <Expand className="h-4 w-4" />
              <span>Expand</span>
            </Button>
          )}
        </div>
      </div>

      {/* Timetable Grid */}
      <div 
        className="grid gap-px bg-slate-200 dark:bg-gray-700/80 rounded-lg overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${1 + workingDays.length}, minmax(0, 1fr))` }}
      >
        {/* Header Row */}
        <div className={`bg-slate-100 dark:bg-gray-700/70 ${
          isCompact ? 'p-2' : 'p-3'
        } font-medium text-slate-900 dark:text-gray-100 text-center ${
          isCompact ? 'text-xs' : 'text-sm'
        }`}>
          Time
        </div>
        {workingDays.map(day => (
          <div 
            key={day}
            className={`bg-slate-100 dark:bg-gray-700/70 ${
              isCompact ? 'p-2' : 'p-3'
            } font-medium text-slate-900 dark:text-gray-100 text-center ${
              isCompact ? 'text-xs' : 'text-sm'
            }`}
          >
            {formatDayName(day)}
          </div>
        ))}

        {/* Time Slots */}
        {nonBreakTimeSlots.map(slot => (
          <React.Fragment key={slot.period}>
            {/* Time Column */}
            <div className={`bg-white dark:bg-gray-800/40 ${
              isCompact ? 'p-1' : 'p-2'
            } border-r border-slate-200 dark:border-gray-700/60`}>
              <div className={`font-medium text-slate-900 dark:text-gray-100 ${
                isCompact ? 'text-xs' : 'text-sm'
              }`}>
                P{slot.period}
              </div>
              <div className={`text-slate-600 dark:text-gray-300 ${
                isCompact ? 'text-xs' : 'text-xs'
              }`}>
                {formatTimeRange(slot)}
              </div>
            </div>

            {/* Subject Cells */}
            {workingDays.map(day => {
              const entry = getEntryForSlot(day, slot.period);
              
              return (
                <div 
                  key={`${day}-${slot.period}`}
                  className={`bg-white dark:bg-gray-800/40 ${
                    isCompact ? 'p-1' : 'p-2'
                  } min-h-[${isCompact ? '3rem' : '4rem'}] flex flex-col justify-center`}
                >
                  {entry ? (
                    <div className="space-y-1">
                      <Badge 
                        variant="secondary" 
                        className={`w-fit font-medium ${
                          isCompact ? 'text-xs px-1 py-0' : 'text-xs'
                        }`}
                      >
                        {entry.subjectName || 'Subject'}
                      </Badge>
                      <div className={`text-slate-600 dark:text-gray-300 ${
                        isCompact ? 'text-xs' : 'text-sm'
                      }`}>
                        {entry.teacherName || 'Teacher'}
                      </div>
                      {entry.room && (
                        <div className={`text-slate-500 dark:text-gray-400 ${
                          isCompact ? 'text-xs' : 'text-xs'
                        }`}>
                          {entry.room}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`text-center text-slate-400 dark:text-gray-500 ${
                      isCompact ? 'text-xs' : 'text-sm'
                    }`}>
                      Free Period
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Footer info */}
      <div className={`mt-3 text-center text-slate-500 dark:text-gray-300 ${
        isCompact ? 'text-xs' : 'text-sm'
      }`}>
        <Clock className="inline h-3 w-3 mr-1" />
        Current Week Schedule
      </div>
    </div>
  );

  return (
    <>
      {/* Compact Display */}
      <div className="max-w-full overflow-x-auto">
        <TimetableGrid isCompact={true} />
      </div>

      {/* Expanded Modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Class {className} - Weekly Timetable</span>
              {userRole === 'admin' && (
                <Button
                  size="sm"
                  onClick={downloadAsPNG}
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PNG</span>
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <TimetableGrid isCompact={false} />
        </DialogContent>
      </Dialog>
    </>
  );
}