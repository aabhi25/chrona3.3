import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Newsfeed from "@/components/Newsfeed";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Users,
  MapPin,
  BookOpen,
  MessageSquare,
  Settings,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Class {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  requiredSubjects: string[];
  schoolId: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
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
  profilePictureUrl?: string;
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

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  classId?: string;
  schoolId: string;
  rollNumber?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianContact?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  isActive: boolean;
  status: "active" | "inactive" | "graduated" | "transferred";
  createdAt: string;
  updatedAt: string;
}

export default function TeacherClassDetailPage() {
  const [, params] = useRoute("/my-classes/:id");
  const { user } = useAuth();
  const classId = params?.id;

  const {
    data: classData,
    isLoading: isClassLoading,
    error: classError,
  } = useQuery<Class>({
    queryKey: ["/api/classes", classId],
    enabled: !!classId,
  });

  const {
    data: studentsResponse,
    isLoading: isStudentsLoading,
  } = useQuery<{ students: Student[], totalCount: number }>({
    queryKey: ["/api/students", classId, "teacher-view"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students?classId=${classId}&limit=1000`);
      return response.json();
    },
    enabled: !!classId,
  });

  const students = studentsResponse?.students || [];

  const {
    data: classSubjectAssignments = [],
    isLoading: isAssignmentsLoading,
  } = useQuery<ClassSubjectAssignment[]>({
    queryKey: ["/api/class-subject-assignments", classId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${classId}`);
      return response.json() as Promise<ClassSubjectAssignment[]>;
    },
    enabled: !!classId,
  });

  if (user?.role !== 'teacher') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
              <p className="text-muted-foreground">This page is only available to teachers.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isClassLoading) {
    return (
      <div className="container mx-auto py-4 md:py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (classError || !classData) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-destructive">Error Loading Class</h2>
              <p className="text-muted-foreground">Unable to load class details. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const className = classData.section 
    ? `Class ${classData.grade}-${classData.section}`
    : `Class ${classData.grade}`;

  return (
    <div className="container mx-auto py-4 md:py-8 space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/my-class">
          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {className}
            </h1>
            {classData.room && (
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {classData.room}
              </Badge>
            )}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {classData.studentCount} {classData.studentCount === 1 ? 'student' : 'students'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            View class feed and configuration
          </p>
        </div>
      </div>

      <Tabs defaultValue="feed" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Class Feed
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <Newsfeed 
            feedScope="class" 
            classId={classId}
            showPostForm={true}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{classData.studentCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Total Subjects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{classSubjectAssignments.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Room Number
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{classData.room || 'N/A'}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Students ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStudentsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students in this class</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`/api/students/${student.id}/profile-picture`} />
                        <AvatarFallback className="text-xs">
                          {student.firstName[0]}{student.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.rollNumber ? `Roll No: ${student.rollNumber}` : 'No roll number'}
                        </p>
                      </div>
                      {student.status !== 'active' && (
                        <Badge variant="outline" className="text-xs">
                          {student.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Subjects & Teachers ({classSubjectAssignments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : classSubjectAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No subjects assigned to this class</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classSubjectAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: assignment.subject.color }}
                          />
                          <h4 className="font-medium">{assignment.subject.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {assignment.assignedTeacher?.name || 'No teacher assigned'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {assignment.weeklyFrequency} {assignment.weeklyFrequency === 1 ? 'period' : 'periods'}/week
                      </Badge>
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
