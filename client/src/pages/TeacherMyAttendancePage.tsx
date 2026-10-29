import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, UserCheck, UserX, Clock, TrendingUp, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { getCurrentDateIST } from "@shared/utils/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLocation } from "wouter";

interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  attendanceDate: string;
  status: "present" | "absent" | "sick_leave" | "personal_leave" | "medical_leave";
  leaveStartDate?: string;
  leaveEndDate?: string;
  reason?: string;
  markedAt: string;
}

interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  attendancePercentage: number;
}

export default function TeacherMyAttendancePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Fetch teacher's own attendance records for the selected month
  const { data: attendanceRecords = [], isLoading, error } = useQuery<TeacherAttendanceRecord[]>({
    queryKey: ["/api/teacher-attendance/my-attendance", format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/teacher-attendance/my-attendance?month=${format(selectedMonth, "yyyy-MM")}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch attendance records");
      }
      return response.json();
    },
    enabled: !!user?.teacherId,
  });

  // Calculate statistics
  const stats: AttendanceStats = {
    totalDays: attendanceRecords.length,
    presentDays: attendanceRecords.filter((r) => r.status === "present").length,
    absentDays: attendanceRecords.filter((r) => r.status === "absent").length,
    leaveDays: attendanceRecords.filter((r) => 
      r.status === "sick_leave" || r.status === "personal_leave" || r.status === "medical_leave"
    ).length,
    attendancePercentage: attendanceRecords.length > 0 
      ? Math.round((attendanceRecords.filter((r) => r.status === "present").length / attendanceRecords.length) * 100)
      : 0,
  };

  // Get days of the selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get attendance for selected date
  const selectedDateRecord = selectedDate
    ? attendanceRecords.find((r) => isSameDay(parseISO(r.attendanceDate), selectedDate))
    : null;

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-500">Present</Badge>;
      case "absent":
        return <Badge className="bg-red-500">Absent</Badge>;
      case "sick_leave":
        return <Badge className="bg-yellow-500">Sick Leave</Badge>;
      case "personal_leave":
        return <Badge className="bg-blue-500">Personal Leave</Badge>;
      case "medical_leave":
        return <Badge className="bg-orange-500">Medical Leave</Badge>;
      default:
        return <Badge variant="outline">Not Marked</Badge>;
    }
  };

  // Get day status for calendar
  const getDayStatus = (day: Date) => {
    const record = attendanceRecords.find((r) => isSameDay(parseISO(r.attendanceDate), day));
    return record?.status;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-purple-600" />
            My Attendance
          </h1>
          <p className="text-sm text-muted-foreground">
            View your attendance history and insights
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">
                {error instanceof Error ? error.message : "Failed to load attendance records"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Present Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold">{stats.presentDays}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leave Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div className="text-2xl font-bold">{stats.leaveDays}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attendance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <div className="text-2xl font-bold">{stats.attendancePercentage}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance Calendar</CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedMonth, "MMMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={(date) => date && setSelectedMonth(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  modifiers={{
                    present: daysInMonth.filter((day) => getDayStatus(day) === "present"),
                    absent: daysInMonth.filter((day) => getDayStatus(day) === "absent"),
                    leave: daysInMonth.filter(
                      (day) =>
                        getDayStatus(day) === "sick_leave" ||
                        getDayStatus(day) === "personal_leave" ||
                        getDayStatus(day) === "medical_leave"
                    ),
                  }}
                  modifiersStyles={{
                    present: {
                      backgroundColor: "rgb(34 197 94)",
                      color: "white",
                      fontWeight: "bold",
                    },
                    absent: {
                      backgroundColor: "rgb(239 68 68)",
                      color: "white",
                      fontWeight: "bold",
                    },
                    leave: {
                      backgroundColor: "rgb(234 179 8)",
                      color: "white",
                      fontWeight: "bold",
                    },
                  }}
                  className="rounded-md border"
                />
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500"></div>
                    <span>Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span>Absent</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, "dd MMMM yyyy") : "Select a Date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              selectedDateRecord ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    {getStatusBadge(selectedDateRecord.status)}
                  </div>

                  {selectedDateRecord.reason && (
                    <div>
                      <span className="text-sm font-medium">Reason:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedDateRecord.reason}
                      </p>
                    </div>
                  )}

                  {(selectedDateRecord.leaveStartDate || selectedDateRecord.leaveEndDate) && (
                    <div>
                      <span className="text-sm font-medium">Leave Period:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedDateRecord.leaveStartDate &&
                          format(parseISO(selectedDateRecord.leaveStartDate), "dd MMM yyyy")}
                        {" - "}
                        {selectedDateRecord.leaveEndDate &&
                          format(parseISO(selectedDateRecord.leaveEndDate), "dd MMM yyyy")}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-sm font-medium">Marked At:</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(parseISO(selectedDateRecord.markedAt), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No attendance record for this date</p>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a date to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance ({format(selectedMonth, "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : attendanceRecords.length > 0 ? (
            <div className="space-y-2">
              {attendanceRecords
                .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime())
                .slice(0, 10)
                .map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => setSelectedDate(parseISO(record.attendanceDate))}
                  >
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{format(parseISO(record.attendanceDate), "dd MMMM yyyy")}</p>
                        {record.reason && (
                          <p className="text-sm text-muted-foreground">{record.reason}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No attendance records found for this month</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
