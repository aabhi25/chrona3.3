import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageLightbox } from "@/components/ImageLightbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherSchema } from "@shared/schema";
import { z } from "zod";
import { 
  ArrowLeft, User, Mail, Phone, IdCard, Calendar as CalendarIcon,
  BookOpen, Users, CheckCircle, XCircle, CalendarDays, Clock,
  FileText, TrendingUp, Activity, UserX, AlertTriangle,
  MapPin, Heart, UserCheck, CreditCard, ChevronLeft, ChevronRight,
  Settings, BarChart3, GripVertical, RotateCcw, Loader2, Edit, Link2, X
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { getCurrentDateIST, formatDateIST } from "@shared/utils/dateUtils";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTeacherProfileLayout } from '@/hooks/useTeacherProfileLayout';
import { useToast } from '@/hooks/use-toast';

interface Teacher {
  id: string;
  name: string;
  email: string;
  contactNumber?: string;
  schoolIdNumber?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  status?: 'active' | 'left_school' | 'on_leave';
  subjects: string[];
  classes: string[];
  maxDailyPeriods: number;
  // Additional personal information fields
  designation?: string;
  gender?: string;
  dateOfBirth?: string;
  fatherHusbandName?: string;
  address?: string;
  aadhar?: string;
  bloodGroup?: string;
  category?: string;
  religion?: string;
}

interface TeacherAttendance {
  id: string;
  teacherId: string;
  attendanceDate: string; // Fixed: API returns attendanceDate, not date
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave" | "late";
  reason?: string;
  leaveStartDate?: string;
  leaveEndDate?: string;
}

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  classId: string;
  subject?: { name: string; code: string };
  class?: { grade: string; section: string };
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

interface SubjectData {
  id: string;
  name: string;
  code: string;
}

interface ClassSubjectAssignment {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId?: string;
  weeklyFrequency: number;
  createdAt: string;
  updatedAt: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Teacher name is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  contactNumber: z.string().min(1, "Mobile number is required"),
  schoolIdNumber: z.string().optional(),
  schoolId: z.string(),
  
