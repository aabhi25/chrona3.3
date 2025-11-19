import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface EditCourseDialogProps {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCourseDialog({
  course,
  open,
  onOpenChange,
}: EditCourseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: course.title,
    description: course.description || "",
    status: course.status,
  });

  // Reset form data whenever dialog opens or course changes
  useEffect(() => {
    if (open) {
      setFormData({
        title: course.title,
        description: course.description || "",
        status: course.status,
      });
    }
  }, [open, course]);

  const updateCourseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", `/api/e-learning/courses/${course.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Course updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/e-learning/courses"] });
      queryClient.invalidateQueries({ queryKey: [`/api/e-learning/courses/${course.id}`] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update course",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Course title is required",
        variant: "destructive",
      });
      return;
    }
    updateCourseMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update your course details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Introduction to Mathematics"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what students will learn..."
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Reset form to original course data
                setFormData({
                  title: course.title,
                  description: course.description || "",
                  status: course.status,
                });
                onOpenChange(false);
              }}
              disabled={updateCourseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateCourseMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {updateCourseMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
