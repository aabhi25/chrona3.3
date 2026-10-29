import { useAuth } from "@/hooks/useAuth";
import { useViewedStudentId } from "@/hooks/useViewedStudentId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Newsfeed from "@/components/Newsfeed";
import { 
  Users, 
  MapPin, 
  BookOpen, 
  User, 
  GraduationCap, 
  MessageSquare, 
  Hash, 
  UserCheck,
  School,
  Mail,
  Phone,
  Calendar,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  admissionNumber: string;
  status: string;
}

interface ClassDetails {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  room?: string;
  schoolId: string;
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
}

interface Subject {
  id: string;
  name: string;
  code: string;
  periodsPerWeek: number;
  color: string;
  schoolId: string;
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
  teacherName: string;
  teacherEmail: string;
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

export default function MyClassPage() {
  const { user } = useAuth();
  const viewedStudentId = useViewedStudentId();

  // Fetch student details to get class information
  const { data: studentDetails, isLoading: loadingStudentDetails } = useQuery({
    queryKey: ["student-details", viewedStudentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students/${viewedStudentId}`);
      return await response.json();
    },
    enabled: !!viewedStudentId
  });

  // Class data query based on student's class
  const { data: classData, isLoading: isClassLoading } = useQuery<ClassDetails>({
    queryKey: ["/api/classes", studentDetails?.class?.id],
    enabled: !!studentDetails?.class?.id,
  });

  // Class students query
  const { data: classStudents, isLoading: loadingClassStudents } = useQuery({
    queryKey: ["class-students", studentDetails?.class?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/classes/${studentDetails?.class?.id}/students`);
      return await response.json();
    },
    enabled: !!studentDetails?.class?.id
  });

  // Class Subject Assignments query
  const { data: classSubjectAssignments = [], isLoading: isAssignmentsLoading } = useQuery<ClassSubjectAssignment[]>({
    queryKey: ["/api/class-subject-assignments", studentDetails?.class?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${studentDetails?.class?.id}`);
      return response.json() as Promise<ClassSubjectAssignment[]>;
    },
    enabled: !!studentDetails?.class?.id,
  });

  // Class Teacher Assignments query
  const { data: classTeacherAssignments = [], isLoading: isClassTeachersLoading } = useQuery<ClassTeacherAssignment[]>({
    queryKey: ["/api/classes", studentDetails?.class?.id, "teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/classes/${studentDetails?.class?.id}/teachers`);
      return response.json() as Promise<ClassTeacherAssignment[]>;
    },
    enabled: !!studentDetails?.class?.id,
  });

  // Timetable data query
  const { data: timetableData = [], isLoading: isTimetableLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable/detailed", studentDetails?.class?.id, "class"],
    queryFn: async () => {
      const params = new URLSearchParams({ classId: studentDetails?.class?.id || '' });
      const response = await apiRequest("GET", `/api/timetable/detailed?${params.toString()}`);
      return response.json() as Promise<TimetableEntry[]>;
    },
    enabled: !!studentDetails?.class?.id,
    staleTime: 0,
  });

  if (user?.role !== "student" && user?.role !== "parent") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground">This page is only available to students.</p>
        </div>
      </div>
    );
  }

  // Get teachers specifically assigned to this class through subject assignments
  const classTeachers = classSubjectAssignments
    .filter(assignment => assignment.assignedTeacher)
    .map(assignment => assignment.assignedTeacher)
    .filter((teacher, index, self) => 
      teacher && self.findIndex(t => t?.id === teacher.id) === index
    ) as Teacher[];

  const uniqueSubjects = Array.from(new Set(timetableData.map(entry => entry.subject?.name).filter(Boolean)));

  // Format time display
  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="container mx-auto py-8 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col">
            {loadingStudentDetails ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <h1 className="text-lg md:text-xl font-semibold leading-tight" data-testid="class-name">
                {studentDetails?.class ? 
                  `Class ${studentDetails.class.grade} ${studentDetails.class.section}` : 
                  'My Class'
                }
              </h1>
            )}
            <p className="text-sm text-muted-foreground">
              Your class overview, classmates, and timetable
            </p>
          </div>
        </div>
      </div>

      {/* Class Overview Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {loadingClassStudents ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-xl font-bold" data-testid="student-count">{classStudents?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total classmates</p>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {isAssignmentsLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-xl font-bold" data-testid="teacher-count">{classTeachers.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Teaching subjects</p>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {isTimetableLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-xl font-bold" data-testid="subject-count">{uniqueSubjects.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total subjects</p>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Room</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            {isClassLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <div className="text-xl font-bold" data-testid="class-room">{classData?.room || studentDetails?.class?.room || "Not set"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Class location</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Class Feed and Class Info */}
      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feed" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Class Feed</span>
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center space-x-2">
            <School className="h-4 w-4" />
            <span>Class Info</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="feed" className="space-y-2 mt-6">
          <Newsfeed feedScope="class" classId={studentDetails?.class?.id} />
        </TabsContent>

        <TabsContent value="info" className="space-y-2 mt-6">
          
          {/* My Classmates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5" />
                <span>My Classmates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClassStudents ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : classStudents?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No classmates found</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {classStudents?.map((student: Student) => (
                    <div
                      key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        student.id === viewedStudentId 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                      data-testid={`student-${student.id}`}
                    >
                      <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-600">
                        <AvatarFallback className="text-xs font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                          {student.firstName?.[0]}{student.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100" data-testid={`text-student-name-${student.id}`}>
                            {student.firstName} {student.lastName}
                            {student.id === viewedStudentId && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-normal ml-1">(You)</span>
                            )}
                          </p>
                          <Badge 
                            variant={student.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {student.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            <span>Roll: {student.rollNumber || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Subjects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Class Subjects</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : classSubjectAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No subjects assigned</h3>
                  <p className="text-muted-foreground">
                    This class doesn't have any subjects assigned yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {classSubjectAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant="secondary" 
                            className="text-sm px-2 py-1" 
                            data-testid={`subject-${assignment.id}`}
                          >
                            <span style={{ color: assignment.subject?.color || "#3B82F6" }}>
                              {assignment.subject?.name || "Unknown Subject"}
                            </span>
                            <span className="ml-1 text-muted-foreground">
                              ({assignment.subject?.code || "N/A"})
                            </span>
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {assignment.weeklyFrequency} periods/week
                          </div>
                          {assignment.assignedTeacher && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {assignment.assignedTeacher.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Teachers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Class Teachers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isClassTeachersLoading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
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
                  {classTeacherAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            {assignment.teacherName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{assignment.teacherName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={assignment.role === 'primary' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {assignment.role === 'primary' ? 'Primary Teacher' : 'Co-Class Teacher'}
                            </Badge>
                          </div>
                          {assignment.teacherEmail && (
                            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {assignment.teacherEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}