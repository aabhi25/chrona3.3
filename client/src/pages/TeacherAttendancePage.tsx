import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Users, UserCheck, UserX, Clock, AlertCircle, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { getCurrentDateIST } from "@shared/utils/dateUtils";
import { sortClasses } from "@shared/classUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface ClassData {
  id: string;
  classId: string;
  classGrade: string;
  classSection: string;
  className: string;
  studentCount: number;
  room: string;
  isPrimary: boolean;
  role: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  classId: string;
}

interface StudentAttendance {
  id: string;
  studentId: string;
  classId: string;
  attendanceDate: string;
  status: "present" | "absent" | "late";
  reason?: string;
  markedAt: string;
}

export default function TeacherAttendancePage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateIST());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch classes where teacher is class teacher
  const { data: classesData, isLoading: classesLoading } = useQuery<{ classes: ClassData[] }>({
    queryKey: ["/api/teachers", user?.teacherId, "class-teacher-classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${user?.teacherId}/class-teacher-classes`);
      return response.json();
    },
    enabled: !!user?.teacherId,
  });

  const classes = classesData?.classes || [];
  const sortedClasses = [...classes].sort((a, b) => {
    const gradeA = parseInt(a.classGrade) || 0;
    const gradeB = parseInt(b.classGrade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;
    return (a.classSection || '').localeCompare(b.classSection || '');
  });

  // Fetch students for selected class
  const { data: studentsData, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students", selectedClass],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students?classId=${selectedClass}`);
      const data = await response.json();
      return data.students || [];
    },
    enabled: !!selectedClass,
  });

  const students = studentsData || [];

  // Fetch attendance for selected class and date
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<StudentAttendance[]>({
    queryKey: ["/api/student-attendance", selectedClass, selectedDate],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/student-attendance?classId=${selectedClass}&date=${selectedDate}`);
      return response.json();
    },
    enabled: !!selectedClass && !!selectedDate,
  });

  const attendance = attendanceData || [];

  // Mark student attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async (data: { studentId: string; status: string }) => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/student-attendance", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          studentId: data.studentId,
          classId: selectedClass,
          attendanceDate: selectedDate,
          status: data.status,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark student attendance");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-attendance", selectedClass, selectedDate] });
      toast({
        title: "Success",
        description: "Student attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark student attendance",
        variant: "destructive",
      });
    },
  });

  // Bulk mark all present mutation
  const markAllPresentMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/student-attendance/mark-all-present", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          classId: selectedClass,
          date: selectedDate,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to mark all students present");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-attendance", selectedClass, selectedDate] });
      toast({
        title: "Success",
        description: "All students marked present",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all students present",
        variant: "destructive",
      });
    },
  });

  const getStudentAttendanceStatus = (studentId: string) => {
    return attendance.find(a => a.studentId === studentId);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Not marked</Badge>;
    
    switch (status) {
      case "present":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">Present</Badge>;
      case "absent":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">Absent</Badge>;
      case "late":
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">Late</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleStudentAttendance = (studentId: string, status: "present" | "absent" | "late") => {
    markAttendanceMutation.mutate({ studentId, status });
  };

  // Filter students based on search term
  const filteredStudents = students.filter((student) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      (student.firstName + " " + student.lastName).toLowerCase().includes(searchLower) ||
      student.rollNumber?.toLowerCase().includes(searchLower)
    );
  });

  const selectedClassData = classes.find(c => c.classId === selectedClass);
  const isToday = selectedDate === getCurrentDateIST();

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
              <p className="text-muted-foreground">This page is only available to teachers.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Student Attendance</h1>
          <p className="text-muted-foreground">Mark attendance for your class</p>
        </div>
      </div>

      {/* Class Selection and Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Class and Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Class</label>
              {classesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : classes.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">You are not assigned as class teacher to any class</p>
                </div>
              ) : (
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedClasses.map((classItem) => (
                      <SelectItem key={classItem.classId} value={classItem.classId}>
                        Class {classItem.classGrade}{classItem.classSection ? `-${classItem.classSection}` : ''} ({classItem.studentCount} students)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(new Date(selectedDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate ? new Date(selectedDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(format(date, "yyyy-MM-dd"));
                        setIsDatePickerOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      {selectedClass && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Student List - Class {selectedClassData?.classGrade}{selectedClassData?.classSection ? `-${selectedClassData.classSection}` : ''}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              <Button
                onClick={() => markAllPresentMutation.mutate()}
                disabled={markAllPresentMutation.isPending || students.length === 0}
                size="sm"
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Mark All Present
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            {students.length > 0 && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search students by name or roll number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {searchTerm && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing {filteredStudents.length} of {students.length} students
                  </p>
                )}
              </div>
            )}

            {studentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No students found in this class</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No students found matching "{searchTerm}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const attendanceStatus = getStudentAttendanceStatus(student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {student.firstName[0]}{student.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.firstName} {student.lastName}</p>
                          <p className="text-sm text-muted-foreground">Roll No: {student.rollNumber}</p>
                          <div className="mt-2">
                            {getStatusBadge(attendanceStatus?.status)}
                          </div>
                        </div>
                      </div>
                      
                      {isToday && (
                        <div className="flex justify-end">
                          <Select 
                            value={attendanceStatus?.status || ""} 
                            onValueChange={(value) => handleStudentAttendance(student.id, value as "present" | "absent" | "late")}
                            disabled={markAttendanceMutation.isPending}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Mark attendance" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="h-4 w-4 text-green-600" />
                                  Present
                                </div>
                              </SelectItem>
                              <SelectItem value="absent">
                                <div className="flex items-center gap-2">
                                  <UserX className="h-4 w-4 text-red-600" />
                                  Absent
                                </div>
                              </SelectItem>
                              <SelectItem value="late">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                  Late
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
