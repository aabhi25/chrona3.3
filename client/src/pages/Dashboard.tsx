import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertTeacherSchema, insertStudentSchema } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { AdminChatAssistant } from "@/components/AdminChatAssistant";
import Newsfeed from "@/components/Newsfeed";
import { CompactTimetableGrid } from "@/components/CompactTimetableGrid";
import { 
  School, Users, Activity, Shield, CheckCircle, XCircle, CalendarDays, Clock,
  UserPlus, Calendar, Eye, ClipboardCheck, Search, AlertTriangle,
  UserCog, TrendingUp, PieChart, User, BookOpen, Bell, GraduationCap,
  IndianRupee, Truck, MessageSquare, Calculator, FileText, Cog, Wallet,
  Package, ClipboardList, Building2, Receipt, CreditCard, Award
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";
import { sortClasses } from "@shared/classUtils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useMemo, useRef, useEffect } from "react";
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";

interface AdminDashboardStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  schoolAdminLogins: Array<{
    schoolName: string;
    adminName: string;
    lastLogin: Date | null;
  }>;
  schoolTeacherCounts: Array<{
    schoolName: string;
    activeTeachers: number;
  }>;
}

interface SchoolInfo {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  adminName: string;
  isActive: boolean;
  totalTeachers: number;
}

interface TeacherAttendance {
  id: string;
  teacherId: string;
  date: string;
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave";
  leaveStartDate?: string;
  leaveEndDate?: string;
  reason?: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects?: string[];
}

interface TimetableAlert {
  teacher: Teacher;
  attendance: TeacherAttendance;
  affectedClasses: number;
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'teacher' | 'class' | 'student' | 'page';
  subtitle?: string;
  path?: string;
  icon?: any;
  category?: string;
}

// Class form schema for creating new classes
const classFormSchema = z.object({
  grade: z.string().min(1, "Class is required"),
  section: z.string().optional().refine(
    (val) => !val || !val.includes(","),
    "Section cannot contain commas. Use 'Add Sections to Class' for multiple sections."
  ),
  studentCount: z.coerce.number().min(0, "Student count must be 0 or greater"),
  room: z.string().optional(),
});

type ClassFormData = z.infer<typeof classFormSchema>;

