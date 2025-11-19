import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherSchema, type Teacher, type TimetableEntry, type TeacherAttendance, type ClassSubjectAssignment, type Class, type Subject } from "@shared/schema";
import { getCurrentDateIST, formatDateIST, toISTDateString } from "@shared/utils/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, User, Users, Mail, Phone, IdCard, Calendar as CalendarIcon, CalendarDays, Clock, CheckCircle, XCircle, BookOpen, AlertTriangle, TrendingUp, Settings, Camera, Download, ChevronDown, Upload, UserCog, UserCheck, BarChart3, RefreshCw, Sparkles, Search } from "lucide-react";
import { DatePickerDialog } from "@/components/DatePickerDialog";
import TeacherSearchInput from "@/components/TeacherSearchInput";
import { z } from "zod";
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { useMemo } from "react";

const formSchema = insertTeacherSchema.extend({
  name: z.string().min(1, "Teacher name is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  contactNumber: z.string().min(1, "Mobile number is required"),
  schoolIdNumber: z.string().optional(),
  
  // New fields from the redesign - all optional
  aadhar: z.string().length(12, "Aadhaar number must be exactly 12 digits").regex(/^\d{12}$/, "Aadhaar number must contain only digits").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  bloodGroup: z.string().optional(),
  designation: z.string().optional(),
  dateOfBirth: z.string().optional(),
  fatherHusbandName: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  
}).omit({ availability: true, employeeId: true });

// Additional interfaces for Teacher Schedule functionality
interface WorkloadAnalytics {
  teachers: Array<{
    teacherId: string;
    teacherName: string;
    weeklyPeriods: number;
    avgDailyPeriods: number;
    maxDailyPeriods: number;
    maxAllowedDaily: number;
    isOverloaded: boolean;
    dailyBreakdown: Record<string, number>;
  }>;
  summary: {
    totalTeachers: number;
    overloadedTeachers: number;
    avgWeeklyPeriods: number;
  };
}

type TeacherFormData = z.infer<typeof formSchema>;

// Helper function to format time to 12-hour format with AM/PM
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper function to generate working days for current and next week
const generateWorkingDays = (workingDays: string[]): Array<{date: string, dayName: string, label: string}> => {
  const days: Array<{date: string, dayName: string, label: string}> = [];
  const today = new Date();
  
  // Get week start date (Monday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const daysFromMonday = (day === 0) ? 6 : day - 1;
    const diff = d.getDate() - daysFromMonday;
    return new Date(d.setDate(diff));
  };
  
  // Generate days for current and next week
  for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
    const weekStart = getWeekStart(today);
    weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
    
    workingDays.forEach(dayName => {
      const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(dayName.toLowerCase());
      if (dayIndex !== -1) {
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + dayIndex);
        
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

export default function TeacherView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [teacherDefaultsForm, setTeacherDefaultsForm] = useState({ defaultMaxPeriodsPerDay: 6 });
  // Initialize active tab based on URL parameter
  const getInitialTab = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'schedule') return 'schedule';
    return 'teachers';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [selectedDate, setSelectedDate] = useState(getCurrentDateIST());
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  
  // Teacher Schedule tab state variables
  const [selectedScheduleTeacher, setSelectedScheduleTeacher] = useState<string>('');

  // Check URL parameters to set active tab when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'schedule') {
      setActiveTab('schedule');
    } else {
      setActiveTab('teachers');
    }
  }, [location]);

  const addForm = useForm<TeacherFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      contactNumber: "",
      schoolIdNumber: "",
      aadhar: "",
      gender: "male",
      bloodGroup: "",
      designation: "",
      dateOfBirth: "",
      fatherHusbandName: "",
      address: "",
      category: "",
      religion: "",
      profilePictureUrl: "",
      schoolId: user?.schoolId || "",
      isActive: true,

    },
  });

  const editForm = useForm<TeacherFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      contactNumber: "",
      schoolIdNumber: "",
      aadhar: "",
      gender: "male",
      bloodGroup: "",
      designation: "",
      dateOfBirth: "",
      fatherHusbandName: "",
      address: "",
      category: "",
      religion: "",
      profilePictureUrl: "",
      schoolId: user?.schoolId || "",
      isActive: true,

    },
  });


  // Force refresh of class-subject assignments when component mounts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments"] });
  }, []);

  // Helper function to get subjects for selected classes
  const getSubjectsForClasses = (selectedClassIds: string[]) => {
    const relevantAssignments = classSubjectAssignments.filter((assignment: ClassSubjectAssignment) => 
      selectedClassIds.includes(assignment.classId)
    );
    
    // Group subjects by grade level to avoid duplicates across sections
    const subjectGradeMap = new Map<string, any>();
    
    relevantAssignments.forEach((assignment: ClassSubjectAssignment) => {
      const subject = subjects.find((s: Subject) => s.id === assignment.subjectId);
      const classData = classes.find((c: Class) => c.id === assignment.classId);
      
      if (subject && classData) {
        const gradeSubjectKey = `${classData.grade}-${assignment.subjectId}`;
        
        if (!subjectGradeMap.has(gradeSubjectKey)) {
          subjectGradeMap.set(gradeSubjectKey, {
            id: assignment.subjectId,
            name: subject.name,
            grade: classData.grade,
            subjectName: subject.name,
            displayName: `Class ${classData.grade} - ${subject.name}`
          });
        }
      }
    });
    
    // Convert map to array and sort by grade then by subject name
    return Array.from(subjectGradeMap.values()).sort((a: { grade: string; subjectName: string }, b: { grade: string; subjectName: string }) => {
      // First sort by grade (using numeric comparison)
      const gradeComparison = a.grade.localeCompare(b.grade, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
      
      // If grades are the same, sort by subject name
      if (gradeComparison === 0) {
        return a.subjectName.localeCompare(b.subjectName);
      }
      
      return gradeComparison;
    });
  };

  // Teachers infinite query
  const {
    data: teachersData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers", user?.schoolId, { classFilter: selectedClassFilter !== "all" ? selectedClassFilter : undefined }],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const params = new URLSearchParams({ 
        offset: offset.toString(),
        limit: '12', // Load 12 teachers per page
        schoolId: user?.schoolId || ''
      });
      
      const response = await apiRequest("GET", `/api/teachers?${params.toString()}`);
      return response.json() as Promise<{ teachers: Teacher[], totalCount: number }>;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.teachers && lastPage.teachers.length === 12) {
        const totalLoaded = allPages.reduce((sum, page) => sum + page.teachers.length, 0);
        return totalLoaded;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!user?.schoolId,
  });

  // Flatten all pages into a single array of teachers
  const teachers = teachersData?.pages.flatMap(page => page.teachers) || [];
  const totalTeachers = teachersData?.pages[0]?.totalCount || 0;

  // Intersection observer for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Auto-load more teachers when reaching bottom
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Set up intersection observer for auto-loading
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, teachers.length]);

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return response.json();
    },
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json();
    },
  });

  const { data: classSubjectAssignments = [] } = useQuery<ClassSubjectAssignment[]>({
    queryKey: ["/api/class-subject-assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/class-subject-assignments");
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache this data
  });

  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!user?.schoolId,
  });

  // Query for timetable entries
  const { data: timetableEntries = [], isLoading: isTimetableLoading } = useQuery({
    queryKey: ["/api/timetable/detailed"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable/detailed");
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: activeTab === "timetable",
  });

  // Query for all teachers (non-paginated) for analytics
  const { data: allTeachersForAnalytics = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers/all", user?.schoolId],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        schoolId: user?.schoolId || '',
        limit: '1000' // Fetch all teachers
      });
      const response = await apiRequest("GET", `/api/teachers?${params.toString()}`);
      const data = await response.json();
      return data.teachers || [] as Teacher[];
    },
    enabled: !!user?.schoolId && activeTab === "schedule",
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Query for teacher attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["/api/teacher-attendance", user?.schoolId, selectedDate],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teacher-attendance?date=${selectedDate}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: !!user?.schoolId && (activeTab === "attendance" || activeTab === "schedule"),
  });


  // Teacher Schedule queries
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['teacher-schedule', selectedScheduleTeacher],
    queryFn: async (): Promise<TimetableEntry[]> => {
      if (!selectedScheduleTeacher) return [];
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/teachers/${selectedScheduleTeacher}/schedule`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch schedule');
      const data = await response.json();
      
      return data;
    },
    enabled: !!selectedScheduleTeacher && activeTab === 'schedule'
  });

  // Workload analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['teacher-workload-analytics'],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/analytics/teacher-workload', {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: activeTab === 'schedule'
  });

  // School data query for teacher defaults
  const { data: schoolData } = useQuery({
    queryKey: ["/api/school-info"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/school-info");
      return await response.json();
    },
    enabled: user?.role === 'admin' && !!user?.schoolId
  });

  // Update teacher defaults form when school data loads
  useEffect(() => {
    if (schoolData) {
      setTeacherDefaultsForm({
        defaultMaxPeriodsPerDay: schoolData.defaultMaxPeriodsPerDay || 6
      });
    }
  }, [schoolData]);

  // Update teacher defaults mutation
  const updateTeacherDefaultsMutation = useMutation({
    mutationFn: async (settingsData: { defaultMaxPeriodsPerDay: number }) => {
      if (!user?.schoolId) throw new Error("School ID not found");
      const response = await apiRequest("PATCH", `/api/schools/${user.schoolId}/settings`, settingsData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Teacher defaults updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/school-info"] });
      setIsSettingsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher defaults",
        variant: "destructive",
      });
    },
  });

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/all", user?.schoolId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-workload-analytics'] });
      // Don't close dialog or reset form here since we handle it in handleAddTeacher
      // after potential profile picture upload
      if (!selectedProfileImage) {
        // Only show success and reset if there's no profile picture to upload
        setIsAddDialogOpen(false);
        setSelectedProfileImage(null);
        setProfileImagePreview(null);
        addForm.reset({
          name: "",
          email: "",
          contactNumber: "",
          schoolIdNumber: "",
          schoolId: user?.schoolId || "",
          isActive: true,
          classes: [],
          subjects: [],
          aadhar: "",
          gender: undefined,
          bloodGroup: "",
          designation: "",
          dateOfBirth: "",
          fatherHusbandName: "",
          address: "",
          category: "",
          religion: "",
          profilePictureUrl: "",
        });
        toast({
          title: "Success",
          description: "Teacher added successfully",
        });
      }
      return result;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add teacher",
        variant: "destructive",
      });
    },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeacherFormData }) => {
      // Prepare backend data with classes included
      const response = await apiRequest("PUT", `/api/teachers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/all", user?.schoolId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-workload-analytics'] });
      setEditingTeacher(null);
      // Clear image state when edit is completed
      setSelectedProfileImage(null);
      setProfileImagePreview(null);
      editForm.reset({
        name: "",
        email: "",
        contactNumber: "",
        schoolIdNumber: "",
        schoolId: user?.schoolId || "",
        isActive: true,
        classes: [],
        subjects: [],
        aadhar: "",
        gender: undefined,
        bloodGroup: "",
        designation: "",
        dateOfBirth: "",
        fatherHusbandName: "",
        address: "",
        category: "",
        religion: "",
        profilePictureUrl: "",
      });
      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher",
        variant: "destructive",
      });
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/teachers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/all", user?.schoolId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-workload-analytics'] });
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete teacher",
        variant: "destructive",
      });
    },
  });

  // Attendance mutations
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ teacherId, status }: { teacherId: string; status: string }) => {
      const response = await apiRequest("POST", "/api/teacher-attendance", {
        teacherId,
        schoolId: user?.schoolId,
        attendanceDate: selectedDate,
        status,
        isFullDay: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-attendance"] });
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark attendance",
        variant: "destructive",
      });
    },
  });



  const handleProfileImageSelect = (file: File) => {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error", 
        description: "Please select a valid image file",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedProfileImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfileImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfilePicture = async (teacherId: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    const token = localStorage.getItem("authToken");
    const response = await fetch(`/api/teachers/${teacherId}/upload-profile-picture`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload profile picture');
    }
    
    const result = await response.json();
    return result.profilePictureUrl;
  };

  const clearImageState = () => {
    setSelectedProfileImage(null);
    setProfileImagePreview(null);
    // Reset the file input
    const fileInput = document.getElementById('profile-image-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleAddTeacher = async (data: TeacherFormData) => {
    try {
      // First create the teacher
      const teacherResult = await createTeacherMutation.mutateAsync(data);
      
      // If there's a profile image, upload it
      if (selectedProfileImage && teacherResult.id) {
        try {
          const profilePictureUrl = await uploadProfilePicture(teacherResult.id, selectedProfileImage);
          
          // Update the teacher with the profile picture URL
          await updateTeacherMutation.mutateAsync({
            id: teacherResult.id,
            data: { ...data, profilePictureUrl }
          });
          
          toast({
            title: "Success",
            description: "Teacher and profile picture added successfully",
          });
        } catch (uploadError) {
          console.error("Profile picture upload failed:", uploadError);
          toast({
            title: "Warning",
            description: "Teacher created but profile picture upload failed",
            variant: "destructive",
          });
        }
        
        // Clean up after profile picture upload (success or failure)
        setIsAddDialogOpen(false);
        clearImageState();
        addForm.reset({
          name: "",
          email: "",
          contactNumber: "",
          schoolIdNumber: "",
          schoolId: user?.schoolId || "",
          isActive: true,
          classes: [],
          subjects: [],
          aadhar: "",
          gender: undefined,
          bloodGroup: "",
          designation: "",
          dateOfBirth: "",
          fatherHusbandName: "",
          address: "",
          category: "",
          religion: "",
          profilePictureUrl: "",
        });
      }
      // If no profile image, the createTeacherMutation onSuccess will handle cleanup
    } catch (error) {
      console.error("Error adding teacher:", error);
      // The createTeacherMutation will handle the error toast
    }
  };

  const handleEditTeacher = async (data: TeacherFormData) => {
    if (!editingTeacher) return;

    try {
      // If a new profile image is selected, upload it first
      if (selectedProfileImage) {
        const profilePictureUrl = await uploadProfilePicture(editingTeacher.id, selectedProfileImage);
        
        // Update teacher with the new profile picture URL
        updateTeacherMutation.mutate({ 
          id: editingTeacher.id, 
          data: { ...data, profilePictureUrl }
        });
      } else {
        // No new profile picture, just update with existing data
        updateTeacherMutation.mutate({ id: editingTeacher.id, data });
      }
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeacher = (id: string) => {
    deleteTeacherMutation.mutate(id);
  };

  const handleExportTeachers = () => {
    try {
      // Filter teachers using the same logic as the display
      const filteredTeachers = teachers.filter((teacher) => {
        // Apply search term filter
        let matchesSearch = true;
        if (teacherSearchTerm) {
          const searchTerm = teacherSearchTerm.toLowerCase();
          matchesSearch = false;
          
          // Search by name
          if (teacher.name.toLowerCase().includes(searchTerm)) matchesSearch = true;
          
          // Search by school ID (employee ID)
          if (teacher.schoolIdNumber && teacher.schoolIdNumber.toLowerCase().includes(searchTerm)) matchesSearch = true;
          
          // Search by classes taught
          const teacherClasses = (teacher.classes || [])
            .map((classId: string) => {
              const classData = classes.find((c: any) => c.id === classId);
              if (!classData) return null;
              const hasSection = classData.section && classData.section.trim() !== '' && classData.section !== '-';
              return hasSection 
                ? `Class ${classData.grade}-${classData.section}`
                : `Class ${classData.grade}`;
            })
            .filter(Boolean);
          
          if (teacherClasses.some((className) => className && className.toLowerCase().includes(searchTerm))) matchesSearch = true;
        }
        
        // Apply class filter
        let matchesClass = true;
        if (selectedClassFilter !== "all") {
          matchesClass = (teacher.classes || []).includes(selectedClassFilter);
        }
        
        return matchesSearch && matchesClass;
      });

      // Format data according to specified column order
      const exportData = filteredTeachers.map((teacher) => {
        // Get subjects
        const teacherSubjects = (teacher.subjects || [])
          .map(subjectId => subjects.find((s: any) => s.id === subjectId)?.name)
          .filter(Boolean)
          .join(', ') || 'Not assigned';

        // Get classes
        const teacherClasses = (teacher.classes || [])
          .map((classId: string) => {
            const classData = classes.find((c: any) => c.id === classId);
            if (!classData) return null;
            const hasSection = classData.section && classData.section.trim() !== '' && classData.section !== '-';
            return hasSection 
              ? `Class ${classData.grade}-${classData.section}`
              : `Class ${classData.grade}`;
          })
          .filter(Boolean)
          .join(', ') || 'Not assigned';

        return {
          'School ID': teacher.schoolIdNumber || 'Not provided',
          'Name': teacher.name,
          'Designation': teacher.designation || 'Not provided',
          'Gender': teacher.gender || 'Not provided',
          'Date of Birth': teacher.dateOfBirth || 'Not provided',
          'Father/Husband Name': teacher.fatherHusbandName || 'Not provided',
          'Contact Number': teacher.contactNumber || 'Not provided',
          'Email': teacher.email || 'Not provided',
          'Address': teacher.address || 'Not provided',
          'Aadhaar Number': teacher.aadhar || 'Not provided',
          'Blood Group': teacher.bloodGroup || 'Not provided',
          'Category': teacher.category || 'Not provided',
          'Religion': teacher.religion || 'Not provided',
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const columnWidths: any[] = [];
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            const cellLength = cell.v.toString().length;
            if (cellLength > maxWidth) {
              maxWidth = cellLength;
            }
          }
        }
        columnWidths.push({ width: Math.min(maxWidth + 2, 50) });
      }
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');

      // Generate filename based on filters
      let filename = 'teachers_export';
      if (selectedClassFilter !== 'all') {
        const selectedClass = classes.find((c: any) => c.id === selectedClassFilter);
        if (selectedClass) {
          const hasSection = selectedClass.section && selectedClass.section.trim() !== '' && selectedClass.section !== '-';
          const className = hasSection 
            ? `class_${selectedClass.grade}_${selectedClass.section}`
            : `class_${selectedClass.grade}`;
          filename = `teachers_${className}`;
        }
      }
      if (teacherSearchTerm) {
        filename += `_search_${teacherSearchTerm.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Exported ${filteredTeachers.length} teacher${filteredTeachers.length !== 1 ? 's' : ''} to Excel`,
      });

    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export teacher data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    
    editForm.reset({
      name: teacher.name,
      email: teacher.email ?? "",
      contactNumber: teacher.contactNumber ?? "",
      schoolIdNumber: teacher.schoolIdNumber ?? "",
      schoolId: teacher.schoolId,
      isActive: teacher.isActive,
      aadhar: teacher.aadhar ?? "",
      gender: teacher.gender || undefined,
      bloodGroup: teacher.bloodGroup ?? "",
      designation: teacher.designation ?? "",
      dateOfBirth: teacher.dateOfBirth ?? "",
      fatherHusbandName: teacher.fatherHusbandName ?? "",
      address: teacher.address ?? "",
      category: teacher.category ?? "",
      religion: teacher.religion ?? "",
      profilePictureUrl: teacher.profilePictureUrl ?? "",
    });
  };

  // Attendance handlers
  const handleMarkAttendance = (teacherId: string, status: string) => {
    markAttendanceMutation.mutate({ teacherId, status });
  };


  // Check if selected date is an active school day
  const selectedDayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const isActiveDay = (timetableStructure as any)?.workingDays?.includes(selectedDayName) || false;

  // Get attendance status for a teacher (only on active days)
  const getTeacherAttendanceStatus = (teacherId: string) => {
    // Only calculate attendance for active days
    if (!isActiveDay) return "not_applicable";
    
    const attendance = attendanceData.find(
      (att) => att.teacherId === teacherId && att.attendanceDate === selectedDate
    );
    return attendance?.status || "present";
  };

  if (!user?.schoolId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You need to be associated with a school to manage teachers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            Teachers
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage teachers, timetables, and attendance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Teacher
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsAddDialogOpen(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Add Single Teacher
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation('/teachers/bulk-upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Add Multiple Teachers
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSettingsDialogOpen(true)}
                title="Teacher Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b">
          <TabsList className="flex flex-wrap justify-start bg-transparent p-0 h-auto w-full">
            <TabsTrigger value="teachers" className="flex items-center gap-2 px-4 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">
              <User className="h-4 w-4" />
              Teachers
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2 px-4 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">
              <CalendarIcon className="h-4 w-4" />
              Teacher Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="teachers" className="space-y-4">
          {/* Search and Filter Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 flex-1">
                <div className="flex-1 min-w-0 sm:max-w-lg">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search teachers by name or School ID..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((classItem: Class) => {
                        const hasSection = classItem.section && classItem.section.trim() !== '' && classItem.section !== '-';
                        const displayName = hasSection 
                          ? `Class ${classItem.grade}-${classItem.section}`
                          : `Class ${classItem.grade}`;
                        return (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              // Clear image state when dialog is closed
              setSelectedProfileImage(null);
              setProfileImagePreview(null);
            }
          }}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Create Teacher
                </DialogTitle>
                <DialogDescription>
                  Add a new teacher with complete information
                </DialogDescription>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(handleAddTeacher)} className="space-y-2">
                  
                  {/* Profile Picture Upload Section */}
                  <div className="flex flex-col items-center space-y-2 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="relative w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border overflow-hidden">
                      {profileImagePreview ? (
                        <>
                          <img 
                            src={profileImagePreview} 
                            alt="Profile preview" 
                            className="w-full h-full object-cover rounded-full"
                          />
                          <button
                            type="button"
                            onClick={clearImageState}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <User className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleProfileImageSelect(file);
                          }
                        }}
                        className="hidden"
                        id="profile-image-input"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('profile-image-input')?.click()}
                      >
                        Upload Image
                      </Button>
                      <span className="text-sm text-gray-500">or</span>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('profile-image-input')?.click()}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    {selectedProfileImage && (
                      <p className="text-sm text-green-600">
                        Selected: {selectedProfileImage.name}
                      </p>
                    )}
                  </div>

                  {/* Section 1: Basic Information */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-primary border-b pb-2">Section 1: Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <FormField
                        control={addForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name*</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Gender */}
                      <FormField
                        control={addForm.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Date of Birth */}
                      <FormField
                        control={addForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Aadhaar Number */}
                      <FormField
                        control={addForm.control}
                        name="aadhar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Aadhaar Number</FormLabel>
                            <FormControl>
                              <Input placeholder="12-digit Aadhaar number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Father / Husband Name */}
                      <FormField
                        control={addForm.control}
                        name="fatherHusbandName"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Father / Husband Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter father/husband name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Section 2: Contact Details */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-primary border-b pb-2">Section 2: Contact Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mobile Number */}
                      <FormField
                        control={addForm.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number*</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter mobile number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Email Address */}
                      <FormField
                        control={addForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="teacher@school.com" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Address */}
                      <FormField
                        control={addForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter complete address" 
                                className="min-h-[80px]" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Section 3: Professional Information */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-primary border-b pb-2">Section 3: Professional Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Employee ID / School ID */}
                      <FormField
                        control={addForm.control}
                        name="schoolIdNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employee ID / School ID</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter employee ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Designation */}
                      <FormField
                        control={addForm.control}
                        name="designation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Designation</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Senior Teacher" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category */}
                      <FormField
                        control={addForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category (General, SC, ST, OBC, etc.)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="obc">OBC</SelectItem>
                                <SelectItem value="sc">SC</SelectItem>
                                <SelectItem value="st">ST</SelectItem>
                                <SelectItem value="ews">EWS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Religion */}
                      <FormField
                        control={addForm.control}
                        name="religion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Religion</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="hindu">Hindu</SelectItem>
                                <SelectItem value="muslim">Muslim</SelectItem>
                                <SelectItem value="christian">Christian</SelectItem>
                                <SelectItem value="sikh">Sikh</SelectItem>
                                <SelectItem value="buddhist">Buddhist</SelectItem>
                                <SelectItem value="jain">Jain</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Blood Group */}
                      <FormField
                        control={addForm.control}
                        name="bloodGroup"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Blood Group</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="A+">A+</SelectItem>
                                <SelectItem value="A-">A-</SelectItem>
                                <SelectItem value="B+">B+</SelectItem>
                                <SelectItem value="B-">B-</SelectItem>
                                <SelectItem value="AB+">AB+</SelectItem>
                                <SelectItem value="AB-">AB-</SelectItem>
                                <SelectItem value="O+">O+</SelectItem>
                                <SelectItem value="O-">O-</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>


                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createTeacherMutation.isPending}
                      data-testid="button-save-teacher"
                    >
                      {createTeacherMutation.isPending ? "Adding..." : "Add Teacher"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Teachers List */}
          <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>All Teachers</CardTitle>
              <CardDescription>
                {totalTeachers} teacher{totalTeachers !== 1 ? 's' : ''} in your school
              </CardDescription>
            </div>
            <Button 
              onClick={handleExportTeachers}
              variant="outline" 
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No teachers found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first teacher
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-teacher">
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teachers
                .filter((teacher) => {
                  // Apply search term filter
                  let matchesSearch = true;
                  if (teacherSearchTerm) {
                    const searchTerm = teacherSearchTerm.toLowerCase();
                    matchesSearch = false;
                    
                    // Search by name
                    if (teacher.name.toLowerCase().includes(searchTerm)) matchesSearch = true;
                    
                    // Search by school ID (employee ID)
                    if (teacher.schoolIdNumber && teacher.schoolIdNumber.toLowerCase().includes(searchTerm)) matchesSearch = true;
                    
                    // Search by classes taught
                    const teacherClasses = (teacher.classes || [])
                      .map((classId: string) => {
                        const classData = classes.find((c: any) => c.id === classId);
                        if (!classData) return null;
                        const hasSection = classData.section && classData.section.trim() !== '' && classData.section !== '-';
                        return hasSection 
                          ? `Class ${classData.grade}-${classData.section}`
                          : `Class ${classData.grade}`;
                      })
                      .filter(Boolean);
                    
                    if (teacherClasses.some((className) => className && className.toLowerCase().includes(searchTerm))) matchesSearch = true;
                  }
                  
                  // Apply class filter
                  let matchesClass = true;
                  if (selectedClassFilter !== "all") {
                    matchesClass = (teacher.classes || []).includes(selectedClassFilter);
                  }
                  
                  return matchesSearch && matchesClass;
                })
                .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically A-Z
                .map((teacher) => {
                  // Get teacher's subjects
                  const teacherSubjects = (teacher.subjects || [])
                    .map(subjectId => subjects.find((s: any) => s.id === subjectId))
                    .filter(Boolean)
                    .map((s: any) => s.name);

                  // Get teacher's assigned classes from the classDisplayNames field provided by backend
                  const teacherClassAssignments = (teacher as any).classDisplayNames || [];

                  return (
                <Card 
                  key={teacher.id} 
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20 cursor-pointer bg-gradient-to-br from-white to-gray-50/30 dark:from-slate-900 dark:to-slate-800/30" 
                  data-testid={`teacher-card-${teacher.id}`}
                  onClick={() => setLocation(`/teacher/${teacher.id}`)}
                >
                  {/* Decorative gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                  
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          {teacher.profilePictureUrl ? (
                            <>
                              <img
                                src={teacher.profilePictureUrl}
                                alt={`${teacher.name}'s profile`}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md dark:border-slate-700 group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                                }}
                              />
                              <div 
                                className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center absolute top-0 left-0 border-2 border-white shadow-md dark:border-slate-700"
                                style={{ display: 'none' }}
                              >
                                <User className="h-6 w-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-white shadow-md dark:border-slate-700 group-hover:scale-105 transition-transform duration-200">
                              <User className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base mb-0.5 truncate" data-testid={`teacher-name-${teacher.id}`}>
                            {teacher.name}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <IdCard className="h-3 w-3" />
                            {teacher.schoolIdNumber || 'Not Assigned'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(teacher);
                          }}
                          className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                          data-testid={`edit-teacher-${teacher.id}`}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pb-4">
                    {/* Classes Taught */}
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0 mt-0.5">
                        <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Classes</p>
                        {teacherClassAssignments.length > 0 ? (
                          <p className="text-sm font-medium">
                            {teacherClassAssignments.slice(0, 2).join(', ')}
                            {teacherClassAssignments.length > 2 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                +{teacherClassAssignments.length - 2} more
                              </span>
                            )}
                          </p>
                        ) : (
                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                            Not Assigned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  );
                })}
            </div>
          )}

          {/* Infinite scroll load more trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading more teachers...</span>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  onClick={loadMore}
                  className="text-muted-foreground"
                  data-testid="button-load-more"
                >
                  Load more teachers
                </Button>
              )}
            </div>
          )}

          {!hasNextPage && teachers.length > 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              You've reached the end of the list
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={!!editingTeacher} onOpenChange={(open) => {
        if (!open) {
          setEditingTeacher(null);
          // Clear image state when dialog is closed
          setSelectedProfileImage(null);
          setProfileImagePreview(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit Teacher
            </DialogTitle>
            <DialogDescription>
              Update teacher information with complete details
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditTeacher)} className="space-y-2">
              
              {/* Profile Picture Upload Section */}
              <div className="flex flex-col items-center space-y-2 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="relative w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border overflow-hidden">
                  {profileImagePreview ? (
                    <>
                      <img 
                        src={profileImagePreview} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      <button
                        type="button"
                        onClick={clearImageState}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </>
                  ) : editingTeacher?.profilePictureUrl ? (
                    <>
                      <img 
                        src={editingTeacher.profilePictureUrl} 
                        alt="Current profile" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Set preview to trigger the file selection interface
                          setProfileImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-600"
                        title="Change image"
                      >
                        ✎
                      </button>
                    </>
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleProfileImageSelect(file);
                      }
                    }}
                    className="hidden"
                    id="edit-profile-image-input"
                  />
                  <label
                    htmlFor="edit-profile-image-input"
                    className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    {editingTeacher?.profilePictureUrl && !profileImagePreview ? 'Change Photo' : 'Choose Photo'}
                  </label>
                  <span className="text-xs text-gray-500 self-center">Max 5MB, JPG/PNG</span>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} data-testid="input-edit-teacher-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="teacher@school.com" 
                            {...field} 
                            data-testid="input-edit-teacher-email" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="contactNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., +1234567890" 
                            {...field} 
                            data-testid="input-edit-teacher-contact" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="schoolIdNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., T001" 
                            {...field} 
                            data-testid="input-edit-teacher-school-id" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="aadhar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aadhaar Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 1234 5678 9012" 
                            {...field} 
                            data-testid="input-edit-teacher-aadhar" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-teacher-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="bloodGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blood Group</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., A+, B-, O+" 
                            {...field} 
                            data-testid="input-edit-teacher-blood-group" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Senior Teacher, HOD" 
                            {...field} 
                            data-testid="input-edit-teacher-designation" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-edit-teacher-dob" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="fatherHusbandName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Father/Husband Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter father or husband name" 
                            {...field} 
                            data-testid="input-edit-teacher-father-husband" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., General, OBC, SC, ST" 
                            {...field} 
                            data-testid="input-edit-teacher-category" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="religion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Religion</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter religion" 
                            {...field} 
                            data-testid="input-edit-teacher-religion" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter complete address" 
                          {...field} 
                          data-testid="input-edit-teacher-address" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateTeacherMutation.isPending}
                  data-testid="button-save-edit-teacher"
                >
                  {updateTeacherMutation.isPending ? "Updating..." : "Update Teacher"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </TabsContent>




        {/* Teacher Insights Tab */}
        <TabsContent value="schedule" className="space-y-4">
          {/* Overview Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Teachers */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Teachers</p>
                    <h3 className="text-lg md:text-xl font-semibold mt-2">{allTeachersForAnalytics?.length || 0}</h3>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Teachers */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Teachers</p>
                    <h3 className="text-lg md:text-xl font-semibold mt-2">
                      {allTeachersForAnalytics?.filter((t: any) => t.status === 'active').length || 0}
                    </h3>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Present Today */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present Today</p>
                    <h3 className="text-lg md:text-xl font-semibold mt-2">
                      {attendanceData?.filter((a: any) => a.status === 'present').length || 0}
                    </h3>
                  </div>
                  <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Absent Today */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Absent Today</p>
                    <h3 className="text-lg md:text-xl font-semibold mt-2">
                      {attendanceData?.filter((a: any) => a.status === 'absent' || a.status === 'sick_leave' || a.status === 'casual_leave').length || 0}
                    </h3>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workload Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Workload Distribution
                </CardTitle>
                <CardDescription>Teaching load across all teachers</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.teachers && analytics.teachers.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.teachers
                      .sort((a: any, b: any) => b.weeklyPeriods - a.weeklyPeriods)
                      .slice(0, 5)
                      .map((teacherData: any) => {
                        const teacher = allTeachersForAnalytics?.find((t: any) => t.id === teacherData.teacherId);
                        const maxPeriods = (teacher?.maxDailyPeriods || 6) * 6; // 6 working days
                        const percentage = maxPeriods > 0 ? (teacherData.weeklyPeriods / maxPeriods) * 100 : 0;
                        
                        return (
                          <div key={teacherData.teacherId} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{teacher?.name || 'Unknown'}</span>
                              <span className="text-muted-foreground">
                                {teacherData.weeklyPeriods}/{maxPeriods} periods
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  percentage >= 110 ? 'bg-red-500' :
                                  percentage >= 90 ? 'bg-green-500' :
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No workload data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subject Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Subject Distribution
                </CardTitle>
                <CardDescription>Teachers per subject</CardDescription>
              </CardHeader>
              <CardContent>
                {classSubjectAssignments && classSubjectAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      // Count teachers per subject
                      const subjectTeacherCount = classSubjectAssignments.reduce((acc: Record<string, Set<string>>, assignment: any) => {
                        const subjectId = assignment.subjectId;
                        if (!acc[subjectId]) {
                          acc[subjectId] = new Set();
                        }
                        acc[subjectId].add(assignment.assignedTeacherId);
                        return acc;
                      }, {});

                      return Object.entries(subjectTeacherCount)
                        .map(([subjectId, teacherSet]) => {
                          const subject = subjects?.find((s: any) => s.id === subjectId);
                          return {
                            subject: subject?.name || 'Unknown',
                            count: teacherSet.size
                          };
                        })
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 6)
                        .map((item) => (
                          <div key={item.subject} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.subject}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500"
                                  style={{ width: `${(item.count / (allTeachersForAnalytics?.length || 1)) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-8 text-right">{item.count}</span>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No subject assignments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Demographics
                </CardTitle>
                <CardDescription>Teacher gender distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {allTeachersForAnalytics && allTeachersForAnalytics.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const genderCount = allTeachersForAnalytics.reduce((acc: Record<string, number>, teacher: any) => {
                        const gender = teacher.gender || 'Not specified';
                        acc[gender] = (acc[gender] || 0) + 1;
                        return acc;
                      }, {});

                      const total = allTeachersForAnalytics.length;
                      const colors: Record<string, string> = {
                        'male': 'bg-blue-500',
                        'female': 'bg-pink-500',
                        'other': 'bg-purple-500',
                        'Not specified': 'bg-gray-400'
                      };

                      return Object.entries(genderCount).map(([gender, count]) => (
                        <div key={gender} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize">{gender}</span>
                            <span className="text-sm text-muted-foreground">
                              {count} ({Math.round((count / total) * 100)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors[gender] || 'bg-gray-500'}`}
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No teacher data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Today's Attendance
                </CardTitle>
                <CardDescription>Current attendance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceData && attendanceData.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const statusCount = attendanceData.reduce((acc: Record<string, number>, attendance: any) => {
                        const status = attendance.status || 'unmarked';
                        acc[status] = (acc[status] || 0) + 1;
                        return acc;
                      }, {});

                      const statusConfig: Record<string, { label: string; color: string }> = {
                        'present': { label: 'Present', color: 'bg-green-500' },
                        'absent': { label: 'Absent', color: 'bg-red-500' },
                        'sick_leave': { label: 'Sick Leave', color: 'bg-orange-500' },
                        'casual_leave': { label: 'Casual Leave', color: 'bg-yellow-500' },
                        'half_day': { label: 'Half Day', color: 'bg-blue-500' },
                        'unmarked': { label: 'Unmarked', color: 'bg-gray-400' }
                      };

                      const total = attendanceData.length;

                      return Object.entries(statusCount).map(([status, count]) => {
                        const config = statusConfig[status] || { label: status, color: 'bg-gray-500' };
                        return (
                          <div key={status} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{config.label}</span>
                              <span className="text-sm text-muted-foreground">
                                {count} ({Math.round((count / total) * 100)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${config.color}`}
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No attendance data for today</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Teachers on Leave */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Teachers on Leave
              </CardTitle>
              <CardDescription>Current and upcoming teacher leaves</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const { data: teachersOnLeaveData, isLoading: teachersOnLeaveLoading } = useQuery({
                  queryKey: ["/api/teachers-on-leave"],
                  enabled: activeTab === 'schedule'
                });

                if (teachersOnLeaveLoading) {
                  return (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    </div>
                  );
                }

                const currentLeaves = teachersOnLeaveData?.current || [];
                const futureLeaves = teachersOnLeaveData?.future || [];
                const hasLeaves = currentLeaves.length > 0 || futureLeaves.length > 0;

                if (!hasLeaves) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No teachers on leave</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {/* Current Leaves */}
                    {currentLeaves.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 text-red-600 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Currently on Leave ({currentLeaves.length})
                        </h4>
                        <div className="space-y-2">
                          {currentLeaves.map((leave: any) => (
                            <div 
                              key={`${leave.teacherId}-${leave.leaveStartDate}-${leave.leaveEndDate}`}
                              className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                  <UserCheck className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{leave.teacherName}</p>
                                  <p className="text-xs text-muted-foreground">{leave.teacherEmail}</p>
                                  {leave.reason && (
                                    <p className="text-xs text-gray-600 mt-1">Reason: {leave.reason}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium text-red-700 capitalize">
                                  {leave.status.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {leave.leaveStartDate} to {leave.leaveEndDate}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Future Leaves */}
                    {futureLeaves.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 text-orange-600 flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Upcoming Leaves ({futureLeaves.length})
                        </h4>
                        <div className="space-y-2">
                          {futureLeaves.map((leave: any) => (
                            <div 
                              key={`${leave.teacherId}-${leave.leaveStartDate}-${leave.leaveEndDate}`}
                              className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                                  <UserCheck className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{leave.teacherName}</p>
                                  <p className="text-xs text-muted-foreground">{leave.teacherEmail}</p>
                                  {leave.reason && (
                                    <p className="text-xs text-gray-600 mt-1">Reason: {leave.reason}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium text-orange-700 capitalize">
                                  {leave.status.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {leave.leaveStartDate} to {leave.leaveEndDate}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Teacher Defaults Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teacher Defaults
            </DialogTitle>
            <DialogDescription>
              Configure default values applied when creating new teachers
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            updateTeacherDefaultsMutation.mutate(teacherDefaultsForm);
          }} className="space-y-4">
            <div>
              <Label htmlFor="defaultMaxPeriodsPerDay">Default Max Periods Per Day for Teachers</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Maximum teaching periods per day assigned to new teachers by default
              </p>
              <Input
                id="defaultMaxPeriodsPerDay"
                type="number"
                min="1"
                max="12"
                value={teacherDefaultsForm.defaultMaxPeriodsPerDay}
                onChange={(e) => setTeacherDefaultsForm({ 
                  ...teacherDefaultsForm, 
                  defaultMaxPeriodsPerDay: parseInt(e.target.value) || 6 
                })}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valid range: 1-12 periods per day
              </p>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={updateTeacherDefaultsMutation.isPending}
              >
                {updateTeacherDefaultsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}