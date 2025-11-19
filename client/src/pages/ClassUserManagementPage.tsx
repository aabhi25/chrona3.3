import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  Users, 
  ArrowLeft, 
  Eye, 
  RefreshCw, 
  Search,
  GraduationCap,
  UserCircle,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface StudentCredentials {
  userId: string;
  loginId: string;
  hasCredentials: boolean;
  hasTemporaryPassword: boolean;
  temporaryPassword: string | null;
  expiresAt: Date | string | null;
}

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  contactNumber: string | null;
  studentCredentials: StudentCredentials | null;
  parentCredentials: StudentCredentials | null;
}

interface ClassData {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

export default function ClassUserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [viewCredentials, setViewCredentials] = useState<{
    studentName: string;
    studentLogin: StudentCredentials | null;
    parentLogin: StudentCredentials | null;
  } | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressData, setProgressData] = useState<{ current: number; total: number } | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);

  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect non-teachers
  useEffect(() => {
    if (user && user.role !== 'teacher') {
      setLocation('/');
    }
  }, [user, setLocation]);

  if (user?.role !== 'teacher') {
    return null;
  }

  // Fetch students in class teacher's class
  const { data, isLoading, error } = useQuery<{
    class: ClassData;
    students: Student[];
    message?: string;
  }>({
    queryKey: ["/api/class-teacher/my-students-credentials"],
  });

  const classData = data?.class;
  const students = data?.students || [];

  // Filter students based on search
  const filteredStudents = students.filter((student) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.admissionNumber.toLowerCase().includes(searchLower)
    );
  });

  // Generate credentials mutation
  const generateMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const response = await apiRequest("POST", "/api/class-teacher/generate-credentials", {
        studentIds
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate credentials");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setProgressId(data.progressId);
      setProgressData({ current: 0, total: data.total });
      setShowProgressDialog(true);
      setShowConfirmGenerate(false);
      startPollingProgress(data.progressId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Poll progress
  const startPollingProgress = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiRequest("GET", `/api/user-management/bulk-progress/${id}`);
        if (response.ok) {
          const progress = await response.json();
          setProgressData({ current: progress.current, total: progress.total });

          if (progress.current >= progress.total) {
            clearInterval(interval);
            setTimeout(() => {
              setShowProgressDialog(false);
              queryClient.invalidateQueries({ queryKey: ["/api/class-teacher/my-students-credentials"] });
              toast({
                title: "Success",
                description: `Generated credentials for ${progress.current} user(s)`,
              });
            }, 1500);
          }
        }
      } catch (error) {
        clearInterval(interval);
        console.error("Error polling progress:", error);
      }
    }, 1000);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleViewCredentials = (student: Student) => {
    setViewCredentials({
      studentName: `${student.firstName} ${student.lastName}`,
      studentLogin: student.studentCredentials,
      parentLogin: student.parentCredentials,
    });
    setShowCredentialsDialog(true);
  };

  const handleGenerateSelected = () => {
    if (selectedStudents.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one student",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmGenerate(true);
  };

  const confirmGenerate = () => {
    generateMutation.mutate(Array.from(selectedStudents));
  };

  const getCredentialStatus = (credentials: StudentCredentials | null) => {
    if (!credentials || !credentials.hasCredentials) {
      return { status: "not_generated", icon: XCircle, color: "text-gray-500", label: "Not Generated" };
    }
    if (credentials.hasTemporaryPassword) {
      const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt) : null;
      if (expiresAt && expiresAt < new Date()) {
        return { status: "expired", icon: XCircle, color: "text-red-500", label: "Expired" };
      }
      return { status: "active", icon: CheckCircle2, color: "text-green-500", label: "Active" };
    }
    return { status: "permanent", icon: CheckCircle2, color: "text-blue-500", label: "Permanent" };
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Class User Management</CardTitle>
            <CardDescription>
              {data?.message || "You are not assigned as a class teacher for any class"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/more")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/more")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            Class User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage login credentials for your class students and parents
          </p>
        </div>
      </div>

      <Card className="mb-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Class {classData.grade} - {classData.section}</CardTitle>
              <CardDescription>
                {students.length} student{students.length !== 1 ? 's' : ''} in your class
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {classData.grade} {classData.section}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Student & Parent Credentials</CardTitle>
              <CardDescription>
                Generate and manage login credentials for students and their parents
              </CardDescription>
            </div>
            <Button
              onClick={handleGenerateSelected}
              disabled={selectedStudents.size === 0 || generateMutation.isPending}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              Generate for Selected ({selectedStudents.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student Details</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Student Login</TableHead>
                  <TableHead className="text-center">Parent Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const studentStatus = getCredentialStatus(student.studentCredentials);
                    const parentStatus = getCredentialStatus(student.parentCredentials);

                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">{student.firstName} {student.lastName}</div>
                            <div className="text-sm text-muted-foreground">{student.admissionNumber}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            {student.email && <div className="text-muted-foreground">{student.email}</div>}
                            {student.contactNumber && <div className="text-muted-foreground">{student.contactNumber}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <studentStatus.icon className={`h-4 w-4 ${studentStatus.color}`} />
                            <span className="text-sm">{studentStatus.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <parentStatus.icon className={`h-4 w-4 ${parentStatus.color}`} />
                            <span className="text-sm">{parentStatus.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCredentials(student)}
                            disabled={!student.studentCredentials && !student.parentCredentials}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Login Credentials - {viewCredentials?.studentName}</DialogTitle>
            <DialogDescription>
              View and share these credentials with the student and parent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewCredentials?.studentLogin && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Student Login</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 px-3 bg-muted rounded">
                    <span className="text-sm text-muted-foreground">Login ID:</span>
                    <span className="font-mono font-semibold">{viewCredentials.studentLogin.loginId}</span>
                  </div>
                  {viewCredentials.studentLogin.temporaryPassword && (
                    <>
                      <div className="flex justify-between items-center py-2 px-3 bg-muted rounded">
                        <span className="text-sm text-muted-foreground">Password:</span>
                        <span className="font-mono font-semibold">{viewCredentials.studentLogin.temporaryPassword}</span>
                      </div>
                      {viewCredentials.studentLogin.expiresAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Expires: {format(new Date(viewCredentials.studentLogin.expiresAt), 'PPP p')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {viewCredentials?.parentLogin && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">Parent Login</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 px-3 bg-muted rounded">
                    <span className="text-sm text-muted-foreground">Login ID:</span>
                    <span className="font-mono font-semibold">{viewCredentials.parentLogin.loginId}</span>
                  </div>
                  {viewCredentials.parentLogin.temporaryPassword && (
                    <>
                      <div className="flex justify-between items-center py-2 px-3 bg-muted rounded">
                        <span className="text-sm text-muted-foreground">Password:</span>
                        <span className="font-mono font-semibold">{viewCredentials.parentLogin.temporaryPassword}</span>
                      </div>
                      {viewCredentials.parentLogin.expiresAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Expires: {format(new Date(viewCredentials.parentLogin.expiresAt), 'PPP p')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Generate Dialog */}
      <AlertDialog open={showConfirmGenerate} onOpenChange={setShowConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate login credentials for {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} and their parents.
              Existing credentials will be refreshed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGenerate}>
              Generate Credentials
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generating Credentials</DialogTitle>
            <DialogDescription>
              Please wait while we generate login credentials...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Progress 
              value={progressData ? (progressData.current / progressData.total) * 100 : 0} 
              className="w-full"
            />
            <p className="text-sm text-center text-muted-foreground">
              {progressData?.current || 0} of {progressData?.total || 0} completed
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
