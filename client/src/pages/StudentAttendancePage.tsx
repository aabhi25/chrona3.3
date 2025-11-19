import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  TrendingUp,
  Award,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  isSameDay,
  startOfYear,
  differenceInDays
} from "date-fns";

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get attendance for current month
  const { data: monthAttendance = [] } = useQuery({
    queryKey: ["student-attendance-month", user?.studentId, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/student-attendance?studentId=${user?.studentId}&startDate=${format(monthStart, 'yyyy-MM-dd')}&endDate=${format(monthEnd, 'yyyy-MM-dd')}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    enabled: user?.role === 'student' && !!user?.studentId
  });

  // Get attendance for entire year for insights
  const yearStart = startOfYear(new Date());
  const yearEnd = new Date();
  const { data: yearAttendance = [] } = useQuery({
    queryKey: ["student-attendance-year", user?.studentId, format(yearStart, 'yyyy-MM-dd'), format(yearEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/student-attendance?studentId=${user?.studentId}&startDate=${format(yearStart, 'yyyy-MM-dd')}&endDate=${format(yearEnd, 'yyyy-MM-dd')}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    enabled: user?.role === 'student' && !!user?.studentId
  });

  if (user?.role !== 'student') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground">This page is only available to students.</p>
        </div>
      </div>
    );
  }

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAttendanceForDate = (date: Date) => {
    return monthAttendance.find((a: any) => 
      isSameDay(new Date(a.attendanceDate), date)
    );
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Calculate statistics
  const monthPresent = monthAttendance.filter((a: any) => a.status === 'present').length;
  const monthAbsent = monthAttendance.filter((a: any) => a.status === 'absent').length;
  const monthLate = monthAttendance.filter((a: any) => a.status === 'late').length;
  const monthTotal = monthAttendance.length;
  const monthRate = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;

  const yearPresent = yearAttendance.filter((a: any) => a.status === 'present').length;
  const yearTotal = yearAttendance.length;
  const yearRate = yearTotal > 0 ? Math.round((yearPresent / yearTotal) * 100) : 0;

  // Calculate streak
  const sortedAttendance = [...yearAttendance].sort((a: any, b: any) => 
    new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime()
  );
  
  let currentStreak = 0;
  for (const record of sortedAttendance) {
    if (record.status === 'present') {
      currentStreak++;
    } else {
      break;
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-500 text-white';
      case 'absent':
        return 'bg-red-500 text-white';
      case 'late':
        return 'bg-orange-500 text-white';
      case 'leave':
        return 'bg-blue-500 text-white';
      default:
        return '';
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 border-b px-6 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">My Attendance</h2>
            <p className="text-white/90">Track your attendance and view insights</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">This Month</p>
                    <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{monthRate}%</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {monthPresent} of {monthTotal} days
                    </p>
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
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">Overall Rate</p>
                    <p className="text-4xl font-bold text-green-900 dark:text-green-100">{yearRate}%</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {yearPresent} of {yearTotal} days
                    </p>
                  </div>
                  <div className="p-4 bg-green-200 dark:bg-green-800 rounded-full">
                    <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Current Streak</p>
                    <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">{currentStreak}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">consecutive days</p>
                  </div>
                  <div className="p-4 bg-purple-200 dark:bg-purple-800 rounded-full">
                    <Award className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">This Month</p>
                    <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">{monthAbsent}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      absent, {monthLate} late
                    </p>
                  </div>
                  <div className="p-4 bg-orange-200 dark:bg-orange-800 rounded-full">
                    <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendar */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Attendance Calendar
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
                  <span className="text-sm font-medium min-w-[140px] text-center">
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
            <CardContent className="p-4">
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

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-xs font-semibold text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((day, index) => {
                  const attendance = getAttendanceForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={index}
                      className={`
                        relative h-12 flex items-center justify-center rounded-md text-sm font-medium
                        transition-all duration-200
                        ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-700' : ''}
                        ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                        ${attendance ? getStatusColor(attendance.status) : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}
                        ${attendance ? 'shadow-sm hover:shadow-md hover:scale-105' : ''}
                      `}
                    >
                      <span className={isToday && !attendance ? 'text-indigo-600 font-bold' : ''}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