  aadhar: z.string().length(12, "Aadhaar number must be exactly 12 digits").regex(/^\d{12}$/, "Aadhaar number must contain only digits").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  designation: z.string().optional(),
  dateOfBirth: z.string().optional(),
  fatherHusbandName: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

type TeacherFormData = z.infer<typeof formSchema>;

const PersonalInformationCard = React.memo<{ 
  teacher: Teacher;
}>(({ teacher }) => {
  
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base flex items-center space-x-2">
          <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-800 dark:text-gray-200">Personal Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-6">
        <div className="flex items-start space-x-3">
          <IdCard className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">School ID</p>
            <p className="text-sm text-muted-foreground">{teacher.schoolIdNumber || 'Not Assigned'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Designation</p>
            <p className="text-sm text-muted-foreground">{teacher.designation || 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Gender</p>
            <p className="text-sm text-muted-foreground">{teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Date of Birth</p>
            <p className="text-sm text-muted-foreground">
              {teacher.dateOfBirth ? format(new Date(teacher.dateOfBirth), 'dd-MM-yyyy') : 'Not Provided'}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Father/Husband Name</p>
            <p className="text-sm text-muted-foreground">{teacher.fatherHusbandName || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Contact Number</p>
            <p className="text-sm text-muted-foreground">{teacher.contactNumber || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-muted-foreground break-words">{teacher.email || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Address</p>
            <p className="text-sm text-muted-foreground break-words">{teacher.address || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Aadhaar Number</p>
            <p className="text-sm text-muted-foreground">
              {teacher.aadhar ? `****-****-${teacher.aadhar.slice(-4)}` : 'Not Provided'}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Heart className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Blood Group</p>
            <p className="text-sm text-muted-foreground">{teacher.bloodGroup || 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Category</p>
            <p className="text-sm text-muted-foreground">{teacher.category ? teacher.category.toUpperCase() : 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Religion</p>
            <p className="text-sm text-muted-foreground">{teacher.religion || 'Not Specified'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

PersonalInformationCard.displayName = 'PersonalInformationCard';

const AttendanceSummaryCard = React.memo<{
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  attendancePercentage: number;
}>(({ presentDays, absentDays, leaveDays, attendancePercentage }) => {
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-800 dark:text-gray-200">Attendance Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-green-600">{attendancePercentage}%</div>
          <p className="text-sm text-muted-foreground">Attendance Rate</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-lg font-semibold text-green-600">{presentDays}</div>
            <p className="text-xs text-muted-foreground">Present</p>
          </div>
          
          <div>
            <div className="flex items-center justify-center mb-1">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-lg font-semibold text-red-600">{absentDays}</div>
            <p className="text-xs text-muted-foreground">Absent</p>
          </div>
          
          <div>
            <div className="flex items-center justify-center mb-1">
              <CalendarDays className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-lg font-semibold text-orange-600">{leaveDays}</div>
            <p className="text-xs text-muted-foreground">On Leave</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AttendanceSummaryCard.displayName = 'AttendanceSummaryCard';

const WeeklyScheduleCard = React.memo<{
  scheduleByDay: Record<string, TimetableEntry[]>;
}>(({ scheduleByDay }) => {
  const getSubjectColor = (subjectName: string) => {
    const colors = [
      { gradient: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)', text: '#1e40af', border: '#bfdbfe' },
      { gradient: 'linear-gradient(to bottom right, #faf5ff, #fce7f3)', text: '#7e22ce', border: '#e9d5ff' },
      { gradient: 'linear-gradient(to bottom right, #ecfdf5, #ccfbf1)', text: '#047857', border: '#a7f3d0' },
      { gradient: 'linear-gradient(to bottom right, #fff7ed, #fef3c7)', text: '#c2410c', border: '#fed7aa' },
      { gradient: 'linear-gradient(to bottom right, #fff1f2, #fce7f3)', text: '#be123c', border: '#fecdd3' },
      { gradient: 'linear-gradient(to bottom right, #ecfeff, #e0f2fe)', text: '#0e7490', border: '#a5f3fc' },
      { gradient: 'linear-gradient(to bottom right, #eef2ff, #f3e8ff)', text: '#4338ca', border: '#c7d2fe' },
      { gradient: 'linear-gradient(to bottom right, #f0fdfa, #ccfbf1)', text: '#0f766e', border: '#99f6e4' },
      { gradient: 'linear-gradient(to bottom right, #fdf4ff, #f3e8ff)', text: '#a21caf', border: '#f5d0fe' },
      { gradient: 'linear-gradient(to bottom right, #fffbeb, #fef9c3)', text: '#b45309', border: '#fde68a' },
      { gradient: 'linear-gradient(to bottom right, #f7fee7, #dcfce7)', text: '#4d7c0f', border: '#d9f99d' },
      { gradient: 'linear-gradient(to bottom right, #f0f9ff, #dbeafe)', text: '#0369a1', border: '#bae6fd' },
    ];
    
    let hash = 0;
    const prime = 31;
    for (let i = 0; i < subjectName.length; i++) {
      hash = (hash * prime + subjectName.charCodeAt(i)) & 0x7FFFFFFF;
    }
    hash = (hash + subjectName.length * 17) & 0x7FFFFFFF;
    const index = hash % colors.length;
    return colors[index];
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-800 dark:text-gray-200">Weekly Schedule</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {(() => {
          if (Object.keys(scheduleByDay).length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-4">No schedule available</p>;
          }

          const allEntries = Object.values(scheduleByDay).flat();
          const gridSchedule = allEntries.reduce((acc, entry) => {
            if (!acc[entry.day]) acc[entry.day] = {};
            acc[entry.day][entry.period] = entry;
            return acc;
          }, {} as Record<string, Record<number, TimetableEntry>>);

          const allPeriods = Array.from(new Set(allEntries.map(entry => entry.period))).sort((a, b) => a - b);
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

          return (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-7 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
                    <div className="p-3 border-r border-gray-200 font-semibold text-sm text-gray-700">
                      Period
                    </div>
                    {days.map(day => (
                      <div key={day} className="p-3 border-r border-gray-200 font-semibold text-sm text-gray-700 text-center capitalize">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {allPeriods.map((period, rowIndex) => (
                    <div key={period} className={`grid grid-cols-7 ${rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                      <div className="p-3 border-r border-b border-gray-200 font-medium text-sm text-gray-600 flex items-center">
                        {period}
                      </div>
                      
                      {days.map(day => {
                        const entry = gridSchedule[day]?.[period];
                        const colors = entry?.subject ? getSubjectColor(entry.subject.name) : null;
                        
                        return (
                          <div 
                            key={`${day}-${period}`} 
                            className="p-2 border-r border-b border-gray-200 text-center min-h-[3rem] flex items-center justify-center"
                          >
                            {entry ? (
                              <div className="w-full">
                                <div 
                                  className="rounded-md px-2 py-1.5 text-xs font-medium border"
                                  style={{
                                    background: colors?.gradient,
                                    color: colors?.text,
                                    borderColor: colors?.border
                                  }}
                                >
                                  <div className="font-bold">{entry.subject?.name || 'Subject'}</div>
                                  {entry.class && (
                                    <div className="text-xs opacity-75 mt-0.5">
                                      Class {entry.class.grade}{entry.class.section && entry.class.section !== '-' ? entry.class.section : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">-</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
});

WeeklyScheduleCard.displayName = 'WeeklyScheduleCard';

const TeachingAssignmentsCard = React.memo<{
  teachingAssignments: Array<{
    classData?: ClassData;
    subjects: Array<{ id?: string; name?: string; code?: string; weeklyFrequency: number }>;
    assignmentCount: number;
  }>;
  teacher: Teacher;
  setMaxPeriodsDialogOpen: (open: boolean) => void;
  setNewMaxPeriods: (periods: number) => void;
}>(({ teachingAssignments, teacher, setMaxPeriodsDialogOpen, setNewMaxPeriods }) => {
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-800 dark:text-gray-200">Teaching Assignments</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {teachingAssignments.length > 0 ? (
          <div className="space-y-3">
            {teachingAssignments.map((assignment) => (
              <div key={assignment.classData?.id} className="border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-indigo-900/30 dark:to-blue-900/30 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg">
                      <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-gray-100 text-base">Class {assignment.classData?.grade}{assignment.classData?.section}</div>
                      <div className="text-xs text-gray-600">{assignment.classData?.studentCount} students</div>
                    </div>
                  </div>
                  <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 text-xs">Active</Badge>
                </div>
                
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center space-x-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Subjects Taught</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {assignment.subjects.map((subject) => (
                      <div key={subject?.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md border border-indigo-100 dark:border-indigo-800 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gradient-to-br from-indigo-500 to-blue-500 dark:from-indigo-400 dark:to-blue-400 rounded-full"></div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{subject?.name}</div>
                            <div className="text-xs text-gray-500 flex items-center space-x-1.5">
                              <span>Code: {subject?.code}</span>
                              <span>•</span>
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">{subject?.weeklyFrequency}x/week</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs">Subject</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">This teacher is not teaching any class</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TeachingAssignmentsCard.displayName = 'TeachingAssignmentsCard';

const QuickLinksCard = React.memo<{
  teacher: Teacher;
  teacherAssignedRoles?: Array<{id: string; name: string; color: string}>;
  allRoles?: Array<{id: string; name: string; description: string; color: string}>;
  onRoleChange?: (roleIds: string[]) => void;
  isUpdatingRole?: boolean;
  setMaxPeriodsDialogOpen: (open: boolean) => void;
  setNewMaxPeriods: (periods: number) => void;
  setEditDialogOpen: (open: boolean) => void;
}>(({ teacher, teacherAssignedRoles = [], allRoles = [], onRoleChange, isUpdatingRole = false, setMaxPeriodsDialogOpen, setNewMaxPeriods, setEditDialogOpen }) => {
  const [rolesPopoverOpen, setRolesPopoverOpen] = React.useState(false);
  
  const handleRoleToggle = (roleId: string, isChecked: boolean) => {
    const currentRoleIds = teacherAssignedRoles.map(r => r.id);
    let newRoleIds: string[];
    
    if (isChecked) {
      newRoleIds = [...currentRoleIds, roleId];
    } else {
      newRoleIds = currentRoleIds.filter(id => id !== roleId);
    }
    
    onRoleChange?.(newRoleIds);
  };
  
  const handleRemoveRole = (roleId: string) => {
    const currentRoleIds = teacherAssignedRoles.map(r => r.id);
    const newRoleIds = currentRoleIds.filter(id => id !== roleId);
    onRoleChange?.(newRoleIds);
  };
  
  return (
    <Card className="shadow-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-b dark:border-gray-700 py-2 px-4">
        <CardTitle className="text-sm flex items-center space-x-2 text-gray-800 dark:text-gray-200">
          <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Quick Links</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {onRoleChange && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              Custom Roles
            </Label>
            
            <Popover open={rolesPopoverOpen} onOpenChange={setRolesPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[2.25rem] justify-start text-left font-normal"
                  disabled={isUpdatingRole}
                >
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  <span className="text-sm">
                    {teacherAssignedRoles.length > 0 
                      ? `${teacherAssignedRoles.length} role${teacherAssignedRoles.length > 1 ? 's' : ''} assigned`
                      : 'Select roles'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Assign Custom Roles</div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {allRoles.length > 0 ? (
                      allRoles.map((role) => (
                        <div key={role.id} className="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={teacherAssignedRoles.some(r => r.id === role.id)}
                            onCheckedChange={(checked) => handleRoleToggle(role.id, checked as boolean)}
                            disabled={isUpdatingRole}
                          />
                          <label
                            htmlFor={`role-${role.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }}></div>
                              <span className="text-sm font-medium">{role.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No custom roles available</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
              {teacherAssignedRoles.length > 0 ? (
                teacherAssignedRoles.map((role) => (
                  <Badge
                    key={role.id}
                    className="text-xs px-2 py-1 flex items-center gap-1"
                    style={{ backgroundColor: role.color, color: '#fff' }}
                  >
                    {role.name}
                    <button
                      onClick={() => handleRemoveRole(role.id)}
                      disabled={isUpdatingRole}
                      className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${role.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs">No custom roles</Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Assign custom roles to grant specific module permissions
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setEditDialogOpen(true)}
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-900/50 hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-900/50 dark:hover:to-indigo-900/70 border border-indigo-200 dark:border-indigo-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200 hover:shadow-md group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Edit className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200 text-center leading-tight">Modify Profile</span>
          </button>
          
          <button
            onClick={() => {
              setNewMaxPeriods(teacher.maxDailyPeriods);
              setMaxPeriodsDialogOpen(true);
            }}
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/50 dark:hover:to-blue-900/70 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 hover:shadow-md group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200 text-center leading-tight">Max Periods</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
});

QuickLinksCard.displayName = 'QuickLinksCard';

const AttendanceHistoryCard = React.memo<{
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  generateCalendarDays: (selectedMonth: Date) => Date[];
  getAttendanceForDate: (date: Date) => TeacherAttendance | undefined;
  getStatusDisplayText: (status: string | undefined) => string;
  getDayStatusDisplay: (date: Date) => React.ReactNode;
}>(({ selectedDate, setSelectedDate, generateCalendarDays, getAttendanceForDate, getStatusDisplayText, getDayStatusDisplay }) => {
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b dark:border-gray-700">
        <CardTitle className="text-base">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-gray-800 dark:text-gray-200">Attendance History</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                disabled={selectedDate <= new Date(2023, 0, 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium px-3 py-1 min-w-[80px] text-center">
                {format(selectedDate, "MMM yyyy")}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                disabled={selectedDate >= new Date()}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {generateCalendarDays(selectedDate).map((date, index) => {
              const attendanceRecord = getAttendanceForDate(date);
              const statusText = getStatusDisplayText(attendanceRecord?.status);
              const dateText = format(date, 'd MMM');
              const isCurrentMonth = isSameMonth(date, selectedDate);
              
              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div className="w-full h-12 relative cursor-pointer">
                      {getDayStatusDisplay(date)}
                    </div>
                  </TooltipTrigger>
                  {isCurrentMonth && (
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-medium">{dateText}</div>
                      <div className="text-gray-600 dark:text-gray-400">{statusText}</div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Legend:</div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded"></div>
                <span>Present</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded"></div>
                <span>Absent</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700 rounded"></div>
                <span>Late</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-700 rounded"></div>
                <span>Leave</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded"></div>
                <span>Not Marked</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AttendanceHistoryCard.displayName = 'AttendanceHistoryCard';

const SECTION_REGISTRY = [
  { id: 'personal-info', columnDefault: 'left', component: PersonalInformationCard },
  { id: 'attendance-summary', columnDefault: 'left', component: AttendanceSummaryCard },
  { id: 'weekly-schedule', columnDefault: 'left', component: WeeklyScheduleCard },
  { id: 'quick-links', columnDefault: 'right', component: QuickLinksCard },
  { id: 'teaching-assignments', columnDefault: 'right', component: TeachingAssignmentsCard },
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

export default function TeacherProfile() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/teacher/:id");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState<string>('');
  const [replacingTeacher, setReplacingTeacher] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string>('');
  const [maxPeriodsDialogOpen, setMaxPeriodsDialogOpen] = useState(false);
  const [newMaxPeriods, setNewMaxPeriods] = useState<number>(6);
  const [updatingMaxPeriods, setUpdatingMaxPeriods] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const teacherId = params?.id;

  if (!match || !teacherId) {
    setLocation("/teachers");
    return null;
  }

  // Fetch teacher details
  const { data: teacher, isLoading: teacherLoading, refetch: refetchTeacher } = useQuery<Teacher>({
    queryKey: ["/api/teachers", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${teacherId}`);
      return response.json() as Promise<Teacher>;
    },
  });

  // Fetch all classes to map teacher's classes
  const { data: allClasses = [] } = useQuery<ClassData[]>({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return response.json() as Promise<ClassData[]>;
    },
  });

  // Fetch all subjects to map teacher's subjects
  const { data: allSubjects = [] } = useQuery<SubjectData[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return response.json() as Promise<SubjectData[]>;
    },
  });

  // Fetch teacher's schedule
  const { data: schedule = [] } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/teachers", teacherId, "schedule"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${teacherId}/schedule`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's attendance for selected month
  const { data: attendance = [], refetch: refetchAttendance } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", teacherId, format(selectedDate, "yyyy-MM")],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
      const response = await apiRequest("GET", `/api/teacher-attendance?teacherId=${teacherId}&startDate=${startDate}&endDate=${endDate}`);
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: !!teacherId,
    staleTime: 30000, // Cache data for 30 seconds
    refetchInterval: 60000, // Refetch every minute for updates
  });

  // Fetch available teachers for replacement
  const { data: availableTeachers = [], refetch: refetchAvailableTeachers } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers/available-for-replacement", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/available-for-replacement/${teacherId}`);
      return response.json() as Promise<Teacher[]>;
    },
    enabled: !!teacherId && replaceDialogOpen,
  });

  // Fetch all class-subject assignments to get current teacher assignments
  const { data: allAssignments = [] } = useQuery<ClassSubjectAssignment[]>({
    queryKey: ["/api/class-subject-assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/class-subject-assignments");
      return response.json() as Promise<ClassSubjectAssignment[]>;
    },
  });

  // Fetch custom roles for assignment
  const { data: customRoles = [] } = useQuery<Array<{id: string; name: string; description: string; color: string}>>({
    queryKey: ["/api/custom-roles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/custom-roles");
      return response.json();
    },
  });

  // Fetch user account for this teacher (to get custom role assignment)
  const { data: teacherUser, refetch: refetchTeacherUser } = useQuery<{id: string; customRoleId: string | null; role: string}>({
    queryKey: ["/api/users/teacher", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users?teacherId=${teacherId}`);
      const users = await response.json();
      return users[0] || null;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's assigned custom roles
  const { data: teacherAssignedRoles = [], refetch: refetchAssignedRoles } = useQuery<Array<{id: string; name: string; color: string}>>({
    queryKey: ["/api/users", teacherUser?.id, "custom-roles"],
    queryFn: async () => {
      if (!teacherUser?.id) return [];
      const response = await apiRequest("GET", `/api/users/${teacherUser.id}/custom-roles`);
      return response.json();
    },
    enabled: !!teacherUser?.id,
  });

  // Mutation to assign custom roles
  const assignCustomRoleMutation = useMutation({
    mutationFn: async (customRoleIds: string[]) => {
      if (!teacherUser?.id) throw new Error("User not found");
      const response = await apiRequest("POST", `/api/users/${teacherUser.id}/assign-custom-role`, {
        customRoleIds
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Roles updated",
        description: "Custom roles have been updated successfully",
      });
      refetchAssignedRoles();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update roles",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Layout state and sensors for drag-and-drop
  const { layout, updateLayout, resetToDefault, isLoading: layoutLoading } = useTeacherProfileLayout(teacherId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Edit teacher form
  const editForm = useForm<TeacherFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: teacher?.name || "",
      email: teacher?.email || "",
      contactNumber: teacher?.contactNumber || "",
      schoolIdNumber: teacher?.schoolIdNumber || "",
      aadhar: teacher?.aadhar || "",
      gender: teacher?.gender as "male" | "female" | "other" | undefined,
      bloodGroup: teacher?.bloodGroup || "",
      designation: teacher?.designation || "",
      dateOfBirth: teacher?.dateOfBirth || "",
      fatherHusbandName: teacher?.fatherHusbandName || "",
      address: teacher?.address || "",
      category: teacher?.category || "",
      religion: teacher?.religion || "",
      profilePictureUrl: teacher?.profilePictureUrl || "",
      schoolId: teacher?.schoolId || "",
      isActive: teacher?.isActive ?? true
    }
  });

  // Update form when teacher data changes
  React.useEffect(() => {
    if (teacher && editDialogOpen) {
      editForm.reset({
        name: teacher.name,
        email: teacher.email || "",
        contactNumber: teacher.contactNumber || "",
        schoolIdNumber: teacher.schoolIdNumber || "",
        aadhar: teacher.aadhar || "",
        gender: teacher.gender as "male" | "female" | "other" | undefined,
        bloodGroup: teacher.bloodGroup || "",
        designation: teacher.designation || "",
        dateOfBirth: teacher.dateOfBirth || "",
        fatherHusbandName: teacher.fatherHusbandName || "",
        address: teacher.address || "",
        category: teacher.category || "",
        religion: teacher.religion || "",
        profilePictureUrl: teacher.profilePictureUrl || "",
        schoolId: teacher.schoolId,
        isActive: teacher.isActive
      });
    }
  }, [teacher, editDialogOpen, editForm]);

  // Update teacher mutation
  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeacherFormData }) => {
      const response = await apiRequest("PUT", `/api/teachers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setEditDialogOpen(false);
      setSelectedProfileImage(null);
      setProfileImagePreview(null);
      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update teacher",
        variant: "destructive",
      });
    },
  });

  // Helper functions for profile image handling
  const handleProfileImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
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
    reader.onloadend = () => {
      setProfileImagePreview(reader.result as string);
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
    const fileInput = document.getElementById('edit-profile-image-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleEditTeacher = async (data: TeacherFormData) => {
    if (!teacher) return;

    try {
      if (selectedProfileImage) {
        const profilePictureUrl = await uploadProfilePicture(teacher.id, selectedProfileImage);
        updateTeacherMutation.mutate({ 
          id: teacher.id, 
          data: { ...data, profilePictureUrl }
        });
      } else {
        updateTeacherMutation.mutate({ id: teacher.id, data });
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

  // Get teacher's current assignments from class-subject assignments table
  const teacherAssignments = allAssignments.filter(assignment => 
    assignment.assignedTeacherId === teacherId
  );
  
  // Group assignments by class to show class-subject pairings
  const assignmentsByClass = teacherAssignments.reduce((acc, assignment) => {
    const classId = assignment.classId;
    if (!acc[classId]) {
      acc[classId] = [];
    }
    acc[classId].push(assignment);
    return acc;
  }, {} as Record<string, ClassSubjectAssignment[]>);

  // Build teaching assignments data with class and subject details
  const teachingAssignments = Object.entries(assignmentsByClass).map(([classId, assignments]) => {
    const classData = allClasses.find(c => c.id === classId);
    const subjects = assignments.map(assignment => {
      const subject = allSubjects.find(s => s.id === assignment.subjectId);
      return {
        ...subject,
        weeklyFrequency: assignment.weeklyFrequency
      };
    }).filter(Boolean);
    
    return {
      classData,
      subjects,
      assignmentCount: assignments.length
    };
  }).filter(item => item.classData && item.subjects.length > 0);

  // Calculate attendance statistics
  const presentDays = attendance.filter(a => a.status === "present").length;
  const absentDays = attendance.filter(a => a.status === "absent").length;
  const leaveDays = attendance.filter(a => a.status === "sick_leave" || a.status === "personal_leave" || a.status === "medical_leave").length;
  const totalRecords = attendance.length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentDays / totalRecords) * 100) : 100;

  // Calculate teaching statistics for stat cards
  const uniquePeriods = new Set(schedule.map(entry => `${entry.day}-${entry.period}`));
  const periodsTaught = uniquePeriods.size;
  const teachingDays = new Set(schedule.map(entry => entry.day)).size || 6;
  
  // Calculate weekly capacity from max daily periods * working days
  const workingDaysCount = teacher?.availability 
    ? Object.values(teacher.availability).filter(Boolean).length 
    : 6;
  const weeklyCapacity = (teacher?.maxDailyPeriods || 6) * workingDaysCount;
  const utilizationPercentage = weeklyCapacity > 0 ? Math.round((periodsTaught / weeklyCapacity) * 100) : 0;

  // Group schedule by day
  const scheduleByDay = schedule.reduce((acc, entry) => {
    if (!acc[entry.day]) acc[entry.day] = [];
    acc[entry.day].push(entry);
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="default" className="bg-green-100 text-green-800">Present</Badge>;
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "sick_leave":
      case "personal_leave":
      case "medical_leave":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">On Leave</Badge>;
      case "late":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Late</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleReplaceTeacher = async () => {
    if (!selectedReplacement || !teacherId) return;

    setReplacingTeacher(true);
    setConflictWarning('');

    try {
      const response = await apiRequest("POST", "/api/teachers/replace", {
        originalTeacherId: teacherId,
        replacementTeacherId: selectedReplacement,
        reason: "Teacher replacement through profile"
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.conflicts && errorData.conflicts.length > 0) {
          setConflictWarning(`Warning: ${errorData.conflicts.length} scheduling conflicts detected.`);
          return;
        }
        throw new Error(errorData.message || "Failed to replace teacher");
      }

      const result = await response.json();
      setReplaceDialogOpen(false);
      setSelectedReplacement('');
      
      // Refresh teacher data
      window.location.reload();
    } catch (error) {
      console.error("Error replacing teacher:", error);
      setConflictWarning(error instanceof Error ? error.message : "Failed to replace teacher");
    } finally {
      setReplacingTeacher(false);
    }
  };

  const handleUpdateMaxPeriods = async () => {
    if (!teacherId || newMaxPeriods < 1 || newMaxPeriods > 10) return;

    setUpdatingMaxPeriods(true);

    try {
      const response = await apiRequest("PUT", "/api/teachers/daily-periods", {
        teacherId: teacherId,
        maxDailyPeriods: newMaxPeriods,
        applyToAll: false
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update max daily periods");
      }

      // Refresh teacher data
      await refetchTeacher();
      setMaxPeriodsDialogOpen(false);
    } catch (error) {
      console.error("Error updating max periods:", error);
      alert(error instanceof Error ? error.message : "Failed to update max daily periods");
    } finally {
      setUpdatingMaxPeriods(false);
    }
  };

  const getTeacherStatusBadge = (teacher: Teacher) => {
    if (teacher.status === 'left_school') {
      return <Badge variant="destructive" className="ml-2">Left School</Badge>;
    } else if (teacher.status === 'on_leave') {
      return <Badge variant="secondary" className="ml-2">On Leave</Badge>;
    } else if (!teacher.isActive) {
      return <Badge variant="outline" className="ml-2">Inactive</Badge>;
    }
    return <Badge variant="default" className="ml-2 bg-green-100 text-green-800">Active</Badge>;
  };

  // Generate calendar days for the selected month
  const generateCalendarDays = (selectedMonth: Date) => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday = 0
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  };

  // Precompute attendance lookup for performance
  const attendanceMap = useMemo(() => {
    const map = new Map<string, TeacherAttendance>();
    attendance.forEach(record => {
      const dateKey = format(new Date(record.attendanceDate), 'yyyy-MM-dd');
      map.set(dateKey, record);
    });
    return map;
  }, [attendance]);

  // Get attendance status for a specific date
  const getAttendanceForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return attendanceMap.get(dateKey);
  };

  // Get readable status text for tooltips
  const getStatusDisplayText = (status: string | undefined) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Late';
      case 'sick_leave':
      case 'personal_leave':
      case 'medical_leave':
        return 'On Leave';
      default:
        return 'Not Marked';
    }
  };

  // Get status display for calendar day
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
        case 'sick_leave':
        case 'personal_leave':
        case 'medical_leave':
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

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    
    const sectionName = SECTION_REGISTRY.find(s => s.id === event.active.id)?.id || 'card';
    const announcement = `Started dragging ${sectionName.replace(/-/g, ' ')}`;
    
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');
    ariaLive.className = 'sr-only';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedSection = SECTION_REGISTRY.find(s => s.id === active.id)?.id || 'card';
    
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) {
      const announcement = `Drag cancelled. ${draggedSection.replace(/-/g, ' ')} returned to original position`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('role', 'status');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.setAttribute('aria-atomic', 'true');
      ariaLive.className = 'sr-only';
      ariaLive.textContent = announcement;
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeInLeft = layout.leftColumn.includes(activeId);
    const activeInRight = layout.rightColumn.includes(activeId);
    const overInLeft = layout.leftColumn.includes(overId);
    const overInRight = layout.rightColumn.includes(overId);

    if (!activeInLeft && !activeInRight) {
      return;
    }

    let newLayout = { ...layout };

    if ((activeInLeft && overInLeft) || (activeInRight && overInRight)) {
      const column = activeInLeft ? 'leftColumn' : 'rightColumn';
      const items = layout[column];
      const oldIndex = items.indexOf(activeId);
      const newIndex = items.indexOf(overId);
      
      newLayout[column] = arrayMove(items, oldIndex, newIndex);
    } else {
      const sourceColumn = activeInLeft ? 'leftColumn' : 'rightColumn';
      const targetColumn = overInLeft ? 'leftColumn' : 'rightColumn';
      
      newLayout[sourceColumn] = layout[sourceColumn].filter(id => id !== activeId);
      
      const targetIndex = layout[targetColumn].indexOf(overId);
      newLayout[targetColumn] = [
        ...layout[targetColumn].slice(0, targetIndex),
        activeId,
        ...layout[targetColumn].slice(targetIndex)
      ];
    }

    updateLayout(newLayout);
    
    toast({
      title: "Layout saved",
      description: "Your profile layout has been updated successfully.",
      duration: 2000,
    });

    const announcement = `${draggedSection.replace(/-/g, ' ')} moved successfully. Layout saved.`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');
    ariaLive.className = 'sr-only';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  };

  const handleResetLayout = () => {
    resetToDefault();
    setResetDialogOpen(false);
    
    toast({
      title: "Layout reset",
      description: "Your profile layout has been reset to default.",
      duration: 2000,
    });

    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');
    ariaLive.className = 'sr-only';
    ariaLive.textContent = 'Layout reset to default successfully';
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  };

  if (teacherLoading) {
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

  if (!teacher) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">Teacher Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">The requested teacher profile could not be found.</p>
          <Button onClick={() => setLocation("/teachers")} className="mt-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
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
              onClick={() => setLocation("/teachers")}
              className="h-11 w-11 p-0 hover:bg-white/20 text-white"
              aria-label="Back to Teachers"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center space-x-4">
              {/* Profile Picture */}
              <div className="relative">
                {teacher.profilePictureUrl ? (
                  <div 
                    className="relative cursor-pointer" 
                    onClick={() => setIsPhotoModalOpen(true)}
                    title="Click to view full image"
                  >
                    <img
                      src={teacher.profilePictureUrl}
                      alt={`${teacher.name}'s profile`}
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
              
              {/* Teacher Name and Details */}
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-white mb-1">{teacher.name}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <IdCard className="h-4 w-4" />
                    <span className="text-sm">ID: {teacher.schoolIdNumber || 'Not Assigned'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{teacher.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getTeacherStatusBadge(teacher)}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-6">
        {/* Periods Taught - Blue */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Periods Taught</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-200">{periodsTaught}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">periods/week</p>
              </div>
              <div className="bg-blue-200 dark:bg-blue-800 p-3 rounded-full">
                <Clock className="h-8 w-8 text-blue-700 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Capacity - Green */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Weekly Capacity</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-200">{weeklyCapacity}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">max periods/week</p>
              </div>
              <div className="bg-emerald-200 dark:bg-emerald-800 p-3 rounded-full">
                <Users className="h-8 w-8 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilization - Purple */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Utilization</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-200">{utilizationPercentage}%</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">capacity used</p>
              </div>
              <div className="bg-purple-200 dark:bg-purple-800 p-3 rounded-full">
                <BarChart3 className="h-8 w-8 text-purple-700 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Layout Button */}
      <div className="px-4 md:px-6 flex justify-end">
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
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
                This will restore the default card arrangement. Your customization will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetLayout}>Reset Layout</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Mobile Info Message */}
      <div className="md:hidden px-4">
        <Alert className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
            Drag-and-drop is available on larger screens (tablets and desktops)
          </AlertDescription>
        </Alert>
      </div>

      {/* Main Content Grid - Drag and Drop Enabled */}
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
                  props = { 
                    teacher
                  };
                } else if (sectionId === 'attendance-summary') {
                  props = { presentDays, absentDays, leaveDays, attendancePercentage };
                } else if (sectionId === 'weekly-schedule') {
                  props = { scheduleByDay };
                } else if (sectionId === 'quick-links') {
                  props = { 
                    teacher,
                    teacherAssignedRoles,
                    allRoles: customRoles,
                    onRoleChange: (roleIds: string[]) => assignCustomRoleMutation.mutate(roleIds),
                    isUpdatingRole: assignCustomRoleMutation.isPending,
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods,
                    setEditDialogOpen
                  };
                } else if (sectionId === 'teaching-assignments') {
                  props = { 
                    teachingAssignments, 
                    teacher, 
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods 
                  };
                } else if (sectionId === 'attendance-history') {
                  props = { 
                    selectedDate, 
                    setSelectedDate, 
                    generateCalendarDays, 
                    getAttendanceForDate, 
                    getStatusDisplayText, 
                    getDayStatusDisplay 
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
                  props = { 
                    teacher
                  };
                } else if (sectionId === 'attendance-summary') {
                  props = { presentDays, absentDays, leaveDays, attendancePercentage };
                } else if (sectionId === 'weekly-schedule') {
                  props = { scheduleByDay };
                } else if (sectionId === 'quick-links') {
                  props = { 
                    teacher,
                    teacherAssignedRoles,
                    allRoles: customRoles,
                    onRoleChange: (roleIds: string[]) => assignCustomRoleMutation.mutate(roleIds),
                    isUpdatingRole: assignCustomRoleMutation.isPending,
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods,
                    setEditDialogOpen
                  };
                } else if (sectionId === 'teaching-assignments') {
                  props = { 
                    teachingAssignments, 
                    teacher, 
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods 
                  };
                } else if (sectionId === 'attendance-history') {
                  props = { 
                    selectedDate, 
                    setSelectedDate, 
                    generateCalendarDays, 
                    getAttendanceForDate, 
                    getStatusDisplayText, 
                    getDayStatusDisplay 
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

        {/* Mobile Single Column View */}
        <div className="lg:hidden px-4 md:px-6 space-y-2">
          {[...layout.leftColumn, ...layout.rightColumn].map((sectionId) => {
            const section = SECTION_REGISTRY.find(s => s.id === sectionId);
            if (!section) return null;

            const Component = section.component;
            let props: any = {};

            if (sectionId === 'personal-info') {
              props = { teacher };
            } else if (sectionId === 'attendance-summary') {
              props = { presentDays, absentDays, leaveDays, attendancePercentage };
            } else if (sectionId === 'weekly-schedule') {
              props = { scheduleByDay };
            } else if (sectionId === 'quick-links') {
              props = { 
                teacher, 
                teacherAssignedRoles,
                allRoles: customRoles,
                onRoleChange: (roleIds: string[]) => assignCustomRoleMutation.mutate(roleIds),
                isUpdatingRole: assignCustomRoleMutation.isPending,
                setMaxPeriodsDialogOpen, 
                setNewMaxPeriods,
                setEditDialogOpen
              };
            } else if (sectionId === 'teaching-assignments') {
              props = { 
                teachingAssignments, 
                teacher, 
                setMaxPeriodsDialogOpen, 
                setNewMaxPeriods 
              };
            } else if (sectionId === 'attendance-history') {
              props = { 
                selectedDate, 
                setSelectedDate, 
                generateCalendarDays, 
                getAttendanceForDate, 
                getStatusDisplayText, 
                getDayStatusDisplay 
              };
            }

            return <Component key={sectionId} {...props} />;
          })}
        </div>

        {/* DragOverlay for enhanced visual feedback */}
        <DragOverlay>
          {activeId ? (
            <div className="opacity-60 shadow-2xl transition-all">
              {(() => {
                const section = SECTION_REGISTRY.find(s => s.id === activeId);
                if (!section) return null;

                const Component = section.component;
                let props: any = {};

                if (activeId === 'personal-info') {
                  props = { 
                    teacher
                  };
                } else if (activeId === 'attendance-summary') {
                  props = { presentDays, absentDays, leaveDays, attendancePercentage };
                } else if (activeId === 'weekly-schedule') {
                  props = { scheduleByDay };
                } else if (activeId === 'quick-links') {
                  props = { 
                    teacher,
                    teacherAssignedRoles,
                    allRoles: customRoles,
                    onRoleChange: (roleIds: string[]) => assignCustomRoleMutation.mutate(roleIds),
                    isUpdatingRole: assignCustomRoleMutation.isPending,
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods,
                    setEditDialogOpen
                  };
                } else if (activeId === 'teaching-assignments') {
                  props = { 
                    teachingAssignments, 
                    teacher, 
                    setMaxPeriodsDialogOpen, 
                    setNewMaxPeriods 
                  };
                } else if (activeId === 'attendance-history') {
                  props = { 
                    selectedDate, 
                    setSelectedDate, 
                    generateCalendarDays, 
                    getAttendanceForDate, 
                    getStatusDisplayText, 
                    getDayStatusDisplay 
                  };
                }

                return <Component {...props} />;
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Max Daily Periods Dialog */}
      <Dialog open={maxPeriodsDialogOpen} onOpenChange={setMaxPeriodsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span>Update Max Daily Periods</span>
            </DialogTitle>
            <DialogDescription>
              Set the maximum number of periods {teacher.name} can teach per day (1-10).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">Max Daily Periods</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={newMaxPeriods}
                onChange={(e) => setNewMaxPeriods(Number(e.target.value))}
                className="w-full"
                placeholder="Enter max periods (1-10)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current value: {teacher.maxDailyPeriods} periods per day
              </p>
            </div>

            <div className="flex space-x-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setMaxPeriodsDialogOpen(false)}
                disabled={updatingMaxPeriods}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMaxPeriods}
                disabled={updatingMaxPeriods || newMaxPeriods < 1 || newMaxPeriods > 10}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updatingMaxPeriods ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
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
                  ) : teacher?.profilePictureUrl ? (
                    <>
                      <img 
                        src={teacher.profilePictureUrl} 
                        alt="Current profile" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      <button
                        type="button"
                        onClick={() => setProfileImagePreview(null)}
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
                      if (file) handleProfileImageSelect(file);
                    }}
                    className="hidden"
                    id="edit-profile-image-input"
                  />
                  <label
                    htmlFor="edit-profile-image-input"
                    className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    {teacher?.profilePictureUrl && !profileImagePreview ? 'Change Photo' : 'Choose Photo'}
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
                          <Input placeholder="Enter full name" {...field} />
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
                            <SelectTrigger>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select blood group" />
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
                            placeholder="e.g., General, OBC, SC/ST" 
                            {...field} 
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
                          placeholder="Enter full address" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={updateTeacherMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateTeacherMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updateTeacherMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Teacher"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Photo Modal */}
      {teacher.profilePictureUrl && (
        <ImageLightbox
          images={[teacher.profilePictureUrl]}
          isOpen={isPhotoModalOpen}
          currentIndex={0}
          onClose={() => setIsPhotoModalOpen(false)}
          onIndexChange={() => {}} // Single image, no navigation needed
        />
      )}
    </div>
  );
}