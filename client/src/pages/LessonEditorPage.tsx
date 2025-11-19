import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, GripVertical, Type, Video, Image, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  blocks: LessonBlock[];
}

function SortableBlock({ block, getBlockIcon, onDelete }: {
  block: LessonBlock;
  getBlockIcon: (type: string) => JSX.Element;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-move">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              {getBlockIcon(block.blockType)}
              <CardTitle className="text-base capitalize">{block.blockType} Block</CardTitle>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {block.blockType === "text" && (
          <p className="whitespace-pre-wrap text-sm">{block.content.text}</p>
        )}
        {block.blockType === "video" && (
          <div className="text-sm">
            <p className="text-muted-foreground">Provider: {block.content.videoProvider}</p>
            <p className="truncate">URL: {block.content.videoUrl}</p>
          </div>
        )}
        {block.blockType === "image" && (
          <div className="text-sm">
            <p className="truncate">URL: {block.content.imageUrl}</p>
          </div>
        )}
        {block.blockType === "document" && (
          <div className="text-sm">
            <p className="truncate">URL: {block.content.documentUrl}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LessonEditorPage() {
  const [, params] = useRoute("/e-learning/courses/:courseId/lessons/:lessonId/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addBlockDialogOpen, setAddBlockDialogOpen] = useState(false);
  const [blockType, setBlockType] = useState<"text" | "video" | "image" | "document" | "quiz">("text");
  const [blockForm, setBlockForm] = useState({
    text: "",
    videoUrl: "",
    videoProvider: "youtube" as "youtube" | "vimeo" | "upload",
    imageUrl: "",
    documentUrl: "",
  });

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

  const createBlockMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/e-learning/lessons/${params?.lessonId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create block");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/lessons/${params?.lessonId}`] });
      setAddBlockDialogOpen(false);
      resetBlockForm();
      toast({ title: "Content block added successfully" });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/e-learning/blocks/${blockId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete block");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/lessons/${params?.lessonId}`] });
      toast({ title: "Content block deleted successfully" });
    },
  });

  const resetBlockForm = () => {
    setBlockForm({
      text: "",
      videoUrl: "",
      videoProvider: "youtube",
      imageUrl: "",
      documentUrl: "",
    });
    setBlockType("text");
  };

  const handleAddBlock = () => {
    const content: any = {};
    
    switch (blockType) {
      case "text":
        content.text = blockForm.text;
        break;
      case "video":
        content.videoUrl = blockForm.videoUrl;
        content.videoProvider = blockForm.videoProvider;
        break;
      case "image":
        content.imageUrl = blockForm.imageUrl;
        break;
      case "document":
        content.documentUrl = blockForm.documentUrl;
        break;
    }

    createBlockMutation.mutate({
      blockType,
      content,
      orderIndex: lesson?.blocks?.length || 0,
    });
  };

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedBlocks = lesson.blocks ? [...lesson.blocks].sort((a, b) => a.orderIndex - b.orderIndex) : [];

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedBlocks.findIndex((b) => b.id === active.id);
      const newIndex = sortedBlocks.findIndex((b) => b.id === over.id);

      const reorderedBlocks = arrayMove(sortedBlocks, oldIndex, newIndex);

      queryClient.setQueryData(
        [`/api/e-learning/lessons/${params?.lessonId}`, params?.courseId],
        (old: any) => ({
          ...old,
          blocks: reorderedBlocks.map((block, index) => ({
            ...block,
            orderIndex: index,
          })),
        })
      );

      for (let i = 0; i < reorderedBlocks.length; i++) {
        const block = reorderedBlocks[i];
        if (block.orderIndex !== i) {
          const token = localStorage.getItem("authToken");
          await fetch(`/api/e-learning/blocks/${block.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderIndex: i }),
            credentials: "include",
          });
        }
      }

      toast({ title: "Blocks reordered successfully" });
    }
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case "text": return <Type className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "image": return <Image className="h-4 w-4" />;
      case "document": return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => setLocation(`/e-learning/courses/${params?.courseId}/lessons/${params?.lessonId}`)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Lesson
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Lesson Content</h1>
        <p className="text-muted-foreground mt-2">{lesson.title}</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Content Blocks</h2>
        <Button onClick={() => setAddBlockDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Content Block
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sortedBlocks.length > 0 ? (
              sortedBlocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  getBlockIcon={getBlockIcon}
                  onDelete={() => {
                    if (confirm("Are you sure you want to delete this content block?")) {
                      deleteBlockMutation.mutate(block.id);
                    }
                  }}
                />
              ))
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No content blocks added yet</p>
                  <p className="text-sm mt-2">Add text, videos, images, or documents to build your lesson</p>
                </CardContent>
              </Card>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={addBlockDialogOpen} onOpenChange={setAddBlockDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Content Block</DialogTitle>
            <DialogDescription>
              Choose the type of content you want to add to this lesson
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Block Type</Label>
              <Select value={blockType} onValueChange={(value: any) => setBlockType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Content</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {blockType === "text" && (
              <div className="grid gap-2">
                <Label>Text Content</Label>
                <Textarea
                  value={blockForm.text}
                  onChange={(e) => setBlockForm({ ...blockForm, text: e.target.value })}
                  placeholder="Enter your lesson content here..."
                  rows={8}
                />
              </div>
            )}

            {blockType === "video" && (
              <>
                <div className="grid gap-2">
                  <Label>Video Provider</Label>
                  <Select 
                    value={blockForm.videoProvider} 
                    onValueChange={(value: any) => setBlockForm({ ...blockForm, videoProvider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="vimeo">Vimeo</SelectItem>
                      <SelectItem value="upload">Upload (Direct Link)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Video URL</Label>
                  <Input
                    value={blockForm.videoUrl}
                    onChange={(e) => setBlockForm({ ...blockForm, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the full URL from YouTube, Vimeo, or a direct video link
                  </p>
                </div>
              </>
            )}

            {blockType === "image" && (
              <div className="grid gap-2">
                <Label>Image URL</Label>
                <Input
                  value={blockForm.imageUrl}
                  onChange={(e) => setBlockForm({ ...blockForm, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a direct link to an image file
                </p>
              </div>
            )}

            {blockType === "document" && (
              <div className="grid gap-2">
                <Label>Document URL</Label>
                <Input
                  value={blockForm.documentUrl}
                  onChange={(e) => setBlockForm({ ...blockForm, documentUrl: e.target.value })}
                  placeholder="https://example.com/document.pdf"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a direct link to a PDF or document file
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlock}>
              Add Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
