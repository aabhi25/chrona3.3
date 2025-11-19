import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, FileText, Image, Video, FileDown, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LessonBlock {
  id: string;
  blockType: "text" | "video" | "image" | "document" | "quiz";
  content: {
    text?: string;
    videoUrl?: string;
    videoProvider?: "youtube" | "vimeo" | "upload";
    imageUrl?: string;
    documentUrl?: string;
    quizId?: string;
  };
  orderIndex: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  status: string;
  blocks: LessonBlock[];
}

export default function LessonDetailPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/e-learning/courses/:courseId/lessons/:lessonId");
  const [, setLocation] = useLocation();

  const { data: lesson, isLoading } = useQuery<Lesson>({
    queryKey: [`/api/e-learning/lessons/${params?.lessonId}`, params?.courseId],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `/api/e-learning/lessons/${params?.lessonId}?courseId=${params?.courseId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch lesson");
      return res.json();
    },
    enabled: !!params?.lessonId && !!params?.courseId,
  });

  const canEditLesson = user?.role === "admin" || user?.role === "teacher";

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Lesson not found</div>
        </div>
      </div>
    );
  }

  const getVideoEmbedUrl = (url: string, provider?: string) => {
    if (provider === "youtube") {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    } else if (provider === "vimeo") {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
    return url;
  };

  const renderBlock = (block: LessonBlock) => {
    switch (block.blockType) {
      case "text":
        return (
          <Card key={block.id}>
            <CardContent className="pt-6">
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{block.content.text}</p>
              </div>
            </CardContent>
          </Card>
        );

      case "video":
        return (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {block.content.videoProvider === "upload" ? (
                  <video controls className="w-full h-full">
                    <source src={block.content.videoUrl} />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <iframe
                    src={getVideoEmbedUrl(block.content.videoUrl || "", block.content.videoProvider)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "image":
        return (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4" />
                Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={block.content.imageUrl}
                alt="Lesson content"
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        );

      case "document":
        return (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => window.open(block.content.documentUrl, "_blank")}
                variant="outline"
                className="w-full"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download or View Document
              </Button>
            </CardContent>
          </Card>
        );

      case "quiz":
        return (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Quiz
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Quiz functionality will be available soon
              </p>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => setLocation(`/e-learning/courses/${params?.courseId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        
        {canEditLesson && (
          <Button
            onClick={() => setLocation(`/e-learning/courses/${params?.courseId}/lessons/${params?.lessonId}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Lesson Content
          </Button>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          <Badge variant={lesson.status === "published" ? "default" : "secondary"}>
            {lesson.status}
          </Badge>
        </div>
        
        {lesson.description && (
          <p className="text-muted-foreground text-lg mb-3">{lesson.description}</p>
        )}
        
        {lesson.duration && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{lesson.duration} minutes</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {lesson.blocks && lesson.blocks.length > 0 ? (
          lesson.blocks
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((block) => renderBlock(block))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No content blocks added to this lesson yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
