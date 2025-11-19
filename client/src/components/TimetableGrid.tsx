import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import React from "react";
import { TimetableChanges } from "./TimetableChanges";
import SubstitutionManagement from "./SubstitutionManagement";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { Plus, Edit, Trash2, RefreshCw, Copy, Download, Eye, Upload, ChevronDown, Settings, BookOpen, UserCircle, Clock, Calendar as CalendarIcon, LayoutGrid, Sparkles, GraduationCap, School, AlertTriangle, Maximize2, X } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { DatePickerDialog } from "@/components/DatePickerDialog";
import { format } from "date-fns";
import { Teacher } from '@/lib/types';
import { getCurrentDateIST, formatDateIST, toISTDateString, getWeekStartDateIST, getWeekEndDateIST, parseISTDate, addDaysIST } from "@shared/utils/dateUtils";
import { sortClasses } from "@shared/classUtils";

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  teacher: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string;
  };
  class: {
    id: string;
    grade: string;
    section: string;
  };
  room?: string;
}

interface TeacherWithPriority extends Teacher {
  priority?: number;
  teachingThisClass?: boolean;
}

interface ManualAssignmentCell {
  day: string;
  period: number;
  timeSlot: TimeSlot;
  entry?: TimetableEntry;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

// Generate consistent light gradient colors for subjects based on their code/name
const generateSubjectColor = (subjectName: string): { from: string; to: string; text: string } => {
  // Hash the subject name to get a consistent number
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Define light gradient color pairs that work well
  const colorPairs = [
    { from: '#dbeafe', to: '#bfdbfe', text: '#1e40af' }, // Blue
    { from: '#fce7f3', to: '#fbcfe8', text: '#9f1239' }, // Pink
    { from: '#d1fae5', to: '#a7f3d0', text: '#065f46' }, // Green
    { from: '#fef3c7', to: '#fde68a', text: '#92400e' }, // Yellow
    { from: '#e0e7ff', to: '#c7d2fe', text: '#3730a3' }, // Indigo
    { from: '#fce7f3', to: '#f5d0fe', text: '#86198f' }, // Purple
    { from: '#ffedd5', to: '#fed7aa', text: '#9a3412' }, // Orange
    { from: '#ccfbf1', to: '#99f6e4', text: '#115e59' }, // Teal
    { from: '#e7e5e4', to: '#d6d3d1', text: '#44403c' }, // Stone
    { from: '#fef9c3', to: '#fef08a', text: '#713f12' }, // Lime
  ];
  
  // Use hash to select a color pair consistently
  const index = Math.abs(hash) % colorPairs.length;
  return colorPairs[index];
};

interface TimetableStructure {
  id: string;
  schoolId: string;
  periodsPerDay: number;
  workingDays: string[];
  timeSlots: TimeSlot[];
  isActive: boolean;
}

interface TimetableGridProps {
  isGeneratingSchoolTimetable: boolean;
  setIsGeneratingSchoolTimetable: (value: boolean) => void;
  onOpenSettings: () => void;
  onOpenGenerationDialog: () => void;
}

// Function to sort working days in proper order
const sortWorkingDays = (days: string[]): string[] => {
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return dayOrder.filter(day => days.includes(day));
};

// Format time to 12-hour format with AM/PM
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

// Get week start date (Monday) in IST timezone - use shared utility
const getWeekStart = (date: Date): Date => {
  return getWeekStartDateIST(date);
};

// Get week end date (Sunday) in IST timezone - use shared utility
const getWeekEnd = (date: Date): Date => {
  return getWeekEndDateIST(date);
};

// Format date range for display
const formatWeekRange = (startDate: Date, endDate: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

// Helper function to generate working days for current and next week
const generateWorkingDays = (workingDays: string[]): Array<{date: string, dayName: string, label: string}> => {
  const days: Array<{date: string, dayName: string, label: string}> = [];
  const today = new Date(getCurrentDateIST() + 'T00:00:00+05:30');
  
  // Generate days for current and next week
  for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
    const weekStart = getWeekStart(today);
    weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
    
    workingDays.forEach(dayName => {
      const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(dayName.toLowerCase());
      if (dayIndex !== -1) {
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + dayIndex);
        
        // Use toISTDateString to ensure YYYY-MM-DD format in IST timezone for backend compatibility
        const dateString = toISTDateString(targetDate);
        const isToday = dateString === getCurrentDateIST();
        const weekLabel = weekOffset === 0 ? 'This Week' : 'Next Week';
        
        days.push({
          date: dateString,
          dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          label: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} - ${formatDateIST(targetDate, { month: 'short', day: 'numeric' })} ${isToday ? '(Today)' : ''} - ${weekLabel}`
        });
      }
    });
  }
  
  return days;
};

export default function TimetableGrid({
  isGeneratingSchoolTimetable,
  setIsGeneratingSchoolTimetable,
  onOpenSettings,
  onOpenGenerationDialog
}: TimetableGridProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [viewMode, setViewMode] = useState<"class">("class");
  const [timetableViewMode, setTimetableViewMode] = useState<"class" | "school" | "master" | "substitutions">("school");
  const selectedDate = new Date(getCurrentDateIST() + 'T00:00:00+05:30'); // Always use current date in IST - no navigation needed
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Check URL parameters for tab navigation (e.g., from notifications)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'substitutions') {
      setTimetableViewMode('substitutions');
    }
  }, [location]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Manual assignment state
  const [assignmentCell, setAssignmentCell] = useState<ManualAssignmentCell | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isFreePeriod, setIsFreePeriod] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntry | null>(null);

  // Validation state
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Week selection state (current or next)
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0); // 0 = current week, 1 = next week
  
  // School-wide date selection state - default to today
  const [selectedSchoolDate, setSelectedSchoolDate] = useState<string>(getCurrentDateIST());
  
  // Tab selection state - default to weekly timetable
  const [activeTab, setActiveTab] = useState<'weekly' | 'master'>('weekly');
  
  // Calculate effective date based on selected week offset using IST timezone
  const effectiveDate = useMemo(() => {
    // selectedDate is already a Date object, use it directly
    const today = selectedDate;
    
    // Get Monday of current week using IST-safe utility
    const currentWeekStart = getWeekStartDateIST(today);
    
    // Add week offset (0 = current week, 1 = next week)
    const targetWeekStart = addDaysIST(currentWeekStart, selectedWeekOffset * 7);
    
    return targetWeekStart;
  }, [selectedDate, selectedWeekOffset]);

  // Refresh confirmation dialog state
  const [isRefreshConfirmDialogOpen, setIsRefreshConfirmDialogOpen] = useState(false);

  // Set as Master Timetable state
  const [isSetAsGlobalDialogOpen, setIsSetAsGlobalDialogOpen] = useState(false);
  const [isSettingAsGlobal, setIsSettingAsGlobal] = useState(false);

  // Sync with Master Timetable state
  const [isCopyFromGlobalDialogOpen, setIsCopyFromGlobalDialogOpen] = useState(false);
  const [isCopyingFromGlobal, setIsCopyingFromGlobal] = useState(false);


  // Weekly timetable export states
  const [isExportingWeekly, setIsExportingWeekly] = useState(false);

  // Global timetable export states
  const [isExportingGlobal, setIsExportingGlobal] = useState<boolean>(false);
  const [isExportingSchoolWide, setIsExportingSchoolWide] = useState<boolean>(false);

  // Fullscreen/Expand view state
  const [isFullscreenView, setIsFullscreenView] = useState(false);
  const [isExportingExpanded, setIsExportingExpanded] = useState(false);
  const [isMasterFullscreenView, setIsMasterFullscreenView] = useState(false);
  const [isExportingMasterExpanded, setIsExportingMasterExpanded] = useState(false);
  const [isSchoolWideFullscreenView, setIsSchoolWideFullscreenView] = useState(false);
  const [isExportingSchoolWideExpanded, setIsExportingSchoolWideExpanded] = useState(false);

  // Generate School Timetable state (moved to parent, only keeping non-prop states)


  // Data queries - declare these first before using in useEffect
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["/api/classes"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle class selection from URL query parameter
  useEffect(() => {
    if (location === "/timetable" && classes && Array.isArray(classes)) {
      // Check for classId query parameter (direct ID)
      const urlParams = new URLSearchParams(window.location.search);
      const classIdFromUrl = urlParams.get('classId');
      const classGradeFromUrl = urlParams.get('class');

      if (classIdFromUrl) {
        setSelectedClass(classIdFromUrl);
        setViewMode("class");
      } else if (classGradeFromUrl) {
        // Find class by grade number (e.g., URL param "1" matches "Class 1" grade)
        const targetClass = classes.find(c => c.grade === classGradeFromUrl);
        if (targetClass) {
          setSelectedClass(targetClass.id);
          setViewMode("class");
        }
      } else {
        setSelectedClass("");
      }
    }
  }, [location, classes]);

  const { data: teachersResponse, isLoading: teachersLoading } = useQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teachers?limit=1000");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const teachers = teachersResponse?.teachers || [];

  // Fetch timetable structure
  const { data: timetableStructure, isLoading: structureLoading } = useQuery<TimetableStructure>({
    queryKey: ["/api/timetable-structure"],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch timetable changes to detect absent teachers
  const { data: timetableChanges = [] } = useQuery({
    queryKey: ["/api/timetable-changes/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-changes/active");
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch timetable freeze status
  const { data: freezeStatus } = useQuery({
    queryKey: ["timetable-freeze-status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings/timetable-freeze-status");
      return response.json();
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });

  // NOTE: Global timetable query moved down to avoid duplication - see globalTimetableData query

  // Fetch teacher attendance data for the entire week
  const { data: teacherAttendance = [] } = useQuery({
    queryKey: ["teacher-attendance", effectiveDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })],
    queryFn: async () => {
      const weekStart = getWeekStart(effectiveDate);
      const weekEnd = getWeekEnd(effectiveDate);
      
      const params = new URLSearchParams({
        startDate: weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        endDate: weekEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      });

      const response = await apiRequest("GET", `/api/teacher-attendance?${params}`);
      return response.json();
    },
    enabled: true, // Always enabled for stable hook order
    refetchInterval: 5000,
  });

  // Query for subjects specific to the selected class
  const { data: classSubjectAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/class-subject-assignments", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      console.log(`[SUBJECTS] Fetching subjects for class: ${selectedClass}`);
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${selectedClass}`);
      const result = await response.json();
      console.log(`[SUBJECTS] Found ${result.length} subject assignments:`, result);
      return result;
    },
    enabled: true, // Always enabled for stable hook order
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for all subjects as fallback
  const { data: allSubjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    enabled: true, // Always enabled for stable hook order
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract subjects from class subject assignments, fallback to all subjects if none assigned
  const classSpecificSubjects: Subject[] = classSubjectAssignments
    .filter((assignment: any) => assignment.subject) // Filter out assignments without subjects
    .map((assignment: any) => assignment.subject);

  const subjects: Subject[] = classSpecificSubjects.length > 0 ? classSpecificSubjects : allSubjects;

  // Removed debug logging - functionality working correctly

  // Query for available teachers when assignment dialog is open and subject is selected OR free period is enabled
  const { data: availableTeachers = [], isLoading: isLoadingTeachers } = useQuery<TeacherWithPriority[]>({
    queryKey: ["/api/timetable/available-teachers", assignmentCell?.day, assignmentCell?.period, selectedClass, selectedSubjectId, isFreePeriod],
    queryFn: async () => {
      // Move all conditions into the function to ensure stable hook calling
      if (!assignmentCell || !selectedClass || (!selectedSubjectId && !isFreePeriod) || !isAssignmentDialogOpen) {
        return [];
      }

      // Calculate the specific date for the day being assigned
      const weekStart = getWeekStart(effectiveDate);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayIndex = dayNames.indexOf(assignmentCell.day.toLowerCase());

      // Calculate the specific date for this day in the current week
      const targetDate = new Date(weekStart);
      if (dayIndex === 0) { // Sunday
        targetDate.setDate(weekStart.getDate() + 6);
      } else {
        targetDate.setDate(weekStart.getDate() + (dayIndex - 1));
      }

      const params = new URLSearchParams({
        classId: selectedClass,
        day: assignmentCell.day,
        period: assignmentCell.period.toString(),
        date: targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // Add date in YYYY-MM-DD format
      });

      // Only add subjectId if not in free period mode
      if (!isFreePeriod && selectedSubjectId) {
        params.append('subjectId', selectedSubjectId);
      }

      const response = await apiRequest("GET", `/api/timetable/available-teachers?${params.toString()}`);
      return response.json();
    },
    enabled: true, // Always enabled to maintain stable hook order
    staleTime: 0,
  });

  const shouldFetchTimetable = Boolean(selectedClass);

  // Weekly timetable data query - fetches from weekly_timetables table
  const { data: weeklyTimetableResponse, isLoading: weeklyTimetableLoading } = useQuery({
    queryKey: ["/api/timetable/weekly", selectedClass, effectiveDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })],
    queryFn: async () => {
      if (!shouldFetchTimetable) return null;

      const params = new URLSearchParams({
        date: effectiveDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      });


      const response = await apiRequest("GET", `/api/timetable/weekly/${selectedClass}?${params.toString()}`);
      const data = await response.json();

      return data;
    },
    enabled: true, // Always enabled for stable hook order
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes - weekly data changes less frequently
  });

  // Check if selected date is a working day (for school-wide mode)
  const { data: workingDayInfo } = useQuery({
    queryKey: ["/api/working-day", selectedSchoolDate, timetableViewMode],
    queryFn: async () => {
      if (timetableViewMode !== "school" || !selectedSchoolDate) return null;
      
      const params = new URLSearchParams({ date: selectedSchoolDate });
      const response = await apiRequest("GET", `/api/working-day?${params}`);
      return response.json();
    },
    enabled: timetableViewMode === "school" && !!selectedSchoolDate,
  });

  // School-wide weekly timetable queries - fetch for ALL classes when in school-wide mode
  const { data: schoolWideWeeklyData, isLoading: schoolWideWeeklyLoading, refetch: refetchSchoolWideData } = useQuery({
    queryKey: ["/api/timetable/school-wide-weekly", selectedSchoolDate, timetableViewMode, classes],
    queryFn: async () => {
      if (timetableViewMode !== "school" || !classes || !Array.isArray(classes)) {
        return null;
      }

      console.log(`[SCHOOL-WIDE] Fetching weekly timetables for ${classes.length} classes on ${selectedSchoolDate} using batch endpoint`);
      
      // Use batch endpoint to fetch all classes in one request
      const classIds = classes.map((c: any) => c.id);
      
      try {
        const response = await apiRequest("POST", "/api/timetable/weekly/batch", {
          classIds,
          date: selectedSchoolDate
        });
        const data = await response.json();
        
        // Transform batch response to match the expected format
        const allClassWeeklyData = data.results.map((result: any) => ({
          classId: result.classId,
          className: result.className,
          weeklyData: {
            type: result.hasWeeklyOverrides ? 'weekly' : 'global',
            classId: result.classId,
            weekStart: result.weekStart,
            data: result.data,
            hasWeeklyOverrides: result.hasWeeklyOverrides
          }
        }));
        
        console.log(`[SCHOOL-WIDE] Batch fetched data for ${allClassWeeklyData.length} classes`);
        return allClassWeeklyData;
        
      } catch (error) {
        console.error(`[SCHOOL-WIDE] Error fetching batch weekly data:`, error);
        return null;
      }
    },
    enabled: timetableViewMode === "school" && !!selectedSchoolDate && !!classes && Array.isArray(classes), // Wait for classes to load
    staleTime: 0, // Always refetch when invalidated for immediate updates after edits/deletions
    gcTime: 0, // No caching - always fetch fresh data
    refetchOnWindowFocus: false, // Avoid heavy background refetches when user switches windows
  });

  // Process school-wide weekly data for display
  const processedSchoolWideData = useMemo(() => {
    if (!schoolWideWeeklyData || timetableViewMode !== "school") {
      return null;
    }

    console.log('[SCHOOL-WIDE] Processing data for display');
    
    // Extract the selected day name from the date - ensure proper date parsing
    const selectedDateObj = new Date(selectedSchoolDate);
    
    // Validate the date object
    if (isNaN(selectedDateObj.getTime())) {
      console.error('[SCHOOL-WIDE] Invalid date provided:', selectedSchoolDate);
      return null;
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const selectedDayName = dayNames[selectedDateObj.getDay()];

    console.log(`[SCHOOL-WIDE] Selected day: ${selectedDayName} from date: ${selectedSchoolDate}`);

    // Group data by time periods and classes
    let classColumns: any[] = [];
    const timeSlotRows: any[] = [];
    let masterFallbackCount = 0; // Count classes using master timetable
    let weeklyOverrideCount = 0; // Count classes using weekly timetable

    // Collect all unique time periods from timetable structure
    if (timetableStructure?.timeSlots) {
      timeSlotRows.push(...timetableStructure.timeSlots.map(slot => ({
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak || false
      })));
    }

    // Process each class's weekly data
    schoolWideWeeklyData.forEach((classData: any) => {
      if (!classData.weeklyData) return;

      const { classId, className, weeklyData } = classData;
      const dataSource = weeklyData.dataSource || (weeklyData.hasWeeklyOverrides ? 'weekly' : 'master');
      
      // Count classes by data source
      if (dataSource === 'master') {
        masterFallbackCount++;
      } else {
        weeklyOverrideCount++;
      }
      
      // Filter entries for the selected day only
      // The backend returns: weeklyData.data.timetableData (not weeklyData.entries)
      const entries = weeklyData?.data?.timetableData || [];
      const dayEntries = Array.isArray(entries) ? 
        entries.filter((entry: any) => 
          entry.day && entry.day.toLowerCase() === selectedDayName.toLowerCase()
        ) : [];

      console.log(`[SCHOOL-WIDE] Class ${className}: ${dayEntries.length} entries for ${selectedDayName} (source: ${dataSource})`);

      // Enrich entries with subject and teacher names
      // Preserve API-enriched data when frontend lookup fails (e.g., Free Period with teacher)
      const enrichedDayEntries = dayEntries.map((entry: any) => {
        const subject = allSubjects?.find((s: any) => s.id === entry.subjectId);
        const teacher = teachers?.find((t: any) => t.id === entry.teacherId);
        
        // Log warnings when lookups fail but API data exists (indicates potential data mismatch)
        if (!subject && entry.subject && entry.subjectId) {
          console.warn(`[SCHOOL-WIDE] Subject lookup failed for ID ${entry.subjectId}, using API data:`, entry.subject);
        }
        if (!teacher && entry.teacher && entry.teacherId) {
          console.warn(`[SCHOOL-WIDE] Teacher lookup failed for ID ${entry.teacherId}, using API data:`, entry.teacher);
        }
        
        // Determine final teacher and subject values with proper fallbacks
        const finalTeacher = teacher ? { id: teacher.id, name: teacher.name } : (entry.teacher || null);
        const finalSubject = subject 
          ? { id: subject.id, name: subject.name, color: subject.color } 
          : (entry.subject || (finalTeacher ? { id: entry.subjectId, name: 'Free Subject', color: '#9333ea' } : null));
        
        return {
          ...entry,
          subject: finalSubject,
          teacher: finalTeacher
        };
      });

      classColumns.push({
        classId,
        className,
        dayEntries: enrichedDayEntries,
        dataSource // Include data source for potential future use
      });
    });

    // Filter out classes that don't have at least one entry with both teacher and subject
    classColumns = classColumns.filter((classColumn) => {
      const hasValidEntry = classColumn.dayEntries.some((entry: any) => {
        const hasTeacher = entry.teacher && entry.teacher.name;
        const hasRealSubject = entry.subject && entry.subject.name && entry.subject.name !== 'Free Subject';
        return hasTeacher && hasRealSubject;
      });
      
      if (!hasValidEntry) {
        console.log(`[SCHOOL-WIDE] Filtering out class ${classColumn.className} - no entries with both teacher and real subject`);
      }
      
      return hasValidEntry;
    });

    // Sort classes using the shared sortClasses utility
    // Map className back to grade/section format for sorting
    const classColumnsWithGrade = classColumns.map(col => {
      const parts = col.className.trim().split(/\s+/);
      return {
        ...col,
        grade: parts[0] || '',
        section: parts[1] || ''
      };
    });
    const sortedColumns = sortClasses(classColumnsWithGrade);
    classColumns = sortedColumns.map(({ grade, section, ...rest }) => rest);

    // Only show master fallback banner if ALL visible classes are using master timetable
    const hasMasterFallback = classColumns.length > 0 && weeklyOverrideCount === 0;

    console.log(`[SCHOOL-WIDE] Processed ${classColumns.length} classes and ${timeSlotRows.length} time slots (after filtering), masterFallback: ${masterFallbackCount}, weeklyOverride: ${weeklyOverrideCount}, showBanner: ${hasMasterFallback}`);

    return {
      classColumns,
      timeSlotRows,
      selectedDayName,
      hasMasterFallback // Return true only if ALL visible classes use master timetable
    };
  }, [schoolWideWeeklyData, selectedSchoolDate, timetableViewMode, timetableStructure, allSubjects, teachers]);

  const { data: timetableData, isLoading: timetableLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/detailed", selectedClass],
    queryFn: async () => {
      if (!shouldFetchTimetable) return [];
      const params = new URLSearchParams();
      if (selectedClass) {
        params.append("classId", selectedClass);
      }
      // Fetch all timetable entries for the selected class (not filtered by date)
      const response = await apiRequest("GET", `/api/timetable/detailed?${params.toString()}`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: true, // Always enabled for stable hook order
    staleTime: 0, // Always fetch fresh data for assignments
    gcTime: 0, // No caching - always fetch fresh data
  });

  // Global timetable data query (includes weekly overrides when date is selected)
  const { data: globalTimetableData, isLoading: globalTimetableLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/global", selectedClass, selectedSchoolDate],
    queryFn: async () => {
      try {
        if (!shouldFetchTimetable) return [];
        const params = new URLSearchParams();
        if (selectedClass) {
          params.append("classId", selectedClass);
        }
        // Add date parameter for school-wide view to get weekly overrides
        if (selectedSchoolDate) {
          params.append("date", selectedSchoolDate);
        }

        // Add aggressive cache busting for Global API
        const timestamp = Date.now();
        const cacheBustParams = new URLSearchParams(params);
        cacheBustParams.set('_t', timestamp.toString());
        cacheBustParams.set('_nocache', Math.random().toString(36));

        // Fetch global timetable entries (includes weekly overrides when date is provided)
        const response = await apiRequest("GET", `/api/timetable/global?${cacheBustParams.toString()}`);

        // Check if response is actually JSON or HTML redirect
        const contentType = response.headers.get('content-type');

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('API returned non-JSON response (likely authentication redirect)');
        }

        const data = await response.json() as TimetableEntry[];


        return data;
      } catch (error) {
        console.error('[GLOBAL API] Error fetching global timetable:', error);
        return [];
      }
    },
    enabled: true, // Always enabled for stable hook order
    staleTime: 0, // Always fetch fresh data for assignments
    gcTime: 0, // No caching - always fetch fresh data
  });


  // Mutation for manual assignment validation
  const validateAssignmentMutation = useMutation({
    mutationFn: async (validationData: {
      classId: string;
      teacherId: string;
      subjectId?: string;
      day: string;
      period: number;
      weekStart: string;
    }) => {
      console.log('[VALIDATION] Sending validation request:', validationData);
      const response = await apiRequest("POST", "/api/timetable/validate-manual-assignment", validationData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[VALIDATION] Validation response:', data);
      setValidationResult(data);
      setValidationError(null);
    },
    onError: (error: Error) => {
      console.error('[VALIDATION] Validation error:', error);
      setValidationError(error.message);
      setValidationResult(null);
    },
    onSettled: () => {
      setIsValidating(false);
    }
  });

  // Mutation for weekly-only teacher assignment (bypasses approval workflow)
  const weeklyEditMutation = useMutation({
    mutationFn: async (assignmentData: {
      classId: string;
      weekStart: string;
      day: string;
      period: number;
      teacherId: string | null;
      subjectId: string | null;
      startTime: string;
      endTime: string;
      room?: string;
      reason?: string;
    }) => {
      console.log('[WEEKLY EDIT] Sending data:', assignmentData);
      const response = await apiRequest("POST", "/api/timetable/weekly-edit", assignmentData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[WEEKLY EDIT] Success response:', data);

      // Targeted invalidation: Only invalidate queries that are actually affected
      if (selectedClass) {
        const currentWeekStart = getWeekStart(effectiveDate);
        const dateString = currentWeekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        // Only invalidate the specific weekly query for this class and date
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/weekly", selectedClass, dateString],
          exact: true
        });
        
        // Invalidate the enhanced query for this specific class
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/enhanced", selectedClass],
          exact: true
        });
      }

      // Refresh school-wide data if in school-wide view
      if (timetableViewMode === "school") {
        console.log('[WEEKLY EDIT] Triggering school-wide data refresh');
        refetchSchoolWideData();
      }

      // Close dialog and reset state
      setIsAssignmentDialogOpen(false);
      setAssignmentCell(null);
      setSelectedSubjectId("");
      setSelectedTeacherId("");
      // Reset validation state
      setValidationResult(null);
      setValidationError(null);

      console.log('[WEEKLY EDIT] Weekly assignment completed successfully with optimized refresh!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Mutation for manual teacher assignment
  const assignTeacherMutation = useMutation({
    mutationFn: async (assignmentData: {
      newTeacherId: string;
      classId: string;
      subjectId: string;
      day: string;
      period: number;
      startTime: string;
      endTime: string;
      timetableEntryId?: string;
      reason: string;
    }) => {
      console.log('[ASSIGNMENT] Sending data:', assignmentData);
      const response = await apiRequest("POST", "/api/timetable/manual-assign", assignmentData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[ASSIGNMENT] Success response:', data);

      // Smooth timetable refresh without page reload
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-changes/active"] 
      });

      // Force immediate refetch of current timetable
      queryClient.refetchQueries({
        queryKey: ["/api/timetable/detailed", selectedClass, viewMode]
      });

      // Close dialog and reset state
      setIsAssignmentDialogOpen(false);
      setAssignmentCell(null);
      setSelectedSubjectId("");
      setSelectedTeacherId("");

      console.log('[ASSIGNMENT] Assignment completed successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Mutation for deleting timetable entries
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      // Check if this is a weekly entry with synthetic ID
      if (entryId.startsWith('weekly-')) {
        console.log('[DELETE] Handling weekly entry deletion for ID:', entryId);

        // Extract day and period from synthetic ID like "weekly-monday-5-classId"
        const parts = entryId.split('-');
        if (parts.length >= 3) {
          const day = parts[1];
          const period = parseInt(parts[2]);
          const classIdFromId = parts.length >= 4 ? parts.slice(3).join('-') : null;

          console.log('[DELETE] Extracted day:', day, 'period:', period, 'classId:', classIdFromId);

          // Check if this is a school-wide delete with metadata
          const entryData = entryToDelete as any;
          const targetClassId = classIdFromId || entryData?.classId || selectedClass;
          const weekStartString = entryData?._weekStart || getWeekStart(effectiveDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

          if (!targetClassId) {
            throw new Error("Cannot determine class ID for deletion");
          }

          // Get the time slots for this period from timetable structure
          const timeSlot = timetableStructure?.timeSlots?.find((p: any) => p.period === period);

          const deletionPayload = {
            classId: targetClassId,
            weekStart: weekStartString,
            day: day,
            period: period,
            teacherId: null, // null = delete
            subjectId: null, // null = delete
            startTime: entryToDelete?.startTime || timeSlot?.startTime || "00:00",
            endTime: entryToDelete?.endTime || timeSlot?.endTime || "00:00",
            room: undefined,
            reason: "Manual deletion of weekly entry via admin interface"
          };

          console.log('[DELETE] Deletion payload:', deletionPayload);

          // Use weekly edit with null values to delete the entry
          const response = await apiRequest("POST", "/api/timetable/weekly-edit", deletionPayload);
          return response.json();
        } else {
          throw new Error("Invalid weekly entry ID format");
        }
      }

      // Find the timetable entry to get its specific day (for global entries)
      const entryToCancel = timetableData?.find((entry: TimetableEntry) => entry.id === entryId);

      if (!entryToCancel) {
        throw new Error("Timetable entry not found");
      }

      // For admin users, use weekly edit system (bypass approval workflow)
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        const weekStart = getWeekStart(effectiveDate);
        const weekStartString = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });


        const deletionPayload = {
          classId: selectedClass,
          weekStart: weekStartString,
          day: entryToCancel.day,
          period: entryToCancel.period,
          teacherId: null, // null = delete
          subjectId: null, // null = delete
          startTime: entryToCancel.startTime,
          endTime: entryToCancel.endTime,
          room: undefined,
          reason: "Manual deletion via admin interface"
        };


        // Use weekly edit with null values to delete the entry
        const response = await apiRequest("POST", "/api/timetable/weekly-edit", deletionPayload);
        return response.json();
      } else {
        // For non-admin users, use the old deletion method with approval workflow
        const getDateForWeekDay = (dayName: string): Date => {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDayIndex = days.indexOf(dayName.toLowerCase());

          if (targetDayIndex === -1) return selectedDate;

          // Get the start of the week (Monday) from selected date
          const weekStart = getWeekStart(effectiveDate);

          // Calculate the target date
          const targetDate = new Date(weekStart);
          if (targetDayIndex === 0) { // Sunday
            targetDate.setDate(weekStart.getDate() + 6);
          } else {
            targetDate.setDate(weekStart.getDate() + (targetDayIndex - 1));
          }

          return targetDate;
        };

        const exactDate = getDateForWeekDay(entryToCancel.day);

        // Pass the exact date of the entry's day to create week-specific cancellation
        const params = new URLSearchParams({
          date: exactDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        });
        const response = await apiRequest("DELETE", `/api/timetable/entry/${entryId}?${params}`);
        return response;
      }
    },
    onSuccess: () => {
      console.log('[DELETE] Entry deleted successfully');

      // Check if this was a school-wide delete
      const entryData = entryToDelete as any;
      const wasSchoolWideDelete = entryData?._isSchoolWideDelete;
      const deletedClassId = entryData?.classId;

      // Targeted invalidation: Only invalidate queries affected by deletion
      if (selectedClass) {
        const currentWeekStart = getWeekStart(effectiveDate);
        const dateString = currentWeekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        // Only invalidate the specific weekly query for this class and date
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/weekly", selectedClass, dateString],
          exact: true
        });
        
        // Invalidate the enhanced query for this specific class 
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/enhanced", selectedClass],
          exact: true
        });
      }

      // For school-wide deletes, also invalidate the affected class's weekly data
      if (wasSchoolWideDelete && deletedClassId && deletedClassId !== selectedClass) {
        const currentWeekStart = getWeekStart(new Date(selectedSchoolDate));
        const dateString = currentWeekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/weekly", deletedClassId, dateString],
          exact: true
        });
      }

      // Refresh school-wide data if in school-wide view
      if (timetableViewMode === "school") {
        // Force immediate refetch of school-wide data
        console.log('[DELETE] Triggering school-wide data refresh');
        refetchSchoolWideData();
      }

      // Only refresh timetable changes for non-admin users (who use approval workflow)
      if (!(user?.role === 'admin' || user?.role === 'super_admin')) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable-changes/active"],
          exact: true
        });
      }

      // Close dialog and reset state
      setIsDeleteDialogOpen(false);
      setEntryToDelete(null);

      console.log('[DELETE] Entry deletion completed successfully with optimized refresh!');
    },
    onError: (error: any) => {
      console.error('[DELETE] Error details:', {
        message: error.message || 'Unknown error',
        status: error.status,
        response: error.response,
        fullError: error
      });
      const errorMessage = error.message || 'Failed to delete entry. Please try again.';
      alert(`Error: ${errorMessage}`);
    },
  });

  // Handle delete confirmation
  const handleDeleteEntry = (entry: TimetableEntry, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent cell click from triggering
    setEntryToDelete(entry);
    setIsDeleteDialogOpen(true);
  };

  // Handle school-wide delete with proper entry resolution
  const handleSchoolWideDelete = (params: {
    classId: string;
    className: string;
    day: string;
    period: number;
    teacherId?: string;
    subjectId?: string;
    event: React.MouseEvent;
  }) => {
    const { classId, className, day, period, teacherId, subjectId, event } = params;
    event.stopPropagation();

    // Get start and end times from timetable structure
    const timeSlot = timetableStructure?.timeSlots?.find((slot: any) => slot.period === period);
    if (!timeSlot) {
      alert('Cannot delete: Time slot information not found');
      return;
    }

    // Get class object
    const classObj = classesArray?.find((c: any) => c.id === classId);
    
    // Get teacher and subject objects
    const teacherObj = teacherId ? teachers?.find((t: any) => t.id === teacherId) : null;
    const subjectObj = subjectId ? allSubjects?.find((s: any) => s.id === subjectId) : null;

    // For school-wide view, we need to handle this as a weekly delete
    // Create a special marker ID that the delete mutation will recognize
    const weekStart = getWeekStart(new Date(selectedSchoolDate));
    const weekStartString = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const syntheticId = `weekly-${day}-${period}-${classId}`;

    // Construct a full TimetableEntry object with all necessary metadata
    const fullEntry: any = {
      id: syntheticId,
      day: day,
      period: period,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      classId: classId,
      teacherId: teacherId || null,
      subjectId: subjectId || null,
      class: classObj,
      teacher: teacherObj,
      subject: subjectObj,
      // Add metadata for weekly deletion
      _weekStart: weekStartString,
      _isSchoolWideDelete: true,
    };

    // Now we can safely delete with the full entry
    setEntryToDelete(fullEntry);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete action
  const confirmDelete = () => {
    if (!entryToDelete?.id) {
      alert('Error: Cannot delete entry without valid ID');
      return;
    }
    deleteEntryMutation.mutate(entryToDelete.id);
  };

  // Handle cell click for manual assignment
  const handleCellClick = (day: string, period: number, timeSlot: TimeSlot, entry?: TimetableEntry) => {
    // Only allow admins to manually assign teachers
    if (user?.role !== 'admin' && user?.role !== 'super_admin') return;


    // Don't allow assignment for break periods
    if (timeSlot.isBreak) return;

    // Set up assignment cell data
    setAssignmentCell({ day, period, timeSlot, entry });

    // Note: selectedClass is already set in the onClick handler for school-wide view
    // No need to set it again here to avoid conflicts

    // For existing entries, pre-select the subject
    if (entry?.subject?.id) {
      setSelectedSubjectId(entry.subject.id);
      setIsFreePeriod(false);
    } else {
      // Free cell - reset state and set to free period mode
      setSelectedSubjectId("");
      setIsFreePeriod(!entry); // Set to true if entry is undefined (free period)
    }

    setSelectedTeacherId("");
    setIsAssignmentDialogOpen(true);
  };

  // Handle teacher assignment submission
  const handleAssignTeacher = () => {
    if (!assignmentCell || !selectedClass) return;

    // Calculate current week start for weekly edits
    const weekStart = getWeekStart(effectiveDate);
    const weekStartString = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Use weekly edit mutation for admin direct edits (bypasses approval workflow)
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      weeklyEditMutation.mutate({
        classId: selectedClass,
        weekStart: weekStartString,
        day: assignmentCell.day,
        period: assignmentCell.period,
        teacherId: selectedTeacherId, // null for deletion
        subjectId: isFreePeriod ? "" : (selectedSubjectId || ""), // null for free period
        startTime: assignmentCell.timeSlot.startTime,
        endTime: assignmentCell.timeSlot.endTime,
        room: undefined,
        reason: selectedTeacherId 
          ? isFreePeriod 
            ? "Free period assignment via admin interface" 
            : "Manual assignment via admin interface" 
          : "Manual removal via admin interface"
      });
    } else {
      // Fallback to global assignment for non-admin users
      if (!selectedTeacherId || (!selectedSubjectId && !isFreePeriod)) return;

      assignTeacherMutation.mutate({
        newTeacherId: selectedTeacherId,
        classId: selectedClass,
        subjectId: isFreePeriod ? "" : (selectedSubjectId || ""),
        day: assignmentCell.day,
        period: assignmentCell.period,
        startTime: assignmentCell.timeSlot.startTime,
        endTime: assignmentCell.timeSlot.endTime,
        timetableEntryId: assignmentCell.entry?.id,
        reason: isFreePeriod ? "Free period assignment via interface" : "Manual assignment via interface"
      });
    }
  };

  // Helper function to check if any weekly timetable exists for the current week
  const isWeeklyTimetableAvailable = (): boolean => {
    return weeklyTimetableResponse && weeklyTimetableResponse.type === 'weekly' && weeklyTimetableResponse.data;
  };

  const getTimetableEntry = (day: string, period: number): TimetableEntry | null => {
    // This function is for the Weekly Timetable section - ONLY show data from weekly_timetables database table
    console.log('[WEEKLY ENTRY] getTimetableEntry called for day:', day, 'period:', period);

    // Check if there's actual weekly timetable data in the database (type === 'weekly')
    if (weeklyTimetableResponse && weeklyTimetableResponse.type === 'weekly' && weeklyTimetableResponse.data) {
      console.log('[WEEKLY ENTRY] Weekly timetable exists for this week - using ONLY weekly data');
      console.log('[WEEKLY ENTRY] Looking for entry in weekly data for day:', day, 'period:', period);
      console.log('[WEEKLY ENTRY] Weekly data structure:', weeklyTimetableResponse.data);

      // The weekly data is nested under timetableData property
      let weeklyData = weeklyTimetableResponse.data.timetableData;

      if (Array.isArray(weeklyData)) {
        console.log('[WEEKLY ENTRY] Using weekly timetableData array with', weeklyData.length, 'entries');

        const weeklyEntry = weeklyData.find((entry: any) => 
          entry.day?.toLowerCase() === day.toLowerCase() && entry.period === period
        );

        if (weeklyEntry) {
          console.log('[WEEKLY ENTRY] Found weekly entry:', weeklyEntry);

          // USE ENRICHED DATA FROM SERVER FIRST (teacher/subject objects already attached by backend)
          // Only fall back to local lookup if server didn't send enriched data
          const teacher = weeklyEntry.teacher || (teachers as any[])?.find((t: any) => t.id === weeklyEntry.teacherId);
          const subject = weeklyEntry.subject || (subjects as any[])?.find((s: any) => s.id === weeklyEntry.subjectId);
          const classData = weeklyEntry.class || (classes as any[])?.find((c: any) => c.id === weeklyTimetableResponse.classId);

          console.log('[WEEKLY ENTRY] Resolved teacher:', teacher?.name, 'subject:', subject?.name);
          console.log('[WEEKLY ENTRY] Available teachers:', (teachers as any[])?.length, 'subjects:', (subjects as any[])?.length);

          // Check if this entry was actually modified (has isModified flag or is new)
          const isActuallyModified = weeklyEntry.isModified === true;

          // Find the corresponding global entry to compare
          const globalEntry = timetableData?.find((entry: TimetableEntry) => 
            entry.day.toLowerCase() === day.toLowerCase() && entry.period === period
          );

          // Use original global ID if this is an unmodified entry that exists in global timetable
          let entryId: string;
          if (!isActuallyModified && globalEntry) {
            entryId = globalEntry.id; // Keep original global ID for proper deletion
            console.log('[WEEKLY ENTRY] Using global ID for unmodified entry:', entryId);
          } else {
            entryId = `weekly-${weeklyEntry.day}-${weeklyEntry.period}`; // Use synthetic ID for modified/new entries
            console.log('[WEEKLY ENTRY] Using synthetic ID for modified entry:', entryId);
          }

          // Convert weekly entry to format expected by UI (add resolved relations)
          return {
            ...weeklyEntry,
            id: entryId,
            classId: weeklyTimetableResponse.classId,
            teacher: teacher || { id: weeklyEntry.teacherId, name: 'Unknown Teacher' },
            subject: subject || { id: weeklyEntry.subjectId, name: teacher ? 'Free Subject' : 'Unknown Subject' },
            class: classData || { id: weeklyTimetableResponse.classId }
          } as any;
        } else {
          console.log('[WEEKLY ENTRY] No weekly entry found for', day, period, '- showing Free Period (weekly table exists but no entry for this slot)');
          return null; // Weekly table exists, but no entry for this time slot = Free Period
        }
      }
    }

    // For weekly timetable section: if no weekly timetable exists in database, return null (NEVER show global data)
    console.log('[WEEKLY ENTRY] No weekly timetable found in database for this week - showing Free Period (weekly view should NEVER show global data)');
    return null;
  };

  const getGlobalTimetableEntry = (day: string, period: number): TimetableEntry | null => {

    if (!globalTimetableData || !Array.isArray(globalTimetableData)) return null;

    return globalTimetableData.find(entry => 
      entry.day.toLowerCase() === day.toLowerCase() && 
      entry.period === period
    ) || null;
  };


  // Handle Master Timetable export
  const handleGlobalExport = async (format: 'png' | 'excel' | 'png-students') => {
    if (isExportingGlobal) return;

    setIsExportingGlobal(true);
    try {
      if (format === 'png') {
        // Find the master expanded timetable element for better export quality
        const gridElement = document.querySelector('[data-export="master-expanded-timetable"]') as HTMLElement;
        if (!gridElement) {
          console.error('Master timetable grid element not found for export');
          return;
        }

        // Use html2canvas to capture the global timetable
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(gridElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        // Get class name for filename
        const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
        const className = selectedClassData?.section 
          ? `${selectedClassData.grade}-${selectedClassData.section}` 
          : selectedClassData?.grade || selectedClass;

        // Download the image
        const link = document.createElement('a');
        link.download = `global-timetable-${className}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } else if (format === 'png-students') {
        await exportGlobalAsPNGForStudents();
      } else if (format === 'excel') {
        // Excel export for global timetable
        const { utils, writeFile } = await import('xlsx');

        // Get class name for title and filename
        const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
        const className = selectedClassData?.section 
          ? `${selectedClassData.grade}-${selectedClassData.section}` 
          : selectedClassData?.grade || selectedClass;

        // Create worksheet data for global timetable
        const worksheetData = [
          [`Master Timetable - Class ${className}`], // Title row
          [], // Empty row for spacing
          ['', ...weekDays.map(day => day.name)], // Header row
          ...timeSlots.map(timeSlot => [
            `Period ${timeSlot.period} (${formatTime12Hour(timeSlot.startTime)} - ${formatTime12Hour(timeSlot.endTime)})`,
            ...weekDays.map(day => {
              const entry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);
              if (entry) {
                return viewMode === "class" ? 
                  `${entry.subject?.name || 'Unknown'} - ${entry.teacher?.name || 'Unknown Teacher'}` :
                  `${entry.subject?.name || 'Unknown'} - ${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`;
              }
              return 'Free Period';
            })
          ])
        ];

        const ws = utils.aoa_to_sheet(worksheetData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Master Timetable');

        writeFile(wb, `global-timetable-${className}.xlsx`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExportingGlobal(false);
    }
  };

  // Handle school-wide timetable export
  const handleSchoolWideExport = async (format: 'png' | 'excel') => {
    if (isExportingSchoolWide) return;

    setIsExportingSchoolWide(true);
    try {
      if (format === 'png') {
        await exportSchoolWideAsPNG();
      } else if (format === 'excel') {
        await exportSchoolWideAsExcel();
      }
    } catch (error) {
      console.error('School-wide export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExportingSchoolWide(false);
    }
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!timetableStructure?.timeSlots) return actualPeriod;

    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of timetableStructure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  // Trigger validation when teacher/subject selection changes
  const triggerValidation = async (teacherId: string, subjectId?: string) => {
    if (!assignmentCell || !selectedClass || !teacherId || isFreePeriod) {
      setValidationResult(null);
      setValidationError(null);
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    setValidationError(null);

    const weekStart = getWeekStart(effectiveDate);
    const validationData = {
      classId: selectedClass,
      teacherId: teacherId,
      subjectId: subjectId,
      day: assignmentCell.day,
      period: assignmentCell.period,
      weekStart: weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    };

    try {
      await validateAssignmentMutation.mutateAsync(validationData);
    } catch (error) {
      console.error('[VALIDATION] Validation failed:', error);
    }
  };

  const getSubjectColor = (color: string) => {
    // Convert hex color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    // Calculate luminance to determine if text should be dark or light
    const getLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    // Create light background and border colors
    const createLightColor = (r: number, g: number, b: number) => {
      // Create very light version for background (mix with white)
      const bgR = Math.round(r + (255 - r) * 0.9);
      const bgG = Math.round(g + (255 - g) * 0.9);
      const bgB = Math.round(b + (255 - b) * 0.9);

      // Create medium light version for border
      const borderR = Math.round(r + (255 - r) * 0.7);
      const borderG = Math.round(g + (255 - g) * 0.7);
      const borderB = Math.round(b + (255 - b) * 0.7);

      return {
        background: `rgb(${bgR}, ${bgG}, ${bgB})`,
        border: `rgb(${borderR}, ${borderG}, ${borderB})`,
        text: `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`
      };
    };

    const rgb = hexToRgb(color);
    if (!rgb) {
      return {
        backgroundImage: 'linear-gradient(to bottom right, #f9fafb, white)',
        borderColor: '#e5e7eb',
        color: '#1f2937',
        borderWidth: '0px',
        borderStyle: 'solid',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      };
    }

    const colors = createLightColor(rgb.r, rgb.g, rgb.b);

    return {
      backgroundImage: `linear-gradient(to bottom right, ${colors.background}, white)`,
      borderColor: colors.border,
      color: colors.text,
      borderWidth: '0px',
      borderStyle: 'solid',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    };
  };

  // Use structure data or fallback to defaults (memoized for stable hook dependencies)
  // CRITICAL: These useMemo hooks must be called BEFORE any early returns to maintain hook order
  const workingDays = useMemo(() => {
    return timetableStructure?.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  }, [timetableStructure?.workingDays]);

  const timeSlots = useMemo(() => {
    return timetableStructure?.timeSlots || [
      { period: 1, startTime: "08:00", endTime: "08:45" },
      { period: 2, startTime: "08:45", endTime: "09:30" },
      { period: 3, startTime: "09:30", endTime: "10:15" },
      { period: 4, startTime: "10:15", endTime: "11:00" },
      { period: 5, startTime: "11:15", endTime: "12:00" },
      { period: 6, startTime: "12:00", endTime: "12:45" },
      { period: 7, startTime: "12:45", endTime: "13:30" },
      { period: 8, startTime: "13:30", endTime: "14:15" },
    ];
  }, [timetableStructure?.timeSlots]);

  const sortedDays = useMemo(() => sortWorkingDays(workingDays), [workingDays]);

  // Calculate week containing effective date (memoized)
  const weekStart = useMemo(() => getWeekStart(effectiveDate), [effectiveDate]);
  const weekEnd = useMemo(() => getWeekEnd(effectiveDate), [effectiveDate]);

  // Generate days of the week with dates (memoized)
  const weekDays = useMemo(() => {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      weekDays.push({ 
        name: dayName, 
        shortName: dayName.substring(0, 3),
        date: shortDate,
        fullDate: date,
        isWorkingDay: sortedDays.includes(dayName.toLowerCase())
      });
    }
    return weekDays.filter(day => day.isWorkingDay); // Only show working days
  }, [weekStart, sortedDays]);


  // Helper function to check if a date is a working day
  const isWorkingDay = (date: Date): boolean => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return workingDays.includes(dayName);
  };

  // Helper function to get the next working day from a given date
  const getNextWorkingDay = (startDate: Date): Date => {
    const date = new Date(startDate);
    while (!isWorkingDay(date)) {
      date.setDate(date.getDate() + 1);
      // Prevent infinite loop - stop after checking 14 days
      if (date.getTime() - startDate.getTime() > 14 * 24 * 60 * 60 * 1000) {
        return startDate;
      }
    }
    return date;
  };





  // Change detection logic for comparing weekly vs global timetables (simplified)
  const compareSchedules = useMemo(() => {
    // Always return zero changes since we removed visual indicators
    return { changesCount: 0, changes: [] };
  }, [selectedClass, globalTimetableData]);

  if (classesLoading || teachersLoading || structureLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Sort options alphabetically and prepare display format
  const classesArray = (classes || []) as any[];
  const teachersArray = (teachers || []) as any[];

  const selectOptions = classesArray.slice().sort((a: any, b: any) => {
    const aDisplay = a.section ? `${a.grade}-${a.section}` : a.grade;
    const bDisplay = b.section ? `${b.grade}-${b.section}` : b.grade;
    return aDisplay.localeCompare(bDisplay, undefined, { numeric: true, sensitivity: 'base' });
  });


  // Check if a date is today or in the future (allow editing)
  const canEditDate = (dayDate: Date): boolean => {
    const today = new Date(getCurrentDateIST() + 'T00:00:00+05:30');
    today.setUTCHours(0, 0, 0, 0); // Set to start of today for comparison

    const compareDate = new Date(dayDate);
    compareDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

    return compareDate >= today; // Allow editing for today and future dates
  };

  // Show refresh confirmation dialog
  const showRefreshConfirmation = () => {
    setIsRefreshConfirmDialogOpen(true);
  };

  // Confirm and execute refresh
  const confirmRefreshTable = () => {
    setIsRefreshConfirmDialogOpen(false);
    executeRefreshTable();
  };


  // Handle refresh table functionality
  const executeRefreshTable = async () => {
    setIsRefreshing(true);

    try {
      // Check for changes in class-subject assignments and regenerate if needed
      if (selectedClass && viewMode === 'class') {
        // Get current timetable data
        const currentTimetable = queryClient.getQueryData(["/api/timetable/detailed", selectedClass, viewMode]) as any[];

        // Get current class-subject assignments
        try {
          const assignmentsResponse = await apiRequest("GET", `/api/class-subject-assignments?classId=${selectedClass}`);
          const currentAssignments = await assignmentsResponse.json();

          console.log(`[REFRESH] Checking for changes in class ${selectedClass}...`);
          console.log(`[REFRESH] Current assignments:`, currentAssignments);
          console.log(`[REFRESH] Current timetable entries:`, currentTimetable?.length || 0);

          // Check if timetable needs regeneration
          let needsRegeneration = false;
          let regenerationReason = '';

          // If no timetable entries exist, automatically generate one
          if (!currentTimetable || currentTimetable.length === 0) {
            needsRegeneration = true;
            regenerationReason = 'No timetable found';
          } else {
            // Compare current assignments with timetable entries
            const timetableSubjects = new Map<string, { count: number, teachers: Set<string> }>();

            // Count subjects and teachers in current timetable
            currentTimetable.forEach((entry: any) => {
              const subjectId = entry.subjectId;
              if (!timetableSubjects.has(subjectId)) {
                timetableSubjects.set(subjectId, { count: 0, teachers: new Set() });
              }
              const subjectData = timetableSubjects.get(subjectId)!;
              subjectData.count++;
              subjectData.teachers.add(entry.teacherId);
            });

            // Check each assignment for mismatches
            for (const assignment of currentAssignments) {
              const subjectId = assignment.subjectId;
              const expectedCount = assignment.weeklyFrequency;
              const assignedTeacherId = assignment.assignedTeacherId;

              const timetableData = timetableSubjects.get(subjectId);

              // Check if subject is missing from timetable
              if (!timetableData) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} missing from timetable`;
                break;
              }

              // Check if period count doesn't match
              if (timetableData.count !== expectedCount) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} has ${timetableData.count} periods but needs ${expectedCount}`;
                break;
              }

              // Check if assigned teacher doesn't match
              if (assignedTeacherId && !timetableData.teachers.has(assignedTeacherId)) {
                needsRegeneration = true;
                regenerationReason = `Subject ${assignment.subject.name} assigned to wrong teacher`;
                break;
              }
            }

            // Check for extra subjects in timetable not in assignments
            for (const subjectId of Array.from(timetableSubjects.keys())) {
              const hasAssignment = currentAssignments.some((a: any) => a.subjectId === subjectId);
              if (!hasAssignment) {
                needsRegeneration = true;
                regenerationReason = `Timetable contains subject not in current assignments`;
                break;
              }
            }
          }

          // If no changes detected, still reshuffle for fresh arrangement
          if (!needsRegeneration) {
            console.log(`[REFRESH] No changes detected, but reshuffling timetable as requested`);
            needsRegeneration = true;
            regenerationReason = 'Reshuffling timetable for fresh arrangement';
          }

          // Always regenerate timetable (either due to changes or for reshuffling)
          console.log(`[REFRESH] ${regenerationReason}, regenerating timetable...`);
          setIsGenerating(true);

          try {
            const response = await apiRequest("POST", "/api/timetable/generate", { classId: selectedClass });
            const result = await response.json();

            if (result.success) {
              console.log(`[REFRESH] Timetable regenerated successfully: ${result.message}`);
              // Show success toast notification
              toast({
                title: "Success",
                description: result.message,
              });
            } else {
              console.warn(`[REFRESH] Regeneration failed: ${result.message}`);
              // Show failure toast notification
              toast({
                title: "Generation Failed",
                description: result.message,
                variant: "destructive",
              });
              // Continue with normal refresh even if generation fails
            }
          } catch (genError) {
            console.error('[REFRESH] Error regenerating timetable:', genError);
            // Show error toast notification
            toast({
              title: "Error",
              description: "Failed to generate timetable. Please try again.",
              variant: "destructive",
            });
            // Continue with normal refresh even if generation fails
          } finally {
            setIsGenerating(false);
          }

        } catch (assignmentError) {
          console.error('[REFRESH] Error fetching assignments, proceeding with normal refresh:', assignmentError);
          // Continue with normal refresh if assignment check fails
        }
      }

      // Invalidate and refetch all timetable-related queries
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/detailed", selectedClass],
        exact: false 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable/global", selectedClass],
        exact: false 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-structure"],
        exact: false 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/timetable-changes/active"],
        exact: false 
      });

      // Force refetch to ensure data is refreshed
      await queryClient.refetchQueries({ 
        queryKey: ["/api/timetable/detailed", selectedClass],
        exact: false 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/timetable/global", selectedClass],
        exact: false 
      });

      // Show success feedback
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000); // Keep spinner for at least 1 second for visual feedback

    } catch (error) {
      console.error('Error refreshing timetable:', error);
      setIsRefreshing(false);
    }
  };


  // Set as Master Timetable functionality
  const showSetAsGlobalConfirmation = () => {
    setIsSetAsGlobalDialogOpen(true);
  };

  const confirmSetAsGlobal = () => {
    setIsSetAsGlobalDialogOpen(false);
    executeSetAsGlobal();
  };

  const executeSetAsGlobal = async () => {
    if (!selectedClass) {
      alert('Please select a class first');
      return;
    }

    setIsSettingAsGlobal(true);

    try {
      const response = await apiRequest("POST", "/api/timetable/set-as-global", {
        classId: selectedClass,
        date: effectiveDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      });

      const result = await response.json();

      if (result.success) {
        // Invalidate and refetch all related queries to show updated data
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/detailed"],
          exact: false 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable-changes/active"],
          exact: false 
        });

        // Force refetch to ensure data is refreshed
        await queryClient.refetchQueries({ 
          queryKey: ["/api/timetable/detailed", selectedClass],
          exact: false 
        });

        console.log(`[SET_AS_GLOBAL] Successfully promoted weekly changes to global timetable. ${result.entriesUpdated} entries updated.`);

        // Show success feedback
        setTimeout(() => {
          setIsSettingAsGlobal(false);
        }, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error setting as global timetable:', error);
      alert('Failed to promote changes to global timetable. Please try again.');
      setIsSettingAsGlobal(false);
    }
  };

  // Sync with Master Timetable functionality
  const showCopyFromGlobalConfirmation = () => {
    console.log("[COPY_FROM_GLOBAL] Button clicked - opening confirmation dialog");
    console.log("[COPY_FROM_GLOBAL] Current states:", {
      selectedClass,
      isCopyingFromGlobal,
      isSettingAsGlobal,
      isGenerating,
      timetableLoading
    });
    setIsCopyFromGlobalDialogOpen(true);
  };

  const confirmCopyFromGlobal = () => {
    setIsCopyFromGlobalDialogOpen(false);
    executeCopyFromGlobal();
  };

  const executeCopyFromGlobal = async () => {
    if (!selectedClass) {
      alert('Please select a class first');
      return;
    }

    // Get the actual week dates from the current weekly timetable being displayed
    const currentWeekStart = weeklyTimetableResponse?.data?.weekStart || weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    setIsCopyingFromGlobal(true);

    try {
      const response = await apiRequest("POST", "/api/timetable/copy-from-global", {
        classId: selectedClass,
        date: currentWeekStart
      });

      const result = await response.json();

      if (result.success) {
        // Invalidate and refetch all related queries to show updated data
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/weekly"],
          exact: false 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/timetable/detailed"],
          exact: false 
        });

        // Force refetch to ensure data is refreshed
        await queryClient.refetchQueries({ 
          queryKey: ["/api/timetable/weekly", selectedClass, currentWeekStart],
          exact: false 
        });

        console.log(`[COPY_FROM_GLOBAL] Successfully copied global timetable to weekly schedule. ${result.entriesCopied} entries copied.`);

        // Show clear success toast message with week information
        // Parse date in timezone-safe manner (treat as UTC to avoid off-by-one issues)
        const weekStartDate = new Date(currentWeekStart + 'T00:00:00Z');
        const weekStartFormatted = weekStartDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          timeZone: 'UTC'
        });
        
        toast({
          title: "Master Timetable Synced Successfully",
          description: `Master timetable has been synced to weekly timetable starting ${weekStartFormatted}`,
          duration: 4000,
        });

        // Show success feedback
        setTimeout(() => {
          setIsCopyingFromGlobal(false);
        }, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error copying from global timetable:', error);
      
      toast({
        title: "Copy Failed",
        description: "Failed to copy master timetable. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
      
      setIsCopyingFromGlobal(false);
    }
  };


  // Handle export functionality
  const handleExport = async (format: 'png' | 'excel' | 'png-students') => {
    if (!selectedClass) {
      alert('Please select a class or teacher to export their timetable');
      return;
    }

    setIsExporting(true);

    try {
      if (format === 'png') {
        await exportAsPNG();
      } else if (format === 'png-students') {
        await exportAsPNGForStudents();
      } else if (format === 'excel') {
        await exportAsExcel();
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle weekly timetable export functionality
  const handleWeeklyExport = async () => {
    if (!selectedClass) {
      alert('Please select a class to export the weekly timetable');
      return;
    }

    setIsExportingWeekly(true);

    try {
      // Export both PNG and Excel simultaneously
      await Promise.all([
        exportWeeklyAsPNG(),
        exportWeeklyAsExcel()
      ]);
      
      toast({
        title: "Export Successful",
        description: "Weekly timetable exported as both PNG and Excel files",
      });
    } catch (error) {
      console.error('Weekly export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export weekly timetable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingWeekly(false);
    }
  };

  // Export timetable as PNG
  const exportAsPNG = async () => {
    const timetableElement = document.querySelector('[data-export="timetable-grid"]') as HTMLElement;

    if (!timetableElement) {
      alert('Timetable grid not found for export');
      return;
    }

    // Add CSS for better export formatting
    const exportStyle = document.createElement('style');
    exportStyle.id = 'export-formatting-style';
    exportStyle.textContent = `
      [data-export="timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="timetable-grid"] .text-sm,
      [data-export="timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
    `;
    document.head.appendChild(exportStyle);

    try {
      const canvas = await html2canvas(timetableElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: timetableElement.scrollWidth,
        height: timetableElement.scrollHeight,
      });

      // Get selected entity name for filename
      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);

      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      // Create download link
      const link = document.createElement('a');
      link.download = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('export-formatting-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export timetable as PNG for Students (without teacher names)
  const exportAsPNGForStudents = async () => {
    const timetableElement = document.querySelector('[data-export="timetable-grid"]') as HTMLElement;

    if (!timetableElement) {
      alert('Timetable grid not found for export');
      return;
    }

    // Add CSS for better export formatting and hide teacher names
    const style = document.createElement('style');
    style.id = 'student-export-style';
    style.textContent = `
      [data-export="timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="timetable-grid"] .text-sm,
      [data-export="timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
      [data-export="timetable-grid"] .text-xs.opacity-90.leading-tight,
      [data-export="timetable-grid"] .text-xs.opacity-75.leading-tight {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    try {
      const canvas = await html2canvas(timetableElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: timetableElement.scrollWidth,
        height: timetableElement.scrollHeight,
      });

      // Get selected entity name for filename
      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);

      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      // Create download link
      const link = document.createElement('a');
      link.download = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}-students.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Student export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('student-export-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export Global timetable as PNG for Students (without teacher names)
  const exportGlobalAsPNGForStudents = async () => {
    const gridElement = document.querySelector('[data-export="global-timetable-grid"]') as HTMLElement;
    if (!gridElement) {
      console.error('Global timetable grid element not found for export');
      return;
    }

    // Add CSS for better export formatting and hide teacher names
    const style = document.createElement('style');
    style.id = 'student-export-style-global';
    style.textContent = `
      [data-export="global-timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="global-timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="global-timetable-grid"] .text-sm,
      [data-export="global-timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="global-timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="global-timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
      [data-export="global-timetable-grid"] .text-xs.opacity-90:not(.font-semibold) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    try {
      // Use html2canvas to capture the global timetable
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Get class name for filename
      const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
      const className = selectedClassData?.section 
        ? `${selectedClassData.grade}-${selectedClassData.section}` 
        : selectedClassData?.grade || selectedClass;

      // Download the image
      const link = document.createElement('a');
      link.download = `global-timetable-${className}-students.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Global student export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('student-export-style-global');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export timetable as Excel
  const exportAsExcel = async () => {
    if (!timetableData || timetableData.length === 0) {
      alert('No timetable data to export');
      return;
    }

    // Get selected entity name for filename
    const selectedEntity = viewMode === 'class' 
      ? (classes as any[])?.find(c => c.id === selectedClass) 
      : (teachers as any[])?.find(t => t.id === selectedClass);

    const entityName = viewMode === 'class' 
      ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
      : selectedEntity?.name;

    // Prepare data for Excel
    const workbook = XLSX.utils.book_new();

    // Create timetable sheet
    const timetableSheet: any[][] = [];

    // Add title row with class/teacher name
    const titleText = viewMode === 'class' 
      ? `Class ${entityName} - Weekly Timetable`
      : `${entityName} - Weekly Timetable`;
    timetableSheet.push([titleText]);
    timetableSheet.push([]); // Empty row for spacing

    // Add header row
    const headerRow = ['Time', ...weekDays.map(day => day.name)];
    timetableSheet.push(headerRow);

    // Add time slots and data
    if (timetableStructure?.timeSlots) {
      timetableStructure.timeSlots.forEach((timeSlot: any) => {
        const row = [timeSlot.displayTime];

        weekDays.forEach(day => {
          const entry = timetableData.find((entry: any) => 
            entry.day === day.name.toLowerCase() && 
            entry.period === timeSlot.period
          );

          let cellValue = '';
          if (entry) {
            if (viewMode === 'class') {
              cellValue = `${entry.teacher?.name || 'Unknown Teacher'}\n${entry.subject?.name || (entry.teacher?.name ? 'Free Subject' : 'Unknown Subject')}`;
            } else {
              cellValue = `${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}\n${entry.subject?.name || (entry.teacher?.name ? 'Free Subject' : 'Unknown Subject')}`;
            }
          }
          row.push(cellValue);
        });

        timetableSheet.push(row);
      });
    }

    // Add worksheet to workbook
    const ws = XLSX.utils.aoa_to_sheet(timetableSheet);

    // Set column widths
    const colWidths = [{ width: 15 }, ...weekDays.map(() => ({ width: 20 }))];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Timetable');

    // Save file
    const filename = `timetable-${viewMode}-${entityName}-${format(selectedDate, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export expanded view as PNG
  const exportExpandedAsPNG = async () => {
    setIsExportingExpanded(true);
    try {
      const expandedTable = document.querySelector('[data-export="timetable-grid"]') as HTMLElement;
      if (!expandedTable) {
        toast({
          title: "Export Failed",
          description: "Could not find timetable to export",
          variant: "destructive"
        });
        return;
      }

      const canvas = await html2canvas(expandedTable, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);

      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      const link = document.createElement('a');
      link.download = `timetable-${entityName}-${selectedWeekOffset === 0 ? 'current' : 'next'}-week.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "Export Successful",
        description: "Timetable exported as PNG",
      });
    } catch (error) {
      console.error('PNG export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as PNG",
        variant: "destructive"
      });
    } finally {
      setIsExportingExpanded(false);
    }
  };

  // Export expanded view as Excel
  const exportExpandedAsExcel = async () => {
    setIsExportingExpanded(true);
    try {
      const selectedEntity = viewMode === 'class' 
        ? (classes as any[])?.find(c => c.id === selectedClass) 
        : (teachers as any[])?.find(t => t.id === selectedClass);

      const entityName = viewMode === 'class' 
        ? (selectedEntity?.section ? `${selectedEntity.grade}-${selectedEntity.section}` : selectedEntity?.grade)
        : selectedEntity?.name;

      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];

      // Add title
      worksheetData.push([`${entityName} - ${selectedWeekOffset === 0 ? 'Current' : 'Next'} Week Timetable`]);
      worksheetData.push([]);

      // Add headers
      const headerRow = ['Time', ...weekDays.map(day => `${day.name}\n${day.date}`)];
      worksheetData.push(headerRow);

      // Add data
      timeSlots.forEach((timeSlot: TimeSlot) => {
        if (timeSlot.isBreak) {
          const row = [`Break\n${formatTime12Hour(timeSlot.startTime)}-${formatTime12Hour(timeSlot.endTime)}`, ...weekDays.map(() => 'Break')];
          worksheetData.push(row);
        } else {
          const row = [`P${getTeachingPeriodNumber(timeSlot.period)}\n${formatTime12Hour(timeSlot.startTime)}-${formatTime12Hour(timeSlot.endTime)}`];
          
          weekDays.forEach(day => {
            const entry = getTimetableEntry(day.name, timeSlot.period);
            const cellValue = entry 
              ? `${entry.subject?.name || 'Unknown'}\n${entry.teacher?.name || ''}`
              : '-';
            row.push(cellValue);
          });
          
          worksheetData.push(row);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const colWidths = [{ width: 20 }, ...weekDays.map(() => ({ width: 18 }))];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, ws, 'Timetable');
      XLSX.writeFile(workbook, `timetable-${entityName}-${selectedWeekOffset === 0 ? 'current' : 'next'}-week.xlsx`);

      toast({
        title: "Export Successful",
        description: "Timetable exported as Excel",
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as Excel",
        variant: "destructive"
      });
    } finally {
      setIsExportingExpanded(false);
    }
  };

  // Export master timetable expanded view as PNG
  const exportMasterExpandedAsPNG = async () => {
    setIsExportingMasterExpanded(true);
    try {
      const expandedTable = document.querySelector('[data-export="global-timetable-grid"]') as HTMLElement;
      if (!expandedTable) {
        toast({
          title: "Export Failed",
          description: "Could not find timetable to export",
          variant: "destructive"
        });
        return;
      }

      const canvas = await html2canvas(expandedTable, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
      const className = selectedClassData?.section 
        ? `${selectedClassData.grade}-${selectedClassData.section}` 
        : selectedClassData?.grade || selectedClass;

      const link = document.createElement('a');
      link.download = `master-timetable-${className}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "Export Successful",
        description: "Master timetable exported as PNG",
      });
    } catch (error) {
      console.error('PNG export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as PNG",
        variant: "destructive"
      });
    } finally {
      setIsExportingMasterExpanded(false);
    }
  };

  // Export master timetable expanded view as Excel
  const exportMasterExpandedAsExcel = async () => {
    setIsExportingMasterExpanded(true);
    try {
      const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
      const className = selectedClassData?.section 
        ? `${selectedClassData.grade}-${selectedClassData.section}` 
        : selectedClassData?.grade || selectedClass;

      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];

      // Add title
      worksheetData.push([`Master Timetable - Class ${className}`]);
      worksheetData.push([]);

      // Add headers
      const headerRow = ['Time', ...weekDays.map(day => `${day.name}\n${day.date}`)];
      worksheetData.push(headerRow);

      // Add data
      timeSlots.forEach((timeSlot: TimeSlot) => {
        const row = [`P${timeSlot.period}\n${formatTime12Hour(timeSlot.startTime)}-${formatTime12Hour(timeSlot.endTime)}`];
        
        weekDays.forEach(day => {
          const entry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);
          const cellValue = entry 
            ? `${entry.subject?.name || 'Unknown'}\n${entry.teacher?.name || ''}`
            : 'Free';
          row.push(cellValue);
        });
        
        worksheetData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const colWidths = [{ width: 20 }, ...weekDays.map(() => ({ width: 18 }))];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, ws, 'Master Timetable');
      XLSX.writeFile(workbook, `master-timetable-${className}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Master timetable exported as Excel",
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as Excel",
        variant: "destructive"
      });
    } finally {
      setIsExportingMasterExpanded(false);
    }
  };

  // Export school-wide timetable expanded view as PNG
  const exportSchoolWideExpandedAsPNG = async () => {
    setIsExportingSchoolWideExpanded(true);
    try {
      const expandedTable = document.querySelector('[data-export="school-wide-timetable"]') as HTMLElement;
      if (!expandedTable) {
        toast({
          title: "Export Failed",
          description: "Could not find timetable to export",
          variant: "destructive"
        });
        return;
      }

      const canvas = await html2canvas(expandedTable, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `school-wide-timetable-${selectedSchoolDate}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "Export Successful",
        description: "School-wide timetable exported as PNG",
      });
    } catch (error) {
      console.error('PNG export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as PNG",
        variant: "destructive"
      });
    } finally {
      setIsExportingSchoolWideExpanded(false);
    }
  };

  // Export school-wide timetable expanded view as Excel
  const exportSchoolWideExpandedAsExcel = async () => {
    setIsExportingSchoolWideExpanded(true);
    try {
      if (!processedSchoolWideData) {
        toast({
          title: "Export Failed",
          description: "No timetable data available",
          variant: "destructive"
        });
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];

      // Add title
      worksheetData.push([`School-wide Timetable - ${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}`]);
      worksheetData.push([]);

      // Add headers (Class + Periods)
      const headerRow = ['Class', ...processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
        const periodNumber = processedSchoolWideData.timeSlotRows
          .slice(0, index + 1)
          .filter((ts: any) => !ts.isBreak)
          .length;
        
        const displayTime = timeSlot.isBreak 
          ? 'Break' 
          : `Period ${periodNumber}`;
        return `${displayTime}\n${formatTime12Hour(timeSlot.startTime)}-${formatTime12Hour(timeSlot.endTime)}`;
      })];
      worksheetData.push(headerRow);

      // Add data rows
      processedSchoolWideData.classColumns.forEach((classCol: any) => {
        const row = [classCol.className];
        
        processedSchoolWideData.timeSlotRows.forEach((timeSlot: any) => {
          const entry = classCol.dayEntries.find((e: any) => e.period === timeSlot.period);
          const cellValue = entry 
            ? `${entry.subject?.name || 'Unknown'}\n${entry.teacher?.name || ''}`
            : timeSlot.isBreak ? 'Break' : '-';
          row.push(cellValue);
        });
        
        worksheetData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const colWidths = [{ width: 20 }, ...processedSchoolWideData.timeSlotRows.map(() => ({ width: 18 }))];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, ws, 'School-wide Timetable');
      XLSX.writeFile(workbook, `school-wide-timetable-${selectedSchoolDate}.xlsx`);

      toast({
        title: "Export Successful",
        description: "School-wide timetable exported as Excel",
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export timetable as Excel",
        variant: "destructive"
      });
    } finally {
      setIsExportingSchoolWideExpanded(false);
    }
  };

  // Export weekly timetable as PNG
  const exportWeeklyAsPNG = async () => {
    // Target the expanded view for better export quality
    const timetableElement = document.querySelector('[data-export="expanded-timetable"]') as HTMLElement;

    if (!timetableElement) {
      alert('Weekly timetable grid not found for export');
      return;
    }

    // Add CSS for better export formatting
    const exportStyle = document.createElement('style');
    exportStyle.id = 'weekly-export-formatting-style';
    exportStyle.textContent = `
      [data-export="timetable-grid"] {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        border-collapse: separate !important;
        border-spacing: 1px !important;
      }
      [data-export="timetable-grid"] .grid > div {
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      [data-export="timetable-grid"] .text-sm,
      [data-export="timetable-grid"] .text-xs {
        line-height: 1.2 !important;
      }
      [data-export="timetable-grid"] .font-semibold {
        font-weight: 600 !important;
      }
      [data-export="timetable-grid"] .opacity-90 {
        opacity: 0.9 !important;
      }
    `;
    document.head.appendChild(exportStyle);

    try {
      const canvas = await html2canvas(timetableElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 2,
        width: timetableElement.scrollWidth,
        height: timetableElement.scrollHeight,
      });

      // Get selected class name for filename
      const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
      const className = selectedClassData?.section 
        ? `${selectedClassData.grade}-${selectedClassData.section}` 
        : selectedClassData?.grade || selectedClass;

      // Create download link with weekly identifier
      const weekStart = getWeekStart(effectiveDate);
      const weekStartFormatted = format(weekStart, 'yyyy-MM-dd');
      const link = document.createElement('a');
      link.download = `weekly-timetable-${className}-${weekStartFormatted}.png`;
      link.href = canvas.toDataURL();
      link.click();

    } catch (error) {
      console.error('Weekly PNG export failed:', error);
      throw error;
    } finally {
      // Remove the temporary style
      const styleElement = document.getElementById('weekly-export-formatting-style');
      if (styleElement) {
        styleElement.remove();
      }
    }
  };

  // Export weekly timetable as Excel
  const exportWeeklyAsExcel = async () => {
    if (!weeklyTimetableResponse?.weeklyEntries || weeklyTimetableResponse.weeklyEntries.length === 0) {
      // Try fallback to timetableData if weekly data not available
      if (!timetableData || timetableData.length === 0) {
        alert('No weekly timetable data to export');
        return;
      }
    }

    // Get selected class name for filename
    const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
    const className = selectedClassData?.section 
      ? `${selectedClassData.grade}-${selectedClassData.section}` 
      : selectedClassData?.grade || selectedClass;

    // Prepare data for Excel
    const workbook = XLSX.utils.book_new();

    // Create timetable sheet
    const timetableSheet: any[][] = [];

    // Add title row with class name and week range
    const weekStart = getWeekStart(effectiveDate);
    const weekEnd = getWeekEnd(effectiveDate);
    const titleText = `Class ${className} - Weekly Timetable (${formatWeekRange(weekStart, weekEnd)})`;
    timetableSheet.push([titleText]);
    timetableSheet.push([]); // Empty row for spacing

    // Add header row
    const headerRow = ['Time', ...weekDays.map(day => day.name)];
    timetableSheet.push(headerRow);

    // Use weekly data if available, otherwise fall back to timetableData
    const dataToExport = weeklyTimetableResponse?.weeklyEntries || timetableData;

    // Add time slots and data
    if (timetableStructure?.timeSlots) {
      timetableStructure.timeSlots.forEach((timeSlot: any) => {
        const row = [timeSlot.displayTime];

        weekDays.forEach(day => {
          const entry = dataToExport.find((entry: any) => 
            entry.day === day.name.toLowerCase() && 
            entry.period === timeSlot.period
          );

          let cellValue = '';
          if (entry) {
            cellValue = `${entry.teacher?.name || 'Unknown Teacher'}\n${entry.subject?.name || (entry.teacher?.name ? 'Free Subject' : 'Unknown Subject')}`;
          }
          row.push(cellValue);
        });

        timetableSheet.push(row);
      });
    }

    // Add worksheet to workbook
    const ws = XLSX.utils.aoa_to_sheet(timetableSheet);

    // Set column widths
    const colWidths = [{ width: 15 }, ...weekDays.map(() => ({ width: 20 }))];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Weekly Timetable');

    // Save file
    const weekStartFormatted = format(weekStart, 'yyyy-MM-dd');
    const filename = `weekly-timetable-${className}-${weekStartFormatted}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export school-wide timetable as PNG
  const exportSchoolWideAsPNG = async () => {
    // Target the expanded view for better export quality
    const element = document.querySelector('[data-export="school-wide-expanded-timetable"]') as HTMLElement;
    if (!element) {
      alert('School-wide timetable not found for export');
      return;
    }

    // Store references for cleanup
    const originalStyles: { 
      element: HTMLElement; 
      backgroundColor: string; 
      color: string;
      padding: string;
      borderRadius: string;
      fontSize: string;
      fontWeight: string;
      boxSizing: string;
      display: string;
      textAlign: string;
    }[] = [];
    const cellOriginalStyles: { element: HTMLElement; minHeight: string; height: string; }[] = [];
    const originalDisplay: string[] = [];
    const exportButtons = element.querySelectorAll('.fa-download, [role="button"]');

    try {
      const html2canvas = (await import('html2canvas')).default;

      // Pre-process: Apply inline styles to subject boxes to ensure they render
      const subjectBoxes = element.querySelectorAll('.rounded.px-2.py-1.text-xs.font-medium.text-white.shadow-sm');
      
      subjectBoxes.forEach((box) => {
        const htmlElement = box as HTMLElement;
        const computedStyle = window.getComputedStyle(htmlElement);
        
        // Store original styles
        originalStyles.push({
          element: htmlElement,
          backgroundColor: htmlElement.style.backgroundColor,
          color: htmlElement.style.color,
          padding: htmlElement.style.padding,
          borderRadius: htmlElement.style.borderRadius,
          fontSize: htmlElement.style.fontSize,
          fontWeight: htmlElement.style.fontWeight,
          boxSizing: htmlElement.style.boxSizing,
          display: htmlElement.style.display,
          textAlign: htmlElement.style.textAlign
        });
        
        // Apply computed styles as inline styles for better rendering
        htmlElement.style.backgroundColor = computedStyle.backgroundColor;
        htmlElement.style.color = computedStyle.color;
        htmlElement.style.padding = computedStyle.padding;
        htmlElement.style.borderRadius = computedStyle.borderRadius;
        htmlElement.style.fontSize = computedStyle.fontSize;
        htmlElement.style.fontWeight = computedStyle.fontWeight;
        htmlElement.style.boxSizing = computedStyle.boxSizing;
        htmlElement.style.display = computedStyle.display;
        htmlElement.style.textAlign = computedStyle.textAlign;
      });

      // Apply better cell styling for export to prevent text cutoff
      const cells = element.querySelectorAll('td');
      
      cells.forEach((cell) => {
        const htmlCell = cell as HTMLElement;
        cellOriginalStyles.push({
          element: htmlCell,
          minHeight: htmlCell.style.minHeight,
          height: htmlCell.style.height
        });
        
        // Ensure cells have adequate height for text wrapping
        htmlCell.style.minHeight = '50px';
        htmlCell.style.height = 'auto';
      });

      // Temporarily hide the export button during capture
      exportButtons.forEach((btn, index) => {
        const parent = btn.closest('button, .dropdown');
        if (parent) {
          originalDisplay[index] = (parent as HTMLElement).style.display;
          (parent as HTMLElement).style.display = 'none';
        }
      });

      // Capture the canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        foreignObjectRendering: false,
        removeContainer: false,
        imageTimeout: 10000,
        width: element.scrollWidth,
        height: element.scrollHeight
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `school-wide-timetable-${selectedSchoolDate}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('PNG export failed. Please try again.');
    } finally {
      // Always restore styles, even if export fails
      
      // Restore the export button visibility
      exportButtons.forEach((btn, index) => {
        const parent = btn.closest('button, .dropdown');
        if (parent) {
          (parent as HTMLElement).style.display = originalDisplay[index] || '';
        }
      });

      // Restore original inline styles
      originalStyles.forEach(({ 
        element, 
        backgroundColor, 
        color, 
        padding, 
        borderRadius, 
        fontSize, 
        fontWeight, 
        boxSizing, 
        display, 
        textAlign 
      }) => {
        element.style.backgroundColor = backgroundColor;
        element.style.color = color;
        element.style.padding = padding;
        element.style.borderRadius = borderRadius;
        element.style.fontSize = fontSize;
        element.style.fontWeight = fontWeight;
        element.style.boxSizing = boxSizing;
        element.style.display = display;
        element.style.textAlign = textAlign;
      });

      // Restore original cell styles
      cellOriginalStyles.forEach(({ element, minHeight, height }) => {
        element.style.minHeight = minHeight;
        element.style.height = height;
      });
    }
  };

  // Export school-wide timetable as Excel
  const exportSchoolWideAsExcel = async () => {
    try {
      if (!processedSchoolWideData) {
        alert('No school-wide timetable data available for export');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];

      // Add title
      worksheetData.push([`School-wide Timetable - ${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}`]);
      worksheetData.push([]); // Empty row

      // Add header row (transposed: Class + Periods)
      const headerRow = ['Class', ...processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
        // Calculate actual period number by counting only non-break periods up to this index
        const periodNumber = processedSchoolWideData.timeSlotRows
          .slice(0, index + 1)
          .filter((ts: any) => !ts.isBreak)
          .length;
        
        const displayTime = timeSlot.isBreak 
          ? 'Break' 
          : `Period ${periodNumber}`;
        const timeRange = `${formatTime12Hour(timeSlot.startTime)} - ${formatTime12Hour(timeSlot.endTime)}`;
        return `${displayTime}\n${timeRange}`;
      })];
      worksheetData.push(headerRow);

      // Add data rows (transposed: one row per class)
      processedSchoolWideData.classColumns.forEach((classColumn: any) => {
        const row = [classColumn.className];
        
        processedSchoolWideData.timeSlotRows.forEach((timeSlot: any) => {
          let cellValue = '';
          
          if (timeSlot.isBreak) {
            cellValue = 'Break';
          } else {
            // Find entry for this class and period (like in the rendering)
            const entry = classColumn.dayEntries.find((e: any) => e.period === timeSlot.period);
            if (entry) {
              cellValue = `${entry.subject?.name || 'Unknown Subject'}\n${entry.teacher?.name || 'Unknown Teacher'}`;
              if (entry.room) {
                cellValue += `\nRoom: ${entry.room}`;
              }
            } else {
              cellValue = 'Free';
            }
          }
          
          row.push(cellValue);
        });
        
        worksheetData.push(row);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths (transposed: class column + period columns)
      const colWidths = [{ width: 20 }, ...processedSchoolWideData.timeSlotRows.map(() => ({ width: 25 }))];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, ws, 'School-wide Timetable');

      // Save file
      const filename = `school-wide-timetable-${selectedSchoolDate}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Excel export failed. Please try again.');
    }
  };

  // Component ready

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-1 border-b border-border">
        {/* Professional Tab Navigation with Generate Button */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-2 sm:pb-0" aria-label="Timetable Navigation">
              <button
              onClick={() => {
                setTimetableViewMode("school");
                setSelectedClass(""); // Clear selected class when switching to school-wide view
              }}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                timetableViewMode === "school"
                  ? "border-blue-500 text-blue-600 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              School-wide Timetable
            </button>
            <button
              onClick={() => setTimetableViewMode("class")}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                timetableViewMode === "class"
                  ? "border-blue-500 text-blue-600 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Class Timetable
            </button>
            <button
              onClick={() => setTimetableViewMode("master")}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                timetableViewMode === "master"
                  ? "border-blue-500 text-blue-600 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Master Schedule
            </button>
            <button
              onClick={() => setTimetableViewMode("substitutions")}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                timetableViewMode === "substitutions"
                  ? "border-blue-500 text-blue-600 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Substitutions
            </button>
            </nav>
          
          {/* Settings Button - Moved from Header */}
          <div className="flex items-center justify-end">
            <Button 
              variant="outline" 
              onClick={onOpenSettings}
              data-testid="button-timetable-settings"
              aria-label="Open timetable settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Date Selection for School-wide View */}
        {timetableViewMode === "school" && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 border border-blue-200/50 dark:border-blue-700/60 rounded-lg p-2 mb-1 mt-2 shadow-md backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center space-x-1.5">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                    <i className="fas fa-calendar-alt text-white text-xs"></i>
                  </div>
                  <Label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Select Date:
                  </Label>
                </div>
                <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                  <DatePickerDialog
                    value={selectedSchoolDate ? new Date(selectedSchoolDate) : undefined}
                    onChange={(date) => setSelectedSchoolDate(toISTDateString(date))}
                    buttonClassName="w-full sm:w-72 h-9 text-xs bg-white dark:bg-gray-800 border border-blue-300/50 dark:border-blue-600/50 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 focus:border-indigo-500 transition-colors justify-start text-left font-normal"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await refetchSchoolWideData();
                    }}
                    disabled={schoolWideWeeklyLoading}
                    className="h-9 w-9 flex-shrink-0"
                    title="Refresh timetable data"
                  >
                    <RefreshCw className={`h-4 w-4 ${schoolWideWeeklyLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium bg-white/60 dark:bg-gray-800/60 px-2.5 py-1 rounded-md backdrop-blur-sm self-start sm:self-center">
                <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 text-xs"></i>
                <span>School-wide timetable for selected date</span>
              </div>
            </div>
          </div>
        )}

        {/* Timetable View Mode Controls - Show for class and master views */}
        {(timetableViewMode === "class" || timetableViewMode === "master") && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-lg p-2 mb-1 mt-2 shadow-md border border-blue-100 dark:border-blue-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">

                {/* Class Selection */}
                <div className="flex items-center gap-2 w-full">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="bg-blue-100/50 dark:bg-blue-800/50 backdrop-blur-md p-1.5 rounded-md">
                      <GraduationCap className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                    </div>
                    <label className="text-xs font-bold text-gray-800 dark:text-gray-200 hidden sm:inline">Class:</label>
                  </div>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="flex-1 sm:w-44 h-9 text-sm bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-gray-800 dark:text-gray-200 font-semibold backdrop-blur-sm shadow-md" data-testid="select-class-teacher">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {Array.isArray(selectOptions) && sortClasses(selectOptions).map((option: any) => (
                        <SelectItem key={option.id} value={option.id} className="cursor-pointer font-medium">
                          <div className="flex items-center space-x-2">
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                            <span>
                              {option.section && option.section.trim() !== '' && option.section !== '-' 
                                ? `${option.grade}-${option.section}` 
                                : option.grade}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Week Selection - Only show for Class Timetable (Weekly), not for Master Schedule */}
              {timetableViewMode !== "master" && (
              <div className="flex items-center gap-2 w-full">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="bg-indigo-100/50 dark:bg-indigo-800/50 backdrop-blur-md p-1.5 rounded-md">
                    <CalendarIcon className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 hidden sm:inline">Week:</label>
                </div>
                <Select value={selectedWeekOffset.toString()} onValueChange={(value) => setSelectedWeekOffset(parseInt(value))}>
                  <SelectTrigger className="flex-1 sm:w-80 h-9 text-xs bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-gray-800 dark:text-gray-200 font-medium backdrop-blur-sm shadow-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="cursor-pointer text-xs">
                      <div className="flex items-center space-x-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-green-600" />
                        <span className="font-semibold">Current Week</span>
                        <span className="text-gray-500 text-xs">({formatWeekRange(getWeekStart(selectedDate), getWeekEnd(selectedDate))})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="1" className="cursor-pointer text-xs">
                      <div className="flex items-center space-x-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-semibold">Next Week</span>
                        <span className="text-gray-500 text-xs">({formatWeekRange(getWeekStart(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000)), getWeekEnd(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000)))})</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-2 sm:px-4 pb-2 sm:pb-4 pt-2">
        {timetableViewMode === "substitutions" ? (
          /* Substitutions Management */
          <SubstitutionManagement />
        ) : timetableViewMode === "school" ? (
          /* School-wide Timetable */
          <div className="bg-white dark:bg-gray-900/50 rounded-xl p-1 sm:p-2">
            {/* Loading State */}
            {schoolWideWeeklyLoading ? (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-purple-600 font-medium">Loading school-wide timetable...</p>
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : workingDayInfo && !workingDayInfo.isWorkingDay ? (
              <div className="text-center py-12">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/60 rounded-lg p-6 max-w-md mx-auto">
                  <CalendarIcon className="h-12 w-12 text-blue-500 dark:text-blue-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Non-Working Day</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })} is not a working day.
                  </p>
                  {workingDayInfo.reason && (
                    <p className="text-sm text-gray-500 mt-2">
                      {workingDayInfo.reason}
                    </p>
                  )}
                </div>
              </div>
            ) : processedSchoolWideData && Array.isArray(processedSchoolWideData.classColumns) && processedSchoolWideData.classColumns.length > 0 ? (
              /* Export wrapper - includes header and timetable grid only when data exists */
              <div data-export="school-wide-timetable">
                {/* School-wide Timetable Header */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="bg-blue-100/50 dark:bg-blue-800/50 backdrop-blur-md p-2 rounded-md">
                        <i className="fas fa-school text-blue-700 dark:text-blue-300 text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center text-sm sm:text-base tracking-tight">
                          <i className="fas fa-calendar-alt mr-1.5 text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm"></i>
                          School-wide Timetable
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 text-xs font-medium leading-relaxed">
                          {processedSchoolWideData && processedSchoolWideData.selectedDayName ? 
                            `${processedSchoolWideData.selectedDayName.charAt(0).toUpperCase() + processedSchoolWideData.selectedDayName.slice(1)} - ${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}` :
                            selectedSchoolDate ? 
                              `All classes for ${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}` :
                              'Select a date to view the school-wide timetable'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="text-xs text-gray-700 dark:text-gray-300 font-medium bg-white/60 dark:bg-gray-800/60 px-2.5 py-1.5 rounded-md text-center sm:text-left">
                        {processedSchoolWideData?.classColumns?.length || 0} Classes • {processedSchoolWideData?.timeSlotRows?.length || 0} Periods
                      </div>
                      
                      {/* Export Button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={isExportingSchoolWideExpanded}
                            className="flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 backdrop-blur-sm shadow-md"
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline font-semibold text-sm">{isExportingSchoolWideExpanded ? 'Exporting...' : 'Export'}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={exportSchoolWideExpandedAsPNG} className="cursor-pointer">
                            <Download className="h-4 w-4 mr-2" />
                            Export as PNG
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportSchoolWideExpandedAsExcel} className="cursor-pointer">
                            <Download className="h-4 w-4 mr-2" />
                            Export as Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Card View (< sm breakpoint) */}
                <div className="sm:hidden space-y-3">
                  {processedSchoolWideData.classColumns.map((classColumn: any) => (
                    <Card key={classColumn.classId} className="overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2">
                        <h4 className="font-bold text-sm flex items-center">
                          <i className="fas fa-chalkboard mr-2"></i>
                          {classColumn.className}
                        </h4>
                      </div>
                      <div className="p-2 space-y-2">
                        {processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
                          const entry = classColumn.dayEntries.find((e: any) => e.period === timeSlot.period);
                          const periodNumber = processedSchoolWideData.timeSlotRows
                            .slice(0, index + 1)
                            .filter((ts: any) => !ts.isBreak)
                            .length;
                          
                          return (
                            <div key={timeSlot.period} className={`flex items-center gap-2 p-2 rounded-lg ${timeSlot.isBreak ? 'bg-orange-50/50 dark:bg-orange-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                              <div className="flex-shrink-0 w-16">
                                <span className={`inline-flex items-center justify-center w-full px-2 py-1 rounded text-xs font-bold ${timeSlot.isBreak ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}>
                                  {timeSlot.isBreak ? 'Break' : `P${periodNumber}`}
                                </span>
                                <div className="text-[10px] text-gray-600 dark:text-gray-400 text-center mt-0.5">
                                  {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                {timeSlot.isBreak ? (
                                  <div className="text-center text-orange-700 dark:text-orange-400 text-sm font-medium">
                                    <i className="fas fa-mug-hot mr-1"></i>Break Time
                                  </div>
                                ) : entry ? (
                                  <div 
                                    className="rounded border-2 px-2 py-1.5 bg-white dark:bg-gray-900" 
                                    style={{ borderColor: entry.subject?.color || '#6366f1' }}
                                  >
                                    <div 
                                      className="font-bold text-xs mb-0.5" 
                                      style={{ color: entry.subject?.color || '#6366f1' }}
                                    >
                                      {entry.subject?.name || 'Unknown'}
                                    </div>
                                    <div className="text-[11px] text-gray-700 dark:text-gray-300">
                                      {entry.teacher?.name || 'No Teacher'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-500 dark:text-gray-400 text-xs py-1.5">
                                    Free Period
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table View (≥ sm breakpoint) */}
                <div className="hidden sm:block w-full overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md">
                  <table className="w-full border-collapse text-xs">
                  {/* Table Header */}
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                      <th className="sticky left-0 z-20 border-r-2 border-b-2 border-gray-200 dark:border-gray-700 px-1 sm:px-2 py-1 sm:py-2 text-left font-bold text-gray-800 dark:text-gray-200 bg-slate-50 dark:bg-slate-800 whitespace-nowrap min-w-[60px] sm:min-w-[80px]">
                        <div className="flex items-center space-x-0.5 sm:space-x-1">
                          <i className="fas fa-chalkboard text-blue-600 dark:text-blue-400 text-xs sm:text-sm"></i>
                          <span className="text-[10px] sm:text-xs tracking-wide uppercase">Class</span>
                        </div>
                      </th>
                      {processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
                        // Calculate actual period number by counting only non-break periods up to this index
                        const periodNumber = processedSchoolWideData.timeSlotRows
                          .slice(0, index + 1)
                          .filter((ts: any) => !ts.isBreak)
                          .length;
                        
                        return (
                        <th key={timeSlot.period} className="border-l border-b-2 border-gray-200 dark:border-gray-700 px-0.5 sm:px-1 py-1 sm:py-2 text-center font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap min-w-[70px] sm:min-w-[90px]">
                          <div className="flex flex-col items-center space-y-0.5 sm:space-y-1">
                            <span className={`
                              inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold shadow-sm
                              ${timeSlot.isBreak 
                                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white" 
                                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                              }
                            `}>
                              {timeSlot.isBreak ? 'Brk' : `P${periodNumber}`}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 font-medium leading-tight">
                              {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                            </span>
                          </div>
                        </th>
                        );
                      })}
                    </tr>
                  </thead>
                  
                  {/* Table Body */}
                  <tbody>
                    {processedSchoolWideData.classColumns.map((classColumn: any, rowIndex: number) => (
                      <tr 
                        key={classColumn.classId} 
                        className={`
                          ${rowIndex % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-slate-50/50 dark:bg-slate-800/50"}
                          hover:bg-blue-50/30 dark:hover:bg-blue-900/30 transition-colors duration-150
                        `}
                      >
                        {/* Class Name Column */}
                        <td className="sticky left-0 z-10 border-r-2 border-b border-gray-200 dark:border-gray-700 px-1 sm:px-2 py-1 sm:py-1.5 font-bold text-gray-800 dark:text-gray-200 bg-slate-50 dark:bg-slate-800 min-w-[60px] sm:min-w-[80px]">
                          <span className="text-[10px] sm:text-xs block">{classColumn.className}</span>
                        </td>
                        
                        {/* Period Columns */}
                        {processedSchoolWideData.timeSlotRows.map((timeSlot: any) => {
                          // Find entry for this class and period
                          const entry = classColumn.dayEntries.find((e: any) => e.period === timeSlot.period);
                          
                          // Permission checks for editing
                          const canEdit = (user?.role === 'admin' || user?.role === 'super_admin') && !timeSlot.isBreak;
                          const selectedDateObj = selectedSchoolDate ? new Date(selectedSchoolDate + 'T00:00:00+05:30') : new Date(getCurrentDateIST() + 'T00:00:00+05:30');
                          const canEditThisDate = canEditDate(selectedDateObj);
                          const canEditThisCell = canEdit && canEditThisDate;
                          
                          return (
                            <td 
                              key={`${classColumn.classId}-${timeSlot.period}`} 
                              className={`border-l border-b border-gray-200 dark:border-gray-700 px-0.5 sm:px-1 py-0.5 sm:py-1 relative min-w-[70px] sm:min-w-[90px] ${
                                timeSlot.isBreak ? "bg-orange-50/30 dark:bg-orange-900/20" : ""
                              } ${
                                canEditThisCell ? 'cursor-pointer hover:bg-blue-100/40 dark:hover:bg-blue-900/40' : 
                                canEdit && !canEditThisDate ? 'opacity-60 cursor-not-allowed' : ''
                              } transition-all duration-150`}
                              onClick={() => {
                                if (canEditThisCell && processedSchoolWideData?.selectedDayName) {
                                  // Get the class object for this cell
                                  const classObj = classesArray?.find((c: any) => c.id === classColumn.classId);
                                  
                                  // For school-wide view, always set the selected class for both existing and free periods
                                  if (classColumn.classId) {
                                    setSelectedClass(classColumn.classId);
                                  }
                                  
                                  // Create entry object with class info if entry exists, otherwise pass undefined
                                  const cellEntry = entry ? {
                                    ...entry,
                                    class: classObj
                                  } : undefined;
                                  
                                  handleCellClick(
                                    processedSchoolWideData.selectedDayName,
                                    timeSlot.period,
                                    timeSlot,
                                    cellEntry
                                  );
                                }
                              }}
                              title={
                                canEditThisCell ? "Click to assign teacher" : 
                                canEdit && !canEditThisDate ? "Cannot edit past dates" : ""
                              }
                            >
                              {timeSlot.isBreak ? (
                                <div className="text-center py-0.5 sm:py-1">
                                  <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-[10px] sm:text-xs font-semibold">
                                    <i className="fas fa-mug-hot text-[10px] sm:text-xs"></i>
                                  </span>
                                </div>
                              ) : entry ? (
                                <div className="relative group min-h-[50px] sm:min-h-[60px] flex flex-col justify-center py-0.5 sm:py-1">
                                  <div 
                                    className="rounded border sm:border-2 px-1 sm:px-2 py-1 sm:py-2 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
                                    style={{ borderColor: entry.subject?.color || '#6366f1' }}
                                    title={entry.subject?.name || 'Unknown'}
                                  >
                                    <div 
                                      className="text-[9px] sm:text-xs font-bold text-center leading-tight sm:leading-snug mb-0.5 sm:mb-1 break-words line-clamp-2"
                                      style={{ color: entry.subject?.color || '#6366f1' }}
                                    >
                                      {entry.subject?.name || 'Unknown'}
                                    </div>
                                    <div className="text-[8px] sm:text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight break-words line-clamp-1 sm:line-clamp-2" title={entry.teacher?.name || 'No Teacher'}>
                                      {entry.teacher?.name || 'No Teacher'}
                                    </div>
                                  </div>
                                  {canEditThisCell && (
                                    <div className="absolute top-0.5 right-0.5 flex space-x-0.5 sm:space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          handleSchoolWideDelete({
                                            classId: classColumn.classId,
                                            className: classColumn.className,
                                            day: processedSchoolWideData.selectedDayName,
                                            period: timeSlot.period,
                                            teacherId: entry.teacher?.id,
                                            subjectId: entry.subject?.id,
                                            event: e
                                          });
                                        }}
                                        className="bg-white/95 hover:bg-red-50 rounded p-0.5 transition-colors shadow-sm"
                                        title="Delete assignment"
                                      >
                                        <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-600 hover:text-red-700" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-1 sm:py-1.5 relative group">
                                  <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] sm:text-xs font-medium">
                                    Free
                                  </span>
                                  {canEditThisCell && (
                                    <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="bg-blue-100 rounded-md p-0.5">
                                        <Plus className="h-3 w-3 text-blue-600" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              /* No Data State */
              <div className="text-center py-16 text-gray-500">
                {(() => {
                  // Check if selected date is a working day
                  if (selectedSchoolDate && timetableStructure?.workingDays) {
                    const selectedDateObj = new Date(selectedSchoolDate);
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const selectedDayName = dayNames[selectedDateObj.getDay()];
                    const isWorkingDay = timetableStructure.workingDays.map(d => d.toLowerCase()).includes(selectedDayName);
                    
                    if (!isWorkingDay) {
                      const isToday = selectedSchoolDate === getCurrentDateIST();
                      return (
                        <>
                          <i className="fas fa-calendar-times text-6xl mb-6 text-amber-300"></i>
                          <h3 className="text-xl font-semibold mb-4 text-amber-600">
                            {isToday ? "Today is not a working day" : "Not a working day"}
                          </h3>
                          <p className="text-sm mb-2">
                            {isToday 
                              ? "Classes are not scheduled for today."
                              : `Classes are not scheduled for ${format(selectedDateObj, "EEEE, MMMM d, yyyy")}.`
                            }
                          </p>
                          <p className="text-xs text-gray-400">
                            Please select a working day to view the timetable.
                          </p>
                        </>
                      );
                    }
                  }
                  
                  return (
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-8 max-w-md w-full shadow-lg border-2 border-purple-200/50">
                        <div className="flex justify-center mb-4">
                          <div className="bg-gradient-to-br from-purple-100 to-indigo-100 p-4 rounded-full">
                            <Sparkles className="h-12 w-12 text-purple-600" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold text-center mb-3 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                          No Timetable Data Available
                        </h3>
                        <p className="text-center text-gray-600 mb-6 text-sm leading-relaxed">
                          No classes have timetables for the selected date. Generate timetables using AI Smart Timetable.
                        </p>
                        <div className="flex justify-center">
                          <Button
                            onClick={onOpenGenerationDialog}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate with AI Smart
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : !selectedClass ? (
          <div className="space-y-8">
            {/* Default Layout */}
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fas fa-calendar-week mr-2"></i>
                Weekly Timetable
              </h4>
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                <i className="fas fa-calendar-week text-4xl mb-4"></i>
                <p className="mb-2">Select a {viewMode} to view the weekly timetable</p>
                <p className="text-sm">
                  {formatWeekRange(weekStart, weekEnd)} - {weekDays.length} working days
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="space-y-8">
            {/* Weekly Schedule Section */}
            {timetableLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (!weeklyTimetableResponse?.data?.timetableData || weeklyTimetableResponse.data.timetableData.length === 0) && (!timetableData || timetableData.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-8 max-w-md w-full shadow-lg border-2 border-purple-200/50">
                  <div className="flex justify-center mb-4">
                    <div className="bg-gradient-to-br from-purple-100 to-indigo-100 p-4 rounded-full">
                      <Sparkles className="h-12 w-12 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-3 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    No Timetable Found
                  </h3>
                  <p className="text-center text-gray-600 mb-6 text-sm leading-relaxed">
                    This {viewMode} doesn't have a timetable yet. Generate one using AI Smart Timetable for intelligent scheduling.
                  </p>
                  <div className="flex justify-center">
                    <Button
                      onClick={onOpenGenerationDialog}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate with AI Smart
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
          <>
            {/* Weekly Timetable Content */}
            {timetableViewMode === "class" && (
          <div className="relative">
            
            <div className="bg-gradient-to-br from-white via-green-50/20 to-emerald-50/30 dark:from-gray-900 dark:via-green-900/20 dark:to-emerald-900/20 border-2 border-green-200/50 dark:border-green-700/60 rounded-2xl shadow-2xl shadow-green-100/50 dark:shadow-green-900/20 p-2 sm:p-3 lg:p-4 mb-8 backdrop-blur-sm" data-export="timetable-grid">
            {/* Weekly Timetable Card Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="bg-green-100/50 dark:bg-green-800/50 backdrop-blur-md p-2 rounded-md">
                    <CalendarIcon className="h-5 w-5 text-green-700 dark:text-green-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center text-sm sm:text-base tracking-tight">
                      <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                      {selectedWeekOffset === 0 ? 'Current Week Timetable' : 'Next Week Timetable'}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center flex-wrap">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5" />
                      {formatWeekRange(weekStart, weekEnd)} • {viewMode === "class" ? 
                        `Class ${(selectOptions as any[])?.find(c => c.id === selectedClass)?.grade}-${(selectOptions as any[])?.find(c => c.id === selectedClass)?.section}` :
                        `${(selectOptions as any[])?.find(t => t.id === selectedClass)?.name}`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Export Button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={isExportingExpanded}
                        className="flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 backdrop-blur-sm shadow-md"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline font-semibold text-sm">{isExportingExpanded ? 'Exporting...' : 'Export'}</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={exportExpandedAsPNG} className="cursor-pointer">
                        <Download className="h-4 w-4 mr-2" />
                        Export as PNG
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportExpandedAsExcel} className="cursor-pointer">
                        <Download className="h-4 w-4 mr-2" />
                        Export as Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sync with Master Button */}
                  {!freezeStatus?.timetableFrozen && (
                    <>
                      <div className="sm:hidden">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={showCopyFromGlobalConfirmation}
                          disabled={isCopyingFromGlobal || isSettingAsGlobal || isGenerating || timetableLoading}
                          className="flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 backdrop-blur-sm shadow-md"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="hidden sm:block">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={showCopyFromGlobalConfirmation}
                          disabled={isCopyingFromGlobal || isSettingAsGlobal || isGenerating || timetableLoading}
                          className="flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 backdrop-blur-sm shadow-md"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="font-semibold text-sm">{isCopyingFromGlobal ? 'Syncing...' : 'Sync with Master'}</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Weekly Grid Table */}
            <div className="w-full">
              <div className="overflow-x-auto rounded-xl border-2 border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                <table className="min-w-max w-full border-collapse text-xs" data-testid="timetable-grid">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-slate-800 dark:via-gray-800 dark:to-slate-800">
                    <th className="sticky left-0 z-20 text-left py-1.5 px-1.5 font-semibold border-r border-gray-200 dark:border-gray-700 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900" style={{ width: '100px' }}>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase">Time</span>
                      </div>
                    </th>
                    {weekDays.map((day) => (
                      <th key={day.name} className="text-center py-1.5 px-1 border-l border-gray-200/50 dark:border-gray-700/50 first:border-l-0">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="font-bold text-base text-gray-800 dark:text-gray-200 tracking-tight">{day.name}</div>
                          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium whitespace-nowrap">
                            {day.date}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot: TimeSlot) => (
                    <tr key={timeSlot.period} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/30 transition-all duration-200 ease-in-out ${
                      timeSlot.isBreak ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20' : 'bg-white dark:bg-gray-900 hover:shadow-sm'
                    }`}>
                      <td className="sticky left-0 z-10 py-1 px-1.5 text-xs border-r border-gray-200 dark:border-gray-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-gray-900">
                        {timeSlot.isBreak ? (
                          <div className="flex items-center space-x-1">
                            <div className="bg-orange-500/10 dark:bg-orange-500/20 p-1 rounded">
                              <i className="fas fa-coffee text-orange-600 dark:text-orange-400 text-xs"></i>
                            </div>
                            <div>
                              <div className="font-bold text-[10px] text-orange-800 dark:text-orange-300">Break</div>
                              <div className="text-[9px] text-orange-700 dark:text-orange-400 leading-tight">
                                {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold">
                              P{getTeachingPeriodNumber(timeSlot.period)}
                            </span>
                            <div className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                              {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                            </div>
                          </div>
                        )}
                      </td>
                      {weekDays.map((day) => {
                        if (timeSlot.isBreak) {
                          return (
                            <td key={day.name} className="py-1 px-1 text-center bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-l border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                              <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-100/80 dark:bg-orange-800/60 text-orange-700 dark:text-orange-300 text-xs font-semibold">
                                <i className="fas fa-coffee text-xs"></i>
                              </div>
                            </td>
                          );
                        }

                        const entry = getTimetableEntry(day.name, timeSlot.period);

                        const canEdit = (user?.role === 'admin' || user?.role === 'super_admin') && !timeSlot.isBreak;
                        const canEditThisDate = canEditDate(day.fullDate);
                        const canEditThisCell = canEdit && canEditThisDate;

                        return (
                          <td 
                            key={day.name} 
                            className={`py-1 px-1 text-center relative border-l border-gray-200/50 dark:border-gray-700/50 overflow-hidden ${
                              canEditThisCell ? 'cursor-pointer hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/30 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30' : 
                              canEdit && !canEditThisDate ? 'opacity-60 cursor-not-allowed' : ''
                            } transition-all duration-200`}
                            onClick={() => canEditThisCell && handleCellClick(day.name, timeSlot.period, timeSlot, entry || undefined)}
                            title={
                              canEditThisCell ? "Click to assign teacher" : 
                              canEdit && !canEditThisDate ? "Cannot edit past dates" : ""
                            }
                          >
                            {entry ? (
                                <div 
                                  className="rounded-lg border-2 px-3 py-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 relative group min-h-[64px] flex flex-col justify-center"
                                  style={{ borderColor: entry.subject?.color || '#3B82F6' }}
                                >
                                  <div 
                                    className="font-bold text-sm leading-snug mb-1.5 break-words" 
                                    style={{ color: entry.subject?.color || '#3B82F6' }}
                                    title={entry.subject?.name || (entry.teacher?.name ? 'Free Subject' : 'Unknown Subject')}
                                  >
                                    {entry.subject?.name || (entry.teacher?.name ? 'Free Subject' : 'Unknown Subject')}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 leading-snug break-words" title={
                                    viewMode === "class" ? 
                                      (entry.teacher?.name || 'Unknown Teacher') : 
                                      `${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`
                                  }>
                                    {viewMode === "class" ? 
                                      (entry.teacher?.name || 'Unknown Teacher') : 
                                      `${entry.class?.grade || 'N/A'}-${entry.class?.section || 'N/A'}`
                                    }
                                  </div>

                                  {canEditThisCell && (
                                    <div className="absolute top-1.5 right-1.5 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => handleDeleteEntry(entry, e)}
                                        className="bg-white/90 hover:bg-red-50 rounded-md p-1 transition-colors shadow-sm"
                                        title="Delete assignment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600 hover:text-red-700" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                            ) : (
                              <div className="text-center py-1 px-1 text-gray-400 dark:text-gray-500 text-xs rounded border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-900/30 transition-all duration-200 relative group">
                                <div className="text-[10px] font-medium">
                                  {isWeeklyTimetableAvailable() ? 'Free' : 'N/A'}
                                </div>
                                {canEditThisCell && isWeeklyTimetableAvailable() && (
                                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-blue-100 rounded-md p-1">
                                      <Plus className="h-3.5 w-3.5 text-blue-600" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>


          </div>
          </div>
            )}
            
            {/* Master Schedule Content */}
            {timetableViewMode === "master" && ((weeklyTimetableResponse?.data?.timetableData?.length ?? 0) > 0 || (timetableData?.length ?? 0) > 0) && (
            <div className="relative">
              
              <div className="mt-8">
              {/* Master Schedule Section */}
              {globalTimetableLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-white via-green-50/20 to-emerald-50/30 dark:from-gray-900 dark:via-green-900/20 dark:to-emerald-900/20 border-2 border-green-200/50 dark:border-green-700/60 rounded-2xl shadow-2xl shadow-green-100/50 dark:shadow-green-900/20 p-2 sm:p-3 lg:p-4 mb-8 backdrop-blur-sm" data-export="global-timetable-grid">
                  {/* Master Timetable Grid */}
                  <div className="overflow-hidden">
                    {/* Master Timetable Header */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-purple-100/50 dark:bg-purple-800/50 backdrop-blur-md p-2 rounded-md">
                            <Eye className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center text-sm sm:text-base tracking-tight">
                              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-pink-600 dark:text-pink-400" />
                              Master Schedule
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center">
                              <GraduationCap className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5" />
                              Standard schedule for Class {
                                selectedClass ? 
                                  (() => {
                                    const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
                                    return selectedClassData?.section 
                                      ? `${selectedClassData.grade}-${selectedClassData.section}` 
                                      : selectedClassData?.grade || selectedClass;
                                  })() 
                                  : 'Unknown'
                              } • Applied to all weeks
                            </p>
                          </div>
                        </div>
                        
                        {/* Export Button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={isExportingMasterExpanded}
                              className="flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 border-white/40 dark:border-gray-600/40 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 backdrop-blur-sm shadow-md"
                            >
                              <Download className="h-4 w-4" />
                              <span className="hidden sm:inline font-semibold text-sm">{isExportingMasterExpanded ? 'Exporting...' : 'Export'}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={exportMasterExpandedAsPNG} className="cursor-pointer">
                              <Download className="h-4 w-4 mr-2" />
                              Export as PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportMasterExpandedAsExcel} className="cursor-pointer">
                              <Download className="h-4 w-4 mr-2" />
                              Export as Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Master Timetable Table */}
                    <div className="w-full">
                      <div className="overflow-x-auto rounded-xl border-2 border-purple-200/50 dark:border-purple-700/50 shadow-sm">
                        <table className="min-w-max w-full border-collapse text-xs">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 dark:from-purple-800 dark:via-pink-800 dark:to-purple-800">
                            <th className="sticky left-0 z-20 text-left py-1.5 px-1.5 font-semibold border-r border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-800 dark:to-purple-900" style={{ width: '100px' }}>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 tracking-wide uppercase">Time</span>
                              </div>
                            </th>
                            {weekDays.map((day) => (
                              <th key={day.name} className="text-center py-1.5 px-1 border-l border-purple-200/50 dark:border-purple-700/50 first:border-l-0">
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="font-bold text-base text-gray-800 dark:text-gray-200 tracking-tight">{day.name}</div>
                                  <div className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium whitespace-nowrap">
                                    {day.date}
                                  </div>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {timeSlots.map((timeSlot, index) => (
                            <tr key={index} className="border-b border-purple-200 dark:border-purple-700 hover:bg-purple-50/30 dark:hover:bg-purple-900/30 transition-all duration-200 ease-in-out bg-white dark:bg-gray-900 hover:shadow-sm">
                              <td className="sticky left-0 z-10 py-1 px-1.5 text-xs border-r border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-white dark:from-purple-800 dark:to-gray-900">
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold">
                                    P{timeSlot.period}
                                  </span>
                                  <div className="text-xs text-purple-600 dark:text-purple-400 leading-tight">
                                    {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                                  </div>
                                </div>
                              </td>
                              {weekDays.map((day) => {
                                const globalEntry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);

                                return (
                                  <td key={day.name} className="py-1 px-1 text-center border-l border-purple-200/50 dark:border-purple-700/50 overflow-hidden transition-all duration-200">
                                    {globalEntry ? (
                                      <div 
                                        className="rounded-lg border-2 px-3 py-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 min-h-[64px] flex flex-col justify-center"
                                        style={{ borderColor: globalEntry.subject?.color || '#3B82F6' }}
                                      >
                                        <div 
                                          className="font-bold text-sm leading-snug mb-1.5 break-words" 
                                          style={{ color: globalEntry.subject?.color || '#3B82F6' }}
                                          title={globalEntry.subject?.name || 'Unknown Subject'}
                                        >
                                          {globalEntry.subject?.name || 'Unknown Subject'}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 leading-snug break-words" title={globalEntry.teacher?.name || 'Unknown Teacher'}>
                                          {globalEntry.teacher?.name || 'Unknown Teacher'}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-1 px-1 text-gray-400 dark:text-gray-500 text-xs rounded border border-dashed border-purple-300 dark:border-purple-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-900/30 transition-all duration-200">
                                        <div className="text-xs font-medium">
                                          Free
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
            </div>
            )}
          </>
            )}
          </div>
        )}

        {/* Manual Teacher Assignment Dialog */}
        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="assignment-dialog-description">
            <DialogHeader>
              <DialogTitle>Assign Teacher</DialogTitle>
            </DialogHeader>
            <div id="assignment-dialog-description" className="sr-only">
              Dialog to manually assign a teacher to a specific time slot in the timetable
            </div>

            {assignmentCell && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm mb-2">Assignment Details</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Day:</strong> {assignmentCell.day.charAt(0).toUpperCase() + assignmentCell.day.slice(1)}</div>
                    <div><strong>Period:</strong> {getTeachingPeriodNumber(assignmentCell.period)}</div>
                    <div><strong>Time:</strong> {formatTime12Hour(assignmentCell.timeSlot.startTime)} - {formatTime12Hour(assignmentCell.timeSlot.endTime)}</div>
                    {assignmentCell.entry && (
                      <>
                        <div><strong>Subject:</strong> {assignmentCell.entry.subject?.name || 'Unknown'}</div>
                        <div><strong>Current Teacher:</strong> {assignmentCell.entry.teacher?.name || 'None'}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 1: Select Subject or Free Period */}
                <div className="space-y-2">
                  <Label htmlFor="subject-select">Select Subject</Label>
                  <Select 
                    value={isFreePeriod ? "FREE_PERIOD" : selectedSubjectId} 
                    onValueChange={(value) => {
                      if (value === "FREE_PERIOD") {
                        setIsFreePeriod(true);
                        setSelectedSubjectId("");
                      } else {
                        setIsFreePeriod(false);
                        setSelectedSubjectId(value);
                      }
                      setSelectedTeacherId(""); // Reset teacher selection
                    }}
                  >
                    <SelectTrigger id="subject-select">
                      <SelectValue placeholder="Choose a subject or free period..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE_PERIOD">
                        <div className="flex items-center space-x-2">
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">
                            Free Period
                          </span>
                          <span>All Available Teachers</span>
                        </div>
                      </SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!assignmentCell?.entry && !isFreePeriod && (
                    <p className="text-xs text-gray-500">
                      Select a subject to teach or choose "Free Period" to see all available teachers.
                    </p>
                  )}
                  {isFreePeriod && (
                    <p className="text-xs text-blue-600">
                      Free Period mode: Showing all available teachers across the school.
                    </p>
                  )}
                </div>

                {/* Step 2: Select Teacher (after subject is selected OR free period is enabled) */}
                {(selectedSubjectId || isFreePeriod) && (
                  <div className="space-y-2">
                    <Label htmlFor="teacher-select">Select Teacher</Label>
                    
                    {/* Loading State */}
                    {isLoadingTeachers ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-700 font-medium">
                            Finding teachers teaching this subject...
                          </span>
                        </div>
                      </div>
                    ) : availableTeachers.length === 0 ? (
                      /* No Teachers Available Error */
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-600 font-medium">
                          {isFreePeriod 
                            ? "No teachers available during this time slot"
                            : `No teachers available who can teach ${subjects.find(s => s.id === selectedSubjectId)?.name}`
                          }
                        </p>
                      </div>
                    ) : (
                      /* Teachers Available - Show Dropdown */
                      <>
                        <Select 
                          value={selectedTeacherId} 
                          onValueChange={(teacherId) => {
                            setSelectedTeacherId(teacherId);
                            // Reset validation state when teacher changes
                            setValidationResult(null);
                            setValidationError(null);
                            // Validation removed - no longer triggers on teacher selection
                          }}
                        >
                          <SelectTrigger 
                            id="teacher-select" 
                            className={
                              validationResult 
                                ? validationResult.isValid 
                                  ? "border-green-500 focus:border-green-500" 
                                  : validationResult.conflicts && validationResult.conflicts.length > 0
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-yellow-500 focus:border-yellow-500"
                                : ""
                            }
                          >
                            <SelectValue placeholder="Choose a teacher..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTeachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id} className="border-b border-gray-200 last:border-b-0">
                                <div className="flex flex-col space-y-1 w-full">
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-medium">
                                      {(teacher as any).schoolIdNumber 
                                        ? `${teacher.name} (${(teacher as any).schoolIdNumber})`
                                        : teacher.name
                                      }
                                    </span>
                                    <div className="flex items-center space-x-1 text-xs">
                                      {teacher.teachingThisClass && (
                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                                          Class Teacher
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          {isFreePeriod 
                            ? `Showing ${availableTeachers.length} available teachers across the school.`
                            : `Showing teachers who can teach ${subjects.find(s => s.id === selectedSubjectId)?.name}.`
                          }
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Validation Status and Results */}
                {selectedTeacherId && !isFreePeriod && (
                  <div className="space-y-3">
                    {/* Validation Loading State */}
                    {isValidating && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-700 font-medium">Validating assignment...</span>
                        </div>
                      </div>
                    )}

                    {/* Validation Error */}
                    {validationError && !isValidating && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">!</span>
                          </div>
                          <span className="text-sm text-red-700 font-medium">Validation Error</span>
                        </div>
                        <p className="text-xs text-red-600 mt-1">{validationError}</p>
                      </div>
                    )}

                    {/* Validation Results */}
                    {validationResult && !isValidating && !validationError && (
                      <div className={`rounded-lg p-3 ${
                        validationResult.isValid 
                          ? "bg-green-50 border border-green-200" 
                          : validationResult.conflicts && validationResult.conflicts.length > 0
                            ? "bg-red-50 border border-red-200"
                            : "bg-yellow-50 border border-yellow-200"
                      }`}>
                        {/* Validation Header */}
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            validationResult.isValid 
                              ? "bg-green-500" 
                              : validationResult.conflicts && validationResult.conflicts.length > 0
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}>
                            <span className="text-white text-xs">
                              {validationResult.isValid ? "✓" : validationResult.conflicts && validationResult.conflicts.length > 0 ? "✗" : "!"}
                            </span>
                          </div>
                          <span className={`text-sm font-medium ${
                            validationResult.isValid 
                              ? "text-green-700" 
                              : validationResult.conflicts && validationResult.conflicts.length > 0
                                ? "text-red-700"
                                : "text-yellow-700"
                          }`}>
                            {validationResult.isValid 
                              ? "Assignment Valid" 
                              : validationResult.conflicts && validationResult.conflicts.length > 0
                                ? "Assignment Conflicts Detected"
                                : "Assignment Warnings"}
                          </span>
                        </div>

                        {/* Conflict Messages */}
                        {validationResult.conflicts && validationResult.conflicts.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {validationResult.conflicts.map((conflict: any, index: number) => (
                              <p key={index} className="text-xs text-red-600">
                                • {conflict.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Warning Messages */}
                        {validationResult.warnings && validationResult.warnings.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {validationResult.warnings.map((warning: any, index: number) => (
                              <p key={index} className="text-xs text-yellow-600">
                                • {warning.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Success Message */}
                        {validationResult.isValid && (
                          <p className="text-xs text-green-600">
                            ✓ This assignment is valid and can be saved safely.
                          </p>
                        )}

                        {/* Alternative Teacher Suggestions */}
                        {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <h4 className="text-xs font-medium text-gray-700 mb-2">Suggested Alternative Teachers:</h4>
                            <div className="space-y-1">
                              {validationResult.suggestions.slice(0, 3).map((suggestion: any, index: number) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTeacherId(suggestion.teacherId);
                                    // Validation removed - no longer triggers on suggestion selection
                                  }}
                                  className="w-full text-left bg-white border border-gray-200 rounded p-2 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-blue-600">{suggestion.teacherName}</span>
                                    <span className="text-xs text-green-600">Available</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{suggestion.reason}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAssignmentDialogOpen(false);
                      setAssignmentCell(null);
                      setSelectedSubjectId("");
                      setSelectedTeacherId("");
                      setIsFreePeriod(false);
                      // Reset validation state
                      setValidationResult(null);
                      setValidationError(null);
                      setIsValidating(false);
                    }}
                    disabled={assignTeacherMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssignTeacher}
                    disabled={
                      !selectedTeacherId || 
                      assignTeacherMutation.isPending || 
                      weeklyEditMutation.isPending ||
                      isValidating ||
                      // Prevent save if validation shows conflicts (but allow warnings and free periods)
                      (!isFreePeriod && validationResult && validationResult.conflicts && validationResult.conflicts.length > 0)
                    }
                    className={
                      validationResult && !isFreePeriod
                        ? validationResult.isValid 
                          ? "bg-green-600 hover:bg-green-700" 
                          : validationResult.conflicts && validationResult.conflicts.length > 0
                            ? "bg-red-600 hover:bg-red-700 cursor-not-allowed"
                            : "bg-yellow-600 hover:bg-yellow-700"
                        : ""
                    }
                  >
                    {(assignTeacherMutation.isPending || weeklyEditMutation.isPending) 
                      ? "Assigning..." 
                      : isValidating
                        ? "Validating..."
                        : validationResult && !isFreePeriod && validationResult.conflicts && validationResult.conflicts.length > 0
                          ? "Cannot Assign (Conflicts)"
                          : user?.role === 'admin' || user?.role === 'super_admin' 
                            ? "Assign Teacher (Direct Edit)" 
                            : "Assign Teacher"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="delete-dialog-description">
            <DialogHeader>
              <DialogTitle>Delete Assignment</DialogTitle>
            </DialogHeader>
            <div id="delete-dialog-description" className="sr-only">
              Dialog to confirm deletion of a timetable assignment
            </div>

            {entryToDelete && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Are you sure you want to delete this assignment?
                </div>

                <div className="bg-muted/30 rounded p-3">
                  <div className="font-semibold text-sm">
                    {entryToDelete.subject?.name || (entryToDelete.teacher?.name ? 'Free Subject' : 'Unknown Subject')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Teacher: {entryToDelete.teacher?.name || 'Unknown Teacher'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Day: {entryToDelete.day.charAt(0).toUpperCase() + entryToDelete.day.slice(1)}, Period: {entryToDelete.period}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Time: {formatTime12Hour(entryToDelete.startTime)} - {formatTime12Hour(entryToDelete.endTime)}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  This will make this time slot available as a free period.
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={deleteEntryMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={confirmDelete}
                    disabled={deleteEntryMutation.isPending}
                  >
                    {deleteEntryMutation.isPending ? "Deleting..." : "Delete Assignment"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Refresh Master Timetable Confirmation Dialog */}
        <Dialog open={isRefreshConfirmDialogOpen} onOpenChange={setIsRefreshConfirmDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="refresh-dialog-description">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <i className="fas fa-sync text-blue-600"></i>
                <span>Refresh Master Timetable</span>
              </DialogTitle>
            </DialogHeader>
            <div id="refresh-dialog-description" className="sr-only">
              Dialog to confirm global timetable refresh operation
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to refresh the <strong>Master Timetable</strong>? This will:
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <ul className="text-sm space-y-1 text-blue-800">
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-check text-blue-600"></i>
                    <span>Check for changes in class-subject assignments</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-sync text-blue-600"></i>
                    <span>Generate a new Master Timetable from scratch</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-globe text-blue-600"></i>
                    <span>Replace the existing Master Timetable for this class</span>
                  </li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> This updates the base timetable that applies to all future weeks. Weekly changes remain separate.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsRefreshConfirmDialogOpen(false)}
                  disabled={isRefreshing || isGenerating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmRefreshTable}
                  disabled={isRefreshing || isGenerating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <i className="fas fa-sync mr-2"></i>
                  Refresh Master Timetable
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set as Master Timetable Confirmation Dialog */}
        <Dialog open={isSetAsGlobalDialogOpen} onOpenChange={setIsSetAsGlobalDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="set-global-dialog-description">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <i className="fas fa-globe text-green-600"></i>
                <span>Set as Master Timetable</span>
              </DialogTitle>
            </DialogHeader>
            <div id="set-global-dialog-description" className="sr-only">
              Dialog to confirm setting current weekly changes as global timetable
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to make the current week's timetable the new <strong>Master Timetable</strong>? This will:
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-3">
                <ul className="text-sm space-y-1 text-green-800">
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-check text-green-600"></i>
                    <span>Take the current effective timetable (including weekly changes)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-globe text-green-600"></i>
                    <span>Make it the new Master Timetable for this class</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-eraser text-green-600"></i>
                    <span>Clear current weekly changes since they're now part of the master schedule</span>
                  </li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> This will be the default timetable for all future weeks unless you make further weekly changes.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSetAsGlobalDialogOpen(false)}
                  disabled={isSettingAsGlobal}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmSetAsGlobal}
                  disabled={isSettingAsGlobal}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <i className="fas fa-globe mr-2"></i>
                  Set as Master Timetable
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sync with Master Timetable Confirmation Dialog */}
        <Dialog open={isCopyFromGlobalDialogOpen} onOpenChange={setIsCopyFromGlobalDialogOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="copy-from-global-dialog-description">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <i className="fas fa-sync text-blue-600"></i>
                <span>Sync with Master Timetable</span>
              </DialogTitle>
            </DialogHeader>
            <div id="copy-from-global-dialog-description" className="sr-only">
              Dialog to confirm copying global timetable to current weekly timetable
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to sync the <strong>Master Timetable</strong> to this week? This will:
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <ul className="text-sm space-y-1 text-blue-800">
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-sync text-blue-600"></i>
                    <span>Copy Master Timetable to this Week's Timetable</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-sync text-blue-600"></i>
                    <span>Replace all current weekly modifications for this class</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <i className="fas fa-calendar-week text-blue-600"></i>
                    <span>Reset this week to match the master schedule exactly</span>
                  </li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Warning:</strong> Any weekly changes you've made for this week will be lost and replaced with the master schedule.
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCopyFromGlobalDialogOpen(false)}
                  disabled={isCopyingFromGlobal}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmCopyFromGlobal}
                  disabled={isCopyingFromGlobal}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <i className="fas fa-sync mr-2"></i>
                  Sync with Master
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fullscreen/Expand View Dialog */}
        <Dialog open={isFullscreenView} onOpenChange={setIsFullscreenView}>
          <DialogContent className="!max-w-[70vw] !w-[70vw] !h-[70vh] !max-h-[70vh] !p-0 !gap-0">
            <div className="flex flex-col h-full">
              {/* Fullscreen Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100/50 dark:bg-blue-800/50 backdrop-blur-md p-2 rounded-md">
                    <CalendarIcon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center text-base tracking-tight">
                      <Sparkles className="h-4 w-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                      {selectedWeekOffset === 0 ? 'Current Week Timetable' : 'Next Week Timetable'}
                    </h3>
                    <p className="text-gray-700 text-xs font-medium flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      {formatWeekRange(weekStart, weekEnd)} • {viewMode === "class" ? 
                        `Class ${(selectOptions as any[])?.find(c => c.id === selectedClass)?.grade}-${(selectOptions as any[])?.find(c => c.id === selectedClass)?.section}` :
                        `${(selectOptions as any[])?.find(t => t.id === selectedClass)?.name}`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Fullscreen Timetable Content */}
              <div className="flex-1 overflow-auto p-1">
                <div className="w-full" data-export="expanded-timetable" style={{ 
                  border: '2px solid #cbd5e1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff'
                }}>
                  <table className="w-full text-sm" style={{ 
                    borderCollapse: 'collapse',
                    width: '100%'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{
                          border: '2px solid #cbd5e1',
                          borderTop: 'none',
                          borderLeft: 'none',
                          padding: '10px 8px',
                          textAlign: 'left',
                          fontWeight: 'bold',
                          color: '#1f2937',
                          backgroundColor: '#e2e8f0',
                          width: '100px',
                          minWidth: '100px'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <Clock className="h-3.5 w-3.5 text-slate-600" />
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase' }}>Time</span>
                          </div>
                        </th>
                        {weekDays.map((day, index) => (
                          <th key={day.name} style={{
                            border: '2px solid #cbd5e1',
                            borderTop: 'none',
                            borderRight: index === weekDays.length - 1 ? 'none' : '2px solid #cbd5e1',
                            padding: '8px 4px',
                            textAlign: 'center',
                            backgroundColor: '#e2e8f0',
                            minWidth: '90px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#1f2937' }}>{day.name}</div>
                              <div style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: '10px',
                                fontWeight: '500'
                              }}>
                                {day.date}
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((timeSlot: TimeSlot, rowIndex: number) => (
                        <tr key={timeSlot.period} style={{ 
                          backgroundColor: timeSlot.isBreak ? '#fff7ed' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc')
                        }}>
                          <td style={{
                            border: '2px solid #cbd5e1',
                            borderLeft: 'none',
                            borderBottom: rowIndex === timeSlots.length - 1 ? 'none' : '2px solid #cbd5e1',
                            padding: timeSlot.isBreak ? '6px 8px' : '8px',
                            backgroundColor: timeSlot.isBreak ? '#ffedd5' : '#f1f5f9',
                            textAlign: 'center'
                          }}>
                            {timeSlot.isBreak ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', padding: '4px', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '14px' }}>☕</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#9a3412' }}>Break</div>
                                  <div style={{ fontSize: '10px', color: '#c2410c', whiteSpace: 'nowrap' }}>
                                    {formatTime12Hour(timeSlot.startTime)}-{formatTime12Hour(timeSlot.endTime)}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: 'linear-gradient(to right, #3b82f6, #6366f1)',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}>
                                  P{getTeachingPeriodNumber(timeSlot.period)}
                                </span>
                                <div style={{ fontSize: '10px', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {formatTime12Hour(timeSlot.startTime)}-{formatTime12Hour(timeSlot.endTime)}
                                </div>
                              </div>
                            )}
                          </td>
                          {weekDays.map((day, colIndex) => {
                            if (timeSlot.isBreak) {
                              return (
                                <td key={day.name} style={{
                                  border: '2px solid #cbd5e1',
                                  borderRight: colIndex === weekDays.length - 1 ? 'none' : '2px solid #cbd5e1',
                                  borderBottom: rowIndex === timeSlots.length - 1 ? 'none' : '2px solid #cbd5e1',
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  backgroundColor: '#fff7ed',
                                  verticalAlign: 'middle'
                                }}>
                                  <div style={{ 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(254, 215, 170, 0.8)',
                                    color: '#c2410c',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}>
                                    <span>☕</span>
                                  </div>
                                </td>
                              );
                            }

                            const entry = getTimetableEntry(day.name, timeSlot.period);

                            return (
                              <td 
                                key={day.name}
                                style={{
                                  border: '2px solid #cbd5e1',
                                  borderRight: colIndex === weekDays.length - 1 ? 'none' : '2px solid #cbd5e1',
                                  borderBottom: rowIndex === timeSlots.length - 1 ? 'none' : '2px solid #cbd5e1',
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                                  verticalAlign: 'middle'
                                }}
                              >
                                {entry ? (
                                  <div 
                                    style={{
                                      ...getSubjectColor(entry.subject?.color || '#3B82F6'),
                                      borderRadius: '6px',
                                      padding: '6px 4px',
                                      textAlign: 'center',
                                      minHeight: '45px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <div style={{ 
                                      fontWeight: 'bold', 
                                      fontSize: '11px', 
                                      marginBottom: '2px',
                                      wordBreak: 'break-word',
                                      lineHeight: '1.2'
                                    }} title={entry.subject?.name || 'Unknown Subject'}>
                                      {entry.subject?.name || 'Unknown Subject'}
                                    </div>
                                    <div style={{ 
                                      fontSize: '10px',
                                      wordBreak: 'break-word',
                                      lineHeight: '1.2'
                                    }} title={entry.teacher?.name || 'Unknown'}>
                                      {entry.teacher?.name || 'Unknown'}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>-</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Master Timetable Fullscreen/Expand View Dialog */}
        <Dialog open={isMasterFullscreenView} onOpenChange={setIsMasterFullscreenView}>
          <DialogContent className="!max-w-[70vw] !w-[70vw] !h-[70vh] !max-h-[70vh] !p-0 !gap-0">
            <div className="flex flex-col h-full">
              {/* Fullscreen Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-rose-900/30">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100/50 dark:bg-purple-800/50 backdrop-blur-md p-2 rounded-md">
                    <Eye className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center text-base tracking-tight">
                      <Sparkles className="h-4 w-4 mr-1.5 text-pink-600 dark:text-pink-400" />
                      Master Schedule
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center">
                      <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                      Class {
                        (() => {
                          const selectedClassData = (classes as any[])?.find(c => c.id === selectedClass);
                          return selectedClassData?.section 
                            ? `${selectedClassData.grade}-${selectedClassData.section}` 
                            : selectedClassData?.grade || selectedClass;
                        })()
                      } • Applied to all weeks
                    </p>
                  </div>
                </div>
              </div>

              {/* Fullscreen Timetable Content */}
              <div className="flex-1 overflow-auto p-1">
                <div className="w-full" data-export="master-expanded-timetable" style={{ 
                  border: '2px solid #d8b4fe',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff'
                }}>
                  <table className="w-full text-sm" style={{ 
                    borderCollapse: 'collapse',
                    width: '100%'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#faf5ff' }}>
                        <th style={{
                          border: '2px solid #d8b4fe',
                          borderTop: 'none',
                          borderLeft: 'none',
                          padding: '10px 8px',
                          textAlign: 'left',
                          fontWeight: 'bold',
                          color: '#1f2937',
                          backgroundColor: '#e9d5ff',
                          width: '100px',
                          minWidth: '100px'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <Clock className="h-3.5 w-3.5 text-purple-600" />
                            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', textTransform: 'uppercase' }}>Time</span>
                          </div>
                        </th>
                        {weekDays.map((day, index) => (
                          <th key={day.name} style={{
                            border: '2px solid #d8b4fe',
                            borderTop: 'none',
                            borderRight: index === weekDays.length - 1 ? 'none' : '2px solid #d8b4fe',
                            padding: '8px 4px',
                            textAlign: 'center',
                            backgroundColor: '#e9d5ff',
                            minWidth: '90px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#1f2937' }}>{day.name}</div>
                              <div style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                backgroundColor: '#f3e8ff',
                                color: '#7c3aed',
                                fontSize: '10px',
                                fontWeight: '500'
                              }}>
                                {day.date}
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((timeSlot: TimeSlot, rowIndex: number) => (
                        <tr key={timeSlot.period} style={{ 
                          backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#faf5ff'
                        }}>
                          <td style={{
                            border: '2px solid #d8b4fe',
                            borderLeft: 'none',
                            borderBottom: rowIndex === timeSlots.length - 1 ? 'none' : '2px solid #d8b4fe',
                            padding: '8px',
                            backgroundColor: '#f3e8ff',
                            textAlign: 'center'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: 'linear-gradient(to right, #a855f7, #ec4899)',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}>
                                P{timeSlot.period}
                              </span>
                              <div style={{ fontSize: '10px', color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                {formatTime12Hour(timeSlot.startTime)}-{formatTime12Hour(timeSlot.endTime)}
                              </div>
                            </div>
                          </td>
                          {weekDays.map((day, colIndex) => {
                            const entry = getGlobalTimetableEntry(day.name.toLowerCase(), timeSlot.period);

                            return (
                              <td 
                                key={day.name}
                                style={{
                                  border: '2px solid #d8b4fe',
                                  borderRight: colIndex === weekDays.length - 1 ? 'none' : '2px solid #d8b4fe',
                                  borderBottom: rowIndex === timeSlots.length - 1 ? 'none' : '2px solid #d8b4fe',
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#faf5ff',
                                  verticalAlign: 'middle'
                                }}
                              >
                                {entry ? (
                                  <div 
                                    style={{
                                      ...getSubjectColor(entry.subject?.color || '#3B82F6'),
                                      borderRadius: '6px',
                                      padding: '6px 4px',
                                      textAlign: 'center',
                                      minHeight: '45px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <div style={{ 
                                      fontWeight: 'bold', 
                                      fontSize: '11px', 
                                      marginBottom: '2px',
                                      wordBreak: 'break-word',
                                      lineHeight: '1.2'
                                    }} title={entry.subject?.name || 'Unknown Subject'}>
                                      {entry.subject?.name || 'Unknown Subject'}
                                    </div>
                                    <div style={{ 
                                      fontSize: '10px',
                                      wordBreak: 'break-word',
                                      lineHeight: '1.2'
                                    }} title={entry.teacher?.name || 'Unknown'}>
                                      {entry.teacher?.name || 'Unknown'}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ color: '#9ca3af', fontSize: '14px' }}>Free</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* School-wide Timetable Fullscreen/Expand View Dialog */}
        <Dialog open={isSchoolWideFullscreenView} onOpenChange={setIsSchoolWideFullscreenView}>
          <DialogContent className="!max-w-[70vw] !w-[70vw] !h-[70vh] !max-h-[70vh] !p-0 !gap-0">
            <div className="flex flex-col h-full">
              {/* Fullscreen Header */}
              <div className="flex items-center justify-between p-2 sm:p-3 border-b bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100/50 dark:bg-blue-800/50 backdrop-blur-md p-2 rounded-md">
                    <School className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center text-base tracking-tight">
                      <CalendarIcon className="h-4 w-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                      School-wide Timetable
                    </h3>
                    <p className="text-gray-700 text-xs font-medium flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      {processedSchoolWideData && processedSchoolWideData.selectedDayName ? 
                        `${processedSchoolWideData.selectedDayName.charAt(0).toUpperCase() + processedSchoolWideData.selectedDayName.slice(1)} - ${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}` :
                        selectedSchoolDate ? 
                          `${formatDateIST(new Date(selectedSchoolDate), { month: 'long', day: 'numeric', year: 'numeric' })}` :
                          'School-wide view'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Fullscreen Timetable Content */}
              <div className="flex-1 overflow-y-auto p-1">
                {processedSchoolWideData && (
                  <div className="w-full" data-export="school-wide-expanded-timetable" style={{ 
                    border: '2px solid #d1d5db',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff'
                  }}>
                    <table className="w-full text-sm" style={{ 
                      borderCollapse: 'collapse',
                      width: '100%',
                      tableLayout: 'fixed'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#eff6ff' }}>
                          <th style={{
                            border: '2px solid #d1d5db',
                            borderTop: 'none',
                            borderLeft: 'none',
                            padding: '10px 8px',
                            textAlign: 'left',
                            fontWeight: 'bold',
                            color: '#1f2937',
                            backgroundColor: '#dbeafe'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <School className="h-3.5 w-3.5 text-blue-600" />
                              <span style={{ fontSize: '12px' }}>Class</span>
                            </div>
                          </th>
                          {processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
                            const periodNumber = processedSchoolWideData.timeSlotRows
                              .slice(0, index + 1)
                              .filter((ts: any) => !ts.isBreak)
                              .length;
                            
                            return (
                              <th key={`${timeSlot.period}-${index}`} style={{
                                border: '2px solid #d1d5db',
                                borderTop: 'none',
                                borderRight: index === processedSchoolWideData.timeSlotRows.length - 1 ? 'none' : '2px solid #d1d5db',
                                padding: '8px 4px',
                                textAlign: 'center',
                                backgroundColor: timeSlot.isBreak ? '#fff7ed' : '#dbeafe'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    backgroundColor: timeSlot.isBreak ? '#f97316' : '#3b82f6',
                                    color: '#ffffff'
                                  }}>
                                    {timeSlot.isBreak ? '☕' : `P${periodNumber}`}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                                    {formatTime12Hour(timeSlot.startTime).replace(' ', '').slice(0, -2)}-{formatTime12Hour(timeSlot.endTime).replace(' ', '').slice(0, -2)}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {processedSchoolWideData.classColumns.map((classCol: any, rowIndex: number) => (
                          <tr key={classCol.classId} style={{ 
                            backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
                          }}>
                            <td style={{
                              border: '2px solid #d1d5db',
                              borderLeft: 'none',
                              borderBottom: rowIndex === processedSchoolWideData.classColumns.length - 1 ? 'none' : '2px solid #d1d5db',
                              padding: '8px',
                              backgroundColor: '#dbeafe',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              color: '#1f2937'
                            }}>
                              {classCol.className}
                            </td>
                            {processedSchoolWideData.timeSlotRows.map((timeSlot: any, index: number) => {
                              const entry = classCol.dayEntries.find((e: any) => e.period === timeSlot.period);
                              
                              return (
                                <td 
                                  key={`${classCol.classId}-${timeSlot.period}-${index}`} 
                                  style={{
                                    border: '2px solid #d1d5db',
                                    borderRight: index === processedSchoolWideData.timeSlotRows.length - 1 ? 'none' : '2px solid #d1d5db',
                                    borderBottom: rowIndex === processedSchoolWideData.classColumns.length - 1 ? 'none' : '2px solid #d1d5db',
                                    padding: '6px 4px',
                                    textAlign: 'center',
                                    backgroundColor: timeSlot.isBreak ? '#fff7ed' : (rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'),
                                    verticalAlign: 'middle'
                                  }}
                                >
                                  {timeSlot.isBreak ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                                      <span style={{ fontSize: '14px' }}>☕</span>
                                    </div>
                                  ) : entry ? (
                                    <div 
                                      style={{
                                        ...getSubjectColor(entry.subject?.color || '#3B82F6'),
                                        borderRadius: '6px',
                                        padding: '6px 4px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        textAlign: 'center',
                                        minHeight: '45px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <div style={{ 
                                        fontWeight: 'bold', 
                                        fontSize: '11px', 
                                        marginBottom: '2px',
                                        wordBreak: 'break-word',
                                        lineHeight: '1.2'
                                      }} title={entry.subject?.name || 'Unknown'}>
                                        {entry.subject?.name || 'Unknown'}
                                      </div>
                                      <div style={{ 
                                        fontSize: '10px',
                                        wordBreak: 'break-word',
                                        lineHeight: '1.2'
                                      }} title={entry.teacher?.name || 'N/A'}>
                                        {entry.teacher?.name || 'N/A'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ color: '#9ca3af', fontSize: '11px' }}>-</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>



      </div>
    </div>
  </div>
  );
}