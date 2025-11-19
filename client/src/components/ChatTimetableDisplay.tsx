import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Calendar, Expand } from "lucide-react";
import html2canvas from 'html2canvas';
import { getCurrentDateIST, formatDateIST, getCurrentDateTimeIST } from "@shared/utils/dateUtils";

interface TimetableEntry {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  teacherId?: string;
  subjectId?: string;
  teacher?: {
    name: string;
  };
  subject?: {
    name: string;
    color?: string;
  };
  class?: {
    grade: string;
    section: string;
  };
  room?: string;
  isModified?: boolean;
}

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

interface ChatTimetableDisplayProps {
  classInfo: {
    grade: string;
    section: string;
  };
  teacherInfo?: {
    name: string;
  };
  weekStart: string;
  weekEnd: string;
  timetableData: TimetableEntry[];
  timeSlots: TimeSlot[];
  workingDays: string[];
}

const dayNames = {
  monday: 'Monday',
  tuesday: 'Tuesday', 
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday'
};

const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDateRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' };
  const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'Asia/Kolkata' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${startDate.toLocaleDateString('en-US', yearOptions)}`;
};

export const ChatTimetableDisplay: React.FC<ChatTimetableDisplayProps> = ({
  classInfo,
  teacherInfo,
  weekStart,
  weekEnd,
  timetableData,
  timeSlots,
  workingDays
}) => {
  const isTeacherSchedule = !!teacherInfo;
  const timetableRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Defensive guards to prevent runtime errors
  if (!timeSlots || !workingDays || !timetableData) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-sm p-4 max-w-4xl">
        <div className="text-center text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2" />
          <p>Unable to load timetable data. Please try again.</p>
        </div>
      </div>
    );
  }

  const sortedWorkingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    .filter(day => workingDays.includes(day));

  const getDayDate = (dayName: string): string => {
    const weekStartDate = new Date(weekStart + 'T00:00:00+05:30');
    const dayIndex = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(dayName);
    const dayDate = new Date(weekStartDate);
    dayDate.setDate(weekStartDate.getDate() + dayIndex);
    return dayDate.getDate().toString();
  };

  const getTimetableEntry = (day: string, period: number): TimetableEntry | null => {
    return timetableData.find(entry => 
      entry.day?.toLowerCase() === day.toLowerCase() && entry.period === period
    ) || null;
  };

  const exportAsPNG = async () => {
    if (!timetableRef.current) return;

    try {
      const canvas = await html2canvas(timetableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.download = `Class_${classInfo.grade}${classInfo.section ? '_' + classInfo.section : ''}_Timetable_${weekStart}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Failed to export timetable:', error);
    }
  };

  // Get today's day name
  const getTodayDayName = () => {
    const today = new Date(getCurrentDateIST() + 'T00:00:00+05:30');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[today.getUTCDay()];
  };

  // Get today's formatted date
  const getTodayFormatted = () => {
    return formatDateIST(getCurrentDateTimeIST(), { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get today's timetable entries
  const getTodayEntries = () => {
    const todayDay = getTodayDayName();
    return timeSlots.map(slot => ({
      ...slot,
      entry: getTimetableEntry(todayDay, slot.period)
    })).filter(item => !item.isBreak); // Filter out breaks for compact view
  };

  // Render compact thumbnail view showing today's schedule
  const renderCompactView = () => {
    const todayEntries = getTodayEntries();
    const todayDay = getTodayDayName();
    const isWeekend = todayDay === 'sunday';
    
    return (
      <div 
        className="bg-card rounded-lg border border-border shadow-sm p-3 max-w-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsExpanded(true)}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {isTeacherSchedule 
                  ? `${teacherInfo?.name} - Teacher Schedule`
                  : `Class ${classInfo.grade}${classInfo.section ? `-${classInfo.section}` : ''} Timetable`
                }
              </h4>
              <p className="text-xs text-muted-foreground">
                {getTodayFormatted()}
              </p>
            </div>
          </div>
          <Expand className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Today's complete schedule */}
        {isWeekend ? (
          <div className="text-center py-4">
            <div className="text-sm text-muted-foreground mb-1">🎉 Weekend</div>
            <div className="text-xs text-muted-foreground">No classes today</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground space-y-1">
            {todayEntries.map((item) => (
              <div key={item.period} className="flex justify-between">
                <span>P{item.period} ({formatTime12Hour(item.startTime)})</span>
                <span className="font-medium text-foreground">
                  {item.entry?.subject?.name || 'Free'}
                  {isTeacherSchedule && item.entry?.class && (
                    <span className="ml-1 text-blue-600">- {item.entry.class.grade}{item.entry.class.section}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-2 text-xs text-center text-blue-600 font-medium">
          Click to view full timetable
        </div>
      </div>
    );
  };

  // Render full expanded view
  const renderExpandedView = () => (
    <div className="bg-card rounded-lg p-4">
      {/* Full Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isTeacherSchedule 
                ? `${teacherInfo?.name} - Teacher Schedule`
                : `Class ${classInfo.grade}${classInfo.section ? `-${classInfo.section}` : ''} Weekly Timetable`
              }
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(weekStart, weekEnd)}
            </p>
          </div>
        </div>
        <Button
          onClick={exportAsPNG}
          size="sm"
          variant="outline"
          className="flex items-center space-x-1"
        >
          <Download className="w-4 h-4" />
          <span>Export PNG</span>
        </Button>
      </div>

      {/* Full Timetable Grid */}
      <div ref={timetableRef} className="bg-card">
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full border-collapse text-sm min-w-0">
            {/* Header Row */}
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30">
                <th className="border border-border px-2 md:px-3 py-2 text-left font-medium text-foreground w-20 md:w-32 lg:w-36 sticky left-0 bg-blue-50 dark:bg-blue-950/30 z-10">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm">🕐</span>
                    <span className="text-sm hidden md:inline">Period</span>
                    <span className="text-sm md:hidden">P</span>
                  </div>
                </th>
                {sortedWorkingDays.map(day => (
                  <th key={day} className="border border-border px-1 md:px-3 lg:px-4 py-2 text-center font-medium text-foreground w-24 md:w-auto">
                    <div>
                      <div className="font-semibold text-sm">{dayNames[day as keyof typeof dayNames]}</div>
                      <div className="text-xs text-muted-foreground">{dayNames[day as keyof typeof dayNames].slice(0, 3)} {getDayDate(day)}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Full Body Rows */}
            <tbody>
              {timeSlots.map((timeSlot) => {
                const isBreak = timeSlot.isBreak;
                
                if (isBreak) {
                  return (
                    <tr key={`break-${timeSlot.period}`} className="bg-orange-50 dark:bg-orange-950/30 h-10">
                      <td className="border border-border px-2 md:px-3 py-2 font-medium text-orange-700 dark:text-orange-300 sticky left-0 bg-orange-50 dark:bg-orange-950/30 z-10">
                        <div className="flex items-center space-x-1 md:space-x-2">
                          <span className="text-sm">☕</span>
                          <span className="text-sm">Break</span>
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400">
                          {formatTime12Hour(timeSlot.startTime)}
                        </div>
                      </td>
                      {sortedWorkingDays.map(day => (
                        <td key={`${day}-break-${timeSlot.period}`} className="border border-border px-1 md:px-3 lg:px-4 py-2 text-center bg-orange-50 dark:bg-orange-950/30">
                          <div className="text-orange-600 dark:text-orange-400 text-sm">Break</div>
                        </td>
                      ))}
                    </tr>
                  );
                }

                return (
                  <tr key={timeSlot.period} className="hover:bg-muted/30 h-16">
                    <td className="border border-border px-2 md:px-3 py-2 font-medium text-foreground bg-blue-50 dark:bg-blue-950/30 sticky left-0 z-10">
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <span className="bg-blue-600 text-white rounded w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold">
                          {timeSlot.period}
                        </span>
                        <span className="text-xs md:text-sm hidden md:inline">P{timeSlot.period}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTime12Hour(timeSlot.startTime)}
                      </div>
                    </td>
                    {sortedWorkingDays.map(day => {
                      const entry = getTimetableEntry(day, timeSlot.period);
                      
                      if (!entry || (!entry.teacherId && !entry.subjectId)) {
                        return (
                          <td key={`${day}-${timeSlot.period}`} className="border border-border px-1 md:px-3 lg:px-4 py-2 text-center">
                            <div className="text-muted-foreground/60 text-xs md:text-sm">Free Period</div>
                          </td>
                        );
                      }

                      const bgColor = entry.subject?.color 
                        ? `${entry.subject.color}15` 
                        : '#f9fafb';

                      return (
                        <td 
                          key={`${day}-${timeSlot.period}`} 
                          className="border border-border px-1 md:px-3 lg:px-4 py-2"
                          style={{ backgroundColor: bgColor }}
                        >
                          <div className="space-y-0.5 md:space-y-1">
                            <div 
                              className="font-semibold text-xs md:text-sm leading-tight truncate"
                              style={{ color: entry.subject?.color || 'hsl(var(--foreground))' }}
                              title={entry.subject?.name || 'Subject'}
                            >
                              {entry.subject?.name || 'Subject'}
                            </div>
                            {isTeacherSchedule ? (
                              <div className="text-xs md:text-sm text-muted-foreground leading-tight truncate" title={entry.class ? `${entry.class.grade}${entry.class.section}` : 'Class'}>
                                {entry.class ? `${entry.class.grade}${entry.class.section}` : 'Class'}
                              </div>
                            ) : (
                              <div className="text-xs md:text-sm text-muted-foreground leading-tight truncate" title={entry.teacher?.name || 'Teacher'}>
                                {entry.teacher?.name || 'Teacher'}
                              </div>
                            )}
                            {entry.room && (
                              <div className="text-xs text-muted-foreground/80 hidden md:block">
                                Room: {entry.room}
                              </div>
                            )}
                            {entry.isModified && (
                              <div className="inline-flex items-center px-1 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hidden md:inline-flex">
                                ✏️ Modified
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Footer */}
      <div className="mt-4 text-sm text-muted-foreground/60 text-center">
        Generated on {formatDateIST(getCurrentDateTimeIST(), { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })} • Class {classInfo.grade}{classInfo.section ? `-${classInfo.section}` : ''}
      </div>
    </div>
  );

  return (
    <>
      {/* Compact Thumbnail View */}
      {renderCompactView()}
      
      {/* Expanded Modal View */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="w-[95vw] max-w-[95vw] xl:max-w-[90vw] h-[90vh] md:h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="sr-only">
              Class {classInfo.grade}{classInfo.section ? `-${classInfo.section}` : ''} Timetable
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-4">
            {renderExpandedView()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatTimetableDisplay;