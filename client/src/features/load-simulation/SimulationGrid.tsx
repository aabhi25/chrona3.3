import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, Users, BookOpen, GraduationCap, X, Move, Pencil, AlertTriangle, CheckCircle, Upload, MoreHorizontal, Sparkles, TrendingUp, AlertCircle, Zap, ArrowRight, Eye, Info, Download, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { sortClasses } from "@/../../shared/classUtils";
import { LoadSimulationBulkUpload } from "./LoadSimulationBulkUpload";
import * as XLSX from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  simulationId: string;
}

interface SimulationData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  classes: SimulationClass[];
  subjects: SimulationSubject[];
  teachers: SimulationTeacher[];
  classSubjects: SimulationClassSubject[];
  assignments: SimulationAssignment[];
  lastOptimizationAt: string | null;
  lastOptimizationSummary: {
    periodsOptimized: number;
    assignmentsCreated: number;
    redistributions: number;
    coverageBefore: number;
    coverageAfter: number;
  } | null;
}

interface SimulationClass {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SimulationSubject {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface SimulationTeacher {
  id: string;
  name: string;
  employeeId: string;
  maxPeriodsPerDay: number;
}

interface SimulationClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  weeklyPeriods: number;
}

interface SimulationAssignment {
  id: string;
  classSubjectId: string;
  teacherId: string | null;
}

// Teacher color gradients for visual consistency - classy light gradients matching transport page
const TEACHER_GRADIENTS = [
  { from: 'from-blue-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-blue-700', badge: 'bg-blue-50' },
  { from: 'from-purple-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-purple-700', badge: 'bg-purple-50' },
  { from: 'from-emerald-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-emerald-700', badge: 'bg-emerald-50' },
  { from: 'from-orange-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-orange-700', badge: 'bg-orange-50' },
  { from: 'from-pink-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-pink-700', badge: 'bg-pink-50' },
  { from: 'from-cyan-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-cyan-700', badge: 'bg-cyan-50' },
  { from: 'from-teal-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-teal-700', badge: 'bg-teal-50' },
  { from: 'from-indigo-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-indigo-700', badge: 'bg-indigo-50' },
  { from: 'from-rose-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-rose-700', badge: 'bg-rose-50' },
  { from: 'from-amber-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-amber-700', badge: 'bg-amber-50' },
  { from: 'from-lime-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-lime-700', badge: 'bg-lime-50' },
  { from: 'from-violet-50', to: 'to-white', bg: 'bg-gradient-to-br', text: 'text-violet-700', badge: 'bg-violet-50' },
];

// Get consistent color for a teacher based on their ID
function getTeacherColor(teacherId: string) {
  const hash = teacherId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TEACHER_GRADIENTS[hash % TEACHER_GRADIENTS.length];
}

const GRADE_OPTIONS = [
  "Playschool",
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

function TeacherCard({ teacher, assignedPeriods, onDelete, onEdit, workingDays }: { teacher: SimulationTeacher; assignedPeriods: number; onDelete: () => void; onEdit: () => void; workingDays: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `teacher-${teacher.id}`,
    data: { teacher },
  });

  const maxWeeklyPeriods = teacher.maxPeriodsPerDay * workingDays; // Calculate weekly from daily using configured working days
  const utilizationPercentage = (assignedPeriods / maxWeeklyPeriods) * 100;
  const teacherColor = getTeacherColor(teacher.id);

  return (
    <div
      ref={setNodeRef}
      className={`group relative p-2.5 border-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging ? "opacity-50" : "opacity-100"
      } ${teacherColor.bg} ${teacherColor.from} ${teacherColor.to} hover:shadow-lg shadow-md border-white/40 hover:border-white/60 ring-1 ring-black/5`}
    >
      <div {...listeners} {...attributes}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm break-words leading-tight ${teacherColor.text}`}>{teacher.name}</p>
            <p className={`text-xs font-semibold ${teacherColor.text} opacity-80 mt-0.5`}>{teacher.employeeId}</p>
          </div>
          <Users className={`h-4 w-4 flex-shrink-0 ${teacherColor.text} opacity-70`} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-white/30 rounded-full h-2 ring-1 ring-black/10 shadow-inner overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                utilizationPercentage >= 100 
                  ? "bg-gradient-to-r from-red-500 to-red-600" 
                  : utilizationPercentage >= 80 
                  ? "bg-gradient-to-r from-orange-500 to-orange-600" 
                  : "bg-gradient-to-r from-emerald-500 to-teal-600"
              }`}
              style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
            />
          </div>
          <span className={`text-xs font-black whitespace-nowrap ${teacherColor.text}`}>
            {assignedPeriods}/{maxWeeklyPeriods}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="absolute -top-2 -right-11 opacity-0 group-hover:opacity-100 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-1.5 transition-all duration-200 shadow-md hover:shadow-lg"
        title="Edit teacher"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-all duration-200 shadow-md hover:shadow-lg"
        title="Delete teacher"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SubjectDropZone({ classSubjectId, children }: { classSubjectId: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `classSubject-dropzone-${classSubjectId}`,
    data: { classSubjectId },
  });

  return (
    <div ref={setNodeRef} className={`transition-all ${isOver ? "ring-2 ring-green-500 ring-offset-2 rounded-lg" : ""}`}>
      {children}
    </div>
  );
}

function DraggableSubject({ 
  subject, 
  classId, 
  children,
  onDelete 
}: { 
  subject: SimulationSubject; 
  classId: string; 
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `subject-drag-${subject.id}-${classId}`,
    data: { subject, sourceClassId: classId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      <div className="group relative inline-flex items-center gap-2.5 border-2 border-gray-200 rounded-xl px-3.5 py-2.5 bg-white hover:shadow-md hover:border-gray-300 transition-all duration-200 min-w-[200px] shadow-sm">
        {/* Drag Handle - only this area initiates drag */}
        <div 
          {...listeners} 
          {...attributes}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-200"
        >
          <Move className="h-4 w-4 text-gray-400 hover:text-gray-600" />
        </div>
        
        {children}
        
        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
          title="Delete subject"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </button>
      </div>
    </div>
  );
}

function ClassRowDropZone({ classId, children }: { classId: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `class-row-${classId}`,
    data: { targetClassId: classId },
  });

  return (
    <td 
      ref={setNodeRef} 
      className={`px-4 py-3 transition-all ${isOver ? "bg-green-50 ring-2 ring-green-400 ring-inset" : ""}`}
    >
      {children}
    </td>
  );
}

function SubjectCard({
  subject,
  classSubject,
  assignment,
  teacher,
  onPeriodsChange,
  onRemoveAssignment,
  onDeleteSubject,
}: {
  subject: SimulationSubject;
  classSubject?: SimulationClassSubject;
  assignment?: SimulationAssignment;
  teacher?: SimulationTeacher;
  onPeriodsChange: (periods: number) => void;
  onRemoveAssignment?: () => void;
  onDeleteSubject: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `subject-${subject.id}`,
    data: { subjectId: subject.id, classSubject, assignment },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group relative border-2 rounded-lg p-4 transition-all ${
        isOver ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      style={{ borderLeftWidth: "4px", borderLeftColor: subject.color }}
    >
      <div className="flex items-center gap-4">
        {/* Subject Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{subject.name}</h4>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{subject.code}</span>
          </div>
          
          {/* Periods Input */}
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              min="0"
              max="20"
              value={classSubject?.weeklyPeriods || 0}
              onChange={(e) => onPeriodsChange(parseInt(e.target.value) || 0)}
              className="h-8 w-20 text-sm text-center"
              placeholder="0"
            />
            <span className="text-sm text-gray-500">periods/week</span>
          </div>
        </div>

        {/* Teacher Assignment */}
        <div className="flex-1">
          {teacher && assignment ? (
            <div className="relative bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg px-3 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAssignment?.();
                }}
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-all"
                title="Remove teacher"
              >
                <X className="h-3 w-3" />
              </button>
              <p className="font-medium text-gray-900 text-sm">{teacher.name}</p>
              <p className="text-xs text-gray-600">{teacher.employeeId}</p>
            </div>
          ) : classSubject && classSubject.weeklyPeriods > 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center text-sm text-gray-400">
              Drop teacher here
            </div>
          ) : null}
        </div>

        {/* Delete Subject Button */}
        <button
          onClick={onDeleteSubject}
          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all"
          title="Delete subject"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </button>
      </div>
    </div>
  );
}

function DraggableTeacherBadge({ teacher, assignmentId }: { teacher: SimulationTeacher; assignmentId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `teacher-assignment-${assignmentId}`,
    data: { teacher, assignmentId, fromCell: true },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white text-gray-700 font-medium shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <Users className="h-3 w-3" />
      <span className="truncate">{teacher.name}</span>
    </div>
  );
}

export default function SimulationGrid({ simulationId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTeacher, setActiveTeacher] = useState<SimulationTeacher | null>(null);
  const [activeSubject, setActiveSubject] = useState<{ subject: SimulationSubject; sourceClassId: string } | null>(null);
  
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  
  const [deleteClassOpen, setDeleteClassOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<{ id: string; grade: string; section: string } | null>(null);
  
  const [deleteTeacherOpen, setDeleteTeacherOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<{ id: string; name: string; employeeId: string } | null>(null);
  
  const [editTeacherOpen, setEditTeacherOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<SimulationTeacher | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherEmployeeId, setEditTeacherEmployeeId] = useState("");
  const [editTeacherMaxPeriods, setEditTeacherMaxPeriods] = useState<number>(7);
  
  const [deleteSubjectOpen, setDeleteSubjectOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<{ id: string; name: string; code: string } | null>(null);
  
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [addSubjectForClass, setAddSubjectForClass] = useState<string | null>(null);
  
  const [editingPeriods, setEditingPeriods] = useState<{ [key: string]: string }>({});
  
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [optimizeSummaryOpen, setOptimizeSummaryOpen] = useState(false);
  const [reviewRecommendationOpen, setReviewRecommendationOpen] = useState(false);
  const [currentRecommendation, setCurrentRecommendation] = useState<any>(null);
  const [optimizeResult, setOptimizeResult] = useState<{
    summary: {
      periodsOptimized: number;
      assignmentsCreated: number;
      redistributions: number;
      coverageBefore: number;
      coverageAfter: number;
      coverageImprovement: number;
    };
    optimizations: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    newAssignments: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    redistributions: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    teacherUtilization: Array<{
      teacherId: string;
      name: string;
      utilization: number;
      periodsAssigned: number;
      capacity: number;
    }>;
  } | null>(null);
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    canOptimize: boolean;
    summary: {
      periodsOptimized: number;
      assignmentsCreated: number;
      redistributions: number;
      coverageBefore: number;
      coverageAfter: number;
      coverageImprovement: number;
    };
    optimizations: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    newAssignments: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    redistributions: Array<{
      classSubjectId: string;
      className: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      periodsAssigned: number;
      type: 'new_assignment' | 'redistribution';
      fromTeacherId?: string;
      fromTeacherName?: string;
    }>;
    teacherUtilization: Array<{
      teacherId: string;
      name: string;
      utilization: number;
      periodsAssigned: number;
      capacity: number;
    }>;
  } | null>(null);
  
  // Common subject suggestions
  const commonSubjects = [
    "Mathematics", "English", "Science", "Social Studies", "History", 
    "Geography", "Physics", "Chemistry", "Biology", "Computer Science",
    "Physical Education", "Art", "Music", "Hindi", "Sanskrit",
    "Economics", "Business Studies", "Accountancy", "Political Science",
    "Psychology", "Sociology", "Philosophy", "Home Science", "French",
    "German", "Spanish", "Environmental Studies", "Civics", "Moral Science"
  ];
  
  // Filter suggestions based on input
  const filteredSuggestions = commonSubjects.filter(subject =>
    subject.toLowerCase().includes(newSubjectName.toLowerCase()) && 
    subject.toLowerCase() !== newSubjectName.toLowerCase()
  ).slice(0, 5); // Show only top 5 suggestions
  
  // Generate subject code using standardized grade-specific logic (3 chars + grade)
  const generateSubjectCode = (name: string, grade: string, existingCodes: string[]): string => {
    // Create base code from first 3 letters of subject name
    const baseCode = name
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .substring(0, 3)
      .toUpperCase();
    
    // Create grade-specific code
    let code = `${baseCode}${grade}`;
    let counter = 1;
    while (existingCodes.includes(code)) {
      code = `${baseCode}${grade}_${counter}`;
      counter++;
    }
    
    return code;
  };
  
  // Format class name for display - add "Class" prefix for numeric classes
  const formatClassName = (className: string): string => {
    // Check if className is just a number (like "1", "2", "10", etc.)
    if (/^\d+$/.test(className)) {
      return `Class ${className}`;
    }
    // Otherwise return as is (like "LKG A", "Playschool", etc.)
    return className;
  };
  
  // Generate color based on subject code
  const generateColorFromCode = (code: string): string => {
    const colors = [
      "#3B82F6", // blue
      "#10B981", // green
      "#F59E0B", // amber
      "#EF4444", // red
      "#8B5CF6", // purple
      "#EC4899", // pink
      "#06B6D4", // cyan
      "#F97316", // orange
      "#84CC16", // lime
      "#6366F1", // indigo
    ];
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmployeeId, setNewTeacherEmployeeId] = useState("");
  const [newTeacherMaxPeriods, setNewTeacherMaxPeriods] = useState("7");

  // Simulation configuration state
  const [teachingPeriodsPerDay, setTeachingPeriodsPerDay] = useState<number | null>(null);
  const [workingDaysCount, setWorkingDaysCount] = useState<number | null>(null);
  const [defaultMaxPeriodsPerDay, setDefaultMaxPeriodsPerDay] = useState<number | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [periodsPerDayInput, setPeriodsPerDayInput] = useState("");
  const [workingDaysInput, setWorkingDaysInput] = useState("");
  const [maxPeriodsInput, setMaxPeriodsInput] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAiAutoAssignConfirm, setShowAiAutoAssignConfirm] = useState(false);
  const [showOptimizeConfirm, setShowOptimizeConfirm] = useState(false);
  const [showAIBanner, setShowAIBanner] = useState(false);

  const { data: simulation, isLoading } = useQuery<SimulationData & { 
    teachingPeriodsPerDay?: number | null;
    workingDaysCount?: number | null;
    defaultMaxPeriodsPerDay?: number | null;
  }>({
    queryKey: [`/api/load-simulations/${simulationId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/load-simulations/${simulationId}`);
      return await response.json();
    },
  });

  // Fetch timetable structure for fallback values
  const { data: timetableStructure } = useQuery<{
    periodsPerDay: number;
    workingDays: string[];
    timeSlots: Array<{
      period: number;
      startTime: string;
      endTime: string;
      isBreak?: boolean;
    }>;
    schoolDefaultMaxPeriodsPerDay?: number;
  }>({
    queryKey: ["/api/timetable-structure"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-structure");
      return await response.json();
    },
  });

  // Calculate fallback values from timetable structure
  const fallbackPeriodsPerDay = useMemo(() => {
    if (!timetableStructure) return 7;
    return timetableStructure.timeSlots?.filter(slot => !slot.isBreak).length || 7;
  }, [timetableStructure]);

  const fallbackWorkingDays = useMemo(() => {
    if (!timetableStructure) return 6;
    return timetableStructure.workingDays?.length || 6;
  }, [timetableStructure]);

  // Initialize config from database when simulation loads
  useEffect(() => {
    if (simulation) {
      setTeachingPeriodsPerDay(simulation.teachingPeriodsPerDay ?? null);
      setWorkingDaysCount(simulation.workingDaysCount ?? null);
      setDefaultMaxPeriodsPerDay(simulation.defaultMaxPeriodsPerDay ?? null);
    }
  }, [simulation]);

  // Use custom values if set, otherwise use fallback
  const effectivePeriodsPerDay = teachingPeriodsPerDay ?? fallbackPeriodsPerDay;
  const effectiveWorkingDays = workingDaysCount ?? fallbackWorkingDays;
  const effectiveMaxPeriodsPerDay = defaultMaxPeriodsPerDay ?? timetableStructure?.schoolDefaultMaxPeriodsPerDay ?? 6;
  const teachingPeriodsPerWeek = effectivePeriodsPerDay * effectiveWorkingDays;

  // Mutation to update simulation config in database
  const updateConfigMutation = useMutation({
    mutationFn: async (config: { 
      teachingPeriodsPerDay?: number | null;
      workingDaysCount?: number | null;
      defaultMaxPeriodsPerDay?: number | null;
    }) => {
      const response = await apiRequest("PATCH", `/api/load-simulations/${simulationId}/config`, config);
      return await response.json();
    },
    onSuccess: (data) => {
      setTeachingPeriodsPerDay(data.teachingPeriodsPerDay ?? null);
      setWorkingDaysCount(data.workingDaysCount ?? null);
      setDefaultMaxPeriodsPerDay(data.defaultMaxPeriodsPerDay ?? null);
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
    },
  });

  // AI Auto Assign Mutation
  const aiAutoAssignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/ai-auto-assign`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      
      toast({
        title: "AI Auto Assign Complete! 🎉",
        description: `Successfully assigned ${data.summary.totalAssignments} subjects. ${data.summary.newTeachersCreated} new teachers created, ${data.summary.existingTeachersUsed} existing teachers used. Average utilization: ${data.summary.averageUtilization}%`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Auto Assign Failed",
        description: error.message || "Failed to auto-assign teachers",
        variant: "destructive",
      });
    }
  });

  // Fetch recommendations - always refetch when dialog opens
  const { data: aiRecommendations, refetch: refetchRecommendations } = useQuery<{
    type: string;
    message: string;
    details?: any;
  }[]>({
    queryKey: [`/api/load-simulations/${simulationId}/recommendations`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/load-simulations/${simulationId}/recommendations`);
      return await response.json();
    },
    refetchOnMount: 'always', // Always fetch fresh data when component mounts
    staleTime: 0, // Data is immediately stale, will refetch on focus/reconnect
  });

  // Show AI banner when recommendations are available
  useEffect(() => {
    if (aiRecommendations && aiRecommendations.length > 0) {
      setShowAIBanner(true);
      // Auto-hide banner after 8 seconds
      const timer = setTimeout(() => {
        setShowAIBanner(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [aiRecommendations]);

  const createClass = useMutation({
    mutationFn: async (grades: string[]) => {
      const promises = grades.map(grade =>
        apiRequest("POST", `/api/load-simulations/${simulationId}/classes`, {
          grade,
          section: "",
          studentCount: 0,
        }).then(res => res.json())
      );
      return await Promise.all(promises);
    },
    onSuccess: (_, grades) => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      setAddClassOpen(false);
      setSelectedGrades([]);
      toast({ 
        title: "Success", 
        description: `${grades.length} ${grades.length === 1 ? 'class' : 'classes'} added successfully` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add classes", variant: "destructive" });
    },
  });

  const deleteClass = useMutation({
    mutationFn: async (classId: string) => {
      if (!simulation) throw new Error("Simulation not loaded");
      
      // Find the class being deleted
      const classToDelete = simulation.classes.find(c => c.id === classId);
      if (!classToDelete) throw new Error("Class not found");
      
      // Delete the class
      const response = await apiRequest("DELETE", `/api/load-simulations/${simulationId}/classes/${classId}`);
      if (response.status !== 204) {
        await response.json();
      }
      
      // Check if there's only one class left for this grade with a section
      const remainingClasses = simulation.classes.filter(
        c => c.id !== classId && c.grade === classToDelete.grade
      );
      
      if (remainingClasses.length === 1 && remainingClasses[0].section) {
        // Remove section from the last remaining class
        await apiRequest("PUT", `/api/load-simulations/${simulationId}/classes/${remainingClasses[0].id}`, {
          grade: remainingClasses[0].grade,
          section: "",
          studentCount: remainingClasses[0].studentCount
        });
      }
      
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({ title: "Success", description: "Class removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove class", variant: "destructive" });
    },
  });

  const addSection = useMutation({
    mutationFn: async (grade: string) => {
      if (!simulation) throw new Error("Simulation not loaded");
      
      // Find all existing sections for this grade
      const existingSections = simulation.classes
        .filter(c => c.grade === grade && c.section)
        .map(c => c.section.toUpperCase())
        .sort();
      
      // Check if there's a class without section to update
      const classWithoutSection = simulation.classes.find(c => c.grade === grade && !c.section);
      
      if (classWithoutSection && existingSections.length === 0) {
        // First time adding sections: Mark first class as A and create B
        const promises = [];
        
        // Update existing class to section A
        promises.push(
          apiRequest("PUT", `/api/load-simulations/${simulationId}/classes/${classWithoutSection.id}`, {
            grade,
            section: 'A',
            studentCount: classWithoutSection.studentCount
          }).then(res => res.json())
        );
        
        // Create section B
        promises.push(
          apiRequest("POST", `/api/load-simulations/${simulationId}/classes`, {
            grade,
            section: 'B',
            studentCount: 0
          }).then(res => res.json())
        );
        
        return Promise.all(promises);
      } else {
        // Already has sections, just add the next one
        const lastSection = existingSections[existingSections.length - 1];
        const nextSection = String.fromCharCode(lastSection.charCodeAt(0) + 1);
        
        const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/classes`, {
          grade,
          section: nextSection,
          studentCount: 0
        });
        return response.json();
      }
    },
    onSuccess: (_, grade) => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({
        title: "Success",
        description: `Section added to ${grade}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add section",
        variant: "destructive",
      });
    },
  });

  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      if (!simulation) throw new Error("Simulation not loaded");
      if (!addSubjectForClass) throw new Error("Please select a class first");
      
      // Find the class to get its grade
      const classData = simulation.classes.find(c => c.id === addSubjectForClass);
      if (!classData) throw new Error("Class not found");
      
      const existingCodes = simulation.subjects.map(s => s.code);
      const code = generateSubjectCode(name, classData.grade, existingCodes);
      const color = generateColorFromCode(code);
      
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/subjects`, {
        classId: addSubjectForClass,
        name,
        code,
        color
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      setAddSubjectOpen(false);
      setNewSubjectName("");
      setShowSuggestions(false);
      setAddSubjectForClass(null);
      toast({ title: "Success", description: "Subject added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add subject", variant: "destructive" });
    },
  });

  const createTeacher = useMutation({
    mutationFn: async (data: { name: string; employeeId?: string; maxPeriodsPerDay: number }) => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/teachers`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      setAddTeacherOpen(false);
      setNewTeacherName("");
      setNewTeacherEmployeeId("");
      setNewTeacherMaxPeriods("40");
      toast({ title: "Success", description: "Teacher added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add teacher", variant: "destructive" });
    },
  });

  const updateTeacher = useMutation({
    mutationFn: async (data: { teacherId: string; name: string; employeeId?: string; maxPeriodsPerDay: number }) => {
      const response = await apiRequest("PUT", `/api/load-simulations/${simulationId}/teachers/${data.teacherId}`, {
        name: data.name,
        employeeId: data.employeeId,
        maxPeriodsPerDay: data.maxPeriodsPerDay
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({ title: "Success", description: "Teacher updated successfully" });
      setEditTeacherOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update teacher", variant: "destructive" });
    },
  });

  const deleteTeacher = useMutation({
    mutationFn: async (teacherId: string) => {
      const response = await apiRequest("DELETE", `/api/load-simulations/${simulationId}/teachers/${teacherId}`);
      if (response.status === 204) return;
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({ title: "Success", description: "Teacher deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete teacher", variant: "destructive" });
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (subjectId: string) => {
      const response = await apiRequest("DELETE", `/api/load-simulations/${simulationId}/subjects/${subjectId}`);
      if (response.status === 204) return;
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({ title: "Success", description: "Subject deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete subject", variant: "destructive" });
    },
  });

  const createOrUpdateClassSubject = useMutation({
    mutationFn: async (data: { classId: string; subjectId: string; weeklyPeriods: number; classSubjectId?: string }) => {
      if (data.classSubjectId) {
        const response = await apiRequest(
          "PUT",
          `/api/load-simulations/${simulationId}/class-subjects/${data.classSubjectId}`,
          { weeklyPeriods: data.weeklyPeriods }
        );
        return await response.json();
      } else {
        const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/class-subjects`, {
          classId: data.classId,
          subjectId: data.subjectId,
          weeklyPeriods: data.weeklyPeriods,
        });
        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update periods", variant: "destructive" });
    },
  });

  const createAssignment = useMutation({
    mutationFn: async (data: { classSubjectId: string; teacherId: string }) => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/assignments`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}/recommendations`] });
      toast({ title: "Success", description: "Teacher assigned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign teacher", variant: "destructive" });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("DELETE", `/api/load-simulations/${simulationId}/assignments/${assignmentId}`);
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}/recommendations`] });
    },
  });

  const updatePeriods = useMutation({
    mutationFn: async (data: { classSubjectId: string; weeklyPeriods: number }) => {
      const response = await apiRequest(
        "PUT",
        `/api/load-simulations/${simulationId}/class-subjects/${data.classSubjectId}`,
        { weeklyPeriods: data.weeklyPeriods }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}/recommendations`] });
    },
  });

  const copySubject = useMutation({
    mutationFn: async (data: { subjectId: string; sourceClassId: string; targetClassId: string }) => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/subjects/copy`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      toast({ title: "Success", description: "Subject copied successfully" });
    },
    onError: (error: any) => {
      console.error("Copy subject error:", error);
      const errorMessage = error?.message || (typeof error === 'string' ? error : "Failed to copy subject");
      toast({ 
        title: "Cannot Copy Subject", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const previewOptimize = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/preview-optimize`);
      return await response.json();
    },
    onSuccess: (data) => {
      if (!data.canOptimize || (data.optimizations && data.optimizations.length === 0)) {
        // If no optimization available, check if there's a previous optimization to show
        if (simulation?.lastOptimizationAt && simulation?.lastOptimizationSummary) {
          // Show the last optimization history instead of error
          setShowAIRecommendations(false);
          setHistoryOpen(true);
        } else {
          // No previous optimization exists, show error
          toast({ 
            title: "No Optimizations Available", 
            description: "All periods are already optimally assigned or no teachers have capacity.", 
            variant: "destructive" 
          });
        }
        return;
      }
      
      setPreviewData(data);
      setShowAIRecommendations(false);
      setPreviewOpen(true);
    },
    onError: (error: any) => {
      toast({ 
        title: "Preview Failed", 
        description: error.message || "Failed to preview optimization", 
        variant: "destructive" 
      });
    },
  });

  const autoOptimize = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/auto-optimize`);
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.optimizations && data.optimizations.length === 0) {
        toast({ 
          title: "No Optimizations Available", 
          description: "All periods are already optimally assigned or no teachers have capacity.", 
          variant: "destructive" 
        });
        return;
      }
      
      setOptimizeResult(data);
      setPreviewOpen(false);
      setOptimizeSummaryOpen(true);
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}/recommendations`] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Optimization Failed", 
        description: error.message || "Failed to auto-optimize simulation", 
        variant: "destructive" 
      });
    },
  });

  const executeRecommendation = useMutation({
    mutationFn: async (data: { teacherId: string; teacherName: string; classSubjectIds: string[] }) => {
      const response = await apiRequest("POST", `/api/load-simulations/${simulationId}/execute-recommendation`, {
        teacherId: data.teacherId,
        classSubjectIds: data.classSubjectIds
      });
      return await response.json();
    },
    onSuccess: (data, variables) => {
      toast({ 
        title: "Success", 
        description: `${variables.teacherName} has been assigned to ${variables.classSubjectIds.length} class(es)` 
      });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}/recommendations`] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Assignment Failed", 
        description: error.message || "Failed to execute recommendation", 
        variant: "destructive" 
      });
    },
  });

  const teacherPeriods = useMemo(() => {
    if (!simulation) return new Map<string, number>();
    const periods = new Map<string, number>();
    
    simulation.assignments.forEach((assignment) => {
      if (assignment.teacherId) {
        const classSubject = simulation.classSubjects.find((cs) => cs.id === assignment.classSubjectId);
        if (classSubject) {
          const current = periods.get(assignment.teacherId) || 0;
          periods.set(assignment.teacherId, current + classSubject.weeklyPeriods);
        }
      }
    });
    
    return periods;
  }, [simulation]);

  const handleDragStart = (event: DragStartEvent) => {
    const teacher = event.active.data.current?.teacher;
    const subject = event.active.data.current?.subject;
    const sourceClassId = event.active.data.current?.sourceClassId;
    
    if (teacher) {
      setActiveTeacher(teacher);
    } else if (subject && sourceClassId) {
      setActiveSubject({ subject, sourceClassId });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTeacher(null);
    setActiveSubject(null);
    
    const { active, over } = event;
    
    const teacher = active.data.current?.teacher as SimulationTeacher;
    const subject = active.data.current?.subject as SimulationSubject;
    const sourceClassId = active.data.current?.sourceClassId as string;
    const fromCell = active.data.current?.fromCell as boolean;
    const assignmentId = active.data.current?.assignmentId as string;

    // Handle teacher dragged from cell and dropped outside valid zones
    if (teacher && fromCell && assignmentId && (!over || !over.data.current?.classSubjectId)) {
      await deleteAssignment.mutateAsync(assignmentId);
      toast({
        title: "Teacher Removed",
        description: `${teacher.name} has been removed from the assignment.`,
      });
      return;
    }

    if (!over || !simulation) return;

    const dropData = over.data.current;
    
    if (!dropData) return;

    // Handle teacher drop on valid zone
    if (teacher) {
      const { classSubjectId } = dropData;
      
      if (!classSubjectId) return;

      const classSubject = simulation.classSubjects.find(cs => cs.id === classSubjectId);
      if (!classSubject) return;

      const existingAssignment = simulation.assignments.find(a => a.classSubjectId === classSubjectId);

      if (existingAssignment?.teacherId === teacher.id) {
        return;
      }

      // If dragged from another cell, delete the old assignment
      if (fromCell && assignmentId) {
        await deleteAssignment.mutateAsync(assignmentId);
      }

      // If there's an existing different teacher, remove them
      if (existingAssignment?.teacherId && existingAssignment.teacherId !== teacher.id) {
        await deleteAssignment.mutateAsync(existingAssignment.id);
      }

      await createAssignment.mutateAsync({
        classSubjectId,
        teacherId: teacher.id,
      });
    }
    
    // Handle subject drop (copy to another class)
    if (subject && sourceClassId) {
      const { targetClassId } = dropData;
      
      if (!targetClassId || targetClassId === sourceClassId) return;

      try {
        await copySubject.mutateAsync({
          subjectId: subject.id,
          sourceClassId,
          targetClassId,
        });
      } catch (error) {
        // Error is already handled by mutation's onError
        // This catch prevents the error from reaching Vite's error overlay
      }
    }
  };

  const handlePeriodsChange = (classId: string, subjectId: string, periods: number) => {
    if (!simulation) return;
    
    const classSubject = simulation.classSubjects.find(
      (cs) => cs.classId === classId && cs.subjectId === subjectId
    );

    createOrUpdateClassSubject.mutate({
      classId,
      subjectId,
      weeklyPeriods: periods,
      classSubjectId: classSubject?.id,
    });
  };

  const handleExportSimulation = () => {
    if (!simulation) return;

    try {
      const workbook = XLSX.utils.book_new();

      // Teachers sheet - Smart Upload format
      const teachersData = simulation.teachers.map(teacher => ({
        'Name*': teacher.name,
        'Mobile Number*': '',
        'Email': '',
        'Designation': '',
        'School ID*': teacher.employeeId,
        'Max Periods/Day': teacher.maxPeriodsPerDay.toString(),
        'Aadhaar Number': '',
        'Gender': '',
        'Blood Group': '',
        'Date of Birth': '',
        'Father/Husband Name': '',
        'Address': '',
        'Category': '',
        'Religion': ''
      }));

      const teachersSheet = XLSX.utils.json_to_sheet(teachersData);
      teachersSheet['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 },
        { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, 
        { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

      // Students sheet - Empty template for manual entry with reference column
      const studentsData = [
        {
          'First Name*': '',
          'Last Name*': '',
          'Admission Number*': '',
          'Grade*': '',
          'Section': '',
          'Roll Number': '',
          'Email': '',
          'Contact Number': '',
          'Date of Birth': '',
          'Gender': '',
          'Blood Group': '',
          'Address': '',
          'Emergency Contact': '',
          '': '',
          '📋 Allowed Classes (Reference Only)': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
        }
      ];
      const studentsSheet = XLSX.utils.json_to_sheet(studentsData);
      studentsSheet['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 10 },
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 3 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');

      // Assignments sheet - Smart Upload format
      const assignmentsData: any[] = [];
      
      simulation.classes.forEach(cls => {
        const classSubjects = simulation.classSubjects.filter(cs => cs.classId === cls.id);
        
        classSubjects.forEach(cs => {
          const subject = simulation.subjects.find(s => s.id === cs.subjectId);
          const assignment = simulation.assignments.find(a => a.classSubjectId === cs.id);
          const teacher = assignment?.teacherId 
            ? simulation.teachers.find(t => t.id === assignment.teacherId) 
            : null;

          if (subject) {
            assignmentsData.push({
              'Teacher School ID*': teacher?.employeeId || '',
              'Grade*': cls.grade,
              'Section': cls.section || '',
              'Subject Name*': subject.name,
              'Weekly Frequency*': cs.weeklyPeriods,
              '': '',
              '📋 Allowed Classes (Reference Only)': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
            });
          }
        });
      });

      const assignmentsSheet = XLSX.utils.json_to_sheet(assignmentsData);
      assignmentsSheet['!cols'] = [
        { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 18 }, { wch: 3 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Assignments');

      // Instructions sheet
      const instructions = [
        ['SMART UPLOAD - EXPORTED FROM SIMULATION'],
        [''],
        ['IMPORTANT: This file is ready to upload to production via Smart Upload'],
        [''],
        ['UPLOAD ORDER:'],
        ['1. Upload Teachers sheet first (creates teacher accounts)'],
        ['2. Upload Students sheet second (add your student data if needed)'],
        ['3. Upload Assignments sheet last (assigns teachers to class-subject combinations)'],
        [''],
        ['NOTES:'],
        ['- Teacher Mobile Numbers: Please fill in before uploading'],
        ['- Student Data: Empty template provided - add your students'],
        ['- Subject Codes: Will be auto-generated by the system on upload'],
        ['- Same subject in same grade will share the same code across sections'],
        [''],
        ['ALLOWED CLASS GRADES:'],
        ['Pre-Primary: Playschool, Pre-Nursery, Nursery, LKG, UKG'],
        ['Primary & Secondary: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10'],
        ['Senior Secondary: 11, 12']
      ];
      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
      instructionsSheet['!cols'] = [{ wch: 70 }];
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

      // Generate filename with simulation name and date
      const date = new Date().toISOString().split('T')[0];
      const filename = `SmartUpload_${simulation.name.replace(/\s+/g, '_')}_${date}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Smart Upload template exported: ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export simulation data",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Simulation not found</p>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-8 h-full">
        <div className="flex-1 overflow-auto">
          <div className="mb-8">
            <div className="flex gap-3">
              <Button
                onClick={() => setAddClassOpen(true)}
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow-md transition-all duration-200 font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Class
              </Button>
              
              <Button
                onClick={() => setShowAiAutoAssignConfirm(true)}
                size="sm"
                disabled={aiAutoAssignMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-sm hover:shadow-md transition-all duration-200 font-medium"
              >
                {aiAutoAssignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                AI Auto Assign
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 transition-all duration-200 shadow-sm font-medium"
                  >
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="shadow-lg border-gray-200">
                  <DropdownMenuItem onClick={() => setBulkUploadOpen(true)} className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Add via Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportSimulation} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {simulation.classes.length === 0 ? (
            <Card className="border-orange-200">
              <CardContent className="py-16 text-center">
                <GraduationCap className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-4">No classes yet</h3>
                <Button onClick={() => setAddClassOpen(true)} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md hover:shadow-lg transition-all">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Class
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Enhanced Grid Table */}
              <div className="border border-gray-200/80 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full table-fixed">
                  <thead className="bg-gradient-to-r from-orange-500/10 via-orange-400/10 to-amber-500/10 border-b border-orange-200/60 backdrop-blur-sm">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-800 border-r border-orange-200/50 sticky left-0 bg-gradient-to-r from-orange-500/10 via-orange-400/10 to-amber-500/10 z-10 w-40 backdrop-blur-sm">
                        Class
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-800">
                        Subjects
                      </th>
                    </tr>
                    {/* Configuration Row */}
                    <tr className="bg-gradient-to-r from-gray-50 via-slate-50 to-gray-50 border-b border-gray-200">
                      <td colSpan={2} className="px-5 py-3">
                        {!isEditingConfig ? (
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-lg shadow-sm">
                              <BookOpen className="h-4 w-4 text-blue-600" />
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-bold text-blue-700">{effectivePeriodsPerDay}</span>
                                <span className="text-xs text-blue-600">periods/day</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/60 rounded-lg shadow-sm">
                              <span className="text-sm font-bold text-green-700">{effectiveWorkingDays}</span>
                              <span className="text-xs text-green-600">working days</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200/60 rounded-lg shadow-sm">
                              <span className="text-sm font-bold text-purple-700">{effectiveMaxPeriodsPerDay}</span>
                              <span className="text-xs text-purple-600">Daily Period Limit per Teacher</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                setPeriodsPerDayInput(effectivePeriodsPerDay.toString());
                                setWorkingDaysInput(effectiveWorkingDays.toString());
                                setMaxPeriodsInput(effectiveMaxPeriodsPerDay.toString());
                                setIsEditingConfig(true);
                              }}
                              title="Configure settings"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            {(teachingPeriodsPerDay !== null || workingDaysCount !== null || defaultMaxPeriodsPerDay !== null) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => setShowResetConfirm(true)}
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-600">Periods/Day:</label>
                              <Input
                                type="number"
                                value={periodsPerDayInput}
                                onChange={(e) => setPeriodsPerDayInput(e.target.value)}
                                className="h-8 w-16 text-sm px-2"
                                placeholder="7"
                                min="1"
                                max="15"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-600">Working Days:</label>
                              <Input
                                type="number"
                                value={workingDaysInput}
                                onChange={(e) => setWorkingDaysInput(e.target.value)}
                                className="h-8 w-16 text-sm px-2"
                                placeholder="6"
                                min="1"
                                max="7"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-600">Max/Teacher/Day:</label>
                              <Input
                                type="number"
                                value={maxPeriodsInput}
                                onChange={(e) => setMaxPeriodsInput(e.target.value)}
                                className="h-8 w-16 text-sm px-2"
                                placeholder="6"
                                min="1"
                                max="15"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                const periods = parseInt(periodsPerDayInput);
                                const days = parseInt(workingDaysInput);
                                const maxPeriods = parseInt(maxPeriodsInput);
                                if (periods > 0 && days > 0 && maxPeriods > 0) {
                                  updateConfigMutation.mutate({
                                    teachingPeriodsPerDay: periods,
                                    workingDaysCount: days,
                                    defaultMaxPeriodsPerDay: maxPeriods
                                  });
                                  setIsEditingConfig(false);
                                  toast({
                                    title: "Configuration Updated",
                                    description: `Set to ${periods} periods/day, ${days} working days, ${maxPeriods} daily period limit per teacher`,
                                  });
                                } else {
                                  toast({
                                    title: "Invalid Values",
                                    description: "All values must be greater than 0",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setIsEditingConfig(false);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortClasses(simulation.classes).map((classItem) => {
                      const classSubjects = simulation.subjects.filter(
                        (subject: any) => subject.classId === classItem.id
                      );
                      
                      // Calculate total periods for this class
                      const totalPeriods = classSubjects.reduce((sum, subject) => {
                        const classSubject = simulation.classSubjects.find(
                          (cs) => cs.classId === classItem.id && cs.subjectId === subject.id
                        );
                        return sum + (classSubject?.weeklyPeriods || 0);
                      }, 0);
                      
                      const isOverLimit = teachingPeriodsPerWeek > 0 && totalPeriods > teachingPeriodsPerWeek;
                      const isNearLimit = teachingPeriodsPerWeek > 0 && totalPeriods === teachingPeriodsPerWeek;
                      
                      return (
                        <tr key={classItem.id} className={`group hover:bg-orange-50/30 transition-all duration-200 ${isOverLimit ? 'bg-red-50/50' : ''}`}>
                          {/* Enhanced Class Name Cell */}
                          <td className="px-5 py-4 align-top border-r border-gray-200/50 sticky left-0 bg-white group-hover:bg-orange-50/30 z-10 w-40 transition-all duration-200">
                            <div className="flex flex-col gap-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base text-gray-900">
                                    {['Playschool', 'Pre-Nursery', 'Nursery', 'LKG', 'UKG'].includes(classItem.grade) ? classItem.grade : `Class ${classItem.grade}`}
                                  </span>
                                  {classItem.section && (
                                    <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold rounded-md shadow-sm">
                                      {classItem.section}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                  <button
                                    onClick={() => addSection.mutate(classItem.grade)}
                                    disabled={addSection.isPending}
                                    className="p-1.5 hover:bg-orange-100 rounded-lg transition-all duration-200 text-orange-600 disabled:opacity-50 shadow-sm hover:shadow"
                                    title="Add section"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setClassToDelete({ id: classItem.id, grade: classItem.grade, section: classItem.section });
                                      setDeleteClassOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-red-100 rounded-lg transition-all duration-200 text-red-600 shadow-sm hover:shadow"
                                    title="Remove class"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {/* Enhanced Total Periods Badge */}
                              {totalPeriods > 0 && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                                  isOverLimit 
                                    ? 'bg-gradient-to-r from-red-100 to-red-50 text-red-700 border border-red-300/60' 
                                    : isNearLimit 
                                    ? 'bg-gradient-to-r from-green-100 to-emerald-50 text-green-700 border border-green-300/60' 
                                    : 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-300/60'
                                }`}>
                                  <span>{totalPeriods}/{teachingPeriodsPerWeek}</span>
                                  {isOverLimit && <AlertTriangle className="h-3.5 w-3.5" />}
                                  {isNearLimit && <CheckCircle className="h-3.5 w-3.5" />}
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Subjects Cell */}
                          <ClassRowDropZone classId={classItem.id}>
                            <div className="flex flex-wrap items-start gap-2">
                              {classSubjects.map((subject) => {
                                const classSubject = simulation.classSubjects.find(
                                  (cs) => cs.classId === classItem.id && cs.subjectId === subject.id
                                );
                                const assignment = simulation.assignments.find(
                                  (a) => a.classSubjectId === classSubject?.id
                                );
                                const teacher = simulation.teachers.find((t) => t.id === assignment?.teacherId);

                                return (
                                  <DraggableSubject 
                                    key={subject.id} 
                                    subject={subject} 
                                    classId={classItem.id}
                                    onDelete={() => {
                                      setSubjectToDelete({ id: subject.id, name: subject.name, code: subject.code });
                                      setDeleteSubjectOpen(true);
                                    }}
                                  >
                                    <SubjectDropZone
                                      classSubjectId={classSubject?.id || ""}
                                    >
                                      {/* Enhanced Subject Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <span className="font-bold text-sm text-gray-900 truncate">{subject.name}</span>
                                          <span className="text-xs px-2 py-0.5 rounded-md font-bold shadow-sm" style={{ backgroundColor: `${subject.color}20`, color: subject.color }}>
                                            {subject.code}
                                          </span>
                                        </div>
                                        
                                        {/* Refined Periods per week input */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <input
                                            type="text"
                                            value={editingPeriods[classSubject?.id || ''] ?? (classSubject?.weeklyPeriods || 0)}
                                            onChange={(e) => {
                                              const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                              if (classSubject?.id) {
                                                setEditingPeriods({ ...editingPeriods, [classSubject.id]: numericValue });
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const value = parseInt((e.target as HTMLInputElement).value) || 0;
                                                if (value >= 0 && value <= 50 && classSubject?.id) {
                                                  // Calculate what the new total would be
                                                  const currentTotal = totalPeriods;
                                                  const currentPeriods = classSubject.weeklyPeriods || 0;
                                                  const newTotal = currentTotal - currentPeriods + value;
                                                  
                                                  // Check if it would exceed the limit
                                                  if (teachingPeriodsPerWeek > 0 && newTotal > teachingPeriodsPerWeek) {
                                                    toast({
                                                      title: "Limit Exceeded",
                                                      description: `This class can have maximum ${teachingPeriodsPerWeek} periods/week. Adding ${value} periods would total ${newTotal} periods.`,
                                                      variant: "destructive"
                                                    });
                                                    return;
                                                  }
                                                  
                                                  updatePeriods.mutate({ 
                                                    classSubjectId: classSubject.id, 
                                                    weeklyPeriods: value 
                                                  });
                                                  const newState = { ...editingPeriods };
                                                  delete newState[classSubject.id];
                                                  setEditingPeriods(newState);
                                                }
                                                (e.target as HTMLInputElement).blur();
                                              } else if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                                e.preventDefault();
                                              }
                                            }}
                                            onBlur={(e) => {
                                              const value = parseInt(e.target.value) || 0;
                                              if (value >= 0 && value <= 50 && classSubject?.id) {
                                                // Calculate what the new total would be
                                                const currentTotal = totalPeriods;
                                                const currentPeriods = classSubject.weeklyPeriods || 0;
                                                const newTotal = currentTotal - currentPeriods + value;
                                                
                                                // Check if it would exceed the limit
                                                if (teachingPeriodsPerWeek > 0 && newTotal > teachingPeriodsPerWeek) {
                                                  toast({
                                                    title: "Limit Exceeded",
                                                    description: `This class can have maximum ${teachingPeriodsPerWeek} periods/week. Adding ${value} periods would total ${newTotal} periods.`,
                                                    variant: "destructive"
                                                  });
                                                  // Reset to previous value
                                                  const newState = { ...editingPeriods };
                                                  delete newState[classSubject.id];
                                                  setEditingPeriods(newState);
                                                  return;
                                                }
                                                
                                                updatePeriods.mutate({ 
                                                  classSubjectId: classSubject.id, 
                                                  weeklyPeriods: value 
                                                });
                                                const newState = { ...editingPeriods };
                                                delete newState[classSubject.id];
                                                setEditingPeriods(newState);
                                              }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-14 px-2 py-1 text-xs font-semibold text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-200 shadow-sm"
                                          />
                                          <span className="text-xs text-gray-600 font-medium">periods/week</span>
                                        </div>
                                        
                                        {teacher && assignment ? (
                                          <DraggableTeacherBadge teacher={teacher} assignmentId={assignment.id} />
                                        ) : (
                                          <div className="text-xs text-gray-500 italic font-medium">Drop teacher here</div>
                                        )}
                                      </div>
                                    </SubjectDropZone>
                                  </DraggableSubject>
                                );
                              })}
                              
                              {/* Enhanced Add Subject Button */}
                              <button
                                onClick={() => {
                                  setAddSubjectForClass(classItem.id);
                                  setAddSubjectOpen(true);
                                }}
                                className="inline-flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <Plus className="h-4 w-4" />
                                Add Subject
                              </button>
                            </div>
                          </ClassRowDropZone>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 border-l border-gray-200/60 pl-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Teacher Pool</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddTeacherOpen(true)}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 shadow-sm font-medium"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {simulation.teachers.length === 0 ? (
            <Card className="border-orange-200/60 shadow-sm">
              <CardContent className="py-12 text-center">
                <div className="bg-gradient-to-br from-orange-100 to-orange-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-sm text-gray-700 mb-6 font-medium">No teachers yet</p>
                <Button onClick={() => setAddTeacherOpen(true)} size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm hover:shadow-md transition-all duration-200 font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {simulation.teachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  assignedPeriods={teacherPeriods.get(teacher.id) || 0}
                  workingDays={effectiveWorkingDays}
                  onEdit={() => {
                    setTeacherToEdit(teacher);
                    setEditTeacherName(teacher.name);
                    setEditTeacherEmployeeId(teacher.employeeId);
                    setEditTeacherMaxPeriods(teacher.maxPeriodsPerDay);
                    setEditTeacherOpen(true);
                  }}
                  onDelete={() => {
                    setTeacherToDelete({ id: teacher.id, name: teacher.name, employeeId: teacher.employeeId });
                    setDeleteTeacherOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTeacher ? (
          <div className="p-3 bg-orange-200 border-2 border-orange-400 rounded-lg shadow-lg">
            <p className="font-medium text-sm">{activeTeacher.name}</p>
            <p className="text-xs text-orange-700">{activeTeacher.employeeId}</p>
          </div>
        ) : activeSubject ? (
          <div className="p-3 bg-blue-200 border-2 rounded-lg shadow-lg" style={{ borderColor: activeSubject.subject.color }}>
            <p className="font-medium text-sm">{activeSubject.subject.name}</p>
            <p className="text-xs" style={{ color: activeSubject.subject.color }}>{activeSubject.subject.code}</p>
          </div>
        ) : null}
      </DragOverlay>

      <Dialog open={addClassOpen} onOpenChange={setAddClassOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Add Classes to Simulation</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Select one or more grades to add to your simulation scenario
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold text-gray-700 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-orange-600" />
                  Available Grades
                </Label>
                {(() => {
                  const existingGrades = simulation?.classes.map(c => c.grade) || [];
                  const availableGrades = GRADE_OPTIONS.filter(g => !existingGrades.includes(g));
                  const allSelected = availableGrades.length > 0 && availableGrades.every(g => selectedGrades.includes(g));
                  
                  return availableGrades.length > 0 ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                      <Checkbox
                        id="select-all"
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGrades(availableGrades);
                          } else {
                            setSelectedGrades([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="select-all"
                        className="text-sm font-medium text-blue-700 cursor-pointer select-none"
                      >
                        Select All ({availableGrades.length})
                      </label>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
                {(() => {
                  const existingGrades = simulation?.classes.map(c => c.grade) || [];
                  const availableGrades = GRADE_OPTIONS.filter(g => !existingGrades.includes(g));
                  
                  if (availableGrades.length === 0) {
                    return (
                      <div className="col-span-4 text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3">
                          <GraduationCap className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">All classes have been added</p>
                        <p className="text-sm text-gray-400 mt-1">No more grades available to add</p>
                      </div>
                    );
                  }
                  
                  return availableGrades.map((grade) => {
                    const isSelected = selectedGrades.includes(grade);
                    return (
                      <div
                        key={grade}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGrades(selectedGrades.filter(g => g !== grade));
                          } else {
                            setSelectedGrades([...selectedGrades, grade]);
                          }
                        }}
                        className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-md scale-105'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm hover:bg-orange-50/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>
                            {grade}
                          </span>
                          <Checkbox
                            id={`grade-${grade}`}
                            checked={isSelected}
                            onCheckedChange={() => {}}
                            className="pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-600">
                {selectedGrades.length > 0 ? (
                  <span className="font-medium text-orange-600">
                    {selectedGrades.length} grade{selectedGrades.length !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span className="text-gray-400">No grades selected</span>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => { setAddClassOpen(false); setSelectedGrades([]); }}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createClass.mutate(selectedGrades)}
                  disabled={selectedGrades.length === 0 || createClass.isPending}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md hover:shadow-lg transition-all px-6"
                >
                  {createClass.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Class{selectedGrades.length !== 1 ? 'es' : ''}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subject</DialogTitle>
            <DialogDescription>Add a new subject to this simulation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Label htmlFor="subject-name">Subject Name</Label>
              <Input
                id="subject-name"
                value={newSubjectName}
                onChange={(e) => {
                  setNewSubjectName(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => setShowSuggestions(newSubjectName.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="e.g., Mathematics"
                autoComplete="off"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredSuggestions.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm"
                      onClick={() => {
                        setNewSubjectName(subject);
                        setShowSuggestions(false);
                      }}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Subject code and color will be automatically assigned</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setAddSubjectOpen(false);
                setNewSubjectName("");
                setShowSuggestions(false);
                setAddSubjectForClass(null);
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => createSubject.mutate(newSubjectName)}
                disabled={!newSubjectName || createSubject.isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                {createSubject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Subject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteClassOpen} onOpenChange={setDeleteClassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Class</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {['Playschool', 'Pre-Nursery', 'Nursery', 'LKG', 'UKG'].includes(classToDelete?.grade || '') ? classToDelete?.grade : `Class ${classToDelete?.grade}`} {classToDelete?.section}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteClassOpen(false);
              setClassToDelete(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (classToDelete) {
                  deleteClass.mutate(classToDelete.id);
                  setDeleteClassOpen(false);
                  setClassToDelete(null);
                }
              }}
              disabled={deleteClass.isPending}
            >
              {deleteClass.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTeacherOpen} onOpenChange={setDeleteTeacherOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Teacher</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {teacherToDelete?.name} ({teacherToDelete?.employeeId})? This will remove all their assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteTeacherOpen(false);
              setTeacherToDelete(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (teacherToDelete) {
                  deleteTeacher.mutate(teacherToDelete.id);
                  setDeleteTeacherOpen(false);
                  setTeacherToDelete(null);
                }
              }}
              disabled={deleteTeacher.isPending}
            >
              {deleteTeacher.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editTeacherOpen} onOpenChange={setEditTeacherOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update teacher details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-teacher-name">
                Teacher Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-teacher-name"
                value={editTeacherName}
                onChange={(e) => setEditTeacherName(e.target.value)}
                placeholder="Enter teacher name"
              />
            </div>
            <div>
              <Label htmlFor="edit-teacher-employee-id">Employee ID</Label>
              <Input
                id="edit-teacher-employee-id"
                value={editTeacherEmployeeId}
                onChange={(e) => setEditTeacherEmployeeId(e.target.value)}
                placeholder="Enter employee ID (optional)"
              />
            </div>
            <div>
              <Label htmlFor="edit-teacher-max-periods">
                Max Periods per day <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-teacher-max-periods"
                type="number"
                min="1"
                value={editTeacherMaxPeriods}
                onChange={(e) => setEditTeacherMaxPeriods(parseInt(e.target.value) || 7)}
                placeholder="e.g., 7"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditTeacherOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editTeacherName.trim() || !teacherToEdit) return;
                updateTeacher.mutate({
                  teacherId: teacherToEdit.id,
                  name: editTeacherName.trim(),
                  employeeId: editTeacherEmployeeId.trim() || undefined,
                  maxPeriodsPerDay: editTeacherMaxPeriods,
                });
              }}
              disabled={!editTeacherName.trim() || updateTeacher.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {updateTeacher.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Teacher
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteSubjectOpen} onOpenChange={setDeleteSubjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {subjectToDelete?.name} ({subjectToDelete?.code})? This will remove all class-subject links and assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteSubjectOpen(false);
              setSubjectToDelete(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (subjectToDelete) {
                  deleteSubject.mutate(subjectToDelete.id);
                  setDeleteSubjectOpen(false);
                  setSubjectToDelete(null);
                }
              }}
              disabled={deleteSubject.isPending}
            >
              {deleteSubject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>Add a new teacher to this simulation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="teacher-name">
                Teacher Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="teacher-name"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="e.g., John Doe"
                required
              />
            </div>
            <div>
              <Label htmlFor="employee-id">Employee ID</Label>
              <Input
                id="employee-id"
                value={newTeacherEmployeeId}
                onChange={(e) => setNewTeacherEmployeeId(e.target.value)}
                placeholder="Auto-generated if left blank"
              />
            </div>
            <div>
              <Label htmlFor="max-periods">
                Max Periods per day <span className="text-red-500">*</span>
              </Label>
              <Input
                id="max-periods"
                type="number"
                min="1"
                max="60"
                value={newTeacherMaxPeriods}
                onChange={(e) => setNewTeacherMaxPeriods(e.target.value)}
                placeholder="7"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddTeacherOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createTeacher.mutate({
                    name: newTeacherName,
                    employeeId: newTeacherEmployeeId || undefined, // Auto-generate if empty
                    maxPeriodsPerDay: parseInt(newTeacherMaxPeriods),
                  })
                }
                disabled={!newTeacherName || !newTeacherMaxPeriods || createTeacher.isPending}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                {createTeacher.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Teacher
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <LoadSimulationBulkUpload
        simulationId={simulationId}
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
      />

      {/* AI Recommendations Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        {/* Pop-out Banner */}
        {showAIBanner && aiRecommendations && aiRecommendations.length > 0 && (
          <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 animate-[slideInRight_0.5s_ease-out] pointer-events-none">
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-lg shadow-2xl">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <div>
                  <div className="font-semibold text-sm">AI Recommendations Available!</div>
                  <div className="text-xs opacity-90">Click here to see {aiRecommendations.length} insights</div>
                </div>
                <ArrowRight className="h-5 w-5 animate-[bounceX_1s_ease-in-out_infinite]" />
              </div>
              {/* Arrow pointing to button */}
              <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-pink-600"></div>
            </div>
          </div>
        )}
        
        <button
          onClick={() => {
            refetchRecommendations(); // Fetch fresh recommendations
            setShowAIRecommendations(true);
            setShowAIBanner(false); // Hide banner when clicked
          }}
          className="group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full p-4 shadow-2xl transition-all duration-500 hover:scale-105 animate-[glow_3s_ease-in-out_infinite]"
          style={{
            boxShadow: '0 20px 50px -12px rgba(168, 85, 247, 0.4), 0 0 0 1px rgba(168, 85, 247, 0.1)',
          }}
          title="AI Recommendations"
        >
          <div className="relative">
            <Sparkles className="h-6 w-6" />
            {aiRecommendations && aiRecommendations.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                {aiRecommendations.length}
              </span>
            )}
          </div>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI Recommendations ✨
          </span>
        </button>
      </div>

      {/* AI Recommendations Dialog */}
      <Dialog open={showAIRecommendations} onOpenChange={setShowAIRecommendations}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              AI Smart Recommendations
            </DialogTitle>
            <DialogDescription>
              AI-powered insights to optimize your teacher load simulation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* AI Optimize School Button at Top - Always visible */}
            <div className="flex justify-end">
              <Button
                onClick={() => setShowOptimizeConfirm(true)}
                disabled={previewOptimize.isPending}
                className="bg-gradient-to-r from-green-700 to-emerald-800 hover:from-green-800 hover:to-emerald-900 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 transform text-sm py-2.5 px-6 relative overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></span>
                <span className="relative flex items-center">
                  {previewOptimize.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      AI Optimize School
                    </>
                  )}
                </span>
              </Button>
            </div>

            {/* Recommendations List */}
            {!aiRecommendations || aiRecommendations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recommendations available at the moment</p>
                <p className="text-sm mt-2">Your load distribution looks balanced!</p>
              </div>
            ) : (
              aiRecommendations.map((recommendation, index) => {
                const getIcon = () => {
                  switch (recommendation.type) {
                    case 'critical_alert':
                      return <AlertTriangle className="h-4 w-4" />;
                    case 'overload_warning':
                      return <AlertCircle className="h-4 w-4" />;
                    case 'redistribution_opportunity':
                      return <TrendingUp className="h-4 w-4" />;
                    case 'staffing_alert':
                      return <AlertCircle className="h-4 w-4" />;
                    case 'optimization':
                      return <TrendingUp className="h-4 w-4" />;
                    case 'sharing_opportunity':
                      return <Users className="h-4 w-4" />;
                    default:
                      return <Sparkles className="h-4 w-4" />;
                  }
                };

                const getColor = () => {
                  switch (recommendation.type) {
                    case 'critical_alert':
                      return 'bg-red-100 border-red-400 text-red-950 border-2 shadow-md';
                    case 'overload_warning':
                      return 'bg-orange-50 border-orange-300 text-orange-900';
                    case 'redistribution_opportunity':
                      return 'bg-emerald-50 border-emerald-200 text-emerald-900';
                    case 'staffing_alert':
                      return 'bg-red-50 border-red-200 text-red-900';
                    case 'optimization':
                      return 'bg-blue-50 border-blue-200 text-blue-900';
                    case 'sharing_opportunity':
                      return 'bg-green-50 border-green-200 text-green-900';
                    default:
                      return 'bg-purple-50 border-purple-200 text-purple-900';
                  }
                };

                return (
                  <div
                    key={index}
                    className={`p-2.5 border rounded-md ${getColor()} transition-all hover:shadow-sm relative`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {getIcon()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-normal leading-snug">{recommendation.message}</p>
                      </div>
                      {(recommendation as any).actionable && 
                       (recommendation as any).action && 
                       (recommendation as any).action.availableClassSubjects?.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setCurrentRecommendation(recommendation);
                            setReviewRecommendationOpen(true);
                          }}
                          className="bg-white hover:bg-green-100 text-green-700 border border-green-300 shadow-sm hover:shadow-md transition-all duration-200 text-xs px-3 py-1 h-auto"
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Recommendation Dialog */}
      <Dialog open={reviewRecommendationOpen} onOpenChange={setReviewRecommendationOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              Review Assignment Changes
            </DialogTitle>
            <DialogDescription>
              Review the changes before applying this recommendation
            </DialogDescription>
          </DialogHeader>

          {currentRecommendation && (currentRecommendation as any).action && (() => {
            const action = (currentRecommendation as any).action;
            
            return (
              <div className="space-y-6 mt-4">
                {/* Teacher Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900">
                        {action.teacherName}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-blue-700">
                          {(() => {
                            const teacher = simulation?.teachers.find(t => t.id === action.teacherId);
                            return teacher ? (
                              <>
                                <span className="font-medium">ID:</span> {teacher.employeeId} • 
                                <span className="font-medium">Capacity:</span> {teacher.maxPeriodsPerDay} periods/day
                              </>
                            ) : null;
                          })()}
                        </p>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">Will be assigned to the following subjects and classes</p>
                    </div>
                  </div>
                </div>

                {/* Changes Summary */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    New Assignments ({action.availableClassSubjects?.length || 0})
                  </h4>
                  
                  {action.availableClassSubjects && action.availableClassSubjects.length > 0 ? (
                    <div className="space-y-2">
                      {action.availableClassSubjects.map((classSubjectId: string) => {
                        const classSubject = simulation?.classSubjects.find(cs => cs.id === classSubjectId);
                        const classItem = simulation?.classes.find(c => c.id === classSubject?.classId);
                        const subject = simulation?.subjects.find(s => s.id === classSubject?.subjectId);
                        
                        console.log('Mapping classSubject:', classSubjectId, {
                          classSubject,
                          classItem,
                          subject
                        });
                        
                        if (!classSubject || !classItem || !subject) {
                          return (
                            <div 
                              key={classSubjectId}
                              className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
                            >
                              Unable to load details for assignment: {classSubjectId}
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={classSubjectId}
                            className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-green-600 p-1.5 rounded">
                                <BookOpen className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-green-900">
                                  {['Playschool', 'Pre-Nursery', 'Nursery', 'LKG', 'UKG'].includes(classItem.grade) ? classItem.grade : `Class ${classItem.grade}`}{classItem.section ? ` - ${classItem.section}` : ''}
                                </p>
                                <p className="text-sm text-green-700">{subject.name}</p>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-green-700">
                              {classSubject.weeklyPeriods} periods/week
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
                      No assignments available to display
                    </div>
                  )}
                </div>

                {/* Confirmation Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewRecommendationOpen(false);
                      setCurrentRecommendation(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const action = (currentRecommendation as any).action;
                      if (action.type === 'assign_teacher' && action.availableClassSubjects?.length > 0) {
                        executeRecommendation.mutate({
                          teacherId: action.teacherId,
                          teacherName: action.teacherName,
                          classSubjectIds: action.availableClassSubjects
                        });
                        setReviewRecommendationOpen(false);
                        setShowAIRecommendations(false);
                        setCurrentRecommendation(null);
                      }
                    }}
                    disabled={executeRecommendation.isPending}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  >
                    {executeRecommendation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm & Apply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Preview Optimization Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg">
                <Eye className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Confirm Auto-Optimization
              </span>
            </DialogTitle>
            <DialogDescription className="text-base">
              Review the changes that will be applied to your simulation
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-6 mt-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        {previewData.summary.periodsOptimized}
                      </div>
                      <div className="text-sm font-semibold text-blue-900">Periods to Optimize</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                        {previewData.summary.assignmentsCreated}
                      </div>
                      <div className="text-sm font-semibold text-indigo-900">Assignments to Create</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 text-2xl font-black mb-2">
                        <span className="text-gray-500">{previewData.summary.coverageBefore}%</span>
                        <ArrowRight className="h-5 w-5 text-cyan-600" />
                        <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                          {previewData.summary.coverageAfter}%
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-cyan-900">Coverage Improvement</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Changes Preview */}
              {previewData.optimizations.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    Changes to be Applied
                  </h3>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2">
                    {previewData.optimizations.map((opt, index) => (
                      <Card key={index} className="border border-blue-200 bg-blue-50/30 hover:shadow-md transition-all">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-1.5 rounded-lg">
                              <Info className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 flex items-center gap-2 text-sm">
                              <span className="font-bold text-gray-900">{formatClassName(opt.className)}</span>
                              <span className="text-gray-400">›</span>
                              <span className="font-semibold text-blue-700">{opt.subjectName}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                              <span className="font-semibold text-indigo-700">{opt.teacherName}</span>
                              <span className="ml-auto bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                {opt.periodsAssigned} periods
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Teachers Preview */}
              {previewData.teacherUtilization.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Affected Teachers (New Utilization)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {previewData.teacherUtilization.map((teacher) => {
                      const teacherColor = getTeacherColor(teacher.teacherId);
                      return (
                        <Card 
                          key={teacher.teacherId} 
                          className={`border-2 shadow-md ${teacherColor.bg} ${teacherColor.from} ${teacherColor.to} border-white/40`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className={`font-bold text-sm ${teacherColor.text}`}>{teacher.name}</div>
                                <div className={`text-xs ${teacherColor.text} opacity-75`}>
                                  {teacher.periodsAssigned}/{teacher.capacity} periods
                                </div>
                              </div>
                              <div className={`text-2xl font-black ${teacherColor.text}`}>
                                {teacher.utilization}%
                              </div>
                            </div>
                            <div className="bg-white/30 rounded-full h-2 ring-1 ring-black/10 shadow-inner overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                                  teacher.utilization >= 100 
                                    ? "bg-gradient-to-r from-red-500 to-red-600" 
                                    : teacher.utilization >= 80 
                                    ? "bg-gradient-to-r from-orange-500 to-orange-600" 
                                    : "bg-gradient-to-r from-emerald-500 to-teal-600"
                                }`}
                                style={{ width: `${Math.min(teacher.utilization, 100)}%` }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between gap-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(false)}
                  className="px-8 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => autoOptimize.mutate()}
                  disabled={autoOptimize.isPending}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all px-8"
                >
                  {autoOptimize.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Apply
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Optimization Summary Dialog */}
      <Dialog open={optimizeSummaryOpen} onOpenChange={setOptimizeSummaryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Optimization Complete
              </span>
            </DialogTitle>
            <DialogDescription className="text-base">
              Your simulation has been automatically optimized with AI-powered assignments
            </DialogDescription>
          </DialogHeader>

          {optimizeResult && (
            <div className="space-y-6 mt-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
                        {optimizeResult.summary.periodsOptimized}
                      </div>
                      <div className="text-sm font-semibold text-emerald-900">Periods Optimized</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        {optimizeResult.summary.assignmentsCreated}
                      </div>
                      <div className="text-sm font-semibold text-blue-900">Assignments Created</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 text-2xl font-black mb-2">
                        <span className="text-gray-500">{optimizeResult.summary.coverageBefore}%</span>
                        <ArrowRight className="h-5 w-5 text-purple-600" />
                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {optimizeResult.summary.coverageAfter}%
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-purple-900">Coverage Improvement</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Optimizations */}
              {optimizeResult.optimizations.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    Optimization Details
                  </h3>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2">
                    {optimizeResult.optimizations.map((opt, index) => (
                      <Card key={index} className="border border-gray-200 bg-white hover:shadow-md transition-all">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-1.5 rounded-lg">
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 flex items-center gap-2 text-sm">
                              <span className="font-bold text-gray-900">{formatClassName(opt.className)}</span>
                              <span className="text-gray-400">›</span>
                              <span className="font-semibold text-blue-700">{opt.subjectName}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                              <span className="font-semibold text-emerald-700">{opt.teacherName}</span>
                              <span className="ml-auto bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                {opt.periodsAssigned} periods
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Teachers */}
              {optimizeResult.teacherUtilization.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Affected Teachers
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {optimizeResult.teacherUtilization.map((teacher) => {
                      const teacherColor = getTeacherColor(teacher.teacherId);
                      return (
                        <Card 
                          key={teacher.teacherId} 
                          className={`border-2 shadow-md ${teacherColor.bg} ${teacherColor.from} ${teacherColor.to} border-white/40`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className={`font-bold text-sm ${teacherColor.text}`}>{teacher.name}</div>
                                <div className={`text-xs ${teacherColor.text} opacity-75`}>
                                  {teacher.periodsAssigned}/{teacher.capacity} periods
                                </div>
                              </div>
                              <div className={`text-2xl font-black ${teacherColor.text}`}>
                                {teacher.utilization}%
                              </div>
                            </div>
                            <div className="bg-white/30 rounded-full h-2 ring-1 ring-black/10 shadow-inner overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                                  teacher.utilization >= 100 
                                    ? "bg-gradient-to-r from-red-500 to-red-600" 
                                    : teacher.utilization >= 80 
                                    ? "bg-gradient-to-r from-orange-500 to-orange-600" 
                                    : "bg-gradient-to-r from-emerald-500 to-teal-600"
                                }`}
                                style={{ width: `${Math.min(teacher.utilization, 100)}%` }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => {
                    setOptimizeSummaryOpen(false);
                    queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${simulationId}`] });
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all px-8"
                >
                  View Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Optimization History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              Already Optimized
            </DialogTitle>
            <DialogDescription>
              All periods have been assigned. View your last optimization details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {simulation?.lastOptimizationAt && simulation?.lastOptimizationSummary ? (
              <>
                {/* Timestamp */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Info className="h-5 w-5" />
                    <div>
                      <div className="font-semibold">Last Optimization</div>
                      <div className="text-sm text-blue-600">
                        {new Date(simulation.lastOptimizationAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-600 font-medium mb-1">
                            Total Periods
                          </div>
                          <div className="text-3xl font-black text-blue-700">
                            {simulation.lastOptimizationSummary.periodsOptimized}
                          </div>
                        </div>
                        <TrendingUp className="h-10 w-10 text-blue-500 opacity-30" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-600 font-medium mb-1">
                            New Assignments
                          </div>
                          <div className="text-3xl font-black text-emerald-700">
                            {simulation.lastOptimizationSummary.assignmentsCreated}
                          </div>
                        </div>
                        <CheckCircle className="h-10 w-10 text-emerald-500 opacity-30" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-orange-600 font-medium mb-1">
                            Redistributions
                          </div>
                          <div className="text-3xl font-black text-orange-700">
                            {simulation.lastOptimizationSummary.redistributions || 0}
                          </div>
                        </div>
                        <Move className="h-10 w-10 text-orange-500 opacity-30" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Coverage Improvement */}
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-bold text-purple-700">Coverage Improvement</div>
                      <div className="text-2xl font-black text-purple-700">
                        {simulation.lastOptimizationSummary.coverageBefore}% → {simulation.lastOptimizationSummary.coverageAfter}%
                      </div>
                    </div>
                    <div className="bg-white/50 rounded-full h-3 ring-1 ring-purple-300 shadow-inner overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 shadow-sm"
                        style={{ width: `${simulation.lastOptimizationSummary.coverageAfter}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No optimization history found</p>
                <p className="text-xs text-gray-400 mt-1">This simulation hasn't been optimized yet</p>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => setHistoryOpen(false)}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-md hover:shadow-lg transition-all px-8"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Configuration Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all custom configuration values (periods/day, working days, and daily period limit) back to the default values from your timetable structure.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                updateConfigMutation.mutate({
                  teachingPeriodsPerDay: null,
                  workingDaysCount: null,
                  defaultMaxPeriodsPerDay: null
                });
                toast({
                  title: "Configuration Reset",
                  description: "Using default values from timetable structure",
                });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Auto Assign Confirmation Dialog */}
      <AlertDialog open={showAiAutoAssignConfirm} onOpenChange={setShowAiAutoAssignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Auto Assign Teachers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all existing assignments and automatically assign teachers to subjects using AI optimization. 
              The system will fill existing teachers to 90%+ utilization before creating new ones, with each teacher limited to maximum 2 different subject types.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                aiAutoAssignMutation.mutate();
                setShowAiAutoAssignConfirm(false);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Auto Assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Optimize School Confirmation Dialog */}
      <AlertDialog open={showOptimizeConfirm} onOpenChange={setShowOptimizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Optimize School?</AlertDialogTitle>
            <AlertDialogDescription>
              This will analyze your teacher assignments and provide AI-powered optimization recommendations to improve teacher utilization and workload distribution across your school.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                previewOptimize.mutate();
                setShowOptimizeConfirm(false);
              }}
              className="bg-gradient-to-r from-green-700 to-emerald-800 hover:from-green-800 hover:to-emerald-900"
            >
              <Zap className="h-4 w-4 mr-2" />
              Optimize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
