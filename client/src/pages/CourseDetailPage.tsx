import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Users, FileText, Plus, Bell, MessageCircle, Pin, CheckCircle2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EditCourseDialog from "@/components/elearning/EditCourseDialog";
import AddLessonDialog from "@/components/elearning/AddLessonDialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  teacherId: string | null;
  teacher?: { id: string; name: string; email: string };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: { firstName: string; lastName: string; role: string };
}

interface DiscussionThread {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isResolved: boolean;
  viewCount: number;
  replyCount: number;
  createdAt: string;
  author: { firstName: string; lastName: string; role: string };
  replies?: any[];
}

export default function CourseDetailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [matchView, paramsView] = useRoute("/e-learning/courses/:id");
  const [matchEdit, paramsEdit] = useRoute("/e-learning/courses/:id/edit");
  const [, setLocation] = useLocation();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addLessonDialogOpen, setAddLessonDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [discussionDialogOpen, setDiscussionDialogOpen] = useState(false);
  
  const [announcementForm, setAnnouncementForm] = useState({ title: "", content: "", isPinned: false });
  const [discussionForm, setDiscussionForm] = useState({ title: "", content: "" });
  
  const courseId = paramsView?.id || paramsEdit?.id;

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: [`/api/e-learning/courses/${courseId}`],
    enabled: !!courseId,
  });

  const { data: lessons = [] } = useQuery<any[]>({
    queryKey: [`/api/e-learning/courses/${courseId}/lessons`],
    enabled: !!courseId,
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: [`/api/e-learning/courses/${courseId}/announcements`],
    enabled: !!courseId,
  });

  const { data: discussions = [] } = useQuery<DiscussionThread[]>({
    queryKey: [`/api/e-learning/courses/${courseId}/discussions`],
    enabled: !!courseId,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/e-learning/courses/${courseId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create announcement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/courses/${courseId}/announcements`] });
      setAnnouncementDialogOpen(false);
      setAnnouncementForm({ title: "", content: "", isPinned: false });
      toast({ title: "Announcement created successfully" });
    },
  });

  const createDiscussionMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/e-learning/courses/${courseId}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create discussion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/courses/${courseId}/discussions`] });
      setDiscussionDialogOpen(false);
      setDiscussionForm({ title: "", content: "" });
      toast({ title: "Discussion created successfully" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
          <Button onClick={() => setLocation("/e-learning")}>
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  const canManageCourse = user?.role === "admin" || (user?.role === "teacher" && course?.teacherId === user?.teacherId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/e-learning")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
        <p className="text-muted-foreground">
          {course.description || "No description available"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{course.status}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lessons</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lessons.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Announcements</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{announcements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discussions</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{discussions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lessons">
            <BookOpen className="h-4 w-4 mr-2" />
            Lessons
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Bell className="h-4 w-4 mr-2" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="discussions">
            <MessageCircle className="h-4 w-4 mr-2" />
            Discussions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Course Lessons</CardTitle>
                  <CardDescription>All lessons in this course</CardDescription>
                </div>
                {canManageCourse && (
                  <Button onClick={() => setAddLessonDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lesson
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No lessons added yet</p>
                  <p className="text-sm mt-2">Start building your course by adding lessons</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      onClick={() => setLocation(`/e-learning/courses/${courseId}/lessons/${lesson.id}`)}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{lesson.title}</h4>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {lesson.description}
                          </p>
                        )}
                        {lesson.duration && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Duration: {lesson.duration} minutes
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Course Announcements</CardTitle>
                  <CardDescription>Important updates and news</CardDescription>
                </div>
                {canManageCourse && (
                  <Button onClick={() => setAnnouncementDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Announcement
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No announcements yet</p>
                  <p className="text-sm mt-2">Keep your students informed with announcements</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="p-4 rounded-lg border bg-card space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <h4 className="font-semibold">{announcement.title}</h4>
                          {announcement.isPinned && (
                            <Pin className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{announcement.author.firstName} {announcement.author.lastName}</span>
                        <span>•</span>
                        <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Course Discussions</CardTitle>
                  <CardDescription>Ask questions and share ideas</CardDescription>
                </div>
                <Button onClick={() => setDiscussionDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Discussion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {discussions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No discussions yet</p>
                  <p className="text-sm mt-2">Start a conversation with your classmates</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {discussions.map((thread) => (
                    <div
                      key={thread.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <h4 className="font-semibold">{thread.title}</h4>
                          {thread.isPinned && (
                            <Pin className="h-4 w-4 text-purple-600" />
                          )}
                          {thread.isResolved && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {thread.content}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{thread.author.firstName} {thread.author.lastName}</span>
                        </div>
                        <span>•</span>
                        <span>{thread.replyCount} replies</span>
                        <span>•</span>
                        <span>{thread.viewCount} views</span>
                        <span>•</span>
                        <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canManageCourse && (
        <div className="flex gap-2">
          <Button
            onClick={() => setEditDialogOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Edit Course
          </Button>
        </div>
      )}

      {course && (
        <>
          <EditCourseDialog
            course={course}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <AddLessonDialog
            courseId={course.id}
            open={addLessonDialogOpen}
            onOpenChange={setAddLessonDialogOpen}
          />
        </>
      )}

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>Share important information with your students</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                placeholder="Write your announcement..."
                rows={5}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pin"
                checked={announcementForm.isPinned}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
              />
              <label htmlFor="pin" className="text-sm">Pin to top</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAnnouncementMutation.mutate(announcementForm)}
              disabled={!announcementForm.title || !announcementForm.content}
            >
              Create Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discussionDialogOpen} onOpenChange={setDiscussionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Discussion</DialogTitle>
            <DialogDescription>Ask a question or start a conversation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={discussionForm.title}
                onChange={(e) => setDiscussionForm({ ...discussionForm, title: e.target.value })}
                placeholder="Discussion topic"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={discussionForm.content}
                onChange={(e) => setDiscussionForm({ ...discussionForm, content: e.target.value })}
                placeholder="What would you like to discuss?"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscussionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createDiscussionMutation.mutate(discussionForm)}
              disabled={!discussionForm.title || !discussionForm.content}
            >
              Start Discussion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
