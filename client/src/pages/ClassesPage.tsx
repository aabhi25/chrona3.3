import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Users, BookOpen, MapPin, ChevronDown, Upload, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { sortClasses, getGradeOrder } from "@shared/classUtils";

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

const classOptions = [
  "Playschool",
  "Pre-Nursery",
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const classFormSchema = z.object({
  grade: z.string().min(1, "Please select a class"),
});

type ClassFormData = z.infer<typeof classFormSchema>;

export default function ClassesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [sectionsToAdd, setSectionsToAdd] = useState<string>("A,B,C");
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const {
    data: classes = [],
    isLoading,
    error,
  } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });

  // Query to get class subject assignments for all classes
  const { data: allSubjectAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/class-subject-assignments"],
    enabled: classes.length > 0,
  });

  // Check if a class is empty (has no subjects, teachers, or students)
  const isClassEmpty = (classItem: Class): boolean => {
    // Check if class has students
    if (classItem.studentCount > 0) {
      return false;
    }

    // Check if class has subject assignments
    const hasSubjects = allSubjectAssignments.some(
      (assignment: any) => assignment.classId === classItem.id
    );
    if (hasSubjects) {
      return false;
    }

    // For teacher assignments, we'll use a simple check based on the existence of subject assignments
    // since teachers are typically assigned through subject assignments
    return true;
  };

  const addForm = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      grade: "",
    },
  });


  const createClassMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const classData = {
        ...data,
        section: "",
        room: ""
      };
      const response = await apiRequest("POST", "/api/classes", classData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Success",
        description: "Class created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });


  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the class being deleted
      const classToDelete = classes.find(c => c.id === id);
      if (!classToDelete) {
        throw new Error("Class not found");
      }

      // Delete the class
      await apiRequest("DELETE", `/api/classes/${id}`);

      // If the deleted class had a section, check for cleanup
      if (classToDelete.section) {
        const remainingSections = classes
          .filter(c => c.grade === classToDelete.grade && c.id !== id && c.section);
        
        // If only one section remains for this grade, rename it to have no section
        if (remainingSections.length === 1) {
          const lastSection = remainingSections[0];
          await apiRequest("PUT", `/api/classes/${lastSection.id}`, {
            grade: lastSection.grade,
            section: '', // Remove the section
            room: lastSection.room || ''
          });
          
          return { 
            deletedClass: classToDelete, 
            renamedClass: lastSection,
            wasAutoRenamed: true 
          };
        }
      }

      return { 
        deletedClass: classToDelete, 
        wasAutoRenamed: false 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      
      if (result.wasAutoRenamed && result.renamedClass) {
        toast({
          title: "Success",
          description: `Deleted ${result.deletedClass.section ? 
            `Class ${result.deletedClass.grade} ${result.deletedClass.section}` : 
            `Class ${result.deletedClass.grade}`
          } and renamed remaining section back to Class ${result.renamedClass.grade}`,
        });
      } else {
        toast({
          title: "Success",
          description: "Class and section deleted successfully",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete class",
        variant: "destructive",
      });
    },
  });


  const createSectionsMutation = useMutation({
    mutationFn: async ({ grade, sections }: { grade: string; sections: string[] }) => {
      // Check if there's an existing class for this grade without a section
      const existingClass = classes.find(c => c.grade === grade && !c.section);
      
      const promises = [];
      
      if (existingClass && sections.length > 0) {
        // Update the existing class to have the first section
        const firstSection = sections[0];
        promises.push(
          apiRequest("PUT", `/api/classes/${existingClass.id}`, {
            grade,
            section: firstSection,
            room: existingClass.room || ""
          }).then(res => res.json())
        );
        
        // Create new classes for the remaining sections
        sections.slice(1).forEach(section => {
          promises.push(
            apiRequest("POST", "/api/classes", {
              grade,
              section,
              room: ""
            }).then(res => res.json())
          );
        });
      } else {
        // No existing class found, create all sections as new classes
        sections.forEach(section => {
          promises.push(
            apiRequest("POST", "/api/classes", {
              grade,
              section,
              room: ""
            }).then(res => res.json())
          );
        });
      }
      
      return Promise.all(promises);
    },
    onSuccess: (createdClasses, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsSectionDialogOpen(false);
      setSectionsToAdd("A,B,C");
      setSelectedClass("");
      toast({
        title: "Success",
        description: `Successfully created ${createdClasses.length} sections for Class ${variables.grade}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sections",
        variant: "destructive",
      });
    },
  });

  const handleCreateSections = () => {
    if (!selectedClass.trim()) {
      toast({
        title: "Error",
        description: "Please enter a grade",
        variant: "destructive",
      });
      return;
    }
    
    const sections = sectionsToAdd
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    if (sections.length === 0) {
      toast({
        title: "Error", 
        description: "Please enter at least one section",
        variant: "destructive",
      });
      return;
    }
    
    createSectionsMutation.mutate({ grade: selectedClass, sections });
  };

  const handleAddClass = (data: ClassFormData) => {
    createClassMutation.mutate(data);
  };

  const handleDeleteClass = (id: string) => {
    deleteClassMutation.mutate(id);
  };

  const getNextSection = (grade: string): string => {
    // Get all existing sections for this grade
    const existingSections = classes
      .filter(c => c.grade === grade && c.section)
      .map(c => c.section)
      .sort();
    
    if (existingSections.length === 0) {
      // No sections exist, return A (for renaming original) and B (for new creation)
      return 'A';
    }
    
    // Find the next alphabetical section
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // First try single letters A-Z
    for (let i = 0; i < alphabet.length; i++) {
      const letter = alphabet[i];
      if (!existingSections.includes(letter)) {
        return letter;
      }
    }
    
    // If all single letters are used, try double letters AA, AB, AC, etc.
    for (let i = 0; i < alphabet.length; i++) {
      for (let j = 0; j < alphabet.length; j++) {
        const letter = alphabet[i] + alphabet[j];
        if (!existingSections.includes(letter)) {
          return letter;
        }
      }
    }
    
    // If somehow all double letters are used (676 sections!), use a timestamp-based fallback
    return 'X' + Date.now().toString().slice(-3);
  };

  const handleAutoAddSection = async (grade: string) => {
    const existingSections = classes.filter(c => c.grade === grade && c.section);
    const classWithoutSection = classes.find(c => c.grade === grade && !c.section);
    
    if (classWithoutSection && existingSections.length === 0) {
      // Special case: Class has no sections yet
      // Rename original class to have section A, then create section B
      try {
        // First rename the existing class to have section A
        const response1 = await apiRequest("PUT", `/api/classes/${classWithoutSection.id}`, {
          grade: classWithoutSection.grade,
          section: 'A',
          room: classWithoutSection.room || ''
        });
        
        // Then create section B  
        const response2 = await apiRequest("POST", "/api/classes", {
          grade: grade,
          section: 'B',
          room: ''
        });
        
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
        
        toast({
          title: "Success",
          description: `Class ${grade} converted to sections. Created ${grade}A and ${grade}B`,
        });
      } catch (error) {
        toast({
          title: "Error", 
          description: "Failed to create sections",
          variant: "destructive",
        });
      }
    } else {
      // Normal case: Add the next section
      const nextSection = getNextSection(grade);
      try {
        const response = await apiRequest("POST", "/api/classes", {
          grade: grade,
          section: nextSection,
          room: ''
        });
        
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
        
        toast({
          title: "Success",
          description: `Added section ${nextSection} to Class ${grade}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add section",
          variant: "destructive",
        });
      }
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading classes: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-purple-600" />
              Classes
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your school's classes and sections
            </p>
          </div>
        <div className="flex flex-col gap-2 md:flex-row md:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-add-class-dropdown" className="h-10 md:h-9">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Class</span>
                <span className="sm:hidden">Add</span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setIsAddDialogOpen(true)}
                data-testid="menu-add-single-class"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Single Class
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLocation('/classes/bulk-upload')}
                data-testid="menu-bulk-import-classes"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add multiple classes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Single Class Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAddClass)} className="space-y-2">
                <FormField
                  control={addForm.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-grade">
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classOptions.map((classOption) => (
                            <SelectItem key={classOption} value={classOption}>
                              {classOption === "1" || classOption === "2" || classOption === "3" || 
                               classOption === "4" || classOption === "5" || classOption === "6" || 
                               classOption === "7" || classOption === "8" || classOption === "9" || 
                               classOption === "10" || classOption === "11" || classOption === "12"
                                ? `Class ${classOption}`
                                : classOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createClassMutation.isPending}
                    data-testid="button-submit-add"
                  >
                    {createClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Classes List */}
      <div className="container mx-auto px-4 md:px-6">
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Classes Found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first class
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-class">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Class
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-2">
          {Object.entries(
            sortClasses(classes)
              .reduce((groups, classItem) => {
                const grade = classItem.grade;
                if (!groups[grade]) groups[grade] = [];
                groups[grade].push(classItem);
                return groups;
              }, {} as Record<string, Class[]>)
          )
          .sort((a, b) => getGradeOrder(a[0]) - getGradeOrder(b[0]))
          .map(([grade, gradeClasses], index) => {
            // Helper function to determine if we should use "Class" prefix
            const getGradeDisplay = (gradeName: string) => {
              const numericGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
              return numericGrades.includes(gradeName) ? `Class ${gradeName}` : gradeName;
            };
            
            const sectionCount = gradeClasses.length;
            
            return (
              <AccordionItem key={grade} value={grade} className="border-0 rounded-lg shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-white">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getGradeDisplay(grade)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({sectionCount} {sectionCount === 1 ? 'Section' : 'Sections'})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-1 pt-2">
                    {gradeClasses
                      .sort((a, b) => {
                        if (!a.section && !b.section) return 0;
                        if (!a.section) return -1;
                        if (!b.section) return 1;
                        return a.section.localeCompare(b.section);
                      })
                      .map((classItem) => (
                        <div key={classItem.id} className="flex items-center justify-between group py-1.5 px-2 rounded hover:bg-muted/50">
                          <Link 
                            href={`/classes/${classItem.id}`} 
                            className="flex-1 flex items-center gap-2 text-sm hover:text-primary transition-colors"
                          >
                            <span className="text-muted-foreground">–</span>
                            <span>
                              {getGradeDisplay(classItem.grade)}
                              {classItem.section && (
                                <span className="text-primary font-medium ml-1">{classItem.section}</span>
                              )}
                            </span>
                            {classItem.room && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({classItem.room})
                              </span>
                            )}
                          </Link>
                          {isClassEmpty(classItem) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-delete-class-${classItem.id}`}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Class and Section</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {classItem.section ? 
                                      `${getGradeDisplay(classItem.grade)} ${classItem.section}` : 
                                      getGradeDisplay(classItem.grade)
                                    }? 
                                    This action cannot be undone and will also remove all associated timetable entries.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteClass(classItem.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid="button-confirm-delete"
                                  >
                                    Yes, Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      ))}
                    
                    {/* Add Section Button */}
                    <button
                      onClick={() => handleAutoAddSection(grade)}
                      className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-600 hover:text-amber-800 dark:hover:text-amber-500 transition-colors py-1.5 px-2"
                    >
                      <span className="text-muted-foreground">+</span>
                      <span>Add Section</span>
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      </div>

      {/* Add Sections Dialog */}
      <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sections to Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label htmlFor="grade-select">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger data-testid="select-sections-grade">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(classes.map(c => c.grade)))
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        Class {grade}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sections-input">Sections (comma separated)</Label>
              <Input
                id="sections-input"
                placeholder="e.g., A,B,C or A,B,C,D"
                value={sectionsToAdd}
                onChange={(e) => setSectionsToAdd(e.target.value)}
                data-testid="input-sections-list"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter sections separated by commas. Each will become a separate class (e.g., 1A, 1B, 1C)
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSectionDialogOpen(false)}
              data-testid="button-cancel-sections"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSections}
              disabled={createSectionsMutation.isPending}
              data-testid="button-create-sections"
            >
              {createSectionsMutation.isPending ? "Creating..." : "Create Sections"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}