import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Newsfeed from "@/components/Newsfeed";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Users,
  MapPin,
  Clock,
  BookOpen,
  User,
  Calendar,
  GraduationCap,
  CalendarDays,
  Mail,
  Phone,
  IdCard,
  Plus,
  X,
  Download,
  FileSpreadsheet,
  Image,
  Loader2,
  MessageSquare,
  Settings,
  Heart,
  Edit,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { z } from "zod";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { getCurrentDateIST, toISTDateString } from "@shared/utils/dateUtils";
import html2canvas from 'html2canvas';
import { getClassName } from "@shared/classUtils";

interface Class {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  requiredSubjects: string[];
  schoolId: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

interface Teacher {
  id: string;
  name: string;
  email?: string;
  contactNumber?: string;
  schoolIdNumber?: string;
  subjects?: string[];
  schoolId: string;
  isActive: boolean;
  profilePictureUrl?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  periodsPerWeek: number;
  color: string;
  schoolId: string;
}

interface TimetableEntry {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacher?: Teacher;
  subject?: {
    id: string;
    name: string;
    code: string;
  };
}

interface TimetableValidityPeriod {
  id: string;
  classId: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

interface ClassSubjectAssignment {
  id: string;
  classId: string;
  subjectId: string;
  weeklyFrequency: number;
  assignedTeacherId?: string | null;
  subject: Subject;
  assignedTeacher?: Teacher;
}

interface ClassTeacherAssignment {
  id: string;
  classId: string;
  teacherId: string;
  role: "primary" | "co_class";
  isPrimary: boolean;
  privileges: {
    attendance: boolean;
    classFeedPosting: boolean;
    parentCommunication: boolean;
    leaveApproval: boolean;
  };
  assignedBy: string;
  schoolId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  teacherName: string;
  teacherEmail: string;
}

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  classId?: string;
  schoolId: string;
  rollNumber?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianContact?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  isActive: boolean;
  status: "active" | "inactive" | "graduated" | "transferred";
  createdAt: string;
  updatedAt: string;
}

// Common subject names for auto-suggestion
const COMMON_SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "Social Studies",
  "History",
  "Geography",
  "Civics",
  "Economics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Information Technology",
  "Physical Education",
  "Art",
  "Music",
  "Sanskrit",
  "French",
  "Spanish",
  "German",
  "Environmental Science",
  "Moral Science",
  "General Knowledge",
  "Business Studies",
  "Accountancy",
  "Commerce",
  "Political Science",
  "Psychology",
  "Sociology",
];

const teacherAssignmentSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required"),
  subjectId: z.string().min(1, "Subject is required"),
});

const classTeacherAssignmentSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required"),
  role: z.enum(["primary", "co_class"], { required_error: "Role is required" }),
  privileges: z.object({
    attendance: z.boolean().default(true),
    classFeedPosting: z.boolean().default(true),
    parentCommunication: z.boolean().default(true),
    leaveApproval: z.boolean().default(true),
  }).default({
    attendance: true,
    classFeedPosting: true,
    parentCommunication: true,
    leaveApproval: true,
  }),
});

// Schema for creating and assigning a new subject
const createSubjectAssignmentSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(255, "Subject name too long"),
  weeklyFrequency: z.number().min(1, "Weekly frequency must be at least 1").max(8, "Weekly frequency cannot exceed 8 periods"),
});

type TeacherAssignmentFormData = z.infer<typeof teacherAssignmentSchema>;
type CreateSubjectAssignmentFormData = z.infer<typeof createSubjectAssignmentSchema>;