// Teacher form schema for creating new teachers
const teacherFormSchema = insertTeacherSchema.extend({
  name: z.string().min(1, "Teacher name is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  contactNumber: z.string().min(1, "Contact number is required"),
  schoolIdNumber: z.string().min(1, "School ID number is required"),
  classes: z.array(z.string()).min(1, "Please select at least one class"),
}).omit({ availability: true });

type TeacherFormData = z.infer<typeof teacherFormSchema>;

// Student form schema for creating new students
const studentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(255, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(255, "Last name too long"),
  admissionNumber: z.string().min(1, "Admission number is required").max(50, "Admission number too long"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  contactNumber: z.string().min(10, "Contact number must be at least 10 digits").max(15, "Contact number too long").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().optional().or(z.literal("")),
  classId: z.string().min(1, "Class is required"),
  rollNumber: z.string().max(20, "Roll number too long").optional().or(z.literal("")),
  bloodGroup: z.string().max(5, "Blood group too long").optional().or(z.literal("")),
  emergencyContact: z.string().max(15, "Emergency contact too long").optional().or(z.literal(""))
});

type StudentFormData = z.infer<typeof studentFormSchema>;

export default function Dashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [isCreateTeacherDialogOpen, setIsCreateTeacherDialogOpen] = useState(false);
  const [isCreateStudentDialogOpen, setIsCreateStudentDialogOpen] = useState(false);
  const { toast } = useToast();
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [displayedTimetable, setDisplayedTimetable] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user?.role === "super_admin";
  const isSchoolAdmin = user?.role === "admin";

  // Additional queries needed for teacher form
  const { data: allClasses = [] } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json();
    },
  });
  const isStudent = user?.role === "student";
  const isParent = user?.role === "parent";
  
  const { data: adminStats, isLoading: adminStatsLoading } = useQuery<AdminDashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: isSuperAdmin,
  });

  // Calculate today's date
  const today = getCurrentDateIST();

  const { data: schoolInfo, isLoading: schoolInfoLoading } = useQuery<SchoolInfo>({
    queryKey: ["/api/school-info"],
    enabled: isSchoolAdmin || isStudent || isParent,
  });

  const { data: teachersResponse } = useQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teachers?limit=1000");
      return response.json();
    },
    enabled: isSchoolAdmin,
  });
  
  const teachers = teachersResponse?.teachers || [];

  // Fetch students for count
  const { data: studentsResponse } = useQuery<{ students: any[], totalCount: number }>({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/students?limit=10000");
      return response.json();
    },
    enabled: isSchoolAdmin,
  });
  
  const students = studentsResponse?.students || [];

  // Fetch classes for search functionality
  const { data: classes = [] } = useQuery<ClassData[]>({
    queryKey: ["/api/classes"],
    enabled: isSchoolAdmin,
  });

  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: isSchoolAdmin,
  });

  const { data: todayAttendance = [] } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", today],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teacher-attendance?date=${today}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: isSchoolAdmin,
  });

  
  // Check if today is an active school day
  const todayDayName = format(new Date(), 'EEEE').toLowerCase(); // Gets day name like 'monday'
  const isActiveDay = (timetableStructure as any)?.workingDays?.includes(todayDayName) || false;

  // Use the same logic as TeacherView - check each teacher's status
  const getTeacherAttendanceStatus = (teacherId: string) => {
    // Only calculate attendance for active days
    if (!isActiveDay) return "not_applicable";
    
    const attendance = todayAttendance.find(
      (att) => att.teacherId === teacherId
    );
    return attendance?.status || "present";
  };

  // Calculate attendance counts only for active days
  const presentTeachers = isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) === "present") : [];
  const absentTeachers = isActiveDay ? teachers.filter(teacher => getTeacherAttendanceStatus(teacher.id) === "absent") : [];
  const onLeaveTeachers = isActiveDay ? teachers.filter(teacher => {
    const status = getTeacherAttendanceStatus(teacher.id);
    return status !== "present" && status !== "absent";
  }) : [];
  
  // Count teachers with no attendance marked today
  const teachersWithAttendance = new Set(todayAttendance.map(r => r.teacherId));
  const teachersWithoutAttendance = teachers.filter(t => !teachersWithAttendance.has(t.id));

  // Prepare data for attendance pie chart
  const attendanceChartData = isActiveDay ? [
    { name: 'Present', value: presentTeachers.length, color: '#22c55e' },
    { name: 'Absent', value: absentTeachers.length, color: '#ef4444' },
    { name: 'On Leave', value: onLeaveTeachers.length, color: '#f97316' }
  ].filter(item => item.value > 0) : [];

  // Navigation pages for search
  const navigationPages = [
    { id: 'timetable', name: 'Timetables', path: '/timetable', icon: Calendar, category: 'Navigation', subtitle: 'Manage class schedules' },
    { id: 'attendance', name: 'Attendance', path: '/attendance', icon: ClipboardCheck, category: 'Navigation', subtitle: 'Track attendance & leaves' },
    { id: 'classes-page', name: 'Classes', path: '/classes', icon: BookOpen, category: 'Navigation', subtitle: 'Manage classes & subjects' },
    { id: 'teachers-page', name: 'Teachers', path: '/teachers', icon: Users, category: 'Navigation', subtitle: 'Manage teacher profiles' },
    { id: 'students-page', name: 'Students', path: '/students', icon: GraduationCap, category: 'Navigation', subtitle: 'Manage student records' },
    { id: 'fee-management', name: 'Fee Management', path: '/fee-management', icon: IndianRupee, category: 'Navigation', subtitle: 'Financial management' },
    { id: 'transport', name: 'Transport Management', path: '/transport', icon: Truck, category: 'Navigation', subtitle: 'Routes & vehicles' },
    { id: 'messages', name: 'Messages', path: '/messages', icon: MessageSquare, category: 'Navigation', subtitle: 'School communications' },
    { id: 'teacher-planner', name: 'Teacher Planner', path: '/teacher-planner', icon: Calculator, category: 'Navigation', subtitle: 'AI staffing optimization' },
    { id: 'exam', name: 'Exam Module', path: '/exam', icon: FileText, category: 'Navigation', subtitle: 'Create exams & manage results' },
    { id: 'school-calendar', name: 'School Calendar', path: '/school-calendar', icon: CalendarDays, category: 'Navigation', subtitle: 'Events & holidays' },
    { id: 'settings', name: 'Settings', path: '/settings', icon: Cog, category: 'Navigation', subtitle: 'School configuration' },
    { id: 'user-management', name: 'User Management', path: '/user-management', icon: UserCog, category: 'Navigation', subtitle: 'Manage login credentials' },
    { id: 'payroll', name: 'Payroll Module', path: '/payroll', icon: Wallet, category: 'Navigation', subtitle: 'Salary management system' },
    { id: 'inventory', name: 'Inventory Management', path: '/inventory', icon: Package, category: 'Navigation', subtitle: 'Track school assets & supplies' },
    { id: 'admission', name: 'Student Online Admission', path: '/admission', icon: ClipboardList, category: 'Navigation', subtitle: 'Online enrollment process' },
    { id: 'hostel', name: 'Hostel Management', path: '/hostel', icon: Building2, category: 'Navigation', subtitle: 'Residential facilities' },
    { id: 'expense', name: 'Expense Management', path: '/expense', icon: Receipt, category: 'Navigation', subtitle: 'Track school expenses' },
    { id: 'id-cards', name: 'ID Cards', path: '/id-cards', icon: CreditCard, category: 'Navigation', subtitle: 'Generate ID cards for students & teachers' },
    { id: 'certification', name: 'Certification', path: '/certification', icon: Award, category: 'Navigation', subtitle: 'Generate certificates for events' },
  ];

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !isSchoolAdmin) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];
    
    // Search navigation pages/features
    navigationPages.forEach(page => {
      if (page.name.toLowerCase().includes(query) || 
          page.subtitle.toLowerCase().includes(query)) {
        results.push({
          id: page.id,
          name: page.name,
          type: 'page',
          subtitle: page.subtitle,
          path: page.path,
          icon: page.icon,
          category: page.category
        });
      }
    });
    
    // Search teachers
    teachers.forEach(teacher => {
      if (teacher.name.toLowerCase().includes(query) || 
          teacher.email?.toLowerCase().includes(query)) {
        results.push({
          id: teacher.id,
          name: teacher.name,
          type: 'teacher',
          subtitle: teacher.email || 'Teacher',
          category: 'People'
        });
      }
    });
    
    // Search students
    students.forEach(student => {
      const fullName = `${student.firstName} ${student.lastName}`;
      if (fullName.toLowerCase().includes(query) || 
          student.admissionNumber?.toLowerCase().includes(query) ||
          student.email?.toLowerCase().includes(query)) {
        results.push({
          id: student.id,
          name: fullName,
          type: 'student',
          subtitle: `${student.admissionNumber || 'Student'} • ${student.class || ''}`,
          category: 'People'
        });
      }
    });
    
    // Search classes
    classes.forEach(classItem => {
      const className = `Class ${classItem.grade}${classItem.section ? ' ' + classItem.section : ''}`;
      if (className.toLowerCase().includes(query) ||
          classItem.grade.toLowerCase().includes(query) ||
          (classItem.section && classItem.section.toLowerCase().includes(query))) {
        results.push({
          id: classItem.id,
          name: className,
          type: 'class',
          subtitle: `${classItem.studentCount} students`,
          category: 'Academic'
        });
      }
    });
    
    return results.slice(0, 12); // Limit to 12 results
  }, [searchQuery, teachers, classes, students, isSchoolAdmin, navigationPages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search result click
  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'teacher') {
      setLocation(`/teacher/${result.id}`);
    } else if (result.type === 'class') {
      setLocation(`/classes/${result.id}`);
    } else if (result.type === 'student') {
      setLocation(`/students/${result.id}`);
    } else if (result.type === 'page' && result.path) {
      setLocation(result.path);
    }
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchDropdown(value.trim().length > 0);
  };

  // Add New Class form
  const addClassForm = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      grade: "",
      section: "",
      studentCount: 0,
      room: "",
    },
  });

  // Add New Teacher form
  const addTeacherForm = useForm<TeacherFormData>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      name: "",
      email: "",
      contactNumber: "",
      schoolIdNumber: "",
      schoolId: user?.schoolId || "",
      isActive: true,
      classes: [],
    },
  });

  // Add New Student form
  const addStudentForm = useForm<StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      admissionNumber: "",
      email: "",
      contactNumber: "",
      dateOfBirth: "",
      gender: undefined,
      address: "",
      classId: "",
      rollNumber: "",
      bloodGroup: "",
      emergencyContact: "",
    },
  });

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const response = await apiRequest("POST", "/api/classes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsCreateClassDialogOpen(false);
      addClassForm.reset();
      toast({
        title: "Success",
        description: "Class created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });

  // Handle add class form submission
  const handleAddClass = (data: ClassFormData) => {
    createClassMutation.mutate(data);
  };

  // Create teacher mutation
  const createTeacherMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      // Prepare backend data with classes included
      const response = await apiRequest("POST", "/api/teachers", { 
        ...data,
        schoolId: user?.schoolId,
        availability: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: []
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsCreateTeacherDialogOpen(false);
      addTeacherForm.reset();
      toast({
        title: "Success",
        description: "Teacher added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add teacher",
        variant: "destructive",
      });
    },
  });

  // Handle add teacher form submission
  const handleAddTeacher = (data: TeacherFormData) => {
    createTeacherMutation.mutate(data);
  };

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const response = await apiRequest("POST", "/api/students", {
        ...data,
        schoolId: user?.schoolId,
        isActive: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsCreateStudentDialogOpen(false);
      addStudentForm.reset();
      toast({
        title: "Success",
        description: "Student added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add student",
        variant: "destructive",
      });
    },
  });

  // Handle add student form submission
  const handleAddStudent = (data: StudentFormData) => {
    createStudentMutation.mutate(data);
  };

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-teacher':
        setLocation('/teachers'); // Navigate to teachers page with new comprehensive form
        break;
      case 'add-student':
        setLocation('/students'); // Navigate to students page with new comprehensive form
        break;
      case 'create-class':
        setLocation('/classes'); // Navigate to classes page with new comprehensive form
        break;
      case 'show-timetable':
        setLocation('/timetable');
        break;
      case 'teacher-schedule':
        setLocation('/teacher-schedule');
        break;
      case 'mark-attendance':
        setLocation('/teachers?tab=attendance');
        break;
      case 'assign-substitute':
        setLocation('/timetable?action=substitute');
        break;
    }
  };

  // Get teachers currently on leave with date ranges
  const teachersOnLeave = todayAttendance.filter(record => 
    record.status !== "present" && record.leaveStartDate && record.leaveEndDate &&
    record.leaveStartDate <= today && today <= record.leaveEndDate
  ).reduce((acc: Array<{
    teacherId: string;
    teacherName: string;
    startDate: string;
    endDate: string;
    status: string;
    reason?: string;
  }>, record) => {
    const teacher = teachers.find(t => t.id === record.teacherId);
    if (teacher && !acc.find(t => t.teacherId === record.teacherId)) {
      acc.push({
        teacherId: record.teacherId,
        teacherName: teacher.name,
        startDate: record.leaveStartDate!,
        endDate: record.leaveEndDate!,
        status: record.status,
        reason: record.reason
      });
    }
    return acc;
  }, []);

  return (
    <div>
      {/* Search Bar Header - Clean minimal design */}
      <header className="px-4 py-2">
        <div className="flex items-center justify-end">
          {/* Search Bar - Only show for school admin */}
          {isSchoolAdmin && (
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
                className="pl-10 w-96 border-2 border-gray-300 shadow-md focus:border-blue-500 focus:shadow-lg transition-all bg-white rounded-full"
              />
              
              {/* Enhanced Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => {
                    const Icon = result.icon || (
                      result.type === 'teacher' ? User :
                      result.type === 'student' ? GraduationCap :
                      result.type === 'class' ? BookOpen :
                      result.type === 'page' ? Calendar :
                      Search
                    );
                    
                    const iconColor = 
                      result.type === 'page' ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' :
                      result.type === 'teacher' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' :
                      result.type === 'student' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' :
                      result.type === 'class' ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' :
                      'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
                    
                    const badgeColor =
                      result.type === 'page' ? 'border-purple-200 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-400' :
                      result.type === 'teacher' ? 'border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-400' :
                      result.type === 'student' ? 'border-green-200 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400' :
                      result.type === 'class' ? 'border-orange-200 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-400' :
                      'border-gray-200 text-gray-700 bg-gray-50';
                    
                    const showCategoryDivider = index === 0 || searchResults[index - 1]?.category !== result.category;
                    
                    return (
                      <div key={`${result.type}-${result.id}`}>
                        {showCategoryDivider && result.category && (
                          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              {result.category}
                            </span>
                          </div>
                        )}
                        <div
                          className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                          onClick={() => handleSearchResultClick(result)}
                        >
                          <div className={`mr-3 p-2 rounded-lg ${iconColor}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {result.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {result.subtitle}
                            </div>
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${badgeColor}`}
                            >
                              {result.type === 'page' ? 'Feature' :
                               result.type === 'teacher' ? 'Teacher' :
                               result.type === 'student' ? 'Student' :
                               result.type === 'class' ? 'Class' :
                               'Subject'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* No results state */}
              {showSearchDropdown && searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-6 text-center">
                  <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No results found for "<span className="font-semibold">{searchQuery}</span>"
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Try searching for teachers, students, classes, or pages
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      
      {/* Content */}
      <div className="overflow-y-auto h-full mt-4">
        {isSuperAdmin ? (
          <>
            {/* Super Admin Content */}
            {/* School Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {adminStatsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
                  <School className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg md:text-xl font-semibold">{adminStats?.totalSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Schools registered</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg md:text-xl font-semibold text-green-600">{adminStats?.activeSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Currently operational</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inactive Schools</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg md:text-xl font-semibold text-orange-600">{adminStats?.inactiveSchools ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        
        {/* School Admin Activity & Teacher Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* School Admin Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>School Admin Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminStatsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2" data-testid="admin-activity-list">
                  {adminStats?.schoolAdminLogins?.map((admin, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{admin.schoolName}</p>
                        <p className="text-xs text-muted-foreground">{admin.adminName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {admin.lastLogin 
                            ? formatDistanceToNow(new Date(admin.lastLogin), { addSuffix: true })
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No school admins found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Teacher Counts by School */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <School className="h-5 w-5" />
                <span>Active Teachers by School</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminStatsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2" data-testid="teacher-counts-list">
                  {adminStats?.schoolTeacherCounts?.map((school, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{school.schoolName}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {school.activeTeachers} teachers
                        </span>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No schools found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </>
        ) : (
          <>
            {/* Modern School Admin Dashboard */}
            <div className="space-y-4">
              


              {/* BOTTOM ROW: AI Assistant and School Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* AI Chat Assistant - School Admin Only */}
                {isSchoolAdmin && (
                  <div className="lg:col-span-3">
                    <AdminChatAssistant 
                      onSystemAction={(action, data) => {
                      switch (action) {
                        case 'open_create_class_dialog':
                          handleQuickAction('create-class');
                          break;
                        case 'open_create_teacher_dialog':
                          handleQuickAction('add-teacher');
                          break;
                        case 'open_create_student_dialog':
                          handleQuickAction('add-student');
                          break;
                        case 'open-timetable-view':
                          // Navigate to timetable with optional class selection
                          if (data?.classNumber) {
                            setLocation(`/timetable?class=${data.classNumber}`);
                          } else {
                            handleQuickAction('show-timetable');
                          }
                          break;
                        case 'refresh-attendance-data':
                          // Refresh attendance data
                          window.location.reload();
                          break;
                        case 'highlight-attendance-stats':
                          // Could scroll to attendance section or add visual highlight
                          const attendanceElement = document.querySelector('[data-testid="attendance-overview"]');
                          if (attendanceElement) {
                            attendanceElement.scrollIntoView({ behavior: 'smooth' });
                          }
                          break;
                        case 'change_theme':
                          // Change theme only (stay in chat)
                          if (data?.theme) {
                            setTheme(data.theme);
                          }
                          break;
                        case 'open_settings':
                          // Navigate to settings page
                          setLocation('/settings');
                          break;
                        case 'display-timetable':
                          // Display compact timetable for the specified class
                          if (data?.classId && data?.timetableEntries && timetableStructure) {
                            setDisplayedTimetable({
                              ...data,
                              workingDays: timetableStructure.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                              timeSlots: timetableStructure.timeSlots || [],
                              userRole: user?.role || 'admin'
                            });
                          }
                          break;
                        case 'display_data':
                          // Handle display_data action - data is already shown in chat message
                          // The list data is passed but we let the chat component display it
                          console.log('Displaying data:', data);
                          break;
                        case 'show_navigation_link':
                          // This action is handled by the chat component to show a clickable link
                          // No action needed here as the link is displayed in the chat
                          break;
                        default:
                          console.log('Unknown system action:', action, data);
                      }
                    }}
                  />
                  </div>
                )}

                {/* Compact Timetable Display - Show when timetable is requested */}
                {displayedTimetable && (
                  <div className="lg:col-span-3 mb-6">
                    <CompactTimetableGrid
                      className={displayedTimetable.className}
                      timetableEntries={displayedTimetable.timetableEntries}
                      workingDays={displayedTimetable.workingDays}
                      timeSlots={displayedTimetable.timeSlots}
                      userRole={displayedTimetable.userRole}
                      onClose={() => setDisplayedTimetable(null)}
                    />
                  </div>
                )}

                {/* Quick Links for Teachers */}
                {user?.role === 'teacher' && (
                  <div className="lg:col-span-3 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setLocation('/my-class')}
                        className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4 text-left hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-base text-blue-900 dark:text-blue-100">My Classes</span>
                        </div>
                      </button>

                      <button
                        onClick={() => setLocation('/my-attendance')}
                        className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4 text-left hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <ClipboardCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <span className="font-semibold text-base text-green-900 dark:text-green-100">My Attendance</span>
                        </div>
                      </button>

                      <button
                        onClick={() => setLocation('/my-schedule')}
                        className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4 text-left hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <span className="font-semibold text-base text-purple-900 dark:text-purple-100">My Schedule</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* School Newsfeed - Below AI Assistant */}
                <div className="lg:col-span-3">
                  <Newsfeed 
                    feedScope="school"
                    showPostForm={user?.role === 'admin' || user?.role === 'teacher'}
                  />
                </div>

              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Add New Class Dialog */}
      <Dialog open={isCreateClassDialogOpen} onOpenChange={setIsCreateClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
          </DialogHeader>
          <Form {...addClassForm}>
            <form onSubmit={addClassForm.handleSubmit(handleAddClass)} className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addClassForm.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 9, 10, 11, 12" 
                          {...field} 
                          data-testid="input-grade"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addClassForm.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., A (single section only, or leave empty)" 
                          {...field} 
                          data-testid="input-section"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addClassForm.control}
                  name="studentCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student Count</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          data-testid="input-student-count"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addClassForm.control}
                  name="room"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Room 101" 
                          {...field} 
                          data-testid="input-room"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateClassDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createClassMutation.isPending}
                  data-testid="button-create-class"
                >
                  {createClassMutation.isPending ? "Creating..." : "Create Class"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add New Teacher Dialog */}
      <Dialog open={isCreateTeacherDialogOpen} onOpenChange={setIsCreateTeacherDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>
              Add a new teacher to your school
            </DialogDescription>
          </DialogHeader>
          <Form {...addTeacherForm}>
            <form onSubmit={addTeacherForm.handleSubmit(handleAddTeacher)} className="space-y-2">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={addTeacherForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teacher Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Smith" {...field} data-testid="input-teacher-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addTeacherForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="teacher@school.com" 
                          {...field} 
                          data-testid="input-teacher-email" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addTeacherForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., +1234567890" 
                          {...field} 
                          data-testid="input-teacher-contact" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addTeacherForm.control}
                  name="schoolIdNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School ID Number *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., T001" 
                          {...field} 
                          data-testid="input-teacher-school-id" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addTeacherForm.control}
                  name="classes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classes Taught *</FormLabel>
                      <FormControl>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value && !field.value.includes(value)) {
                              field.onChange([...field.value, value]);
                            }
                          }}
                          data-testid="select-teacher-classes"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select classes" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortClasses(allClasses).map((cls: any) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                Grade {cls.grade} - Section {cls.section}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value.map((classId) => {
                            const cls = allClasses.find((c: any) => c.id === classId);
                            return cls ? (
                              <span
                                key={classId}
                                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                              >
                                Grade {cls.grade} - Section {cls.section}
                                <button
                                  type="button"
                                  onClick={() => field.onChange(field.value.filter(id => id !== classId))}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                  data-testid={`remove-class-${classId}`}
                                >
                                  ×
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateTeacherDialogOpen(false)}
                  data-testid="button-cancel-teacher"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTeacherMutation.isPending}
                  data-testid="button-save-teacher"
                >
                  {createTeacherMutation.isPending ? "Adding..." : "Add Teacher"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add New Student Dialog */}
      <Dialog open={isCreateStudentDialogOpen} onOpenChange={setIsCreateStudentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Fill in the student information below. All required fields are marked with an asterisk.
            </DialogDescription>
          </DialogHeader>
          <Form {...addStudentForm}>
            <form onSubmit={addStudentForm.handleSubmit(handleAddStudent)} className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addStudentForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter first name" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter last name" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addStudentForm.control}
                  name="admissionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter admission number" {...field} data-testid="input-admission-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class *</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortClasses(allClasses).map((cls: any) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                Grade {cls.grade} - Section {cls.section}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addStudentForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="student@email.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} data-testid="input-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addStudentForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addStudentForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter address" {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={addStudentForm.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Roll number" {...field} data-testid="input-roll-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <FormControl>
                        <Input placeholder="A+, B+, etc." {...field} data-testid="input-blood-group" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addStudentForm.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency phone" {...field} data-testid="input-emergency-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateStudentDialogOpen(false)}
                  data-testid="button-cancel-student"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createStudentMutation.isPending}
                  data-testid="button-save-student"
                >
                  {createStudentMutation.isPending ? "Adding..." : "Add Student"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
