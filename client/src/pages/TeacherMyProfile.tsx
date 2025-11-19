import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, User, Mail, Phone, IdCard, Calendar as CalendarIcon,
  BookOpen, Users, CheckCircle, XCircle, CalendarDays, Clock,
  FileText, TrendingUp, Activity,
  MapPin, Heart, UserCheck, CreditCard, ChevronLeft, ChevronRight,
  Link2, BarChart3
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfYear, endOfYear } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImageLightbox } from "@/components/ImageLightbox";

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
  attendanceDate: string;
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave" | "late";
  reason?: string;
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

const PersonalInformationCard = React.memo<{ teacher: Teacher }>(({ teacher }) => {
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
          <IdCard className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">School ID</p>
            <p className="text-sm text-muted-foreground">{teacher.schoolIdNumber || 'Not Assigned'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Designation</p>
            <p className="text-sm text-muted-foreground">{teacher.designation || 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Gender</p>
            <p className="text-sm text-muted-foreground">{teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Date of Birth</p>
            <p className="text-sm text-muted-foreground">
              {teacher.dateOfBirth ? format(new Date(teacher.dateOfBirth), 'dd-MM-yyyy') : 'Not Provided'}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Father/Husband Name</p>
            <p className="text-sm text-muted-foreground">{teacher.fatherHusbandName || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Contact Number</p>
            <p className="text-sm text-muted-foreground">{teacher.contactNumber || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-muted-foreground break-words">{teacher.email || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Address</p>
            <p className="text-sm text-muted-foreground break-words">{teacher.address || 'Not Provided'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Aadhaar Number</p>
            <p className="text-sm text-muted-foreground">
              {teacher.aadhar ? `****-****-${teacher.aadhar.slice(-4)}` : 'Not Provided'}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Heart className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Blood Group</p>
            <p className="text-sm text-muted-foreground">{teacher.bloodGroup || 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Category</p>
            <p className="text-sm text-muted-foreground">{teacher.category ? teacher.category.toUpperCase() : 'Not Specified'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
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
}>(({ teachingAssignments }) => {
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
                <div className="flex items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg">
                      <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="font-bold text-gray-900 dark:text-gray-100 text-base">
                      Class {assignment.classData?.grade}{assignment.classData?.section ? `-${assignment.classData.section}` : ''}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center space-x-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Subjects Taught</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {assignment.subjects.map((subject) => (
                      <div key={subject?.id} className="flex items-center p-2 bg-white dark:bg-gray-800 rounded-md border border-indigo-100 dark:border-indigo-800 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">You are not teaching any class currently</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TeachingAssignmentsCard.displayName = 'TeachingAssignmentsCard';

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

export default function TeacherMyProfile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const teacherId = user?.teacherId;

  // Fetch teacher details
  const { data: teacher, isLoading: teacherLoading } = useQuery<Teacher>({
    queryKey: ["/api/teachers", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${teacherId}`);
      return response.json() as Promise<Teacher>;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's timetable
  const { data: timetable = [] } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/timetable?teacherId=${teacherId}`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher attendance for current year
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());
  const { data: attendanceRecords = [] } = useQuery<TeacherAttendance[]>({
    queryKey: ["/api/teacher-attendance", teacherId, yearStart, yearEnd],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/teacher-attendance?teacherId=${teacherId}&startDate=${format(yearStart, 'yyyy-MM-dd')}&endDate=${format(yearEnd, 'yyyy-MM-dd')}`
      );
      return response.json() as Promise<TeacherAttendance[]>;
    },
    enabled: !!teacherId,
  });

  // Fetch teaching assignments
  const { data: assignmentsData = [] } = useQuery({
    queryKey: ["/api/class-subject-assignments", teacherId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/class-subject-assignments?teacherId=${teacherId}`);
      return response.json();
    },
    enabled: !!teacherId,
  });

  const scheduleByDay = React.useMemo(() => {
    return timetable.reduce((acc, entry) => {
      if (!acc[entry.day]) {
        acc[entry.day] = [];
      }
      acc[entry.day].push(entry);
      return acc;
    }, {} as Record<string, TimetableEntry[]>);
  }, [timetable]);

  // Process teaching assignments
  const teachingAssignments = React.useMemo(() => {
    const classMap = new Map();
    
    assignmentsData.forEach((assignment: any) => {
      const classId = assignment.classId;
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          classData: {
            id: assignment.classId,
            grade: assignment.classGrade,
            section: assignment.classSection,
            studentCount: 0,
          },
          subjects: [],
          assignmentCount: 0,
        });
      }
      
      const classEntry = classMap.get(classId);
      classEntry.subjects.push({
        id: assignment.subject?.id,
        name: assignment.subject?.name,
        code: assignment.subject?.code,
        weeklyFrequency: assignment.weeklyFrequency,
      });
      classEntry.assignmentCount++;
    });
    
    return Array.from(classMap.values());
  }, [assignmentsData]);

  // Calculate total periods from weekly frequencies
  const totalPeriods = React.useMemo(() => {
    return assignmentsData.reduce((total: number, assignment: any) => {
      return total + (assignment.weeklyFrequency || 0);
    }, 0);
  }, [assignmentsData]);

  // Calculate attendance statistics
  const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
  const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
  const leaveDays = attendanceRecords.filter(r => 
    r.status === 'sick_leave' || r.status === 'personal_leave' || r.status === 'medical_leave'
  ).length;
  const totalDays = attendanceRecords.length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // Calendar helper functions
  const generateCalendarDays = (selectedMonth: Date) => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const getAttendanceForDate = (date: Date) => {
    return attendanceRecords.find(record => 
      isSameDay(new Date(record.attendanceDate), date)
    );
  };

  const getStatusDisplayText = (status: string | undefined): string => {
    if (!status) return "Not marked";
    const statusMap: Record<string, string> = {
      present: "Present",
      absent: "Absent",
      late: "Late",
      sick_leave: "Sick Leave",
      personal_leave: "Personal Leave",
      medical_leave: "Medical Leave",
    };
    return statusMap[status] || status;
  };

  const getDayStatusDisplay = (date: Date) => {
    const attendance = getAttendanceForDate(date);
    const isCurrentMonth = isSameMonth(date, selectedDate);
    
    let bgClass = "bg-white dark:bg-gray-800";
    let borderClass = "border-2 border-dashed border-gray-200 dark:border-gray-700";
    
    if (attendance) {
      switch (attendance.status) {
        case "present":
          bgClass = "bg-green-100 dark:bg-green-900/50";
          borderClass = "border border-green-200 dark:border-green-700";
          break;
        case "absent":
          bgClass = "bg-red-100 dark:bg-red-900/50";
          borderClass = "border border-red-200 dark:border-red-700";
          break;
        case "late":
          bgClass = "bg-yellow-100 dark:bg-yellow-900/50";
          borderClass = "border border-yellow-200 dark:border-yellow-700";
          break;
        case "sick_leave":
        case "personal_leave":
        case "medical_leave":
          bgClass = "bg-orange-100 dark:bg-orange-900/50";
          borderClass = "border border-orange-200 dark:border-orange-700";
          break;
      }
    }
    
    return (
      <div
        className={`w-full h-full rounded-lg flex items-center justify-center text-sm font-medium ${bgClass} ${borderClass} ${
          isCurrentMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"
        }`}
      >
        {format(date, "d")}
      </div>
    );
  };

  if (teacherLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse"></div>
        <div className="container mx-auto p-6 space-y-6 max-w-7xl -mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-64 animate-pulse bg-gray-200 dark:bg-gray-700"></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">Profile Not Found</h2>
          <p className="text-muted-foreground">Unable to load your profile information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 pb-20 pt-3 px-4">
        <div className="container mx-auto max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 mb-3"
            onClick={() => setLocation('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar 
                  className="h-20 w-20 border-4 border-white shadow-xl cursor-pointer"
                  onClick={() => teacher.profilePictureUrl && setIsPhotoModalOpen(true)}
                >
                  {teacher.profilePictureUrl ? (
                    <AvatarImage src={teacher.profilePictureUrl} alt={teacher.name} />
                  ) : (
                    <AvatarFallback className="text-2xl font-bold bg-white text-indigo-600">
                      {teacher.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{teacher.name}</h1>
                <div className="flex items-center space-x-3 text-white/90 text-sm">
                  <div className="flex items-center space-x-1">
                    <IdCard className="h-4 w-4" />
                    <span>ID: {teacher.schoolIdNumber || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Mail className="h-4 w-4" />
                    <span>{teacher.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Phone className="h-4 w-4" />
                    <span>{teacher.contactNumber || 'No contact'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Badge className={`
              ${teacher.status === 'active' ? 'bg-green-500 hover:bg-green-500' : 
                teacher.status === 'on_leave' ? 'bg-orange-500 hover:bg-orange-500' : 
                'bg-gray-500 hover:bg-gray-500'} 
              text-white capitalize
            `}>
              {teacher.status || 'active'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container mx-auto max-w-7xl px-4 -mt-16 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Classes</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{teachingAssignments.length}</p>
                </div>
                <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Total Periods</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{totalPeriods}</p>
                </div>
                <div className="p-3 bg-purple-200 dark:bg-purple-800 rounded-full">
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-1">Max Daily Periods</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{teacher.maxDailyPeriods}</p>
                </div>
                <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full">
                  <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profile Content */}
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <PersonalInformationCard teacher={teacher} />
            <AttendanceSummaryCard
              presentDays={presentDays}
              absentDays={absentDays}
              leaveDays={leaveDays}
              attendancePercentage={attendancePercentage}
            />
            <WeeklyScheduleCard scheduleByDay={scheduleByDay} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <TeachingAssignmentsCard teachingAssignments={teachingAssignments} />
            <AttendanceHistoryCard
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              generateCalendarDays={generateCalendarDays}
              getAttendanceForDate={getAttendanceForDate}
              getStatusDisplayText={getStatusDisplayText}
              getDayStatusDisplay={getDayStatusDisplay}
            />
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {teacher.profilePictureUrl && (
        <ImageLightbox
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          images={[teacher.profilePictureUrl]}
          currentIndex={0}
          onIndexChange={() => {}}
        />
      )}
    </div>
  );
}