export default function ClassDetailPage() {
  const [, params] = useRoute("/classes/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const classId = params?.id;
  const [isTeacherAssignDialogOpen, setIsTeacherAssignDialogOpen] = useState(false);
  const [isSubjectAssignDialogOpen, setIsSubjectAssignDialogOpen] = useState(false);
  const [isEditSubjectDialogOpen, setIsEditSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  
  // Navigation state and refs for overview cards
  const [activeTab, setActiveTab] = useState("feed");
  const [pendingScrollRef, setPendingScrollRef] = useState<React.RefObject<HTMLDivElement> | null>(null);
  const studentsRef = useRef<HTMLDivElement>(null);
  const teachersRef = useRef<HTMLDivElement>(null);
  const subjectsRef = useRef<HTMLDivElement>(null);

  // Handle smooth scrolling after tab switch
  useEffect(() => {
    if (activeTab === "config" && pendingScrollRef?.current) {
      requestAnimationFrame(() => {
        pendingScrollRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "start" 
        });
        setPendingScrollRef(null);
      });
    }
  }, [activeTab, pendingScrollRef]);
  
  const [isDeleteSubjectDialogOpen, setIsDeleteSubjectDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null);
  const [isDeleteTeacherDialogOpen, setIsDeleteTeacherDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<any>(null);
  
  // Copy subjects state
  const [isCopySubjectsDialogOpen, setIsCopySubjectsDialogOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<Class[]>([]);
  const [copyValidationErrors, setCopyValidationErrors] = useState<{ classId: string; className: string; error: string }[]>([]);
  
  // Class Teacher state
  const [isClassTeacherAssignDialogOpen, setIsClassTeacherAssignDialogOpen] = useState(false);
  const [isClassTeacherDeleteDialogOpen, setIsClassTeacherDeleteDialogOpen] = useState(false);
  const [classTeacherToDelete, setClassTeacherToDelete] = useState<ClassTeacherAssignment | null>(null);
  const [isEditPrivilegesDialogOpen, setIsEditPrivilegesDialogOpen] = useState(false);
  const [editingClassTeacher, setEditingClassTeacher] = useState<ClassTeacherAssignment | null>(null);
  
  // Teacher Mini-Profile state
  const [isTeacherProfileDialogOpen, setIsTeacherProfileDialogOpen] = useState(false);
  const [selectedProfileTeacher, setSelectedProfileTeacher] = useState<any>(null);

  // Edit Room state - inline editing
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [roomEditValue, setRoomEditValue] = useState("");
  const roomInputRef = useRef<HTMLInputElement>(null);

  // Students state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsOffset, setStudentsOffset] = useState(0);
  const [isLoadingMoreStudents, setIsLoadingMoreStudents] = useState(false);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const STUDENTS_PER_PAGE = 5;
  
  const [teacherSearchText, setTeacherSearchText] = useState("");
  const [showTeacherSuggestions, setShowTeacherSuggestions] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Subject name auto-suggestion state
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [filteredSubjects, setFilteredSubjects] = useState<string[]>([]);

  const teacherAssignForm = useForm<TeacherAssignmentFormData>({
    resolver: zodResolver(teacherAssignmentSchema),
    defaultValues: {
      teacherId: "",
      subjectId: "",
    },
  });

  const createSubjectForm = useForm<CreateSubjectAssignmentFormData>({
    resolver: zodResolver(createSubjectAssignmentSchema),
    defaultValues: {
      name: "",
      weeklyFrequency: 4,
    },
  });

  const editSubjectForm = useForm<{ weeklyFrequency: number }>({
    resolver: zodResolver(z.object({
      weeklyFrequency: z.number().min(1, "Weekly frequency must be at least 1").max(8, "Weekly frequency cannot exceed 8 periods")
    })),
    defaultValues: {
      weeklyFrequency: 1,
    },
  });

  const classTeacherForm = useForm({
    resolver: zodResolver(classTeacherAssignmentSchema),
    defaultValues: {
      teacherId: "",
      role: "primary" as const,
      privileges: {
        attendance: true,
        classFeedPosting: true,
        parentCommunication: true,
        leaveApproval: true,
      },
    },
  });

  const editPrivilegesForm = useForm({
    resolver: zodResolver(z.object({
      privileges: z.object({
        attendance: z.boolean(),
        classFeedPosting: z.boolean(),
        parentCommunication: z.boolean(),
        leaveApproval: z.boolean(),
      }),
    })),
    defaultValues: {
      privileges: {
        attendance: true,
        classFeedPosting: true,
        parentCommunication: true,
        leaveApproval: true,
      },
    },
  });


  // Class data query
  const {
    data: classData,
    isLoading: isClassLoading,
    error: classError,
  } = useQuery<Class>({
    queryKey: ["/api/classes", classId],
    enabled: !!classId,
  });

  // Timetable data query
  // Get current week dates for version queries
  const getCurrentWeek = () => {
    const istDateStr = getCurrentDateIST();
    const now = new Date(istDateStr + 'T00:00:00+05:30');
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() + daysToMonday); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 5); // Saturday
    
    return {
      start: toISTDateString(startOfWeek),
      end: toISTDateString(endOfWeek)
    };
  };

  const currentWeek = getCurrentWeek();


  const {
    data: timetableData = [],
    isLoading: isTimetableLoading,
  } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/detailed", classId, "class"], // Match TimetableGrid format
    queryFn: async () => {
      const params = new URLSearchParams({ classId: classId || '' });
      // Always fetch the latest active timetable - no version parameter
      const response = await apiRequest("GET", `/api/timetable/detailed?${params.toString()}`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: !!classId,
    staleTime: 0, // Always fetch fresh data like TimetableGrid
  });

  // Validity periods query

  // Teachers query
  const {
    data: teachersResponse,
    isLoading: isTeachersLoading,
  } = useQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers-v2", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers?schoolId=${user?.schoolId}&limit=1000`);
      return response.json();
    },
    enabled: !!user?.schoolId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  
  const teachers = teachersResponse?.teachers || [];

  // Filter teachers based on search text (top 5)
  // Match teachers whose first name starts with the search term
  const filteredTeachers = teachers
    .filter(teacher => {
      const searchLower = teacherSearchText.toLowerCase();
      const nameLower = teacher.name.toLowerCase();
      const nameParts = nameLower.split(' ');
      
      // Check if the first name starts with the search term
      const nameMatches = nameParts.length > 0 && nameParts[0].startsWith(searchLower);
      
      // Also check school ID number for exact match
      const idMatches = teacher.schoolIdNumber?.toLowerCase().includes(searchLower);
      
      return nameMatches || idMatches;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);

  // Subjects query
  const {
    data: subjects = [],
    isLoading: isSubjectsLoading,
  } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  // All Classes query (for add teacher form)
  const {
    data: allClasses = [],
    isLoading: isAllClassesLoading,
  } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });

  // Timetable structure query
  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!user?.schoolId,
  });


  // Class Subject Assignments query
  const {
    data: classSubjectAssignments = [],
    isLoading: isAssignmentsLoading,
  } = useQuery<ClassSubjectAssignment[]>({
    queryKey: ["/api/class-subject-assignments-v2", classId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${classId}`);
      return response.json() as Promise<ClassSubjectAssignment[]>;
    },
    enabled: !!classId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Class Teacher Assignments query
  const {
    data: classTeacherAssignments = [],
    isLoading: isClassTeachersLoading,
  } = useQuery<ClassTeacherAssignment[]>({
    queryKey: ["/api/classes", classId, "teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/classes/${classId}/teachers`);
      return response.json() as Promise<ClassTeacherAssignment[]>;
    },
    enabled: !!classId,
  });

  // Students query - Initial load
  const {
    data: initialStudents = [],
    isLoading: isStudentsLoading,
  } = useQuery<Student[]>({
    queryKey: ["/api/students", classId, "initial", "v2"], // v2 to clear old cache
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students?classId=${classId}&offset=0&limit=${STUDENTS_PER_PAGE}`);
      const data = await response.json() as { students: Student[], totalCount: number };
      const fetchedStudents = data.students || [];
      setStudents(fetchedStudents);
      setHasMoreStudents(fetchedStudents.length === STUDENTS_PER_PAGE);
      setStudentsOffset(STUDENTS_PER_PAGE);
      return fetchedStudents;
    },
    enabled: !!classId,
  });

  // Calculate weekly period limits
  const weeklyPeriodCap = timetableStructure 
    ? (timetableStructure.timeSlots?.filter((slot: any) => !slot.isBreak).length || 0) * (timetableStructure.workingDays?.length || 0)
    : 42; // Default fallback
  
  const currentTotalPeriods = classSubjectAssignments.reduce((sum, assignment) => sum + assignment.weeklyFrequency, 0);
  const availablePeriods = Math.max(0, weeklyPeriodCap - currentTotalPeriods); // Prevent negative

  // Watch form values for validation feedback
  const watchedCreateFrequency = createSubjectForm.watch("weeklyFrequency") || 0;
  const watchedEditFrequency = editSubjectForm.watch("weeklyFrequency") || 0;
  
  const createWouldExceed = watchedCreateFrequency > 0 && watchedCreateFrequency > availablePeriods;
  const editWouldExceed = editingSubject && watchedEditFrequency > 0 && (watchedEditFrequency - editingSubject.weeklyFrequency) > availablePeriods;


  const [teacherAssignError, setTeacherAssignError] = useState<string | null>(null);

  const assignTeacherMutation = useMutation({
    mutationFn: async (data: TeacherAssignmentFormData) => {
      const response = await apiRequest("POST", `/api/classes/${classId}/assign-teacher`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2", classId] });
      setIsTeacherAssignDialogOpen(false);
      teacherAssignForm.reset({
        teacherId: "",
        subjectId: "",
      });
      setTeacherSearchText("");
      setSelectedTeacher(null);
      setShowTeacherSuggestions(false);
      setTeacherAssignError(null);
      toast({
        title: "Success",
        description: "Teacher assigned to subject successfully",
      });
    },
    onError: (error: Error) => {
      setTeacherAssignError(error.message || "Failed to assign teacher");
    },
  });


  const createAndAssignSubjectMutation = useMutation({
    mutationFn: async (data: CreateSubjectAssignmentFormData) => {
      const response = await apiRequest("POST", `/api/classes/${classId}/create-assign-subject`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2", classId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setIsSubjectAssignDialogOpen(false);
      createSubjectForm.reset();
      toast({
        title: "Success",
        description: "Subject created and assigned successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create and assign subject",
        variant: "destructive",
      });
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async (data: { weeklyFrequency: number }) => {
      const response = await apiRequest("PUT", `/api/class-subject-assignments/${editingSubject?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2"] });
      setIsEditSubjectDialogOpen(false);
      setEditingSubject(null);
      editSubjectForm.reset();
      toast({
        title: "Success",
        description: "Subject periods updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subject periods",
        variant: "destructive",
      });
    },
  });

  const removeTeacherMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("DELETE", `/api/classes/${classId}/unassign-teacher/${assignmentId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2", classId] });
      toast({
        title: "Success",
        description: "Teacher assignment removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove teacher assignment",
        variant: "destructive",
      });
    },
  });

  const removeSubjectMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("DELETE", `/api/class-subject-assignments/${assignmentId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2", classId] });
      toast({
        title: "Success",
        description: "Subject assignment removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove subject assignment",
        variant: "destructive",
      });
    },
  });

  const generateTimetableMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/timetable/generate", {
        classId: classId
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        // Invalidate all timetable-related queries and force refetch
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey[0] === "/api/timetable/detailed" || 
                   queryKey[0] === "/api/timetable";
          }
        });
        
        // Force refetch of the current timetable data
        queryClient.refetchQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey[0] === "/api/timetable/detailed";
          }
        });
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate timetable",
        variant: "destructive",
      });
    },
  });

  const copySubjectsMutation = useMutation({
    mutationFn: async (targetClassIds: string[]) => {
      const response = await apiRequest("POST", `/api/classes/${classId}/copy-subjects`, {
        targetClassIds
      });
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result.message,
      });
      setIsCopySubjectsDialogOpen(false);
      setSelectedSections([]);
      setCopyValidationErrors([]);
      // Invalidate class-subject-assignments for all affected classes
      queryClient.invalidateQueries({ queryKey: ["/api/class-subject-assignments-v2"] });
    },
    onError: (error: any) => {
      // Error object from apiRequest now includes { message, errors } from backend
      if (error.errors && Array.isArray(error.errors)) {
        setCopyValidationErrors(error.errors);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to copy subjects",
          variant: "destructive",
        });
      }
    },
  });

  // Edit Room Mutation
  const editRoomMutation = useMutation({
    mutationFn: async (room: string) => {
      const response = await apiRequest("PUT", `/api/classes/${classId}`, { room });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", classId] });
      setIsEditingRoom(false);
      toast({
        title: "Success", 
        description: "Room updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update room",
        variant: "destructive",
      });
      setIsEditingRoom(false);
    },
  });

  // Class Teacher Mutations
  const assignClassTeacherMutation = useMutation({
    mutationFn: async (data: { teacherId: string; role: "primary" | "co_class"; privileges: any }) => {
      const response = await apiRequest("POST", `/api/classes/${classId}/teachers`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", classId, "teachers"] });
      setIsClassTeacherAssignDialogOpen(false);
      classTeacherForm.reset();
      toast({
        title: "Success",
        description: "Class teacher assigned successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign class teacher",
        variant: "destructive",
      });
    },
  });

  const updateClassTeacherPrivilegesMutation = useMutation({
    mutationFn: async (data: { assignmentId: string; privileges: any }) => {
      const response = await apiRequest("PUT", `/api/classes/${classId}/teachers/${data.assignmentId}`, {
        privileges: data.privileges
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", classId, "teachers"] });
      setIsEditPrivilegesDialogOpen(false);
      setEditingClassTeacher(null);
      editPrivilegesForm.reset();
      toast({
        title: "Success",
        description: "Privileges updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update privileges",
        variant: "destructive",
      });
    },
  });

  const removeClassTeacherMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("DELETE", `/api/classes/${classId}/teachers/${assignmentId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", classId, "teachers"] });
      setIsClassTeacherDeleteDialogOpen(false);
      setClassTeacherToDelete(null);
      toast({
        title: "Success",
        description: "Class teacher assignment removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove class teacher assignment",
        variant: "destructive",
      });
    },
  });

  // Fetch available sections when copy dialog opens
  useEffect(() => {
    if (isCopySubjectsDialogOpen && classData) {
      fetchAvailableSections();
    }
  }, [isCopySubjectsDialogOpen, classData]);

  const fetchAvailableSections = async () => {
    try {
      const response = await apiRequest("GET", `/api/classes/${classId}/other-sections`);
      const sections = await response.json();
      setAvailableSections(sections);
    } catch (error) {
      console.error("Error fetching available sections:", error);
      toast({
        title: "Error",
        description: "Failed to fetch available sections.",
        variant: "destructive",
      });
    }
  };

  // Load more students function
  const loadMoreStudents = async () => {
    if (isLoadingMoreStudents || !hasMoreStudents || !classId) return;

    setIsLoadingMoreStudents(true);
    try {
      const response = await apiRequest("GET", `/api/students?classId=${classId}&offset=${studentsOffset}&limit=${STUDENTS_PER_PAGE}`);
      const data = await response.json() as { students: Student[], totalCount: number };
      const newStudents = data.students || [];
      
      setStudents(prev => [...prev, ...newStudents]);
      setStudentsOffset(prev => prev + STUDENTS_PER_PAGE);
      setHasMoreStudents(newStudents.length === STUDENTS_PER_PAGE);
    } catch (error) {
      console.error("Error loading more students:", error);
      toast({
        title: "Error",
        description: "Failed to load more students.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMoreStudents(false);
    }
  };

  // Handle scroll to load more students
  const handleStudentsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMoreStudents && !isLoadingMoreStudents) {
      loadMoreStudents();
    }
  };

  // Navigation handlers for overview cards
  const handleStudentsCardClick = () => {
    setActiveTab("config");
    setPendingScrollRef(studentsRef);
  };

  const handleTeachersCardClick = () => {
    setActiveTab("config");
    setPendingScrollRef(teachersRef);
  };

  const handleSubjectsCardClick = () => {
    setActiveTab("config");
    setPendingScrollRef(subjectsRef);
  };

  // Class Teacher Handlers
  const handleAssignClassTeacher = (data: any) => {
    assignClassTeacherMutation.mutate(data);
  };

  const handleDeleteClassTeacherClick = (assignment: ClassTeacherAssignment) => {
    setClassTeacherToDelete(assignment);
    setIsClassTeacherDeleteDialogOpen(true);
  };

  const handleConfirmDeleteClassTeacher = () => {
    if (classTeacherToDelete) {
      removeClassTeacherMutation.mutate(classTeacherToDelete.id);
    }
  };

  const handleEditPrivilegesClick = (assignment: ClassTeacherAssignment) => {
    setEditingClassTeacher(assignment);
    editPrivilegesForm.reset({
      privileges: assignment.privileges,
    });
    setIsEditPrivilegesDialogOpen(true);
  };

  const handleUpdatePrivileges = (data: any) => {
    if (editingClassTeacher) {
      updateClassTeacherPrivilegesMutation.mutate({
        assignmentId: editingClassTeacher.id,
        privileges: data.privileges,
      });
    }
  };


  if (classError) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading class: {(classError as Error).message}</p>
            <Link href="/classes">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Invalid class ID</p>
            <Link href="/classes">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get teachers specifically assigned to this class through subject assignments
  const classTeachers = teachers.filter(teacher => 
    classSubjectAssignments.some(assignment => 
      (assignment.assignedTeacher?.id ?? assignment.assignedTeacherId) === teacher.id
    )
  );

  const uniqueSubjects = Array.from(new Set(timetableData.map(entry => entry.subject?.name).filter(Boolean)));

  // Get assigned subjects from class subject assignments
  const assignedSubjects = classSubjectAssignments;

  // Use timetable structure data or defaults
  const workingDays = (timetableStructure as any)?.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const timeSlots = (timetableStructure as any)?.timeSlots || [
    { period: 1, startTime: "08:00", endTime: "08:45" },
    { period: 2, startTime: "08:45", endTime: "09:30" },
    { period: 3, startTime: "09:30", endTime: "10:15" },
    { period: 4, startTime: "10:15", endTime: "11:00" },
    { period: 5, startTime: "11:15", endTime: "12:00" },
    { period: 6, startTime: "12:00", endTime: "12:45" },
    { period: 7, startTime: "12:45", endTime: "13:30" },
    { period: 8, startTime: "13:30", endTime: "14:15" },
  ];

  // Sort working days in proper order
  const sortWorkingDays = (days: string[]): string[] => {
    const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return dayOrder.filter(day => days.includes(day));
  };

  const sortedWorkingDays = sortWorkingDays(workingDays);

  const getTimetableEntry = (day: string, period: number) => {
    return timetableData.find(entry => 
      entry.day === day.toLowerCase() && entry.period === period
    );
  };

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!timeSlots) return actualPeriod;
    
    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  const getSubjectColor = (color: string) => {
    const colorMap: Record<string, string> = {
      '#3B82F6': 'bg-blue-50 border-blue-200 text-blue-900',
      '#10B981': 'bg-green-50 border-green-200 text-green-900',
      '#8B5CF6': 'bg-purple-50 border-purple-200 text-purple-900',
      '#F59E0B': 'bg-orange-50 border-orange-200 text-orange-900',
      '#EF4444': 'bg-red-50 border-red-200 text-red-900',
      '#06B6D4': 'bg-cyan-50 border-cyan-200 text-cyan-900',
      '#EC4899': 'bg-pink-50 border-pink-200 text-pink-900',
      '#84CC16': 'bg-lime-50 border-lime-200 text-lime-900',
    };
    return colorMap[color] || 'bg-gray-50 border-gray-200 text-gray-900';
  };

  // Get current week date range
  const getCurrentWeekRange = () => {
    const istDateStr = getCurrentDateIST();
    const now = new Date(istDateStr + 'T00:00:00+05:30');
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Calculate offset to get to Monday
    
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + mondayOffset);
    
    const saturday = new Date(monday);
    saturday.setUTCDate(monday.getUTCDate() + 5); // Saturday is 5 days after Monday
    
    return {
      start: monday,
      end: saturday
    };
  };

  const weekRange = getCurrentWeekRange();
  const formatDateRange = (start: Date, end: Date) => {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    };
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Export functions
  const exportToExcel = () => {
    if (!timetableData || timetableData.length === 0) {
      toast({
        title: "No Data",
        description: "No timetable data to export",
        variant: "destructive",
      });
      return;
    }

    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data in grid format
    const headers = ['Period', ...sortedWorkingDays.map(day => day.charAt(0).toUpperCase() + day.slice(1))];
    
    const data: any[][] = [
      ['WEEKLY TIMETABLE'],
      ['Class: ' + (classData ? getClassName(classData.grade, classData.section) : '')],
      ['Period: ' + formatDateRange(weekRange.start, weekRange.end)],
      [], // Empty row
      headers
    ];

    // Fill in the timetable data
    timeSlots.forEach((timeSlot: any) => {
      if (timeSlot.isBreak) {
        const row = [`Break (${formatTime12Hour(timeSlot.startTime)} - ${formatTime12Hour(timeSlot.endTime)})`, 
                     ...Array(sortedWorkingDays.length).fill('Break Time')];
        data.push(row);
      } else {
        const row = [`P${getTeachingPeriodNumber(timeSlot.period)} (${formatTime12Hour(timeSlot.startTime)} - ${formatTime12Hour(timeSlot.endTime)})`];
        
        sortedWorkingDays.forEach(day => {
          const entry = getTimetableEntry(day, timeSlot.period);
          if (entry) {
            row.push(`${entry.subject?.name || 'Unknown'} - ${entry.teacher?.name || 'Unknown'}`);
          } else {
            row.push('Free Period');
          }
        });
        
        data.push(row);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    const colWidths = [
      { wch: 20 }, // Period column
      ...sortedWorkingDays.map(() => ({ wch: 15 })) // Day columns
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    
    const fileName = `Timetable_${classData ? getClassName(classData.grade, classData.section) : 'Unknown'}_${formatDateRange(weekRange.start, weekRange.end).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Successful",
      description: "Timetable exported to Excel successfully",
    });
  };

  const exportToPNG = async () => {
    if (!timetableData || timetableData.length === 0) {
      toast({
        title: "No Data",
        description: "No timetable data to export",
        variant: "destructive",
      });
      return;
    }

    const timetableSection = document.getElementById('timetable-section');
    if (!timetableSection) {
      toast({
        title: "Export Error",
        description: "Could not find timetable to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const canvas = await html2canvas(timetableSection, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `Timetable_${classData ? getClassName(classData.grade, classData.section) : 'Unknown'}_${formatDateRange(weekRange.start, weekRange.end).replace(/[^a-zA-Z0-9-]/g, '_')}.png`;
      link.href = canvas.toDataURL();
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: "Timetable exported as PNG successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Error",
        description: "Failed to export timetable as PNG",
        variant: "destructive",
      });
    }
  };



  const handleAssignTeacher = (data: TeacherAssignmentFormData) => {
    setTeacherAssignError(null); // Clear any previous errors
    assignTeacherMutation.mutate(data);
  };

  const handleCreateAndAssignSubject = (data: CreateSubjectAssignmentFormData) => {
    createAndAssignSubjectMutation.mutate(data);
  };



  const handleEditSubject = (assignment: any) => {
    setEditingSubject(assignment);
    editSubjectForm.setValue("weeklyFrequency", assignment.weeklyFrequency);
    setIsEditSubjectDialogOpen(true);
  };

  const handleUpdateSubject = (data: { weeklyFrequency: number }) => {
    updateSubjectMutation.mutate(data);
  };

  const handleDeleteSubjectClick = (assignment: any) => {
    setSubjectToDelete(assignment);
    setIsDeleteSubjectDialogOpen(true);
  };

  const handleConfirmDeleteSubject = () => {
    if (subjectToDelete) {
      removeSubjectMutation.mutate(subjectToDelete.id);
      setIsDeleteSubjectDialogOpen(false);
      setSubjectToDelete(null);
    }
  };

  const handleDeleteTeacherClick = (assignment: any) => {
    setTeacherToDelete(assignment);
    setIsDeleteTeacherDialogOpen(true);
  };

  const handleConfirmDeleteTeacher = () => {
    if (teacherToDelete) {
      removeTeacherMutation.mutate(teacherToDelete.id);
      setIsDeleteTeacherDialogOpen(false);
      setTeacherToDelete(null);
    }
  };

  // Room Handlers
  const handleEditRoomClick = () => {
    setRoomEditValue(classData?.room || "");
    setIsEditingRoom(true);
    // Focus the input after state update
    setTimeout(() => roomInputRef.current?.focus(), 0);
  };

  const handleSaveRoom = () => {
    if (roomEditValue.trim() !== (classData?.room || "")) {
      editRoomMutation.mutate(roomEditValue.trim());
    } else {
      setIsEditingRoom(false);
    }
  };

  const handleCancelRoomEdit = () => {
    setIsEditingRoom(false);
    setRoomEditValue("");
  };

  const handleRoomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRoom();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRoomEdit();
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <Link href="/classes">
            <Button variant="outline" size="sm" data-testid="button-back-to-classes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex flex-col">
            {isClassLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <h1 className="text-lg md:text-xl font-semibold leading-tight" data-testid="class-name">
                Class {classData ? getClassName(classData.grade, classData.section) : ''}
              </h1>
            )}
            <p className="text-sm text-muted-foreground">
              Complete class overview with teachers and timetable
            </p>
          </div>
        </div>
      </div>

      {/* Class Overview Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8 relative z-10">
        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105 bg-gradient-to-br from-blue-50 to-white border-0 shadow-lg hover:shadow-xl"
          onClick={handleStudentsCardClick}
          data-testid="card-students-overview"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {isClassLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-gray-900" data-testid="student-count">{classData?.studentCount || 0}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Total enrolled</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105 bg-gradient-to-br from-green-50 to-white border-0 shadow-lg hover:shadow-xl"
          onClick={handleTeachersCardClick}
          data-testid="card-teachers-overview"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teachers</CardTitle>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {isTeachersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-gray-900" data-testid="teacher-count">{classTeachers.length}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Assigned teachers</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105 bg-gradient-to-br from-purple-50 to-white border-0 shadow-lg hover:shadow-xl"
          onClick={handleSubjectsCardClick}
          data-testid="card-subjects-overview"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subjects</CardTitle>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {isTimetableLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-gray-900" data-testid="subject-count">{uniqueSubjects.length}</div>
            )}
            <p className="text-xs text-gray-500 mt-1">Total subjects</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 relative z-20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Room</CardTitle>
            <div className="flex items-center space-x-2">
              {user?.role === 'admin' && !isEditingRoom && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-orange-100 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditRoomClick();
                  }}
                  title="Edit room number"
                  data-testid="button-edit-room"
                >
                  <Edit className="h-3 w-3 text-orange-600" />
                </Button>
              )}
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md">
                <MapPin className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {isClassLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : isEditingRoom ? (
              <div className="space-y-1">
                <Input
                  ref={roomInputRef}
                  value={roomEditValue}
                  onChange={(e) => setRoomEditValue(e.target.value)}
                  onKeyDown={handleRoomKeyDown}
                  onBlur={handleSaveRoom}
                  placeholder="e.g., A-101, Room 5"
                  className="h-8 text-sm bg-white border-orange-300 focus:border-orange-500"
                  disabled={editRoomMutation.isPending}
                  data-testid="input-room-inline"
                />
                <p className="text-xs text-gray-500">Press Enter to save, Esc to cancel</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900" data-testid="class-room">{classData?.room || "Not set"}</div>
                <p className="text-xs text-gray-500 mt-1">Class location</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Class Feed and Class Config */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="feed" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Class Feed</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Class Config</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="space-y-6">
          {/* Assigned Subjects */}
      <Card ref={subjectsRef} data-testid="section-subjects" className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Assigned Subjects</span>
              </CardTitle>
              {assignedSubjects.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-200 dark:border-blue-800 w-fit">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {currentTotalPeriods}/{weeklyPeriodCap}
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">periods assigned</span>
                </div>
              )}
            </div>
            <Dialog open={isSubjectAssignDialogOpen} onOpenChange={setIsSubjectAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-assign-subject">
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Subject
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isAssignmentsLoading ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          ) : assignedSubjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No subjects assigned</h3>
              <p className="text-muted-foreground">
                This class doesn't have any subjects assigned yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {assignedSubjects.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => handleEditSubject(assignment)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm px-2 py-1" data-testid={`assigned-subject-${assignment.id}`}>
                        <span style={{ color: assignment.subject?.color || "#3B82F6" }}>{assignment.subject?.name || "Unknown Subject"}</span>
                        <span className="ml-1 text-muted-foreground">({assignment.subject?.code || "N/A"})</span>
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {assignment.weeklyFrequency} periods/week
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSubjectClick(assignment);
                    }}
                    disabled={removeSubjectMutation.isPending}
                    data-testid={`button-remove-subject-${assignment.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {assignedSubjects.length > 0 && (
          <div className="px-6 pb-6">
            <Button 
              variant="outline" 
              onClick={() => setIsCopySubjectsDialogOpen(true)}
              className="w-full"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Copy Subjects to other sections
            </Button>
          </div>
        )}
      </Card>

      {/* Teachers Teaching This Class */}
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Teachers Teaching This Class</span>
            </CardTitle>
            <Dialog open={isTeacherAssignDialogOpen} onOpenChange={setIsTeacherAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={assignedSubjects.length === 0}
                  data-testid="button-assign-teacher"
                  title={assignedSubjects.length === 0 ? "Please assign subjects to this class first" : "Assign Teacher"}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Teacher
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isTeachersLoading ? (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </Card>
              ))}
            </div>
          ) : classTeachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No teachers assigned</h3>
              <p className="text-muted-foreground">
                This class doesn't have any teachers assigned yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {classTeachers.map((teacher) => {
                const teacherAssignments = classSubjectAssignments.filter(assignment => assignment.assignedTeacherId === teacher.id);
                
                return (
                  <Card 
                    key={teacher.id} 
                    className="group h-full flex flex-col border-blue-100 shadow-[0_1px_3px_rgba(59,130,246,0.12)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.2)] hover:border-blue-200 transition-all duration-200" 
                    data-testid={`class-teacher-card-${teacher.id}`}
                  >
                    {/* Header with branded accent */}
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-lg" />
                    
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all">
                          <AvatarImage 
                            src={teacher.profilePictureUrl} 
                            alt={`${teacher.name} profile`}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <button 
                            onClick={() => {
                              setSelectedProfileTeacher(teacher);
                              setIsTeacherProfileDialogOpen(true);
                            }}
                            className="font-semibold text-base text-left hover:text-blue-600 transition-colors cursor-pointer w-full line-clamp-2"
                            data-testid={`class-teacher-name-${teacher.id}`}
                            title="Click to view teacher profile"
                          >
                            {teacher.name}
                          </button>
                          {teacher.schoolIdNumber && (
                            <div className="flex items-center gap-1 mt-1">
                              <IdCard className="h-3.5 w-3.5 text-blue-400" />
                              <span className="text-xs text-muted-foreground font-medium" data-testid={`class-teacher-school-id-${teacher.id}`}>
                                {teacher.schoolIdNumber}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 pb-4 px-4 flex-1 flex flex-col">
                      {teacherAssignments.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Subjects</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {teacherAssignments.map((assignment) => (
                              <div 
                                key={assignment.id} 
                                className="group/badge relative inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 hover:border-blue-300 transition-all duration-150 px-3 py-1.5 text-xs font-medium" 
                                data-testid={`teacher-subject-${teacher.id}-${assignment.subjectId}`}
                              >
                                <span className="break-words leading-tight">{assignment.subject?.name}</span>
                                <span className="text-blue-500 font-semibold">({assignment.subject?.code})</span>
                                <button
                                  onClick={() => handleDeleteTeacherClick(assignment)}
                                  disabled={removeTeacherMutation.isPending}
                                  className="ml-0.5 hover:text-red-600 transition-colors opacity-60 hover:opacity-100"
                                  data-testid={`button-remove-subject-${teacher.id}-${assignment.subjectId}`}
                                  title="Remove this subject assignment"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Teachers */}
      <Card ref={teachersRef} data-testid="section-teachers">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5" />
              <span>Class Teachers</span>
            </CardTitle>
            <Dialog open={isClassTeacherAssignDialogOpen} onOpenChange={setIsClassTeacherAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-assign-class-teacher">
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Class Teacher
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isClassTeachersLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </Card>
              ))}
            </div>
          ) : classTeacherAssignments.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No class teachers assigned</h3>
              <p className="text-muted-foreground">
                This class doesn't have any class teachers assigned yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[...classTeacherAssignments]
                .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                .map((assignment) => (
                <Card 
                  key={assignment.id} 
                  className={`hover:shadow-md transition-shadow ${
                    assignment.isPrimary ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700/60' : ''
                  }`} 
                  data-testid={`class-teacher-assignment-${assignment.id}`}
                >
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          assignment.isPrimary ? 'bg-primary' : 'bg-secondary'
                        }`}>
                          <GraduationCap className={`h-4 w-4 ${
                            assignment.isPrimary ? 'text-primary-foreground' : 'text-secondary-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate" data-testid={`class-teacher-name-${assignment.id}`}>
                            {assignment.teacherName}
                          </h3>
                          <Badge 
                            variant={assignment.isPrimary ? "default" : "secondary"} 
                            className="text-xs mt-1"
                            data-testid={`class-teacher-role-${assignment.id}`}
                          >
                            {assignment.isPrimary ? "Primary Class Teacher" : "Co-Class Teacher"}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Settings className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditPrivilegesClick(assignment)}>
                            Edit Privileges
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClassTeacherClick(assignment)}
                            className="text-destructive"
                          >
                            Remove Teacher
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 pt-0 pb-3">

                    {/* Privileges */}
                    <div className="pt-2 border-t border-muted">
                      <p className="text-xs font-medium mb-1">Privileges:</p>
                      <div className="flex flex-wrap gap-1">
                        {assignment.privileges.attendance && (
                          <Badge variant="outline" className="text-xs">Attendance</Badge>
                        )}
                        {assignment.privileges.classFeedPosting && (
                          <Badge variant="outline" className="text-xs">Class Feed</Badge>
                        )}
                        {assignment.privileges.parentCommunication && (
                          <Badge variant="outline" className="text-xs">Parent Comm.</Badge>
                        )}
                        {assignment.privileges.leaveApproval && (
                          <Badge variant="outline" className="text-xs">Leave Approval</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students */}
      <Card ref={studentsRef} data-testid="section-students">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Students</span>
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {students.length} {students.length === 1 ? 'student' : 'students'} loaded
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isStudentsLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-4 w-28" />
                </Card>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No students found</h3>
              <p className="text-muted-foreground">
                This class doesn't have any students enrolled yet.
              </p>
            </div>
          ) : (
            <div 
              className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
              onScroll={handleStudentsScroll}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pr-2">
                {students.map((student) => (
                  <Card key={student.id} className="hover:shadow-md transition-shadow" data-testid={`student-card-${student.id}`}>
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate" data-testid={`student-name-${student.id}`}>
                            {student.firstName} {student.lastName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {student.rollNumber && (
                              <Badge variant="outline" className="text-xs">
                                Roll: {student.rollNumber}
                              </Badge>
                            )}
                            <Badge 
                              variant={student.status === 'active' ? 'default' : 'secondary'} 
                              className="text-xs"
                              data-testid={`student-status-${student.id}`}
                            >
                              {student.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 pt-0 pb-3">
                      {student.admissionNumber && (
                        <div className="flex items-center gap-1 text-xs">
                          <IdCard className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground" data-testid={`student-admission-${student.id}`}>
                            {student.admissionNumber}
                          </span>
                        </div>
                      )}

                      {student.email && (
                        <div className="flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate" data-testid={`student-email-${student.id}`}>
                            {student.email}
                          </span>
                        </div>
                      )}

                      {student.contactNumber && (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground" data-testid={`student-contact-${student.id}`}>
                            {student.contactNumber}
                          </span>
                        </div>
                      )}

                      {student.guardianName && (
                        <div className="text-xs text-muted-foreground pt-1 border-t border-muted">
                          <p className="font-medium">Guardian: {student.guardianName}</p>
                          {student.guardianContact && (
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {student.guardianContact}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Loading more indicator */}
              {isLoadingMoreStudents && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading more students...</span>
                  </div>
                </div>
              )}

              {/* End of list indicator */}
              {!hasMoreStudents && students.length > STUDENTS_PER_PAGE && (
                <div className="text-center py-3 text-xs text-muted-foreground border-t border-muted mt-3">
                  All students loaded
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher Assignment Dialog */}
      <Dialog open={isTeacherAssignDialogOpen} onOpenChange={(open) => {
        setIsTeacherAssignDialogOpen(open);
        if (!open) {
          setTeacherSearchText("");
          setSelectedTeacher(null);
          setShowTeacherSuggestions(false);
          teacherAssignForm.reset();
          setTeacherAssignError(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px] min-h-[390px]">
          <DialogHeader>
            <DialogTitle>Assign Teacher to Class</DialogTitle>
            <DialogDescription>
              {assignedSubjects.length === 0 
                ? "Please assign subjects to this class first before assigning teachers"
                : "Select a teacher from your school and choose which subject they will teach in this class"
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...teacherAssignForm}>
            <form onSubmit={teacherAssignForm.handleSubmit(handleAssignTeacher)} className="space-y-2">
              <FormField
                control={teacherAssignForm.control}
                name="teacherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teacher</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Search for a teacher..."
                          value={selectedTeacher ? selectedTeacher.name : teacherSearchText}
                          onChange={(e) => {
                            setTeacherSearchText(e.target.value);
                            setSelectedTeacher(null);
                            setShowTeacherSuggestions(true);
                            field.onChange("");
                          }}
                          onFocus={() => setShowTeacherSuggestions(true)}
                          data-testid="select-teacher"
                          className="w-full"
                        />
                        {showTeacherSuggestions && teacherSearchText && (
                          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                            {filteredTeachers.length === 0 ? (
                              <div className="p-3 text-center text-muted-foreground">
                                <p className="text-sm">No teachers found</p>
                                <p className="text-xs mt-1">Try a different search term</p>
                              </div>
                            ) : (
                              filteredTeachers.map((teacher) => (
                                <div
                                  key={teacher.id}
                                  className="py-1.5 px-2 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                                  onClick={() => {
                                    setSelectedTeacher(teacher);
                                    setTeacherSearchText(teacher.name);
                                    setShowTeacherSuggestions(false);
                                    field.onChange(teacher.id);
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium truncate">{teacher.name}</span>
                                    {teacher.schoolIdNumber && (
                                      <span className="text-xs text-muted-foreground flex-shrink-0">{teacher.schoolIdNumber}</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {teachers.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            No teachers available. Please add teachers to your school first.
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={teacherAssignForm.control}
                name="subjectId"
                render={({ field }) => {
                  const unassignedSubjects = assignedSubjects.filter(assignment => !assignment.assignedTeacherId);
                  const allSubjectsAssigned = assignedSubjects.length > 0 && unassignedSubjects.length === 0;
                  
                  return (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} 
                        disabled={allSubjectsAssigned || assignedSubjects.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-subject">
                            <SelectValue placeholder="Choose which subject this teacher will teach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assignedSubjects.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              <p className="text-sm">No subjects assigned to this class</p>
                            </div>
                          ) : allSubjectsAssigned ? (
                            <div className="p-4 text-center text-muted-foreground">
                              <p className="text-sm font-medium">All subjects have been assigned</p>
                              <p className="text-xs mt-1">Every subject in this class already has a teacher</p>
                            </div>
                          ) : (
                            unassignedSubjects.map((assignment) => (
                              <SelectItem key={assignment.subjectId} value={assignment.subjectId}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{assignment.subject.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {assignment.weeklyFrequency} periods per week
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {allSubjectsAssigned && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 p-2 bg-amber-50 dark:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-700/60">
                          All subjects have been assigned for this class. You can update existing teacher assignments from the teacher cards above.
                        </div>
                      )}
                      {field.value && !allSubjectsAssigned && (
                        <div className="text-xs text-muted-foreground mt-2">
                          The selected teacher will be assigned to teach this subject in this class.
                        </div>
                      )}
                    </FormItem>
                  );
                }}
              />

              {teacherAssignError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-red-600 dark:text-red-500">Error</p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">{teacherAssignError}</p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={assignTeacherMutation.isPending || assignedSubjects.length === 0}
                  data-testid="button-submit-teacher-assignment"
                >
                  {assignTeacherMutation.isPending ? "Assigning..." : "Assign Teacher"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      {/* Create and Assign Subject Dialog */}
      <Dialog open={isSubjectAssignDialogOpen} onOpenChange={setIsSubjectAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create and Assign Subject</DialogTitle>
            <DialogDescription>
              Create a new subject and assign it to this class
            </DialogDescription>
          </DialogHeader>
          <Form {...createSubjectForm}>
            <form onSubmit={createSubjectForm.handleSubmit(handleCreateAndAssignSubject)} className="space-y-2">
              <FormField
                control={createSubjectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Enter subject name (e.g., Mathematics)"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            const value = e.target.value;
                            if (value.length > 0) {
                              const filtered = COMMON_SUBJECTS.filter(subject =>
                                subject.toLowerCase().includes(value.toLowerCase())
                              ).slice(0, 5); // Show max 5 suggestions
                              setFilteredSubjects(filtered);
                              setShowSubjectSuggestions(filtered.length > 0);
                            } else {
                              setShowSubjectSuggestions(false);
                              setFilteredSubjects([]);
                            }
                          }}
                          onFocus={() => {
                            const value = field.value;
                            if (value && value.length > 0) {
                              const filtered = COMMON_SUBJECTS.filter(subject =>
                                subject.toLowerCase().includes(value.toLowerCase())
                              ).slice(0, 5);
                              setFilteredSubjects(filtered);
                              setShowSubjectSuggestions(filtered.length > 0);
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow click on suggestion
                            setTimeout(() => setShowSubjectSuggestions(false), 200);
                          }}
                          autoComplete="off"
                        />
                        {showSubjectSuggestions && filteredSubjects.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {filteredSubjects.map((subject, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                                onClick={() => {
                                  field.onChange(subject);
                                  setShowSubjectSuggestions(false);
                                  setFilteredSubjects([]);
                                }}
                              >
                                {subject}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createSubjectForm.control}
                name="weeklyFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periods in a week</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        placeholder="Number of periods per week"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-weekly-frequency"
                        className={createWouldExceed ? "border-destructive" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="text-xs mt-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Currently assigned: {currentTotalPeriods} periods</span>
                        <span>Weekly limit: {weeklyPeriodCap} periods</span>
                      </div>
                      {createWouldExceed ? (
                        <div className="text-destructive mt-1 font-medium">
                          ⚠️ Would exceed limit by {watchedCreateFrequency - availablePeriods} periods. Only {availablePeriods} periods available.
                        </div>
                      ) : availablePeriods <= 10 ? (
                        <div className="text-amber-600 mt-1">
                          ⚠️ Only {availablePeriods} periods remaining
                        </div>
                      ) : (
                        <div className="text-green-600 mt-1">
                          ✓ {availablePeriods} periods available
                        </div>
                      )}
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createAndAssignSubjectMutation.isPending || createWouldExceed}
                  data-testid="button-submit-subject-assignment"
                >
                  {createAndAssignSubjectMutation.isPending ? "Creating..." : createWouldExceed ? "Exceeds Period Limit" : "Create & Assign Subject"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditSubjectDialogOpen} onOpenChange={setIsEditSubjectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subject Periods</DialogTitle>
            <DialogDescription className="text-sm">
              Modify the weekly frequency for {editingSubject?.subject?.name} ({editingSubject?.subject?.code})
            </DialogDescription>
          </DialogHeader>
          <Form {...editSubjectForm}>
            <form onSubmit={editSubjectForm.handleSubmit(handleUpdateSubject)} className="space-y-4">
              <FormField
                control={editSubjectForm.control}
                name="weeklyFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weekly Frequency (Periods per week)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        placeholder="Enter periods"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-edit-weekly-frequency"
                        className={editWouldExceed ? "border-destructive" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                    {editingSubject && (
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Current: {editingSubject.weeklyFrequency} → New: {watchedEditFrequency}</span>
                          <span>Available: {availablePeriods} periods</span>
                        </div>
                        {editWouldExceed ? (
                          <div className="text-destructive font-medium">
                            ⚠️ Would exceed limit by {(watchedEditFrequency - editingSubject.weeklyFrequency) - availablePeriods} periods
                          </div>
                        ) : (
                          <div className="text-green-600">
                            ✓ Within limit ({weeklyPeriodCap} total periods)
                          </div>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditSubjectDialogOpen(false);
                    setEditingSubject(null);
                    editSubjectForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateSubjectMutation.isPending || editWouldExceed}
                  data-testid="button-update-subject"
                >
                  {updateSubjectMutation.isPending ? "Updating..." : editWouldExceed ? "Exceeds Period Limit" : "Update Periods"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirmation Dialog */}
      <AlertDialog open={isDeleteSubjectDialogOpen} onOpenChange={setIsDeleteSubjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Subject Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {subjectToDelete?.subject?.name} ({subjectToDelete?.subject?.code}) from this class? 
              This action cannot be undone and will remove all related timetable entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setIsDeleteSubjectDialogOpen(false);
                setSubjectToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSubject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeSubjectMutation.isPending}
              data-testid="button-confirm-delete-subject"
            >
              {removeSubjectMutation.isPending ? "Removing..." : "Remove Subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Teacher Assignment Confirmation Dialog */}
      <AlertDialog open={isDeleteTeacherDialogOpen} onOpenChange={setIsDeleteTeacherDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Teacher Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {teacherToDelete?.teacher?.name} from teaching {teacherToDelete?.subject?.name} ({teacherToDelete?.subject?.code}) for this class? 
              This action cannot be undone and will remove all related timetable entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setIsDeleteTeacherDialogOpen(false);
                setTeacherToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteTeacher}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeTeacherMutation.isPending}
              data-testid="button-confirm-delete-teacher"
            >
              {removeTeacherMutation.isPending ? "Removing..." : "Remove Teacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy Subjects Dialog */}
      <Dialog open={isCopySubjectsDialogOpen} onOpenChange={(open) => {
        setIsCopySubjectsDialogOpen(open);
        if (!open) {
          setCopyValidationErrors([]);
          setSelectedSections([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Subjects to other sections</DialogTitle>
            <DialogDescription>
              Select the sections you want to copy all assigned subjects to. This will copy {assignedSubjects.length} subjects to the selected sections.
            </DialogDescription>
          </DialogHeader>
          
          {/* Validation Errors */}
          {copyValidationErrors.length > 0 && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg" role="alert" aria-live="assertive">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <h4 className="font-semibold text-destructive mb-2">
                    Cannot copy subjects - Period limit exceeded
                  </h4>
                  <div className="space-y-1">
                    {copyValidationErrors.map((error, index) => (
                      <p key={index} className="text-sm text-destructive">
                        <strong>Class {error.className}:</strong> {error.error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="grid gap-3 max-h-60 overflow-y-auto">
              {availableSections.map((section) => {
                const hasError = copyValidationErrors.some(e => e.classId === section.id);
                return (
                  <div key={section.id} className={cn(
                    "flex items-center space-x-2 p-2 rounded",
                    hasError && "bg-destructive/5 border border-destructive/20"
                  )}>
                    <Checkbox
                      id={section.id}
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSections([...selectedSections, section.id]);
                        } else {
                          setSelectedSections(selectedSections.filter(id => id !== section.id));
                        }
                        setCopyValidationErrors([]); // Clear errors when selection changes
                      }}
                    />
                    <label
                      htmlFor={section.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      <div className="flex items-center gap-2">
                        <span>Class {section.grade} {section.section}</span>
                        <span className="text-muted-foreground">({section.studentCount} students)</span>
                        {hasError && <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />}
                      </div>
                    </label>
                  </div>
                );
              })}
              {availableSections.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No other sections available for this grade.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCopySubjectsDialogOpen(false);
                setSelectedSections([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedSections.length === 0 || copySubjectsMutation.isPending}
              onClick={() => {
                copySubjectsMutation.mutate(selectedSections);
              }}
            >
              {copySubjectsMutation.isPending 
                ? "Copying..." 
                : `Copy to ${selectedSections.length} section${selectedSections.length !== 1 ? 's' : ''}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Teacher Assignment Dialog */}
      <Dialog open={isClassTeacherAssignDialogOpen} onOpenChange={setIsClassTeacherAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Class Teacher</DialogTitle>
            <DialogDescription>
              Select a teacher and configure their role and privileges for this class.
            </DialogDescription>
          </DialogHeader>
          <Form {...classTeacherForm}>
            <form onSubmit={classTeacherForm.handleSubmit(handleAssignClassTeacher)} className="space-y-2">
              <FormField
                control={classTeacherForm.control}
                name="teacherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teacher</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-class-teacher">
                          <SelectValue placeholder="Select a teacher" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teachers
                          .filter(teacher => {
                            // Only show teachers who are teaching this class (check assignedTeacherId)
                            const isTeachingThisClass = classSubjectAssignments.some(
                              assignment => assignment.assignedTeacherId === teacher.id
                            );
                            // And exclude teachers already assigned as class teachers
                            const isAlreadyClassTeacher = classTeacherAssignments.some(
                              assignment => assignment.teacherId === teacher.id
                            );
                            return isTeachingThisClass && !isAlreadyClassTeacher;
                          })
                          .map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name} ({teacher.schoolIdNumber || 'No ID'})
                          </SelectItem>
                        ))}
                        {teachers.filter(teacher => {
                          const isTeachingThisClass = classSubjectAssignments.some(
                            assignment => assignment.assignedTeacherId === teacher.id
                          );
                          const isAlreadyClassTeacher = classTeacherAssignments.some(
                            assignment => assignment.teacherId === teacher.id
                          );
                          return isTeachingThisClass && !isAlreadyClassTeacher;
                        }).length === 0 && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No teachers teaching this class yet. Please assign teachers to subjects first.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={classTeacherForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isClassTeachersLoading}>
                      <FormControl>
                        <SelectTrigger data-testid="select-class-teacher-role">
                          <SelectValue placeholder={isClassTeachersLoading ? "Loading..." : "Select role"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!classTeacherAssignments.some(assignment => assignment.isPrimary && assignment.isActive) && (
                          <SelectItem value="primary">Primary Class Teacher</SelectItem>
                        )}
                        <SelectItem value="co_class">Co-Class Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                    {classTeacherAssignments.some(assignment => assignment.isPrimary && assignment.isActive) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Primary teacher already assigned to this class
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>Privileges</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={classTeacherForm.control}
                    name="privileges.attendance"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-privilege-attendance"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Attendance Management
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classTeacherForm.control}
                    name="privileges.classFeedPosting"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-privilege-class-feed"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Class Feed Posting
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classTeacherForm.control}
                    name="privileges.parentCommunication"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-privilege-parent-comm"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Parent Communication
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classTeacherForm.control}
                    name="privileges.leaveApproval"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-privilege-leave-approval"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Leave Approval
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsClassTeacherAssignDialogOpen(false);
                    classTeacherForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={assignClassTeacherMutation.isPending}
                  data-testid="button-submit-class-teacher"
                >
                  {assignClassTeacherMutation.isPending ? "Assigning..." : "Assign Class Teacher"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Privileges Dialog */}
      <Dialog open={isEditPrivilegesDialogOpen} onOpenChange={setIsEditPrivilegesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Privileges</DialogTitle>
            <DialogDescription>
              Configure privileges for {editingClassTeacher?.teacherName}
            </DialogDescription>
          </DialogHeader>
          <Form {...editPrivilegesForm}>
            <form onSubmit={editPrivilegesForm.handleSubmit(handleUpdatePrivileges)} className="space-y-2">
              <div className="space-y-3">
                <FormLabel>Privileges</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editPrivilegesForm.control}
                    name="privileges.attendance"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-edit-privilege-attendance"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Attendance Management
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editPrivilegesForm.control}
                    name="privileges.classFeedPosting"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-edit-privilege-class-feed"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Class Feed Posting
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editPrivilegesForm.control}
                    name="privileges.parentCommunication"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-edit-privilege-parent-comm"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Parent Communication
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editPrivilegesForm.control}
                    name="privileges.leaveApproval"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-edit-privilege-leave-approval"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Leave Approval
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditPrivilegesDialogOpen(false);
                    setEditingClassTeacher(null);
                    editPrivilegesForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateClassTeacherPrivilegesMutation.isPending}
                  data-testid="button-update-privileges"
                >
                  {updateClassTeacherPrivilegesMutation.isPending ? "Updating..." : "Update Privileges"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      {/* Delete Class Teacher Confirmation Dialog */}
      <AlertDialog open={isClassTeacherDeleteDialogOpen} onOpenChange={setIsClassTeacherDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Class Teacher Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {classTeacherToDelete?.teacherName} as a class teacher for this class? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setIsClassTeacherDeleteDialogOpen(false);
                setClassTeacherToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteClassTeacher}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeClassTeacherMutation.isPending}
              data-testid="button-confirm-delete-class-teacher"
            >
              {removeClassTeacherMutation.isPending ? "Removing..." : "Remove Teacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Teacher Mini-Profile Dialog */}
      <Dialog open={isTeacherProfileDialogOpen} onOpenChange={setIsTeacherProfileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage 
                  src={selectedProfileTeacher?.profilePictureUrl} 
                  alt={`${selectedProfileTeacher?.name} profile`}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{selectedProfileTeacher?.name}</h2>
                {selectedProfileTeacher?.designation && (
                  <p className="text-sm text-muted-foreground">{selectedProfileTeacher.designation}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedProfileTeacher && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* School/Employee ID */}
                {(selectedProfileTeacher.schoolIdNumber || selectedProfileTeacher.employeeId) && (
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">School/Employee ID</span>
                      <span className="text-sm">{selectedProfileTeacher.schoolIdNumber || selectedProfileTeacher.employeeId}</span>
                    </div>
                  </div>
                )}

                {/* Date of Birth */}
                {selectedProfileTeacher.dateOfBirth && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Date of Birth</span>
                      <span className="text-sm">{format(new Date(selectedProfileTeacher.dateOfBirth), 'PPP')}</span>
                    </div>
                  </div>
                )}

                {/* Father/Husband Name */}
                {selectedProfileTeacher.fatherHusbandName && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Father/Husband Name</span>
                      <span className="text-sm">{selectedProfileTeacher.fatherHusbandName}</span>
                    </div>
                  </div>
                )}

                {/* Contact Number */}
                {selectedProfileTeacher.contactNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Contact Number</span>
                      <span className="text-sm">{selectedProfileTeacher.contactNumber}</span>
                    </div>
                  </div>
                )}

                {/* Email */}
                {selectedProfileTeacher.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Email</span>
                      <span className="text-sm">{selectedProfileTeacher.email}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsTeacherProfileDialogOpen(false);
                setSelectedProfileTeacher(null);
              }}
              data-testid="button-close-teacher-profile"
            >
              Close
            </Button>
            {(user?.role === 'admin' || user?.role === 'super_admin') && selectedProfileTeacher && (
              <Button 
                onClick={() => {
                  setLocation(`/teacher/${selectedProfileTeacher.id}`);
                  setIsTeacherProfileDialogOpen(false);
                  setSelectedProfileTeacher(null);
                }}
                data-testid="button-view-teacher-profile"
              >
                <User className="h-4 w-4 mr-2" />
                View Full Profile
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>
        
        <TabsContent value="feed" className="space-y-6">
          {/* Class Feed */}
          <Newsfeed 
            feedScope="class"
            classId={classId}
            showPostForm={user?.role === 'admin' || user?.role === 'teacher'}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
}