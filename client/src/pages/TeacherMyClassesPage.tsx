import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, MapPin, GraduationCap, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getClassName } from "@shared/classUtils";

interface TeacherClass {
  id: string;
  grade: string;
  section: string | null;
  room: string | null;
  studentCount: number;
  role: string;
  subjects: string[];
}

export default function TeacherMyClassesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: classesData, isLoading } = useQuery<{ classes: TeacherClass[] }>({
    queryKey: ["/api/teachers", user?.teacherId, "classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers/${user?.teacherId}/classes`);
      return response.json();
    },
    enabled: !!user?.teacherId,
  });

  const classes = classesData?.classes || [];


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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="container mx-auto py-6 md:py-10 space-y-8">
        {/* Enhanced Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 p-4 md:p-5 shadow-xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtNi42MjcgNS4zNzMtMTIgMTItMTJzMTIgNS4zNzMgMTIgMTItNS4zNzMgMTItMTIgMTItMTItNS4zNzMtMTItMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">My Classes</h1>
                <p className="text-xs md:text-sm text-white/90">
                  Classes you teach or manage
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <div className="flex -space-x-1.5">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <GraduationCap className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <span className="text-white/90 text-xs font-medium ml-1">{classes.length} {classes.length === 1 ? 'Class' : 'Classes'}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-[280px] border-2">
                <CardHeader className="pb-3">
                  <Skeleton className="h-7 w-36" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardContent className="pt-16 pb-16">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-6 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl">
                    <GraduationCap className="h-16 w-16 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">No Classes Assigned</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    You don't have any classes assigned yet. Contact your administrator for class assignments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card
                key={classItem.id}
                className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                onClick={() => setLocation(`/my-classes/${classItem.id}`)}
              >
                <CardHeader className="pb-4 pt-6">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2.5">
                      Class {getClassName(classItem.grade, classItem.section)}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                      {classItem.role}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pb-6">
                  {/* Room Info */}
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-md">
                      <MapPin className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Room</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {classItem.room || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  {/* Subjects */}
                  {classItem.subjects.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <BookOpen className="h-3 w-3" />
                        <span>SUBJECTS TAUGHT</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {classItem.subjects.map((subject, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                          >
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arrow Icon */}
                  <div className="flex items-center justify-end pt-2">
                    <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                      <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
