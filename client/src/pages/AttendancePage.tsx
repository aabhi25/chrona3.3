import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Users, UserCheck, UserX, Clock, CheckCircle2, Search, BarChart3, Download, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCcw, CalendarDays, User, Calendar, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import LeaveApplicationsSection from "@/components/LeaveApplicationsSection";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherAttendanceSchema, type TeacherAttendance as TeacherAttendanceType } from "@shared/schema";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";
import { sortClasses } from "@shared/classUtils";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAttendanceTabOrder, type AttendanceTabId } from "@/hooks/useAttendanceTabOrder";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

interface Teacher {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  schoolIdNumber?: string;
  profilePictureUrl?: string;
  subjects: string[];
  classes: string[];
  availability?: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
  };
  maxDailyPeriods?: number;
  isActive?: boolean;
  status: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rollNumber?: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianContact?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  status: string;
  class?: {
    id: string;
    name: string;
    grade: string;
    section: string;
  };
}

interface Class {
  id: string;
  name: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface Subject {
  id: string;
  name: string;
  code?: string;
}

interface TeacherAttendance {
  id: string;
  teacherId: string;
  attendanceDate: string;
  status: "present" | "absent" | "late" | "on_leave" | "medical_leave" | "personal_leave";
  reason?: string;
  markedAt: string;
  teacher?: Teacher;
  leaveStartDate?: string;
  leaveEndDate?: string;
}

interface StudentAttendance {
  id: string;
  studentId: string;
  classId: string;
  attendanceDate: string;
  status: "present" | "absent" | "late";
  reason?: string;
  markedAt: string;
  student?: Student;
}

interface AttendanceOverview {
  date: string;
  summary: {
    teachers: {
      total: number;
      present: number;
      absent: number;
      attendanceRate: number;
    };
    students: {
      total: number;
      present: number;
      absent: number;
      attendanceRate: number;
    };
  };
  classWiseAttendance: {
    classId: string;
    className: string;
    grade: string;
    section: string;
    totalStudents: number;
    presentStudents: number;
    attendanceRate: number;
  }[];
  alerts: {
    teachersAbsentConsecutive: {
      teacher: Teacher;
      consecutiveDays: number;
    }[];
    studentsLowAttendance: {
      student: Student;
      attendanceRate: number;
      totalDays: number;
      presentDays: number;
    }[];
  };
}

// Tab labels mapping
const TAB_LABELS: Record<AttendanceTabId, string> = {
  overview: 'Overview',
  teachers: 'Teachers Attendance',
  students: 'Students Attendance',
  leave: 'Leave Management',
};

// Sortable Tab Trigger Component
function SortableTabTrigger({ id, children, ...props }: { id: string; children: React.ReactNode; value: string; 'data-testid'?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <TabsTrigger
      ref={setNodeRef}
      style={style}
      {...props}
      className="relative group"
    >
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners}>
          <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
        {children}
      </div>
    </TabsTrigger>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  // Initialize selectedDate with IST timezone to match the backend
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  // Handle deep linking via query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const view = params.get('view');
    if (view && ['overview', 'teachers', 'students', 'leave'].includes(view)) {
      setActiveTab(view);
    }
  }, [location]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<string>("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>("all");
  const [leaveSearchTerm, setLeaveSearchTerm] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("all");
  const [leaveDateRangeFilter, setLeaveDateRangeFilter] = useState<string>("all");
  const [isClassAttendanceExpanded, setIsClassAttendanceExpanded] = useState(false);
  
  // Drag-and-drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Tab order management
  const { tabs, updateTabOrder, isLoading: isTabOrderLoading } = useAttendanceTabOrder();
  
  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if selected date is today (in IST timezone)
  const isToday = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return selectedDate === today;
  }, [selectedDate]);

  // Check if selected date is a working day
  const { data: isWorkingDay = true } = useQuery<boolean>({
    queryKey: ["/api/working-day", selectedDate],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/working-day?date=${selectedDate}`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        // If endpoint doesn't exist or fails, default to true (working day)
        return true;
      }
      const data = await response.json();
      return data.isWorkingDay;
    },
    enabled: user?.role === "admin" || user?.role === "super_admin",
  });

  // Helper function to convert class IDs to class names
  const getClassNames = (classIds: string[]): string => {
    if (!classIds || classIds.length === 0) return 'None assigned';
    
    const classNames = classIds.map(classId => {
      const classInfo = classes.find(c => c.id === classId);
      if (classInfo) {
        return `Class ${classInfo.grade}${classInfo.section ? ' ' + classInfo.section : ''}`;
      }
      return classId; // fallback to ID if class not found
    });
    
    return classNames.join(', ');
  };

  // Helper function to convert subject IDs to subject names
  const getSubjectNames = (subjectIds: string[]): string => {
    if (!subjectIds || subjectIds.length === 0) return 'None assigned';
    
    const subjectNames = subjectIds.map(subjectId => {
      const subjectInfo = subjects.find(s => s.id === subjectId);
      if (subjectInfo) {
        return subjectInfo.name;
      }
      return subjectId; // fallback to ID if subject not found
    });
    
    return subjectNames.join(', ');
  };

  // Fetch teachers
  const { data: teachersResponse, isLoading: teachersLoading } = useQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers?schoolId=${user?.schoolId}&limit=1000`);
      return response.json();
    },
    enabled: !!(user?.role === "admin" || user?.role === "super_admin") && !!user?.schoolId,
  });
  
  const teachers = teachersResponse?.teachers || [];

  // Fetch classes
  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ["/api/classes", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/classes?schoolId=${user?.schoolId}`);
      return response.json();
    },
    enabled: !!(user?.role === "admin" || user?.role === "super_admin") && !!user?.schoolId,
  });

  // Fetch subjects
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    enabled: user?.role === "admin" || user?.role === "super_admin",
  });

  // Fetch students for selected class
  const { data: studentsResponse, isLoading: studentsLoading, error: studentsError } = useQuery<{ students: Student[], totalCount: number }>({
    queryKey: ["/api/students", selectedClass],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students?classId=${selectedClass}`);
      return response.json();
    },
    enabled: !!selectedClass && (user?.role === "admin" || user?.role === "super_admin"),
  });
  
  const students = studentsResponse?.students || [];

  // Fetch teacher attendance
  const { data: teacherAttendance = [], isLoading: teacherAttendanceLoading } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", selectedDate],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/teacher-attendance?date=${selectedDate}`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher attendance: ${response.status}`);
      }
      return response.json();
    },
    enabled: user?.role === "admin" || user?.role === "super_admin",
  });

  // Fetch student attendance for selected class
  const { data: studentAttendance = [], isLoading: studentAttendanceLoading, error: studentAttendanceError } = useQuery<StudentAttendance[]>({
    queryKey: ["/api/student-attendance", selectedClass, selectedDate],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/student-attendance?classId=${selectedClass}&date=${selectedDate}`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch student attendance: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && (user?.role === "admin" || user?.role === "super_admin"),
  });

  // Fetch attendance overview
  const { data: attendanceOverview, isLoading: overviewLoading } = useQuery<AttendanceOverview>({
    queryKey: ["/api/attendance/overview", selectedDate],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/attendance/overview?date=${selectedDate}`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch attendance overview: ${response.status}`);
      }
      return response.json();
    },
    enabled: user?.role === "admin" || user?.role === "super_admin",
  });

  // Query for all teachers on leave (with date ranges)
  const { data: allTeachersOnLeave = [] } = useQuery({
    queryKey: ["/api/teacher-attendance/all-leave", user?.schoolId],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/teacher-attendance`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher attendance: ${response.status}`);
      }
      const allAttendance = await response.json() as TeacherAttendance[];
      
      // Filter for leave records and group by teacher with date ranges
      const leaveRecords = allAttendance.filter(att => 
        att.status !== "present" && att.leaveStartDate && att.leaveEndDate
      );
      
      // Group by teacher and get unique leave periods
      const leaveByTeacher = new Map<string, {
        teacherId: string;
        teacherName: string;
        periods: Array<{
          startDate: string; 
          endDate: string; 
          reason?: string; 
          status: string;
          isActive: boolean;
        }>;
      }>();
      
      const today = getCurrentDateIST();
      
      leaveRecords.forEach(record => {
        const teacher = teachers.find(t => t.id === record.teacherId);
        if (!teacher) return;
        
        if (!leaveByTeacher.has(record.teacherId)) {
          leaveByTeacher.set(record.teacherId, {
            teacherId: record.teacherId,
            teacherName: teacher.name,
            periods: []
          });
        }
        
        const existing = leaveByTeacher.get(record.teacherId)!;
        const periodExists = existing.periods.some(p => 
          p.startDate === record.leaveStartDate && p.endDate === record.leaveEndDate
        );
        
        if (!periodExists && record.leaveStartDate && record.leaveEndDate) {
          const isActive = record.leaveStartDate <= today && today <= record.leaveEndDate;
          existing.periods.push({
            startDate: record.leaveStartDate,
            endDate: record.leaveEndDate,
            reason: record.reason || undefined,
            status: record.status,
            isActive
          });
        }
      });
      
      // Sort periods by start date (most recent first)
      leaveByTeacher.forEach(data => {
        data.periods.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      });
      
      return Array.from(leaveByTeacher.values());
    },
    enabled: !!user?.schoolId && (activeTab === "overview" || activeTab === "leave") && teachers.length > 0,
  });

  // Filter for currently active leave periods
  const currentlyOnLeave = allTeachersOnLeave.filter(teacher => 
    teacher.periods.some(period => period.isActive)
  );

  // Fetch teacher attendance for last 30 days for pattern analysis
  const { data: teacherAttendanceLast30Days = [] } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance/last-30-days"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Calculate date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const response = await fetch(`/api/teacher-attendance?startDate=${startDateStr}&endDate=${endDateStr}`, { 
        headers,
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch teacher attendance: ${response.status}`);
      }
      return response.json();
    },
    enabled: activeTab === "overview" && (user?.role === "admin" || user?.role === "super_admin"),
  });


  // Sort attendance data chronologically for accurate trend analysis
  const sorted30DayAttendance = useMemo(() => {
    if (!teacherAttendanceLast30Days) return [];
    
    // Sort by attendance date (oldest first)
    return [...teacherAttendanceLast30Days].sort((a, b) => 
      new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime()
    );
  }, [teacherAttendanceLast30Days]);

  // Mark teacher attendance mutation with optimistic updates
  const markTeacherAttendanceMutation = useMutation({
    mutationFn: async (data: { teacherId: string; status: string; reason?: string }) => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/teacher-attendance", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          teacherId: data.teacherId,
          attendanceDate: selectedDate,
          status: data.status,
          reason: data.reason,
          // Removed schoolId - backend uses user's schoolId for security
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark teacher attendance");
      }
      return response.json();
    },
    onMutate: async (data) => {
      // Capture the date at mutation time to avoid race conditions
      const mutationDate = selectedDate;
      
      // Show instant feedback for absent status
      if (data.status === 'absent') {
        toast({
          title: "Processing...",
          description: "Creating substitutions and finding available teachers",
        });
      }
      
      // OPTIMIZATION: Instant UI update when marking teacher present
      if (data.status === 'present') {
        // Cancel any outgoing queries
        await queryClient.cancelQueries({ queryKey: ["/api/teacher-attendance", mutationDate] });
        await queryClient.cancelQueries({ queryKey: ["/api/substitutions/urgent"] });
        
        // Snapshot previous states for rollback
        const previousAttendance = queryClient.getQueryData<TeacherAttendance[]>(["/api/teacher-attendance", mutationDate]);
        const previousSubstitutions = queryClient.getQueryData(["/api/substitutions/urgent"]);
        
        // Optimistically update teacher attendance to 'present'
        queryClient.setQueryData<TeacherAttendance[]>(["/api/teacher-attendance", mutationDate], (old) => {
          const currentData = old || [];
          const existingIndex = currentData.findIndex(record => record.teacherId === data.teacherId);
          
          if (existingIndex >= 0) {
            const newArray = [...currentData];
            newArray[existingIndex] = {
              ...newArray[existingIndex],
              status: 'present',
              reason: data.reason,
            };
            return newArray;
          } else {
            return [...currentData, {
              id: `temp-${data.teacherId}-${Date.now()}`,
              teacherId: data.teacherId,
              attendanceDate: mutationDate,
              status: 'present',
              reason: data.reason,
              markedAt: new Date().toISOString(),
            }];
          }
        });
        
        // Optimistically remove all substitutions for this teacher on this date
        queryClient.setQueryData(["/api/substitutions/urgent"], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          
          return old.filter((sub: any) => 
            !(sub.originalTeacherId === data.teacherId && sub.date === mutationDate)
          );
        });
        
        // Show instant feedback
        toast({
          title: "Processing...",
          description: "Cancelling substitutions...",
        });
        
        // Store for rollback
        return { previousAttendance, mutationDate, previousSubstitutions };
      }
      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/teacher-attendance", mutationDate] });

      // Snapshot the previous value
      const previousAttendance = queryClient.getQueryData<TeacherAttendance[]>(["/api/teacher-attendance", mutationDate]);

      // Optimistically update the cache
      queryClient.setQueryData<TeacherAttendance[]>(["/api/teacher-attendance", mutationDate], (old) => {
        const currentData = old || []; // Handle undefined cache by initializing to empty array
        
        // Find existing record for this teacher
        const existingIndex = currentData.findIndex(record => record.teacherId === data.teacherId);
        
        if (existingIndex >= 0) {
          // Update existing record
          const newArray = [...currentData];
          newArray[existingIndex] = {
            ...newArray[existingIndex],
            status: data.status as "present" | "absent" | "late",
            reason: data.reason,
          };
          return newArray;
        } else {
          // Create new record
          const newRecord: TeacherAttendance = {
            id: `temp-${data.teacherId}-${Date.now()}`, // Temporary ID
            teacherId: data.teacherId,
            attendanceDate: mutationDate,
            status: data.status as "present" | "absent" | "late",
            reason: data.reason,
            markedAt: new Date().toISOString(),
          };
          return [...currentData, newRecord];
        }
      });

      return { previousAttendance, mutationDate };
    },
    onError: (error, data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAttendance && context?.mutationDate) {
        queryClient.setQueryData(["/api/teacher-attendance", context.mutationDate], context.previousAttendance);
      }
      
      // Rollback substitutions if present status failed
      if (data.status === 'present' && (context as any)?.previousSubstitutions) {
        queryClient.setQueryData(["/api/substitutions/urgent"], (context as any).previousSubstitutions);
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to mark teacher attendance",
        variant: "destructive",
      });
      console.error("Error marking teacher attendance:", error);
      
      // Only refetch on error to sync with server, using mutation date from context
      if (context?.mutationDate) {
        queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance", context.mutationDate] });
      }
      
      // Refetch substitutions on error too
      if (data.status === 'present') {
        queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
      }
    },
    onSuccess: (serverData, variables, context) => {
      // Update cache with server response instead of refetching, using mutation date from context
      if (context?.mutationDate) {
        queryClient.setQueryData<TeacherAttendance[]>(["/api/teacher-attendance", context.mutationDate], (old) => {
          const currentData = old || [];
          const existingIndex = currentData.findIndex(record => record.id === serverData.id || record.teacherId === serverData.teacherId);
          
          if (existingIndex >= 0) {
            const newArray = [...currentData];
            newArray[existingIndex] = serverData;
            return newArray;
          } else {
            return [...currentData, serverData];
          }
        });
      }
      
      // Invalidate urgent substitutions query to trigger refresh
      if (variables.status === 'absent') {
        queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
        toast({
          title: "Success",
          description: "Teacher marked absent. Substitutions created successfully.",
        });
      } else if (variables.status === 'present') {
        // Invalidate to sync backend cancellations (optimistic update already done)
        queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
        toast({
          title: "Success",
          description: "Teacher marked present. Substitutions cancelled.",
        });
      } else {
        toast({
          title: "Success",
          description: "Teacher attendance marked successfully",
        });
      }
    },
  });

  // Mark student attendance mutation with optimistic updates
  const markStudentAttendanceMutation = useMutation({
    mutationFn: async (data: { studentId: string; status: string; reason?: string }) => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/student-attendance", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          studentId: data.studentId,
          classId: selectedClass,
          attendanceDate: selectedDate,
          status: data.status,
          reason: data.reason,
          // Removed schoolId - backend uses user's schoolId for security
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark student attendance");
      }
      return response.json();
    },
    onMutate: async (data) => {
      // Capture the class and date at mutation time to avoid race conditions
      const mutationClass = selectedClass;
      const mutationDate = selectedDate;
      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/student-attendance", mutationClass, mutationDate] });

      // Snapshot the previous value
      const previousAttendance = queryClient.getQueryData<StudentAttendance[]>(["/api/student-attendance", mutationClass, mutationDate]);

      // Optimistically update the cache
      queryClient.setQueryData<StudentAttendance[]>(["/api/student-attendance", mutationClass, mutationDate], (old) => {
        const currentData = old || []; // Handle undefined cache by initializing to empty array
        
        // Find existing record for this student
        const existingIndex = currentData.findIndex(record => record.studentId === data.studentId);
        
        if (existingIndex >= 0) {
          // Update existing record
          const newArray = [...currentData];
          newArray[existingIndex] = {
            ...newArray[existingIndex],
            status: data.status as "present" | "absent" | "late",
            reason: data.reason,
          };
          return newArray;
        } else {
          // Create new record
          const newRecord: StudentAttendance = {
            id: `temp-${data.studentId}-${Date.now()}`, // Temporary ID
            studentId: data.studentId,
            classId: mutationClass,
            attendanceDate: mutationDate,
            status: data.status as "present" | "absent" | "late",
            reason: data.reason,
            markedAt: new Date().toISOString(),
          };
          return [...currentData, newRecord];
        }
      });

      return { previousAttendance, mutationClass, mutationDate };
    },
    onError: (error, data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAttendance && context?.mutationClass && context?.mutationDate) {
        queryClient.setQueryData(["/api/student-attendance", context.mutationClass, context.mutationDate], context.previousAttendance);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to mark student attendance",
        variant: "destructive",
      });
      console.error("Error marking student attendance:", error);
      
      // Only refetch on error to sync with server, using mutation class and date from context
      if (context?.mutationClass && context?.mutationDate) {
        queryClient.invalidateQueries({ queryKey: ["/api/student-attendance", context.mutationClass, context.mutationDate] });
      }
    },
    onSuccess: (serverData, variables, context) => {
      // Update cache with server response instead of refetching, using mutation class and date from context
      if (context?.mutationClass && context?.mutationDate) {
        queryClient.setQueryData<StudentAttendance[]>(["/api/student-attendance", context.mutationClass, context.mutationDate], (old) => {
          const currentData = old || [];
          const existingIndex = currentData.findIndex(record => record.id === serverData.id || record.studentId === serverData.studentId);
          
          if (existingIndex >= 0) {
            const newArray = [...currentData];
            newArray[existingIndex] = serverData;
            return newArray;
          } else {
            return [...currentData, serverData];
          }
        });
      }
      
      toast({
        title: "Success",
        description: "Student attendance marked successfully",
      });
    },
  });

  // Bulk mark all teachers present mutation
  const markAllTeachersPresentMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/teacher-attendance/mark-all-present", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          date: selectedDate,
          // Removed schoolId - backend uses user's schoolId for security
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark all teachers present");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance"] });
      toast({
        title: "Success",
        description: `${data.message}. Created: ${data.createdCount}, Skipped existing: ${data.skippedExistingCount}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all teachers present",
        variant: "destructive",
      });
      console.error("Error marking all teachers present:", error);
    },
  });

  // Bulk mark all students in class present mutation
  const markAllStudentsPresentMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/student-attendance/mark-all-present", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          date: selectedDate,
          classId: selectedClass,
          // Removed schoolId - backend uses user's schoolId for security
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark all students present");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-attendance"] });
      toast({
        title: "Success",
        description: `${data.message}. Created: ${data.createdCount}, Skipped existing: ${data.skippedExistingCount}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all students present",
        variant: "destructive",
      });
      console.error("Error marking all students present:", error);
    },
  });

  const handleTeacherAttendance = (teacherId: string, status: "present" | "absent" | "late") => {
    if (!isWorkingDay) {
      toast({
        title: "Cannot Mark Attendance",
        description: "Today is not a working day for your school.",
        variant: "destructive",
      });
      return;
    }
    markTeacherAttendanceMutation.mutate({ teacherId, status });
  };

  const handleStudentAttendance = (studentId: string, status: "present" | "absent" | "late") => {
    if (!isWorkingDay) {
      toast({
        title: "Cannot Mark Attendance",
        description: "Today is not a working day for your school.",
        variant: "destructive",
      });
      return;
    }
    markStudentAttendanceMutation.mutate({ studentId, status });
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.indexOf(active.id as AttendanceTabId);
      const newIndex = tabs.indexOf(over.id as AttendanceTabId);

      const newOrder = [...tabs];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);

      updateTabOrder(newOrder);
    }

    setActiveId(null);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "present":
        return (
          <div className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/40 rounded-full border border-green-200 dark:border-green-700/50">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
            <span className="text-sm text-green-700 dark:text-green-300">Present</span>
          </div>
        );
      case "absent":
        return (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-50 dark:bg-red-900/40 rounded-full border border-red-200 dark:border-red-700/50">
            <div className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full"></div>
            <span className="text-sm text-red-700 dark:text-red-300">Absent</span>
          </div>
        );
      case "late":
        return (
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/40 rounded-full border border-yellow-200 dark:border-yellow-700/50">
            <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full"></div>
            <span className="text-sm text-yellow-700 dark:text-yellow-300">Late</span>
          </div>
        );
      case "on_leave":
      case "medical_leave":
      case "personal_leave":
        return (
          <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/40 rounded-full border border-blue-200 dark:border-blue-700/50">
            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
            <span className="text-sm text-blue-700 dark:text-blue-300">On Leave</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-full border border-gray-200 dark:border-gray-700/50">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Not Marked</span>
          </div>
        );
    }
  };

  const getAttendanceRecord = (personId: string, attendanceList: any[]) => {
    if (!Array.isArray(attendanceList)) {
      return undefined;
    }
    return attendanceList.find(record => 
      record.teacherId === personId || record.studentId === personId
    );
  };

  // Check if teacher is on leave for the selected date
  const isTeacherOnLeave = (teacherId: string): boolean => {
    const attendanceRecord = getAttendanceRecord(teacherId, teacherAttendance);
    if (!attendanceRecord) return false;
    
    const { status, leaveStartDate, leaveEndDate } = attendanceRecord;
    
    // Check if the status is a leave status
    const isLeaveStatus = ['on_leave', 'medical_leave', 'personal_leave'].includes(status);
    
    // If there's a leave period, check if selected date falls within it
    if (leaveStartDate && leaveEndDate) {
      const selected = new Date(selectedDate);
      const start = new Date(leaveStartDate);
      const end = new Date(leaveEndDate);
      return selected >= start && selected <= end;
    }
    
    // Otherwise, just check the status
    return isLeaveStatus;
  };

  // Filter and sort teachers alphabetically based on search term and status
  const filteredTeachers = teachers
    .filter((teacher) => {
      const searchLower = teacherSearchTerm.toLowerCase();
      const teacherName = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`;
      
      // Get class names for this teacher
      const teacherClassNames = getClassNames(teacher.classes).toLowerCase();
      
      // Check if teacher matches search term
      const matchesSearch = (
        teacherName.toLowerCase().includes(searchLower) ||
        (teacher.employeeId && teacher.employeeId.toLowerCase().includes(searchLower)) ||
        (teacher.schoolIdNumber && teacher.schoolIdNumber.toLowerCase().includes(searchLower)) ||
        teacherClassNames.includes(searchLower)
      );
      
      // Check status filter
      if (teacherStatusFilter === "all") {
        return matchesSearch;
      }
      
      const attendanceRecord = getAttendanceRecord(teacher.id, teacherAttendance);
      
      if (teacherStatusFilter === "present") {
        return matchesSearch && attendanceRecord?.status === "present";
      } else if (teacherStatusFilter === "absent") {
        return matchesSearch && (attendanceRecord?.status === "absent" || attendanceRecord?.status === "on_leave" || attendanceRecord?.status === "medical_leave" || attendanceRecord?.status === "personal_leave");
      } else if (teacherStatusFilter === "late") {
        return matchesSearch && attendanceRecord?.status === "late";
      } else if (teacherStatusFilter === "not_marked") {
        return matchesSearch && !attendanceRecord;
      }
      
      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort alphabetically by name
      const nameA = a.name || `${a.firstName || ''} ${a.lastName || ''}`;
      const nameB = b.name || `${b.firstName || ''} ${b.lastName || ''}`;
      return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
    });

  // Filter students based on search term and status
  const filteredStudents = students.filter((student) => {
    const searchLower = studentSearchTerm.toLowerCase();
    const studentName = `${student.firstName} ${student.lastName}`;
    
    // Check if student matches search term
    const matchesSearch = (
      studentName.toLowerCase().includes(searchLower) ||
      student.admissionNumber.toLowerCase().includes(searchLower) ||
      (student.rollNumber && student.rollNumber.toLowerCase().includes(searchLower))
    );
    
    // Check status filter
    if (studentStatusFilter === "all") {
      return matchesSearch;
    }
    
    const attendanceRecord = getAttendanceRecord(student.id, studentAttendance);
    
    if (studentStatusFilter === "present") {
      return matchesSearch && attendanceRecord?.status === "present";
    } else if (studentStatusFilter === "absent") {
      return matchesSearch && attendanceRecord?.status === "absent";
    } else if (studentStatusFilter === "late") {
      return matchesSearch && attendanceRecord?.status === "late";
    } else if (studentStatusFilter === "not_marked") {
      return matchesSearch && !attendanceRecord;
    }
    
    return matchesSearch;
  });

  // Helper function to get initials from name
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper function to get badge color based on leave type
  const getLeaveTypeBadgeColor = (status: string) => {
    switch (status) {
      case 'medical_leave':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700/50';
      case 'personal_leave':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700/50';
      case 'on_leave':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700/50';
      case 'absent':
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50';
    }
  };

  // Helper function to calculate days between dates
  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Helper function to check if date is in range
  const isInDateRange = (startDate: string, endDate: string, rangeFilter: string) => {
    const today = new Date(getCurrentDateIST());
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (rangeFilter === "all") return true;
    
    if (rangeFilter === "this_week") {
      const weekAgo = new Date(new Date(getCurrentDateIST()));
      weekAgo.setDate(weekAgo.getDate() - 7);
      return start >= weekAgo || end >= weekAgo;
    }
    
    if (rangeFilter === "this_month") {
      const monthAgo = new Date(new Date(getCurrentDateIST()));
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return start >= monthAgo || end >= monthAgo;
    }
    
    if (rangeFilter === "last_3_months") {
      const threeMonthsAgo = new Date(new Date(getCurrentDateIST()));
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return start >= threeMonthsAgo || end >= threeMonthsAgo;
    }
    
    return true;
  };

  // Calculate leave statistics
  const leaveStatistics = useMemo(() => {
    const today = getCurrentDateIST();
    let onLeaveToday = 0;
    let activeLeavePeriodsCount = 0;
    let totalLeaveRecords = 0;
    const leaveTypeCounts: Record<string, number> = {};

    allTeachersOnLeave.forEach((teacherData) => {
      teacherData.periods.forEach((period) => {
        totalLeaveRecords++;
        
        // Count leave types
        leaveTypeCounts[period.status] = (leaveTypeCounts[period.status] || 0) + 1;
        
        // Check if active today
        if (period.isActive) {
          activeLeavePeriodsCount++;
          // Count unique teachers on leave today (only count once per teacher)
          if (period.startDate <= today && today <= period.endDate) {
            onLeaveToday++;
          }
        }
      });
    });
    
    // Deduplicate teachers on leave today
    const uniqueTeachersOnLeaveToday = new Set();
    allTeachersOnLeave.forEach((teacherData) => {
      teacherData.periods.forEach((period) => {
        if (period.isActive && period.startDate <= today && today <= period.endDate) {
          uniqueTeachersOnLeaveToday.add(teacherData.teacherId);
        }
      });
    });

    // Find most common leave type
    let mostCommonType = "None";
    let maxCount = 0;
    Object.entries(leaveTypeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    });

    return {
      onLeaveToday: uniqueTeachersOnLeaveToday.size,
      activeLeavePeriodsCount,
      totalLeaveRecords,
      mostCommonType: maxCount > 0 ? mostCommonType : "None",
    };
  }, [allTeachersOnLeave]);

  // Filter leave records based on search and filters
  const filteredLeaveRecords = useMemo(() => {
    let filtered = allTeachersOnLeave;

    // Filter by search term
    if (leaveSearchTerm) {
      const searchLower = leaveSearchTerm.toLowerCase();
      filtered = filtered.filter((teacherData) =>
        teacherData.teacherName.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (leaveStatusFilter !== "all") {
      filtered = filtered.map((teacherData) => ({
        ...teacherData,
        periods: teacherData.periods.filter((period) => {
          if (leaveStatusFilter === "active") return period.isActive;
          if (leaveStatusFilter === "past") return !period.isActive;
          return true;
        }),
      })).filter((teacherData) => teacherData.periods.length > 0);
    }

    // Filter by leave type
    if (leaveTypeFilter !== "all") {
      filtered = filtered.map((teacherData) => ({
        ...teacherData,
        periods: teacherData.periods.filter((period) => period.status === leaveTypeFilter),
      })).filter((teacherData) => teacherData.periods.length > 0);
    }

    // Filter by date range
    if (leaveDateRangeFilter !== "all") {
      filtered = filtered.map((teacherData) => ({
        ...teacherData,
        periods: teacherData.periods.filter((period) =>
          isInDateRange(period.startDate, period.endDate, leaveDateRangeFilter)
        ),
      })).filter((teacherData) => teacherData.periods.length > 0);
    }

    return filtered;
  }, [allTeachersOnLeave, leaveSearchTerm, leaveStatusFilter, leaveTypeFilter, leaveDateRangeFilter]);

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-purple-600" />
            Attendance Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Mark and manage attendance for teachers and students
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm"
              data-testid="input-attendance-date"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
            <TabsList className="grid w-full grid-cols-4">
              {tabs.map((tabId) => (
                <SortableTabTrigger
                  key={tabId}
                  id={tabId}
                  value={tabId}
                  data-testid={`tab-${tabId}`}
                >
                  {TAB_LABELS[tabId]}
                </SortableTabTrigger>
              ))}
            </TabsList>
          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <div className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium shadow-lg">
                {TAB_LABELS[activeId as AttendanceTabId]}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <TabsContent value="overview" className="space-y-4">
          {/* Overview Header with Refresh Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Daily Overview</h2>
              <p className="text-sm text-muted-foreground">
                Overview for {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Invalidate all attendance-related queries to refresh data
                queryClient.invalidateQueries({ queryKey: ["/api/attendance/overview"] });
                queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance"] });
                queryClient.invalidateQueries({ queryKey: ["/api/student-attendance"] });
                queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
                queryClient.invalidateQueries({ queryKey: ["/api/students"] });
                queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
                toast({
                  title: "Data Refreshed",
                  description: "Attendance data has been refreshed successfully.",
                });
              }}
              className="flex items-center space-x-2"
              disabled={overviewLoading}
            >
              <RefreshCcw className={`h-4 w-4 ${overviewLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Attendance</span>
            </Button>
          </div>
          
          {overviewLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : attendanceOverview ? (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <Badge variant="secondary" className="font-semibold text-xs">{attendanceOverview.summary.teachers.attendanceRate}%</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Total Teachers</p>
                      <p className="text-2xl font-bold text-gray-900">{attendanceOverview.summary.teachers.total}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{attendanceOverview.summary.teachers.present}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{attendanceOverview.summary.teachers.absent}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <Badge variant="secondary" className="font-semibold text-xs">{attendanceOverview.summary.students.attendanceRate}%</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Total Students</p>
                      <p className="text-2xl font-bold text-gray-900">{attendanceOverview.summary.students.total}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{attendanceOverview.summary.students.present}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{attendanceOverview.summary.students.absent}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Teacher</p>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Attendance</p>
                      <p className="text-2xl font-bold text-gray-900">{attendanceOverview.summary.teachers.attendanceRate}%</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-orange-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Student</p>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Attendance</p>
                      <p className="text-2xl font-bold text-gray-900">{attendanceOverview.summary.students.attendanceRate}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Class-wise Attendance */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Class-wise Attendance</h2>
                </div>

                {/* Two-column grid: Chart and Summary Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left Column: Interactive Bar Chart */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Attendance by Class</CardTitle>
                      <CardDescription className="text-xs">Visual breakdown of attendance rates across all classes</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {(() => {
                        // Create a single sorted array with displayLabel for both data and color mapping
                        const sortedClassData = attendanceOverview.classWiseAttendance
                          .map(cls => ({
                            ...cls,
                            displayLabel: cls.section ? `${cls.grade}-${cls.section}` : cls.grade
                          }))
                          .sort((a, b) => {
                            const gradeA = parseInt(a.grade) || 0;
                            const gradeB = parseInt(b.grade) || 0;
                            if (gradeA !== gradeB) {
                              return gradeA - gradeB;
                            }
                            return (a.section || '').localeCompare(b.section || '');
                          });

                        const displayData = isClassAttendanceExpanded ? sortedClassData : sortedClassData.slice(0, 6);

                        return (
                          <>
                            <ResponsiveContainer width="100%" height={displayData.length * 30 + 50}>
                              <BarChart 
                                data={displayData}
                                layout="vertical"
                              >
                                <XAxis 
                                  type="number"
                                  domain={[0, Math.max(...displayData.map(d => d.attendanceRate)) + 10]}
                                  hide={true}
                                />
                                <YAxis 
                                  type="category"
                                  dataKey="displayLabel" 
                                  tick={{ fill: 'currentColor', fontSize: 10 }}
                                  tickLine={{ stroke: 'currentColor' }}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    color: 'hsl(var(--foreground))',
                                    fontSize: '11px',
                                    padding: '8px'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${value}%`,
                                    `Attendance (${props.payload.presentStudents}/${props.payload.totalStudents})`
                                  ]}
                                  labelFormatter={(label) => `Class ${label}`}
                                />
                                <Bar dataKey="attendanceRate" radius={[0, 8, 8, 0]} barSize={20}>
                                  {displayData.map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={
                                        entry.attendanceRate >= 90 ? '#22c55e' :
                                        entry.attendanceRate >= 75 ? '#eab308' : '#ef4444'
                                      }
                                    />
                                  ))}
                                  <LabelList 
                                    dataKey="attendanceRate" 
                                    position="right" 
                                    formatter={(value: number, entry: any, index: number) => {
                                      const item = displayData[index];
                                      if (!item || item.presentStudents === undefined || item.totalStudents === undefined) {
                                        return `${value}%`;
                                      }
                                      return `${value}% (${item.presentStudents}/${item.totalStudents})`;
                                    }}
                                    style={{ fontSize: '11px', fill: 'hsl(var(--foreground))' }} 
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            
                            {/* Expand/Collapse Button - Only show if there are more than 6 classes */}
                            {sortedClassData.length > 6 && (
                              <button
                                onClick={() => setIsClassAttendanceExpanded(!isClassAttendanceExpanded)}
                                className="w-full mt-3 p-3 flex items-center justify-center gap-2 border border-border rounded-md bg-muted/50 hover:bg-muted hover:shadow-sm transition-all cursor-pointer"
                              >
                                {isClassAttendanceExpanded ? (
                                  <>
                                    <ChevronUp className="h-5 w-5" />
                                    <span className="text-sm font-medium">Showing all {sortedClassData.length} classes • Click to collapse</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-5 w-5" />
                                    <span className="text-sm font-medium">Showing 6 of {sortedClassData.length} classes • Click to expand</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Right Column: Summary Statistics */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Overall Performance</CardTitle>
                      <CardDescription className="text-xs">Class attendance metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Classes</p>
                        <p className="text-lg md:text-xl font-semibold">{attendanceOverview.classWiseAttendance.length}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Average Attendance</p>
                        <p className="text-lg md:text-xl font-semibold">
                          {(attendanceOverview.classWiseAttendance.reduce((acc, c) => acc + c.attendanceRate, 0) / 
                            attendanceOverview.classWiseAttendance.length || 0).toFixed(1)}%
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Classes with ≥90%</p>
                        <div className="flex items-baseline space-x-2">
                          <p className="text-lg md:text-xl font-semibold text-green-600">
                            {attendanceOverview.classWiseAttendance.filter(c => c.attendanceRate >= 90).length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            of {attendanceOverview.classWiseAttendance.length}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Classes with &lt;75%</p>
                        <div className="flex items-baseline space-x-2">
                          <p className="text-lg md:text-xl font-semibold text-red-600">
                            {attendanceOverview.classWiseAttendance.filter(c => c.attendanceRate < 75).length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            of {attendanceOverview.classWiseAttendance.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Notable Alerts */}
              {(attendanceOverview.alerts.teachersAbsentConsecutive.length > 0 || 
                attendanceOverview.alerts.studentsLowAttendance.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span>Notable Alerts</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Teachers Absent Consecutively */}
                    {attendanceOverview.alerts.teachersAbsentConsecutive.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-600 mb-2 flex items-center space-x-2">
                          <UserX className="h-4 w-4" />
                          <span>Teachers Absent 3+ Consecutive Days</span>
                        </h4>
                        <div className="space-y-2">
                          {attendanceOverview.alerts.teachersAbsentConsecutive.map((alert) => (
                            <div key={alert.teacher.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700/50 rounded">
                              <div>
                                <p className="font-medium">{alert.teacher.name}</p>
                                <p className="text-sm text-muted-foreground">ID: {alert.teacher.employeeId}</p>
                              </div>
                              <Badge variant="destructive">
                                {alert.consecutiveDays} consecutive days
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Students with Low Attendance */}
                    {attendanceOverview.alerts.studentsLowAttendance.length > 0 && (
                      <div>
                        <h4 className="font-medium text-orange-600 mb-2 flex items-center space-x-2">
                          <UserX className="h-4 w-4" />
                          <span>Students with Low Attendance (&lt;75%)</span>
                        </h4>
                        <div className="space-y-2">
                          {attendanceOverview.alerts.studentsLowAttendance.map((alert) => (
                            <div key={alert.student.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/50 rounded">
                              <div>
                                <p className="font-medium">{alert.student.firstName} {alert.student.lastName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {alert.student.class?.name} • {alert.presentDays}/{alert.totalDays} days present
                                </p>
                              </div>
                              <Badge variant="destructive">
                                {alert.attendanceRate}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Teacher Attendance Insights Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Teacher Attendance Insights</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Module 1: Teacher Absence Impact */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <span>Teacher Absence Impact</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Real-time impact of teacher absences on classes and students today
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        // Get teachers who are absent or on leave today
                        const absentTeachers = teacherAttendance.filter(att => 
                          att.status === 'absent' || 
                          att.status === 'on_leave' || 
                          att.status === 'medical_leave' || 
                          att.status === 'personal_leave'
                        );

                        if (absentTeachers.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <p className="text-lg font-medium text-green-600">All teachers present today! 🎉</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {absentTeachers.map((attendance) => {
                              const teacher = teachers.find(t => t.id === attendance.teacherId);
                              if (!teacher) return null;

                              // Calculate impact
                              const affectedClasses = classes.filter(c => teacher.classes.includes(c.id));
                              const totalStudentsImpacted = affectedClasses.reduce((sum, c) => sum + c.studentCount, 0);
                              
                              // Determine status display
                              const statusDisplay = attendance.status === 'absent' ? 'Absent' :
                                                   attendance.status === 'on_leave' ? 'On Leave' :
                                                   attendance.status === 'medical_leave' ? 'Medical Leave' :
                                                   attendance.status === 'personal_leave' ? 'Personal Leave' : 'Absent';
                              
                              const statusColor = attendance.status === 'absent' ? 'destructive' :
                                                 attendance.status.includes('leave') ? 'default' : 'destructive';

                              return (
                                <div key={attendance.id} className="flex items-start space-x-3 p-3 border rounded-lg bg-muted/30">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={teacher.profilePictureUrl || undefined} alt={teacher.name} />
                                    <AvatarFallback className="bg-orange-100 text-orange-600">
                                      {teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-medium truncate">{teacher.name}</p>
                                      <Badge variant={statusColor as any} className="ml-2 shrink-0">
                                        {statusDisplay}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1">
                                      <strong>Classes:</strong> {affectedClasses.length > 0 ? 
                                        affectedClasses.map(c => `${c.grade}${c.section ? ' ' + c.section : ''}`).join(', ') : 
                                        'None assigned'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-1">
                                      <strong>Students impacted:</strong> {totalStudentsImpacted} students
                                    </p>
                                    {attendance.reason && (
                                      <p className="text-xs text-muted-foreground mb-1">
                                        <strong>Reason:</strong> {attendance.reason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Module 2: Teacher Attendance Patterns */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        <span>Teacher Attendance Patterns</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Attendance patterns over the last 30 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        // Calculate patterns for each teacher
                        const teacherPatterns = teachers.map(teacher => {
                          const attendance = sorted30DayAttendance.filter(att => att.teacherId === teacher.id);
                          
                          // Count working days and absences (ONLY count 'absent' status, not leave/late)
                          const totalDays = 30; // Simplified - could calculate actual working days
                          const absentDays = attendance.filter(att => 
                            att.status === 'absent'
                          ).length;
                          const presentDays = attendance.filter(att => att.status === 'present').length;
                          
                          // Calculate attendance rate
                          const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
                          
                          // Analyze day-of-week patterns (threshold changed to ≥3) - only count actual absences
                          const dayPattern: Record<string, number> = {
                            Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0
                          };
                          
                          attendance.filter(att => 
                            att.status === 'absent'
                          ).forEach(att => {
                            const dayName = format(new Date(att.attendanceDate), 'EEEE');
                            dayPattern[dayName]++;
                          });
                          
                          // Find most common absence day with threshold ≥3
                          const maxDay = Object.entries(dayPattern)
                            .filter(([_, count]) => count >= 3)
                            .sort((a, b) => b[1] - a[1])[0];
                          const patternText = maxDay ? `Absent ${maxDay[1]} ${maxDay[0]}s` : null;
                          
                          // Calculate trend: compare first 15 days vs last 15 days with safety checks
                          const sortedAttendance = [...attendance].sort((a, b) => 
                            new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime()
                          );
                          const first15 = sortedAttendance.slice(0, 15);
                          const last15 = sortedAttendance.slice(-15);
                          
                          const first15Present = first15.filter(att => att.status === 'present').length;
                          const last15Present = last15.filter(att => att.status === 'present').length;
                          
                          // Total working days in each period
                          const first15Total = first15.length;
                          const last15Total = last15.length;
                          
                          // Guard against division by zero
                          const first15Rate = first15Total > 0 ? (first15Present / first15Total) * 100 : 0;
                          const last15Rate = last15Total > 0 ? (last15Present / last15Total) * 100 : 0;
                          
                          const trendDiff = last15Rate - first15Rate;
                          
                          let trend: 'improving' | 'declining' | 'stable' = 'stable';
                          // Only show trend if we have sufficient data (at least 15 days total)
                          if (sortedAttendance.length >= 15) {
                            if (trendDiff > 5) trend = 'improving';
                            else if (trendDiff < -5) trend = 'declining';
                          }
                          
                          // Check for insufficient data
                          if (sortedAttendance.length < 15) {
                            return {
                              teacher,
                              attendanceRate,
                              absentDays,
                              presentDays,
                              patternText,
                              trend,
                              status: null, // No status for insufficient data
                              insufficientData: true,
                              message: `Insufficient data (${sortedAttendance.length} attendance records in last 30 days, need ≥15 for analysis)`
                            };
                          }
                          
                          return {
                            teacher,
                            attendanceRate,
                            absentDays,
                            presentDays,
                            patternText,
                            trend,
                            status: attendanceRate >= 90 ? 'Good' : attendanceRate >= 75 ? 'Warning' : 'Critical',
                            insufficientData: false
                          };
                        });
                        
                        // Sort by attendance rate (worst first) and take top 5 with attendance < 90%
                        const concerningPatterns = teacherPatterns
                          .filter(p => p.attendanceRate < 90)
                          .sort((a, b) => a.attendanceRate - b.attendanceRate)
                          .slice(0, 5);
                        
                        if (concerningPatterns.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <p className="text-sm text-muted-foreground">No concerning attendance patterns detected</p>
                              <p className="text-xs text-muted-foreground mt-1">All teachers have attendance ≥90%</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {concerningPatterns.map(({ teacher, attendanceRate, absentDays, patternText, trend, status, insufficientData, message }) => {
                              const rateColor = attendanceRate >= 90 ? 'text-green-600' :
                                               attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600';
                              const statusVariant = status === 'Good' ? 'default' :
                                                   status === 'Warning' ? 'secondary' : 'destructive';

                              return (
                                <div key={teacher.id} className="flex items-start space-x-3 p-3 border rounded-lg bg-muted/30">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={teacher.profilePictureUrl || undefined} alt={teacher.name} />
                                    <AvatarFallback className="bg-blue-100 text-blue-600">
                                      {teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-medium truncate">{teacher.name}</p>
                                      {/* Only show status badge for teachers with sufficient data */}
                                      {!insufficientData && status && (
                                        <Badge variant={statusVariant as any} className="ml-2 shrink-0">
                                          {status}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Show insufficient data message if applicable */}
                                    {insufficientData ? (
                                      <Badge variant="outline" className="text-xs text-muted-foreground mt-1">
                                        {message}
                                      </Badge>
                                    ) : (
                                      <>
                                        <div className="flex items-center space-x-3 mb-1">
                                          <p className={`text-sm font-semibold ${rateColor}`}>
                                            {attendanceRate}%
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {absentDays} days absent
                                          </p>
                                          
                                          {/* Trend Indicator */}
                                          {trend === 'improving' && (
                                            <div className="flex items-center gap-1 text-green-600" title="Attendance improving">
                                              <TrendingUp className="h-3 w-3" />
                                              <span className="text-xs">Improving</span>
                                            </div>
                                          )}
                                          {trend === 'declining' && (
                                            <div className="flex items-center gap-1 text-red-600" title="Attendance declining">
                                              <TrendingDown className="h-3 w-3" />
                                              <span className="text-xs">Declining</span>
                                            </div>
                                          )}
                                          {trend === 'stable' && (
                                            <div className="flex items-center gap-1 text-muted-foreground" title="Attendance stable">
                                              <Minus className="h-3 w-3" />
                                              <span className="text-xs">Stable</span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Visual Progress Bar */}
                                        <div className="flex items-center gap-2 mt-2">
                                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all ${
                                                attendanceRate >= 90 ? 'bg-green-500' : 
                                                attendanceRate >= 75 ? 'bg-yellow-500' : 
                                                'bg-red-500'
                                              }`}
                                              style={{ width: `${attendanceRate}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-muted-foreground min-w-[3rem] text-right">{attendanceRate}%</span>
                                        </div>
                                        
                                        {patternText && (
                                          <p className="text-xs text-muted-foreground italic mt-1">
                                            Pattern: {patternText}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No attendance data available for {format(new Date(selectedDate), "MMMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Teachers Attendance - {format(new Date(selectedDate), "MMMM d, yyyy")}</span>
                </div>
                {isToday && (
                  !isWorkingDay ? (
                    <Button
                      disabled={true}
                      className="bg-gray-400 text-white cursor-not-allowed"
                      onClick={() => {
                        toast({
                          title: "Cannot Mark Attendance", 
                          description: "Today is not a working day for your school.",
                          variant: "destructive",
                        });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark All Present (Off Day)
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={markAllTeachersPresentMutation.isPending || teachers.length === 0}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-mark-all-teachers-present"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {markAllTeachersPresentMutation.isPending ? "Marking..." : "Mark All Present"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mark All Teachers Present</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to mark all {teachers.length} teachers as present for {format(new Date(selectedDate), "MMMM d, yyyy")}? 
                            This will only mark teachers who don't already have attendance recorded for this date.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => markAllTeachersPresentMutation.mutate()}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Mark All Present
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Attendance Summary for Teachers */}
              {!teachersLoading && !teacherAttendanceLoading && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Teachers</p>
                          <p className="text-lg md:text-xl font-semibold text-blue-600">{teachers.length}</p>
                        </div>
                        <Users className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Present</p>
                          <p className="text-lg md:text-xl font-semibold text-green-600">
                            {teacherAttendance.filter(a => a.status === 'present').length}
                          </p>
                        </div>
                        <UserCheck className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Absent</p>
                          <p className="text-lg md:text-xl font-semibold text-red-600">
                            {teacherAttendance.filter(a => a.status === 'absent' || a.status === 'on_leave' || a.status === 'medical_leave' || a.status === 'personal_leave').length}
                          </p>
                        </div>
                        <UserX className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Late</p>
                          <p className="text-lg md:text-xl font-semibold text-yellow-600">
                            {teacherAttendance.filter(a => a.status === 'late').length}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-yellow-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Search and filter for teachers */}
              <div className="mb-4 space-y-3">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search teachers by name, school ID, or class taught..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      data-testid="search-teachers"
                    />
                  </div>
                  <Select value={teacherStatusFilter} onValueChange={setTeacherStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teachers</SelectItem>
                      <SelectItem value="present">Present Only</SelectItem>
                      <SelectItem value="absent">Absent Only</SelectItem>
                      <SelectItem value="late">Late Only</SelectItem>
                      <SelectItem value="not_marked">Not Marked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(teacherSearchTerm || teacherStatusFilter !== "all") && (
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredTeachers.length} of {teachers.length} teachers
                  </p>
                )}
              </div>
              {teachersLoading || teacherAttendanceLoading || classesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeachers.map((teacher: Teacher) => {
                    const attendanceRecord = getAttendanceRecord(teacher.id, teacherAttendance);
                    
                    return (
                      <div
                        key={teacher.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`teacher-attendance-${teacher.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage 
                              src={teacher.profilePictureUrl || undefined} 
                              alt={teacher.name || `${teacher.firstName} ${teacher.lastName}`}
                            />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {(teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`)
                                .split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <h3 className="font-medium text-blue-600 cursor-pointer hover:text-blue-800 hover:underline"
                                    data-testid={`teacher-name-${teacher.id}`}>
                                  {teacher.name || `${teacher.firstName} ${teacher.lastName}`}
                                </h3>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Teacher Details - {teacher.name || `${teacher.firstName} ${teacher.lastName}`}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                  <div>
                                    <h4 className="font-semibold mb-2">Personal Information</h4>
                                    <p><strong>Name:</strong> {teacher.name || `${teacher.firstName} ${teacher.lastName}`}</p>
                                    <p><strong>School ID Number:</strong> {teacher.schoolIdNumber || 'Not assigned'}</p>
                                    <p><strong>Status:</strong> {teacher.status}</p>
                                    <p><strong>Active:</strong> {teacher.isActive ? 'Yes' : 'No'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Contact Information</h4>
                                    <p><strong>Email:</strong> {teacher.email || 'Not provided'}</p>
                                    <p><strong>Contact Number:</strong> {teacher.contactNumber || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Teaching Assignment</h4>
                                    <p><strong>Subjects:</strong> {getSubjectNames(teacher.subjects)}</p>
                                    <p><strong>Classes:</strong> {getClassNames(teacher.classes)}</p>
                                    <p><strong>Max Daily Periods:</strong> {teacher.maxDailyPeriods || 'Not specified'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Availability</h4>
                                    {teacher.availability ? (
                                      <div className="text-sm">
                                        {Object.entries(teacher.availability).map(([day, periods]) => (
                                          <p key={day}>
                                            <strong>{day.charAt(0).toUpperCase() + day.slice(1)}:</strong> {Array.isArray(periods) && periods.length > 0 ? periods.join(', ') : 'Not available'}
                                          </p>
                                        ))}
                                      </div>
                                    ) : (
                                      <p>No availability information</p>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <p className="text-sm text-muted-foreground">
                              School ID: {teacher.schoolIdNumber || 'Not assigned'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Classes: {getClassNames(teacher.classes)}
                            </p>
                            <div className="mt-2">
                              {attendanceRecord ? (
                                getStatusDisplay(attendanceRecord.status)
                              ) : (
                                getStatusDisplay("not_marked")
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isToday && !isTeacherOnLeave(teacher.id) && (
                          <div className="flex justify-end">
                            <Select 
                              value={attendanceRecord?.status || ""} 
                              onValueChange={(value) => handleTeacherAttendance(teacher.id, value as "present" | "absent" | "late")}
                              disabled={markTeacherAttendanceMutation.isPending}
                            >
                              <SelectTrigger className="w-40" data-testid={`select-teacher-status-${teacher.id}`}>
                                <SelectValue placeholder="Mark attendance" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                    Present
                                  </div>
                                </SelectItem>
                                <SelectItem value="absent">
                                  <div className="flex items-center gap-2">
                                    <UserX className="h-4 w-4 text-red-600" />
                                    Absent
                                  </div>
                                </SelectItem>
                                <SelectItem value="late">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    Late
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {filteredTeachers.length === 0 && teachers.length > 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No teachers found matching "{teacherSearchTerm}"
                    </div>
                  )}
                  
                  {teachers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No teachers found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Students Attendance - {format(new Date(selectedDate), "MMMM d, yyyy")}</span>
                </div>
                {selectedClass && isToday && (
                  !isWorkingDay ? (
                    <Button
                      disabled={true}
                      className="bg-gray-400 text-white cursor-not-allowed"
                      onClick={() => {
                        toast({
                          title: "Cannot Mark Attendance",
                          description: "Today is not a working day for your school.",
                          variant: "destructive",
                        });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark All Present (Off Day)
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={markAllStudentsPresentMutation.isPending || !selectedClass || students.length === 0}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-mark-all-students-present"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {markAllStudentsPresentMutation.isPending ? "Marking..." : "Mark All Present"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mark All Students Present</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to mark all {students.length} students in the selected class as present for {format(new Date(selectedDate), "MMMM d, yyyy")}? 
                            This will only mark students who don't already have attendance recorded for this date.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => markAllStudentsPresentMutation.mutate()}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Mark All Present
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )
                )}
              </CardTitle>
              <div className="flex items-center space-x-4">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-64" data-testid="select-class">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortClasses(classes).map((cls: Class) => {
                        // Format class name - remove dash if no section
                        const displayName = cls.section 
                          ? `Class ${cls.grade} - ${cls.section}`
                          : `Class ${cls.grade}`;
                        
                        return (
                          <SelectItem key={cls.id} value={cls.id}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Attendance Summary for Students */}
              {selectedClass && !studentsLoading && !studentAttendanceLoading && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Students</p>
                          <p className="text-lg md:text-xl font-semibold text-blue-600">{students.length}</p>
                        </div>
                        <Users className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Present</p>
                          <p className="text-lg md:text-xl font-semibold text-green-600">
                            {studentAttendance.filter(a => a.status === 'present').length}
                          </p>
                        </div>
                        <UserCheck className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Absent</p>
                          <p className="text-lg md:text-xl font-semibold text-red-600">
                            {studentAttendance.filter(a => a.status === 'absent').length}
                          </p>
                        </div>
                        <UserX className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Late</p>
                          <p className="text-lg md:text-xl font-semibold text-yellow-600">
                            {studentAttendance.filter(a => a.status === 'late').length}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-yellow-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Search and filter for students */}
              {selectedClass && (
                <div className="mb-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search students by name, admission number, or roll number..."
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="search-students"
                      />
                    </div>
                    <Select value={studentStatusFilter} onValueChange={setStudentStatusFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        <SelectItem value="present">Present Only</SelectItem>
                        <SelectItem value="absent">Absent Only</SelectItem>
                        <SelectItem value="late">Late Only</SelectItem>
                        <SelectItem value="not_marked">Not Marked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(studentSearchTerm || studentStatusFilter !== "all") && (
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredStudents.length} of {students.length} students
                    </p>
                  )}
                </div>
              )}

              {!selectedClass ? (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a class to view student attendance
                </div>
              ) : studentsLoading || studentAttendanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : studentsError ? (
                <div className="text-center py-8 text-red-600">
                  <p>Error loading students: {studentsError?.message || 'Unable to fetch students'}</p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {Array.isArray(filteredStudents) && filteredStudents.map((student: Student) => {
                    const attendanceRecord = getAttendanceRecord(student.id, studentAttendance);
                    
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`student-attendance-${student.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <h3 className="font-medium text-blue-600 cursor-pointer hover:text-blue-800 hover:underline"
                                    data-testid={`student-name-${student.id}`}>
                                  {student.firstName} {student.lastName}
                                </h3>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Student Details - {student.firstName} {student.lastName}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                  <div>
                                    <h4 className="font-semibold mb-2">Personal Information</h4>
                                    <p><strong>Name:</strong> {student.firstName} {student.lastName}</p>
                                    <p><strong>Admission Number:</strong> {student.admissionNumber}</p>
                                    <p><strong>Roll Number:</strong> {student.rollNumber || 'Not assigned'}</p>
                                    <p><strong>Gender:</strong> {student.gender || 'Not specified'}</p>
                                    <p><strong>Date of Birth:</strong> {student.dateOfBirth || 'Not specified'}</p>
                                    <p><strong>Blood Group:</strong> {student.bloodGroup || 'Not specified'}</p>
                                    <p><strong>Status:</strong> {student.status}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Contact Information</h4>
                                    <p><strong>Email:</strong> {student.email || 'Not provided'}</p>
                                    <p><strong>Contact Number:</strong> {student.contactNumber || 'Not provided'}</p>
                                    <p><strong>Address:</strong> {student.address || 'Not provided'}</p>
                                    <p><strong>Emergency Contact:</strong> {student.emergencyContact || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Guardian Information</h4>
                                    <p><strong>Guardian Name:</strong> {student.guardianName || 'Not provided'}</p>
                                    <p><strong>Relation:</strong> {student.guardianRelation || 'Not specified'}</p>
                                    <p><strong>Guardian Contact:</strong> {student.guardianContact || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Medical Information</h4>
                                    <p><strong>Medical Info:</strong> {student.medicalInfo || 'None specified'}</p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <p className="text-sm text-muted-foreground">
                              Admission No: {student.admissionNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Roll No: {student.rollNumber || 'Not assigned'}
                            </p>
                            <div className="mt-2">
                              {attendanceRecord ? (
                                getStatusDisplay(attendanceRecord.status)
                              ) : (
                                getStatusDisplay("not_marked")
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isToday && (
                          <div className="flex justify-end">
                            <Select 
                              value={attendanceRecord?.status || ""} 
                              onValueChange={(value) => handleStudentAttendance(student.id, value as "present" | "absent" | "late")}
                              disabled={markStudentAttendanceMutation.isPending}
                            >
                              <SelectTrigger className="w-40" data-testid={`select-student-status-${student.id}`}>
                                <SelectValue placeholder="Mark attendance" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                    Present
                                  </div>
                                </SelectItem>
                                <SelectItem value="absent">
                                  <div className="flex items-center gap-2">
                                    <UserX className="h-4 w-4 text-red-600" />
                                    Absent
                                  </div>
                                </SelectItem>
                                <SelectItem value="late">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    Late
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {filteredStudents.length === 0 && students.length > 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No students found matching "{studentSearchTerm}"
                    </div>
                  )}
                  
                  {(!students || students.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No students found in the selected class
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          {/* Leave Applications Section */}
          <LeaveApplicationsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}