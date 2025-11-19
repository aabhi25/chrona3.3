import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus, BookOpen, FileText, CheckCircle, Clock, Award, Users, BarChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ELearningPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newCourseDialogOpen, setNewCourseDialogOpen] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({ title: "", description: "" });

  // Fetch courses based on role
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["/api/e-learning/courses"],
    enabled: !!user,
  });

  // Fetch student enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ["/api/e-learning/my-courses"],
    enabled: user?.role === "student",
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/e-learning/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/e-learning/courses"] });
      setNewCourseDialogOpen(false);
      setNewCourseForm({ title: "", description: "" });
      toast({ title: "Course created successfully" });
    },
  });

  // Enroll in course mutation
  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/e-learning/courses/${courseId}/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to enroll");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/e-learning/my-courses"] });
      toast({ title: "Enrolled successfully" });
    },
  });

  const handleCreateCourse = () => {
    if (!newCourseForm.title.trim()) {
      toast({ title: "Please enter a course title", variant: "destructive" });
      return;
    }
    
    createCourseMutation.mutate(newCourseForm);
  };

  // Teacher View
  if (user?.role === "teacher" || user?.role === "admin") {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-purple-600" />
              E-Learning - {user?.role === "admin" ? "Admin Dashboard" : "Teacher Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.role === "admin" 
                ? "Manage all courses across your school" 
                : "Create and manage your online courses"}
            </p>
          </div>

          <Dialog open={newCourseDialogOpen} onOpenChange={setNewCourseDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
                <DialogDescription>
                  Add a new course for your students
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Course Title *</label>
                  <Input
                    value={newCourseForm.title}
                    onChange={(e) =>
                      setNewCourseForm({ ...newCourseForm, title: e.target.value })
                    }
                    placeholder="Introduction to Mathematics"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={newCourseForm.description}
                    onChange={(e) =>
                      setNewCourseForm({ ...newCourseForm, description: e.target.value })
                    }
                    placeholder="Describe what students will learn..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewCourseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCourse}
                  disabled={createCourseMutation.isPending}
                >
                  {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              </div>
            ) : courses.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-purple-600 opacity-50" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      No courses yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first course to get started
                    </p>
                    <Button
                      onClick={() => setNewCourseDialogOpen(true)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Course
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course: any) => (
                  <Card
                    key={course.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-md bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-950"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{course.title}</CardTitle>
                          <CardDescription className="mt-2 line-clamp-2">
                            {course.description || "No description"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            course.status === "published"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {course.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>0 students</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          <span>0 lessons</span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => setLocation(`/e-learning/courses/${course.id}`)}
                        >
                          View Course
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-purple-600" />
                  Course Analytics
                </CardTitle>
                <CardDescription>
                  Track student engagement and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Analytics will appear here once you have courses with students
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Student View
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-purple-600" />
          E-Learning - Student Portal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore courses and track your learning progress
        </p>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="available">Available Courses</TabsTrigger>
          <TabsTrigger value="enrolled">
            My Courses ({enrollments.length})
          </TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : courses.filter((c: any) => c.status === "published").length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-purple-600 opacity-50" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No courses available yet
                  </h3>
                  <p className="text-muted-foreground">
                    Check back later for new courses from your teachers
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses
                .filter((c: any) => c.status === "published")
                .map((course: any) => (
                  <Card
                    key={course.id}
                    className="hover:shadow-lg transition-shadow border-0 shadow-md bg-gradient-to-br from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-950"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <CardDescription className="mt-2 line-clamp-2">
                        {course.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Teacher: {course.teacher?.name || "Unknown"}</span>
                        </div>
                        {course.level && (
                          <Badge variant="outline">{course.level}</Badge>
                        )}
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                          onClick={() => enrollMutation.mutate(course.id)}
                          disabled={enrollMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Enroll Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrolled" className="space-y-4">
          {enrollments.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-purple-600 opacity-50" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Not enrolled in any courses
                  </h3>
                  <p className="text-muted-foreground">
                    Browse available courses and enroll to start learning
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.map((enrollment: any) => (
                <Card
                  key={enrollment.id}
                  className="hover:shadow-lg transition-shadow border-0 shadow-md bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-950"
                >
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {enrollment.course.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Teacher: {enrollment.course.teacher?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-purple-600">
                          {enrollment.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full"
                          style={{ width: `${enrollment.progressPercentage}%` }}
                        />
                      </div>
                      <Button size="sm" className="w-full">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Continue Learning
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                Learning Progress
              </CardTitle>
              <CardDescription>
                Track your achievements and completion status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-0">
                  <CardHeader className="pb-3">
                    <CardDescription>Courses Enrolled</CardDescription>
                    <CardTitle className="text-3xl">{enrollments.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-0">
                  <CardHeader className="pb-3">
                    <CardDescription>Courses Completed</CardDescription>
                    <CardTitle className="text-3xl">
                      {enrollments.filter((e: any) => e.completedAt).length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-0">
                  <CardHeader className="pb-3">
                    <CardDescription>Average Progress</CardDescription>
                    <CardTitle className="text-3xl">
                      {enrollments.length > 0
                        ? Math.round(
                            enrollments.reduce((sum: number, e: any) => sum + e.progressPercentage, 0) /
                              enrollments.length
                          )
                        : 0}
                      %
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
