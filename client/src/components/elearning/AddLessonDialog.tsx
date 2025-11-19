import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddLessonDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddLessonDialog({
  courseId,
  open,
  onOpenChange,
}: AddLessonDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration: "",
  });

  const addLessonMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        duration: data.duration ? parseInt(data.duration) : undefined,
      };
      const res = await apiRequest(
        "POST",
        `/api/e-learning/courses/${courseId}/lessons`,
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lesson created successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/courses/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/courses/${courseId}/lessons`] });
      setFormData({ title: "", description: "", duration: "" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Lesson title is required",
        variant: "destructive",
      });
      return;
    }
    addLessonMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Lesson</DialogTitle>
            <DialogDescription>
              Create a new lesson for this course
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lesson-title">Lesson Title *</Label>
              <Input
                id="lesson-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Introduction to Algebra"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this lesson covers..."
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) =>
                  setFormData({ ...formData, duration: e.target.value })
                }
                placeholder="e.g., 45"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({ title: "", description: "", duration: "" });
                onOpenChange(false);
              }}
              disabled={addLessonMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addLessonMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {addLessonMutation.isPending ? "Creating..." : "Create Lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
