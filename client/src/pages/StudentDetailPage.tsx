import React, { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { sortClasses } from "@shared/classUtils";
import { insertParentSchema, insertStudentSchema, type InsertParent, type InsertStudent, type Student, type Parent, type StudentParent } from "@shared/schema";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths } from "date-fns";
import { 
  ArrowLeft, 
  UserPlus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Users, 
  GraduationCap, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Key,
  Copy,
  Edit,
  RefreshCw,
  Lock,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  BookOpen,
  BarChart3,
  IdCard,
  GripVertical,
  RotateCcw
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStudentProfileLayout } from "@/hooks/useStudentProfileLayout";

// Memoized Card Components
const PersonalInformationCard = React.memo<{
  student: Student;
  classes: Array<{ id: string; grade: string; section: string }>;
  handleEditStudent: () => void;
}>(({ student, classes, handleEditStudent }) => {
  const getStudentClass = () => {
    if (!student?.classId) return "Not Assigned";
    const studentClass = classes.find(c => c.id === student.classId);
    return studentClass ? `${studentClass.grade} ${studentClass.section}` : "Not Assigned";
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-gray-800 dark:text-gray-200">Personal Information</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditStudent}
            data-testid="button-edit-student"
            className="h-8"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-6">
        <div className="flex items-start space-x-3">
          <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Admission Number</p>
            <p className="text-sm text-muted-foreground font-mono" data-testid="text-admission-number">{student.admissionNumber}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Users className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Class</p>
            <p className="text-sm text-muted-foreground" data-testid="text-class">{getStudentClass()}</p>
          </div>
        </div>

        {student?.classId && (
          <div className="flex items-start space-x-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Roll Number</p>
              <p className="text-sm text-muted-foreground" data-testid="text-roll-number">{student.rollNumber || "Not Assigned"}</p>
            </div>
          </div>
        )}

        {student.gender && (
          <div className="flex items-start space-x-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Gender</p>
              <p className="text-sm text-muted-foreground capitalize" data-testid="text-gender">{student.gender}</p>
            </div>
          </div>
        )}

        {student.dateOfBirth && (
          <div className="flex items-start space-x-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Date of Birth</p>
              <p className="text-sm text-muted-foreground" data-testid="text-dob">
                {format(new Date(student.dateOfBirth), 'dd-MM-yyyy')}
              </p>
            </div>
          </div>
        )}

        {student.contactNumber && (
          <div className="flex items-start space-x-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Contact Number</p>
              <p className="text-sm text-muted-foreground" data-testid="text-contact">{student.contactNumber}</p>
            </div>
          </div>
        )}

        {student.email && (
          <div className="flex items-start space-x-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground break-words" data-testid="text-email">{student.email}</p>
            </div>
          </div>
        )}

        {student.address && (
          <div className="flex items-start space-x-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Address</p>
              <p className="text-sm text-muted-foreground break-words" data-testid="text-address">{student.address}</p>
            </div>
          </div>
        )}

        {student.bloodGroup && (
          <div className="flex items-start space-x-3">
            <Activity className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Blood Group</p>
              <p className="text-sm text-muted-foreground" data-testid="text-blood-group">{student.bloodGroup}</p>
            </div>
          </div>
        )}

        {student.emergencyContact && (
          <div className="flex items-start space-x-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Emergency Contact</p>
              <p className="text-sm text-muted-foreground" data-testid="text-emergency-contact">{student.emergencyContact}</p>
            </div>
          </div>
        )}

        {student.medicalInfo && (
          <div className="flex items-start space-x-3">
            <Activity className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Medical Information</p>
              <p className="text-sm text-muted-foreground" data-testid="text-medical">{student.medicalInfo}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PersonalInformationCard.displayName = 'PersonalInformationCard';

const ParentsCard = React.memo<{
  studentParents: (StudentParent & { parent: Parent })[];
  isParentsLoading: boolean;
  handleAddParent: () => void;
  handleEditParent: (parent: Parent) => void;
  handleDeleteParent: (parentId: string) => void;
}>(({ studentParents, isParentsLoading, handleAddParent, handleEditParent, handleDeleteParent }) => {
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-gray-800 dark:text-gray-200">Parents & Guardians</span>
          </CardTitle>
          <Button onClick={handleAddParent} data-testid="button-add-parent" size="sm" className="h-8">
            <UserPlus className="h-3 w-3 mr-1" />
            Add Parent
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isParentsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : studentParents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No parents added yet</p>
            <p className="text-sm text-gray-400 mb-4">Add parents to enable parent portal access</p>
            <Button onClick={handleAddParent} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add First Parent
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1">
            {studentParents.map((sp) => (
              <Card key={sp.id} className="border-2 border-gray-100 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/50 dark:to-blue-900/50 flex items-center justify-center">
                        <User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                          {sp.parent.firstName} {sp.parent.lastName}
                        </h3>
                        <Badge variant="outline" className="mt-1 text-xs capitalize">
                          {sp.parent.relationToStudent}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditParent(sp.parent)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteParent(sp.parent.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {sp.parent.contactNumber && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Phone className="h-3 w-3" />
                        <span>{sp.parent.contactNumber}</span>
                      </div>
                    )}
                    {sp.parent.email && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Mail className="h-3 w-3" />
                        <span className="break-words">{sp.parent.email}</span>
                      </div>
                    )}
                    {sp.parent.occupation && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <GraduationCap className="h-3 w-3" />
                        <span>{sp.parent.occupation}</span>
                      </div>
                    )}
                    {sp.parent.address && (
                      <div className="flex items-start space-x-2 text-gray-600">
                        <MapPin className="h-3 w-3 mt-0.5" />
                        <span className="break-words">{sp.parent.address}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ParentsCard.displayName = 'ParentsCard';

const AttendanceHistoryCard = React.memo<{
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  generateCalendarDays: (date: Date) => Date[];
  getAttendanceForDate: (date: Date) => any;
  getStatusDisplayText: (status: string | undefined) => string;
  getDayStatusDisplay: (date: Date) => React.ReactNode;
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  totalRecords: number;
}>(({ selectedDate, setSelectedDate, generateCalendarDays, getAttendanceForDate, getStatusDisplayText, getDayStatusDisplay, presentDays, absentDays, excusedDays, totalRecords }) => {
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-800 dark:text-gray-200">Attendance History</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <h3 className="text-base font-semibold">
            {format(selectedDate, 'MMMM yyyy')}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {generateCalendarDays(selectedDate).map((date, idx) => {
            const attendanceRecord = getAttendanceForDate(date);
            const statusText = getStatusDisplayText(attendanceRecord?.status);
            
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div className="relative aspect-square">
                    {getDayStatusDisplay(date)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{format(date, 'PPP')}</p>
                  <p className="text-sm">{statusText}</p>
                  {attendanceRecord?.reason && (
                    <p className="text-xs text-gray-400 mt-1">Reason: {attendanceRecord.reason}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded"></div>
            </div>
            <div className="text-xs font-medium text-gray-600">Present</div>
            <div className="text-sm font-bold text-green-600">{presentDays}</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded"></div>
            </div>
            <div className="text-xs font-medium text-gray-600">Absent</div>
            <div className="text-sm font-bold text-red-600">{absentDays}</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-700 rounded"></div>
            </div>
            <div className="text-xs font-medium text-gray-600">Excused</div>
            <div className="text-sm font-bold text-orange-600">{excusedDays}</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded"></div>
            </div>
            <div className="text-xs font-medium text-gray-600">Not Marked</div>
            <div className="text-sm font-bold text-gray-600">{totalRecords - presentDays - absentDays - excusedDays}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AttendanceHistoryCard.displayName = 'AttendanceHistoryCard';

// Section Registry
const SECTION_REGISTRY = [
  { id: 'personal-info', columnDefault: 'left', component: PersonalInformationCard },
  { id: 'parents-guardians', columnDefault: 'right', component: ParentsCard },
  { id: 'attendance-history', columnDefault: 'right', component: AttendanceHistoryCard }
];

interface SortableCardProps {
  id: string;
  children: React.ReactNode;
}

const SortableCard: React.FC<SortableCardProps> = ({ id, children }) => {
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
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group select-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            {...attributes}
            {...listeners}
            role="button"
            aria-label="Drag to reorder card"
            className="absolute top-4 left-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing bg-white dark:bg-gray-800 rounded-md p-2 shadow-md border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
          >
            <GripVertical className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Drag to reorder</p>
        </TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
};

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Dialog states
  const [isParentDialogOpen, setIsParentDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [isCredentialsVisible, setIsCredentialsVisible] = useState(false);
  const [isRefreshConfirmDialogOpen, setIsRefreshConfirmDialogOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  
  // Profile picture state
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  
  // Attendance calendar state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Drag-and-drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Layout management hook
  const studentId = id || "";
  const { layout, updateLayout, resetToDefault, isLoading: isLayoutLoading } = useStudentProfileLayout(studentId);

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

  // Form setup
  const formSchema = insertParentSchema.omit({ schoolId: true });
  const parentForm = useForm<Omit<InsertParent, 'schoolId'>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "", 
      email: "",
      contactNumber: "",
      alternateContact: "",
      address: "",
      occupation: "",
      relationToStudent: "father",
      isActive: true,
    },
  });

  const studentFormSchema = insertStudentSchema.omit({ schoolId: true });
  const studentForm = useForm<Omit<InsertStudent, 'schoolId'>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      admissionNumber: "",
      firstName: "",
      lastName: "",
      email: "",
      contactNumber: "",
      dateOfBirth: "",
      gender: "male",
      address: "",
      classId: "",
      rollNumber: "",
      bloodGroup: "",
      emergencyContact: "",
      status: "active",
    },
  });

  // Queries
  const { data: student, isLoading: isStudentLoading } = useQuery<Student>({
    queryKey: ["/api/students", id],
    enabled: !!id,
  });

  const { data: studentParents = [], isLoading: isParentsLoading } = useQuery<(StudentParent & { parent: Parent })[]>({
    queryKey: ["/api/students", id, "parents"],
    enabled: !!id,
  });

  const { data: studentCredentials, isLoading: isCredentialsLoading } = useQuery<{
    studentLogin: { loginId: string; temporaryPassword?: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null;
    parentLogin: { loginId: string; temporaryPassword?: string; hasTemporaryPassword: boolean; expiresAt: string | null; } | null;
  }>({
    queryKey: ["/api/students", id, "credentials"],
    enabled: !!id,
  });

  const { data: classes = [] } = useQuery<{ id: string; grade: string; section: string }[]>({
    queryKey: ["/api/classes"],
  });

  // Fetch student's attendance for selected month
  const { data: attendance = [] } = useQuery<any[]>({
    queryKey: ["/api/student-attendance", id, format(selectedDate, "yyyy-MM")],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
      const response = await apiRequest("GET", `/api/student-attendance?studentId=${id}&startDate=${startDate}&endDate=${endDate}`);
      return response.json();
    },
    enabled: !!id,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Calculate attendance statistics
  const presentDays = attendance.filter(a => a.status === "present").length;
  const absentDays = attendance.filter(a => a.status === "absent").length;
  const excusedDays = attendance.filter(a => a.status === "excused").length;
  const totalRecords = attendance.length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentDays / totalRecords) * 100) : 100;

  // Mutations
  const createParentMutation = useMutation({
    mutationFn: async (data: InsertParent & { studentId: string }) => {
      const response = await apiRequest("POST", "/api/parents", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "parents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "credentials"] });
      setIsParentDialogOpen(false);
      parentForm.reset();
      toast({ title: "Success", description: "Parent added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add parent", variant: "destructive" });
    },
  });

  const updateParentMutation = useMutation({
    mutationFn: async (data: InsertParent & { id: string }) => {
      const response = await apiRequest("PATCH", `/api/parents/${data.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "parents"] });
      setIsParentDialogOpen(false);
      setEditingParent(null);
      parentForm.reset();
      toast({ title: "Success", description: "Parent updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update parent", variant: "destructive" });
    },
  });

  const deleteParentMutation = useMutation({
    mutationFn: async (parentId: string) => {
      const response = await apiRequest("DELETE", `/api/parents/${parentId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "parents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "credentials"] });
      toast({ title: "Success", description: "Parent removed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove parent", variant: "destructive" });
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: InsertStudent & { id: string }) => {
      const response = await apiRequest("PATCH", `/api/students/${data.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id] });
      queryClient.refetchQueries({ queryKey: ["/api/students", id] });
      setIsStudentDialogOpen(false);
      studentForm.reset();
      clearImageState();
      toast({ title: "Success", description: "Student updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update student", variant: "destructive" });
    },
  });

  const refreshCredentialsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/students/${id}/credentials/refresh`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/students", id, "credentials"], {
        studentLogin: {
          loginId: data.studentLogin.loginId,
          temporaryPassword: data.studentLogin.temporaryPassword,
          hasTemporaryPassword: true,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        },
        parentLogin: {
          loginId: data.parentLogin.loginId,
          temporaryPassword: data.parentLogin.temporaryPassword,
          hasTemporaryPassword: true,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        }
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/students", id, "credentials"] });
      
      toast({ 
        title: "Success", 
        description: "Login credentials have been refreshed successfully. New passwords are now visible below." 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to refresh credentials", 
        variant: "destructive" 
      });
    },
  });

  // Handlers
  const handleAddParent = () => {
    setEditingParent(null);
    parentForm.reset();
    setIsParentDialogOpen(true);
  };

  const handleEditParent = (parent: Parent) => {
    setEditingParent(parent);
    parentForm.reset({
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email || "",
      contactNumber: parent.contactNumber,
      alternateContact: parent.alternateContact || "",
      address: parent.address || "",
      occupation: parent.occupation || "",
      relationToStudent: parent.relationToStudent,
      isActive: parent.isActive,
    });
    setIsParentDialogOpen(true);
  };

  const handleParentSubmit = (data: Omit<InsertParent, 'schoolId'>) => {
    if (!student) return;
    
    if (editingParent) {
      updateParentMutation.mutate({ ...data, id: editingParent.id, schoolId: student.schoolId } as any);
    } else {
      createParentMutation.mutate({ ...data, studentId: student.id, schoolId: student.schoolId });
    }
  };

  const handleDeleteParent = (parentId: string) => {
    if (confirm("Are you sure you want to remove this parent?")) {
      deleteParentMutation.mutate(parentId);
    }
  };

  const handleEditStudent = () => {
    if (!student) return;
    
    studentForm.reset({
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email || "",
      contactNumber: student.contactNumber || "",
      dateOfBirth: student.dateOfBirth || "",
      gender: student.gender || "male",
      address: student.address || "",
      classId: student.classId || "",
      rollNumber: student.rollNumber || "",
      bloodGroup: student.bloodGroup || "",
      emergencyContact: student.emergencyContact || "",
      status: student.status,
    });
    setIsStudentDialogOpen(true);
  };

  const handleStudentSubmit = async (data: Omit<InsertStudent, 'schoolId'>) => {
    if (!student) return;
    
    let profilePictureUrl: string | null | undefined = student.profilePictureUrl;
    
    if (selectedProfileImage) {
      try {
        const formData = new FormData();
        formData.append('profileImage', selectedProfileImage);
        
        const uploadResponse = await apiRequest("POST", `/api/students/${student.id}/profile-picture`, formData);
        const uploadResult = await uploadResponse.json();
        profilePictureUrl = uploadResult.profilePictureUrl;
      } catch (error) {
        toast({ 
          title: "Error", 
          description: "Failed to upload profile picture", 
          variant: "destructive" 
        });
        return;
      }
    }
    
    updateStudentMutation.mutate({ 
      ...data, 
      id: student.id, 
      schoolId: student.schoolId,
      profilePictureUrl: profilePictureUrl ?? undefined
    });
  };

  const handleProfileImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "Error", 
        description: "Image must be less than 5MB", 
        variant: "destructive" 
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

  const clearImageState = () => {
    setSelectedProfileImage(null);
    setProfileImagePreview(null);
  };

  const generateCalendarDays = (selectedMonth: Date) => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  };

  const attendanceMap = useMemo(() => {
    const map = new Map<string, any>();
    attendance.forEach(record => {
      const dateKey = format(new Date(record.attendanceDate), 'yyyy-MM-dd');
      map.set(dateKey, record);
    });
    return map;
  }, [attendance]);

  const getAttendanceForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return attendanceMap.get(dateKey);
  };

  const getStatusDisplayText = (status: string | undefined) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Late';
      case 'excused':
        return 'Excused';
      default:
        return 'Not Marked';
    }
  };

  const getDayStatusDisplay = (date: Date) => {
    const attendanceRecord = getAttendanceForDate(date);
    const isCurrentMonth = isSameMonth(date, selectedDate);
    const dayNumber = format(date, 'd');

    if (!isCurrentMonth) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm rounded">
          {dayNumber}
        </div>
      );
    }

    let statusColor = '';
    
    if (!attendanceRecord) {
      statusColor = 'bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-200';
    } else {
      switch (attendanceRecord.status) {
        case 'present':
          statusColor = 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-200 border border-green-200 dark:border-green-700';
          break;
        case 'absent':
          statusColor = 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-700';
          break;
        case 'excused':
          statusColor = 'bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700';
          break;
        case 'late':
          statusColor = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700';
          break;
        default:
          statusColor = 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700';
      }
    }

    return (
      <div className={`absolute inset-0 flex items-center justify-center text-sm font-medium rounded ${statusColor}`}>
        {dayNumber}
      </div>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  const handleRefreshCredentials = () => {
    setIsRefreshConfirmDialogOpen(true);
  };

  const confirmRefreshCredentials = () => {
    refreshCredentialsMutation.mutate();
    setIsRefreshConfirmDialogOpen(false);
  };

  const getStudentClass = () => {
    if (!student?.classId) return "Not Assigned";
    const studentClass = classes.find(c => c.id === student.classId);
    return studentClass ? `${studentClass.grade} ${studentClass.section}` : "Not Assigned";
  };

  // Drag-and-drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    if (active.id !== over.id) {
      const activeColumn = layout.leftColumn.includes(active.id as string) ? 'left' : 'right';
      const overColumn = layout.leftColumn.includes(over.id as string) ? 'left' : 'right';

      if (activeColumn === overColumn) {
        const column = activeColumn === 'left' ? layout.leftColumn : layout.rightColumn;
        const oldIndex = column.indexOf(active.id as string);
        const newIndex = column.indexOf(over.id as string);

        const newColumn = [...column];
        const [removed] = newColumn.splice(oldIndex, 1);
        newColumn.splice(newIndex, 0, removed);

        updateLayout({
          ...layout,
          [activeColumn === 'left' ? 'leftColumn' : 'rightColumn']: newColumn
        });
      } else {
        const sourceColumn = activeColumn === 'left' ? [...layout.leftColumn] : [...layout.rightColumn];
        const destColumn = overColumn === 'left' ? [...layout.leftColumn] : [...layout.rightColumn];

        const sourceIndex = sourceColumn.indexOf(active.id as string);
        const [removed] = sourceColumn.splice(sourceIndex, 1);

        const destIndex = destColumn.indexOf(over.id as string);
        destColumn.splice(destIndex, 0, removed);

        updateLayout({
          leftColumn: activeColumn === 'left' ? sourceColumn : destColumn,
          rightColumn: activeColumn === 'right' ? sourceColumn : destColumn
        });
      }
    }

    setActiveId(null);
    setOverId(null);
  };

  const handleResetLayout = () => {
    resetToDefault();
    setIsResetDialogOpen(false);
    toast({
      title: "Layout Reset",
      description: "Student profile layout has been reset to default",
    });
  };

  if (isStudentLoading) {
    return (
      <div className="p-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Student not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Modern Gradient Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-700 dark:to-blue-700 text-white rounded-lg shadow-lg p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/students")}
              className="h-11 w-11 p-0 hover:bg-white/20 text-white"
              aria-label="Back to Students"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center space-x-4">
              {/* Profile Picture */}
              <div className="relative">
                {student.profilePictureUrl ? (
                  <div 
                    className="relative cursor-pointer" 
                    onClick={() => setIsPhotoModalOpen(true)}
                    title="Click to view full image"
                  >
                    <img
                      src={student.profilePictureUrl}
                      alt={`${student.firstName} ${student.lastName}'s profile`}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg hover:border-blue-200 transition-colors"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallbackDiv) fallbackDiv.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center absolute top-0 left-0 shadow-lg"
                      style={{ display: 'none' }}
                    >
                      <User className="w-10 h-10 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-lg">
                    <User className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>
              
              {/* Student Name and Details */}
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-white mb-1">{student.firstName} {student.lastName}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <IdCard className="h-4 w-4" />
                    <span className="text-sm">Admission: {student.admissionNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Class: {getStudentClass()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={student.status === "active" ? "default" : "secondary"} 
              className={student.status === "active" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300" : ""}
            >
              {student.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-6">
        {/* Attendance Rate - Blue */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Attendance Rate</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-200">{attendancePercentage}%</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">this month</p>
              </div>
              <div className="bg-blue-200 dark:bg-blue-800 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-blue-700 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Present Days - Green */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Present Days</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-200">{presentDays}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">out of {totalRecords} days</p>
              </div>
              <div className="bg-emerald-200 dark:bg-emerald-800 p-3 rounded-full">
                <Calendar className="h-8 w-8 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Parents - Purple */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Active Parents</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-200">{studentParents.length}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">guardians registered</p>
              </div>
              <div className="bg-purple-200 dark:bg-purple-800 p-3 rounded-full">
                <Users className="h-8 w-8 text-purple-700 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Layout Button */}
      <div className="px-4 md:px-6 flex justify-end">
        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset to Default Layout
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Profile Layout?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset the student profile card layout to the default arrangement. Your custom layout preferences will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetLayout}>
                Reset Layout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Main Content - Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Responsive Grid: Single column on mobile/tablet, dual column on desktop */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 px-4 md:px-6">
          {/* Left Column */}
          <SortableContext
            items={layout.leftColumn}
            strategy={verticalListSortingStrategy}
          >
            <div 
              className={`space-y-2 rounded-lg p-3 transition-all duration-200 ${
                overId && layout.leftColumn.includes(overId) 
                  ? 'bg-indigo-50 ring-2 ring-indigo-400 ring-offset-2 animate-pulse' 
                  : ''
              }`}
            >
              {layout.leftColumn.length === 0 && activeId && (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm font-medium">Drop here</p>
                </div>
              )}
              {layout.leftColumn.map((sectionId) => {
                const section = SECTION_REGISTRY.find(s => s.id === sectionId);
                if (!section) return null;

                const Component = section.component;
                let props: any = {};

                if (sectionId === 'personal-info') {
                  props = { student, classes, handleEditStudent };
                } else if (sectionId === 'parents-guardians') {
                  props = { 
                    studentParents, 
                    isParentsLoading, 
                    handleAddParent, 
                    handleEditParent, 
                    handleDeleteParent 
                  };
                } else if (sectionId === 'attendance-history') {
                  props = { 
                    selectedDate, 
                    setSelectedDate, 
                    generateCalendarDays, 
                    getAttendanceForDate, 
                    getStatusDisplayText, 
                    getDayStatusDisplay, 
                    presentDays, 
                    absentDays, 
                    excusedDays, 
                    totalRecords 
                  };
                }

                return (
                  <SortableCard key={sectionId} id={sectionId}>
                    <Component {...props} />
                  </SortableCard>
                );
              })}
            </div>
          </SortableContext>

          {/* Right Column */}
          <SortableContext
            items={layout.rightColumn}
            strategy={verticalListSortingStrategy}
          >
            <div 
              className={`space-y-2 rounded-lg p-3 transition-all duration-200 ${
                overId && layout.rightColumn.includes(overId) 
                  ? 'bg-indigo-50 ring-2 ring-indigo-400 ring-offset-2 animate-pulse' 
                  : ''
              }`}
            >
              {layout.rightColumn.length === 0 && activeId && (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm font-medium">Drop here</p>
                </div>
              )}
              {layout.rightColumn.map((sectionId) => {
                const section = SECTION_REGISTRY.find(s => s.id === sectionId);
                if (!section) return null;

                const Component = section.component;
                let props: any = {};

                if (sectionId === 'personal-info') {
                  props = { student, classes, handleEditStudent };
                } else if (sectionId === 'parents-guardians') {
                  props = { 
                    studentParents, 
                    isParentsLoading, 
                    handleAddParent, 
                    handleEditParent, 
                    handleDeleteParent 
                  };
                } else if (sectionId === 'attendance-history') {
                  props = { 
                    selectedDate, 
                    setSelectedDate, 
                    generateCalendarDays, 
                    getAttendanceForDate, 
                    getStatusDisplayText, 
                    getDayStatusDisplay, 
                    presentDays, 
                    absentDays, 
                    excusedDays, 
                    totalRecords 
                  };
                }

                return (
                  <SortableCard key={sectionId} id={sectionId}>
                    <Component {...props} />
                  </SortableCard>
                );
              })}
            </div>
          </SortableContext>
        </div>

        {/* Mobile/Tablet View - Single Column, No Drag-and-Drop */}
        <div className="lg:hidden space-y-2 px-4 md:px-6">
          {[...layout.leftColumn, ...layout.rightColumn].map((sectionId) => {
            const section = SECTION_REGISTRY.find(s => s.id === sectionId);
            if (!section) return null;

            const Component = section.component;
            let props: any = {};

            if (sectionId === 'personal-info') {
              props = { student, classes, handleEditStudent };
            } else if (sectionId === 'login-credentials') {
              props = { 
                studentCredentials, 
                isCredentialsLoading, 
                isCredentialsVisible, 
                setIsCredentialsVisible, 
                handleRefreshCredentials, 
                refreshCredentialsMutation, 
                copyToClipboard 
              };
            } else if (sectionId === 'parents-guardians') {
              props = { 
                studentParents, 
                isParentsLoading, 
                handleAddParent, 
                handleEditParent, 
                handleDeleteParent 
              };
            } else if (sectionId === 'attendance-history') {
              props = { 
                selectedDate, 
                setSelectedDate, 
                generateCalendarDays, 
                getAttendanceForDate, 
                getStatusDisplayText, 
                getDayStatusDisplay, 
                presentDays, 
                absentDays, 
                excusedDays, 
                totalRecords 
              };
            }

            return <Component key={sectionId} {...props} />;
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (() => {
            const section = SECTION_REGISTRY.find(s => s.id === activeId);
            if (!section) return null;

            const Component = section.component;
            let props: any = {};

            if (activeId === 'personal-info') {
              props = { student, classes, handleEditStudent };
            } else if (activeId === 'parents-guardians') {
              props = { 
                studentParents, 
                isParentsLoading, 
                handleAddParent, 
                handleEditParent, 
                handleDeleteParent 
              };
            } else if (activeId === 'attendance-history') {
              props = { 
                selectedDate, 
                setSelectedDate, 
                generateCalendarDays, 
                getAttendanceForDate, 
                getStatusDisplayText, 
                getDayStatusDisplay, 
                presentDays, 
                absentDays, 
                excusedDays, 
                totalRecords 
              };
            }

            return <Component {...props} />;
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* Photo Modal */}
      {student.profilePictureUrl && (
        <ImageLightbox
          images={[student.profilePictureUrl]}
          isOpen={isPhotoModalOpen}
          currentIndex={photoIndex}
          onClose={() => {
            setIsPhotoModalOpen(false);
            setPhotoIndex(0);
          }}
          onIndexChange={setPhotoIndex}
        />
      )}

      {/* Parent Dialog */}
      <Dialog open={isParentDialogOpen} onOpenChange={setIsParentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingParent ? 'Edit Parent' : 'Add New Parent'}</DialogTitle>
            <DialogDescription>
              {editingParent ? 'Update parent information below' : 'Fill in the parent details below'}
            </DialogDescription>
          </DialogHeader>
          <Form {...parentForm}>
            <form onSubmit={parentForm.handleSubmit(handleParentSubmit)} className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={parentForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter first name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parentForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter last name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={parentForm.control}
                name="relationToStudent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relation to Student *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={parentForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="parent@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={parentForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parentForm.control}
                  name="alternateContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alternate Contact</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Alternative number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={parentForm.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupation</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter occupation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={parentForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter address" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsParentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createParentMutation.isPending || updateParentMutation.isPending}
                >
                  {createParentMutation.isPending || updateParentMutation.isPending ? 'Saving...' : 'Save Parent'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Student Edit Dialog */}
      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
            <DialogDescription>
              Update student details below
            </DialogDescription>
          </DialogHeader>
          <Form {...studentForm}>
            <form onSubmit={studentForm.handleSubmit(handleStudentSubmit)} className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={studentForm.control}
                name="admissionNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Number *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortClasses(classes).map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.grade} {cls.section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  control={studentForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={studentForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., A+, B-, O+" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Profile Picture</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProfileImageSelect(file);
                  }}
                />
                {(profileImagePreview || student.profilePictureUrl) && (
                  <div className="mt-2">
                    <img
                      src={profileImagePreview || student.profilePictureUrl}
                      alt="Preview"
                      className="w-32 h-32 rounded-lg object-cover border-2"
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsStudentDialogOpen(false);
                  clearImageState();
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStudentMutation.isPending}>
                  {updateStudentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Refresh Credentials Confirmation Dialog */}
      <AlertDialog open={isRefreshConfirmDialogOpen} onOpenChange={setIsRefreshConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh Login Credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate new temporary passwords for both student and parent portals. 
              The old passwords will no longer work. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRefreshCredentials}>
              Refresh Credentials
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
