import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewedStudentId } from "@/hooks/useViewedStudentId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Calendar, 
  Phone, 
  MapPin, 
  Users, 
  GraduationCap, 
  Mail, 
  ArrowLeft,
  CheckCircle,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Activity
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { useLocation } from "wouter";
import TeacherMyProfile from "./TeacherMyProfile";

export default function MyProfilePage() {
  const { user } = useAuth();
  const viewedStudentId = useViewedStudentId();
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // If user is a teacher, render teacher profile
  if (user?.role === 'teacher') {
    return <TeacherMyProfile />;
  }

  // Student profile logic below
  const { data: studentDetails, isLoading: loadingStudentDetails } = useQuery({
    queryKey: ["student-details", viewedStudentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students/${viewedStudentId}`);
      return await response.json();
    },
    enabled: !!viewedStudentId
  });

  const { data: parentsData = [] } = useQuery({
    queryKey: ["student-parents", viewedStudentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students/${viewedStudentId}/parents`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    enabled: !!viewedStudentId
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student-attendance-month", viewedStudentId, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/student-attendance?studentId=${viewedStudentId}&startDate=${format(monthStart, 'yyyy-MM-dd')}&endDate=${format(monthEnd, 'yyyy-MM-dd')}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    enabled: !!viewedStudentId
  });

  if (user?.role !== "student" && user?.role !== "parent") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground">This page is only available to students and teachers.</p>
        </div>
      </div>
    );
  }

  const getStudentClass = () => {
    if (!studentDetails?.class) return "Not Assigned";
    return `${studentDetails.class.grade} ${studentDetails.class.section}`;
  };

  const presentDays = attendanceData.filter((a: any) => a.status === 'present').length;
  const totalDays = attendanceData.length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAttendanceForDate = (date: Date) => {
    return attendanceData.find((a: any) => 
      isSameDay(new Date(a.attendanceDate), date)
    );
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  if (loadingStudentDetails) {
    return (
      <div className="min-h-screen">
        <div className="h-20 bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse"></div>
        <div className="container mx-auto p-6 space-y-6 max-w-7xl -mt-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-32 animate-pulse bg-gray-200 dark:bg-gray-700"></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 pb-8 pt-3 px-4">
        <div className="container mx-auto max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 mb-2"
            onClick={() => setLocation('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
                <AvatarFallback className="text-lg font-bold bg-white text-indigo-600">
                  {studentDetails?.firstName?.[0]}{studentDetails?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h1 className="text-xl font-bold text-white mb-0.5">
                  {studentDetails?.firstName} {studentDetails?.lastName}
                </h1>
                <div className="flex items-center gap-3 text-white/90 text-xs">
                  <div className="flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Admission: {studentDetails?.admissionNumber}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>Class: {getStudentClass()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Badge className="bg-green-500 hover:bg-green-500 text-white capitalize px-2.5 py-0.5 text-xs">
              {studentDetails?.status || 'active'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl -mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Attendance Rate</p>
                  <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{attendanceRate}%</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">this month</p>
                </div>
                <div className="p-4 bg-blue-200 dark:bg-blue-800 rounded-full">
                  <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-1">Present Days</p>
                  <p className="text-4xl font-bold text-green-900 dark:text-green-100">{presentDays}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">out of {totalDays} days</p>
                </div>
                <div className="p-4 bg-green-200 dark:bg-green-800 rounded-full">
                  <Calendar className="h-8 w-8 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Active Parents</p>
                  <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">{parentsData.length}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">guardians registered</p>
                </div>
                <div className="p-4 bg-purple-200 dark:bg-purple-800 rounded-full">
                  <Users className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Admission Number</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {studentDetails?.admissionNumber || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Class</p>
                  <p className="text-sm text-muted-foreground">
                    {getStudentClass()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Roll Number</p>
                  <p className="text-sm text-muted-foreground">
                    {studentDetails?.rollNumber || 'Not Assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Contact Number</p>
                  <p className="text-sm text-muted-foreground">
                    {studentDetails?.contactNumber || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {studentDetails?.email || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Gender</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {studentDetails?.gender || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Date of Birth</p>
                  <p className="text-sm text-muted-foreground">
                    {studentDetails?.dateOfBirth ? format(new Date(studentDetails.dateOfBirth), 'dd-MM-yyyy') : 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Blood Group</p>
                  <p className="text-sm text-muted-foreground">
                    {studentDetails?.bloodGroup || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Address</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {studentDetails?.address || 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Emergency Contact</p>
                  <p className="text-sm text-muted-foreground">
                    {studentDetails?.emergencyContact || 'Not Provided'}
                  </p>
                </div>
              </div>

              {studentDetails?.medicalInfo && (
                <div className="flex items-start gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Medical Information</p>
                    <p className="text-sm text-muted-foreground">
                      {studentDetails.medicalInfo}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Parents & Guardians
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {parentsData.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No parents added yet</h3>
                    <p className="text-sm text-muted-foreground">Contact your school administrator to add parents</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parentsData.map((sp: any) => (
                      <div key={sp.id} className="p-4 border rounded-lg dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                              {sp.parent?.firstName?.[0]}{sp.parent?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {sp.parent?.firstName} {sp.parent?.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {sp.relationship || 'Guardian'}
                            </p>
                          </div>
                        </div>
                        {sp.parent?.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            <Mail className="h-3 w-3" />
                            <span>{sp.parent.email}</span>
                          </div>
                        )}
                        {sp.parent?.contactNumber && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{sp.parent.contactNumber}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Attendance History
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreviousMonth}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextMonth}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-xs text-muted-foreground">Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-xs text-muted-foreground">Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-orange-500"></div>
                    <span className="text-xs text-muted-foreground">Late</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span className="text-xs text-muted-foreground">Leave</span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const attendance = getAttendanceForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    
                    return (
                      <div
                        key={index}
                        className={`
                          aspect-square flex items-center justify-center rounded-lg text-sm
                          ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-700' : ''}
                          ${attendance?.status === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium' : ''}
                          ${attendance?.status === 'absent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium' : ''}
                          ${attendance?.status === 'late' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium' : ''}
                          ${attendance?.status === 'leave' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : ''}
                          ${!attendance && isCurrentMonth ? 'text-gray-900 dark:text-gray-100' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-lg bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg flex-shrink-0">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Profile Management</h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Your profile information is managed by your school administration. If you need to update any details, please contact your school office.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
