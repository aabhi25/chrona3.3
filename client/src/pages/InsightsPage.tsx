import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Users, GraduationCap, UserCheck, Building, TrendingUp, CheckCircle, XCircle, Clock, Sparkles, Lightbulb, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export default function InsightsPage() {
  const { user } = useAuth();

  // Fetch students
  const { data: studentsResponse } = useQuery({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/students?limit=10000");
      return await response.json();
    },
  });

  // Fetch teachers
  const { data: teachersResponse } = useQuery({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teachers?limit=10000");
      return await response.json();
    },
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return await response.json();
    },
  });

  // Fetch today's student attendance
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: todayStudentAttendance = [] } = useQuery({
    queryKey: ["/api/student-attendance", today],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/student-attendance?date=${today}`);
      return await response.json();
    },
  });

  // Fetch today's teacher attendance
  const { data: todayTeacherAttendance = [] } = useQuery({
    queryKey: ["/api/teacher-attendance", today],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teacher-attendance");
      return await response.json();
    },
  });

  // Fetch class-subject assignments
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["/api/class-subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/class-subjects");
      return await response.json();
    },
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subjects");
      return await response.json();
    },
  });

  // Fetch AI Timetable Insights
  const { data: aiInsights = [], isLoading: isLoadingInsights } = useQuery<Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string }>>({
    queryKey: ["/api/ai-timetable-insights"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ai-timetable-insights");
      return await response.json();
    },
  });

  const students = studentsResponse?.students || [];
  const teachers = teachersResponse?.teachers || [];
  
  // Calculate metrics
  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  
  // Student attendance calculations
  const presentStudents = todayStudentAttendance.filter((a: any) => a.status === "present").length;
  const absentStudents = todayStudentAttendance.filter((a: any) => a.status === "absent").length;
  const lateStudents = todayStudentAttendance.filter((a: any) => a.status === "late").length;
  const studentAttendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;
  
  // Teacher attendance calculations
  const presentTeachers = todayTeacherAttendance.filter((a: any) => a.status === "present").length;
  const absentTeachers = todayTeacherAttendance.filter((a: any) => a.status === "absent").length;
  const onLeaveTeachers = todayTeacherAttendance.filter((a: any) => a.status === "on_leave").length;
  const teacherAttendanceRate = totalTeachers > 0 ? Math.round((presentTeachers / totalTeachers) * 100) : 0;

  // Use AI insights instead of local analysis
  const suggestions = aiInsights;

  // Legacy local analysis (kept as fallback, but not used anymore)
  const legacySuggestions = useMemo(() => {
    const suggestions: Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string }> = [];

    // Analyze teacher workload
    const teacherWorkload = teachers.map((teacher: any) => {
      const assignedSubjects = classSubjects.filter((cs: any) => cs.teacherId === teacher.id);
      const totalPeriods = assignedSubjects.reduce((sum: number, cs: any) => sum + (cs.weeklyPeriods || 0), 0);
      const maxPeriods = (teacher.maxPeriodsPerDay || 7) * 6; // Assuming 6 working days
      const uniqueSubjects = new Set(assignedSubjects.map((cs: any) => cs.subjectId)).size;
      
      return {
        teacher,
        totalPeriods,
        maxPeriods,
        utilizationRate: maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0,
        uniqueSubjects,
        assignedSubjects: assignedSubjects.length
      };
    });

    // Find underutilized teachers
    const underutilizedTeachers = teacherWorkload.filter((tw: any) => tw.utilizationRate < 60 && tw.totalPeriods > 0);
    if (underutilizedTeachers.length > 0) {
      const teacher = underutilizedTeachers[0];
      suggestions.push({
        type: 'info',
        title: 'Teacher Capacity Available',
        description: `${teacher.teacher.name} is teaching ${teacher.totalPeriods} periods/week (${Math.round(teacher.utilizationRate)}% utilized). They can handle ${teacher.maxPeriods - teacher.totalPeriods} more periods.`
      });
    }

    // Find teachers teaching very few subjects
    const teachersWithFewSubjects = teacherWorkload.filter((tw: any) => tw.uniqueSubjects === 1 && tw.assignedSubjects > 1);
    if (teachersWithFewSubjects.length > 0) {
      const teacher = teachersWithFewSubjects[0];
      suggestions.push({
        type: 'success',
        title: 'Subject Specialization Detected',
        description: `${teacher.teacher.name} is specialized in 1 subject across ${teacher.assignedSubjects} classes. This promotes teaching consistency.`
      });
    }

    // Optimal teacher count analysis
    const totalRequiredPeriods = classSubjects.reduce((sum: number, cs: any) => sum + (cs.weeklyPeriods || 0), 0);
    const avgPeriodsPerTeacher = 35; // Average 35 periods per teacher per week
    const optimalTeacherCount = Math.ceil(totalRequiredPeriods / avgPeriodsPerTeacher);
    
    if (totalTeachers > optimalTeacherCount + 3) {
      suggestions.push({
        type: 'warning',
        title: 'Optimal Staffing Analysis',
        description: `School can function efficiently with ${optimalTeacherCount} teachers. Current count: ${totalTeachers}. Consider optimizing teacher allocation.`
      });
    } else if (totalTeachers >= optimalTeacherCount) {
      suggestions.push({
        type: 'success',
        title: 'Well-Staffed School',
        description: `Current teacher count (${totalTeachers}) is optimal for ${totalRequiredPeriods} weekly periods across all classes.`
      });
    }

    // Attendance insights
    if (studentAttendanceRate >= 95) {
      suggestions.push({
        type: 'success',
        title: 'Excellent Student Attendance',
        description: `Outstanding ${studentAttendanceRate}% student attendance rate today. Keep up the great work!`
      });
    } else if (studentAttendanceRate < 85) {
      suggestions.push({
        type: 'warning',
        title: 'Attention: Low Student Attendance',
        description: `Student attendance is ${studentAttendanceRate}% today. ${absentStudents} students are absent. Consider investigating causes.`
      });
    }

    if (teacherAttendanceRate >= 95) {
      suggestions.push({
        type: 'success',
        title: 'Excellent Teacher Attendance',
        description: `Strong ${teacherAttendanceRate}% teacher attendance rate today. All classes are well-covered.`
      });
    } else if (absentTeachers > 2) {
      suggestions.push({
        type: 'warning',
        title: 'Teacher Absence Alert',
        description: `${absentTeachers} teachers are absent today. Ensure substitute arrangements are in place.`
      });
    }

    // Class-to-student ratio
    const avgStudentsPerClass = totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;
    if (avgStudentsPerClass > 45) {
      suggestions.push({
        type: 'warning',
        title: 'High Student-Class Ratio',
        description: `Average ${avgStudentsPerClass} students per class. Consider adding more sections for better learning outcomes.`
      });
    } else if (avgStudentsPerClass >= 25 && avgStudentsPerClass <= 35) {
      suggestions.push({
        type: 'success',
        title: 'Optimal Class Size',
        description: `Average ${avgStudentsPerClass} students per class is ideal for effective teaching and student engagement.`
      });
    }

    // Teachers with versatile subject teaching
    const versatileTeachers = teacherWorkload.filter((tw: any) => tw.uniqueSubjects >= 3);
    if (versatileTeachers.length > 0) {
      const teacher = versatileTeachers[0];
      suggestions.push({
        type: 'info',
        title: 'Versatile Educator Identified',
        description: `${teacher.teacher.name} teaches ${teacher.uniqueSubjects} different subjects. Such versatility adds flexibility to scheduling.`
      });
    }

    return suggestions;
  }, [teachers, classSubjects, totalStudents, totalClasses, studentAttendanceRate, teacherAttendanceRate, absentStudents, absentTeachers]);

  return (
    <div className="container mx-auto p-3 md:p-4 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-600" />
          Insights
        </h1>
        <p className="text-sm text-muted-foreground">Track your school performance and student engagement</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Students Card */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-sm text-gray-500 mt-1">Enrolled students</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Teachers Card */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-sm">
                <UserCheck className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900">{totalTeachers}</p>
              <p className="text-sm text-gray-500 mt-1">Active faculty members</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Classes Card */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm">
                <Building className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{totalClasses}</p>
              <p className="text-sm text-gray-500 mt-1">Active class sections</p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Attendance Rate Card */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">Student Attendance</p>
              <p className="text-3xl font-bold text-gray-900">{studentAttendanceRate}%</p>
              <p className="text-sm text-gray-500 mt-1">{presentStudents} of {totalStudents} present today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Student Attendance Details */}
        <Card className="border border-gray-200 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">Student Attendance Details</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">Today's student attendance breakdown</p>
            
            <div className="space-y-2">
              {/* Present */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Present</p>
                    <p className="text-sm text-gray-600">Students attended today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{presentStudents}</p>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-0.5 text-sm px-2 py-0">
                    {studentAttendanceRate}%
                  </Badge>
                </div>
              </div>

              {/* Absent */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm">
                    <XCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Absent</p>
                    <p className="text-sm text-gray-600">Students not present</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">{absentStudents}</p>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mt-0.5 text-sm px-2 py-0">
                    {totalStudents > 0 ? Math.round((absentStudents / totalStudents) * 100) : 0}%
                  </Badge>
                </div>
              </div>

              {/* Late */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full shadow-sm">
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Late</p>
                    <p className="text-sm text-gray-600">Students arrived late</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-600">{lateStudents}</p>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mt-0.5 text-sm px-2 py-0">
                    {totalStudents > 0 ? Math.round((lateStudents / totalStudents) * 100) : 0}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Attendance Details */}
        <Card className="border border-gray-200 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-gray-900">Teacher Attendance Details</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">Today's teacher attendance breakdown</p>
            
            <div className="space-y-2">
              {/* Present */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Present</p>
                    <p className="text-sm text-gray-600">Teachers attended today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{presentTeachers}</p>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-0.5 text-sm px-2 py-0">
                    {teacherAttendanceRate}%
                  </Badge>
                </div>
              </div>

              {/* Absent */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm">
                    <XCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Absent</p>
                    <p className="text-sm text-gray-600">Teachers not present</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">{absentTeachers}</p>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mt-0.5 text-sm px-2 py-0">
                    {totalTeachers > 0 ? Math.round((absentTeachers / totalTeachers) * 100) : 0}%
                  </Badge>
                </div>
              </div>

              {/* On Leave */}
              <div className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-sm">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">On Leave</p>
                    <p className="text-sm text-gray-600">Teachers on approved leave</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-600">{onLeaveTeachers}</p>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mt-0.5 text-sm px-2 py-0">
                    {totalTeachers > 0 ? Math.round((onLeaveTeachers / totalTeachers) * 100) : 0}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions Section */}
      <Card className="border border-gray-200 shadow-lg">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h3 className="text-base font-bold text-gray-900">AI-Powered Insights</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">Smart recommendations to improve school operations</p>
          
          <div className="space-y-2">
            {isLoadingInsights ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-purple-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <p className="text-sm font-medium">Analyzing timetable data...</p>
                </div>
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-md border-0 shadow-sm ${
                    suggestion.type === 'success'
                      ? 'bg-gradient-to-br from-green-50 to-white'
                      : suggestion.type === 'warning'
                      ? 'bg-gradient-to-br from-amber-50 to-white'
                      : 'bg-gradient-to-br from-blue-50 to-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`p-1.5 rounded-full shadow-sm ${
                        suggestion.type === 'success'
                          ? 'bg-gradient-to-br from-green-500 to-green-600'
                          : suggestion.type === 'warning'
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600'
                      }`}
                    >
                      {suggestion.type === 'success' ? (
                        <CheckCircle className="h-3 w-3 text-white" />
                      ) : suggestion.type === 'warning' ? (
                        <AlertCircle className="h-3 w-3 text-white" />
                      ) : (
                        <Lightbulb className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm mb-0.5">{suggestion.title}</p>
                      <p className="text-sm text-gray-700">{suggestion.description}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No suggestions available at the moment</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
