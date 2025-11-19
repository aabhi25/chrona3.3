import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar as CalendarIcon, Plus, Trash2, Edit, Calculator, FileText, Download, ArrowLeft, Info, BookOpen, CheckCircle2, Lightbulb, Settings, GraduationCap, Save } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

// Exam form schema
const examFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  examType: z.enum(["mid_term", "final", "quarterly", "unit_test", "other"]),
  academicSessionId: z.string().min(1, "Academic session is required"),
  startDate: z.date(),
  endDate: z.date(),
  totalMarks: z.string().min(1, "Total marks required"),
  passingMarks: z.string().min(1, "Passing marks required"),
});

// Mark entry schema
const markEntrySchema = z.object({
  studentId: z.string(),
  examSubjectId: z.string(),
  marksObtained: z.string(),
  remarks: z.string().optional(),
});

// Debounced Max Marks Input Component
function MaxMarksInput({ 
  selectedSubject, 
  examSubjectsForMarks, 
  updateMaxMarks 
}: {
  selectedSubject: string;
  examSubjectsForMarks: any[];
  updateMaxMarks: (examSubjectId: string, maxMarks: number) => void;
}) {
  const selectedExamSubject = examSubjectsForMarks.find((es: any) => es.id === selectedSubject);
  const [inputValue, setInputValue] = useState<string>(String(selectedExamSubject?.maxMarks || 100));

  // Sync input value when selected subject changes
  useEffect(() => {
    setInputValue(String(selectedExamSubject?.maxMarks || 100));
  }, [selectedSubject, selectedExamSubject?.maxMarks]);

  // Debounce the API call
  useEffect(() => {
    const timeout = setTimeout(() => {
      const numValue = parseInt(inputValue);
      if (inputValue !== '' && numValue > 0 && numValue !== selectedExamSubject?.maxMarks) {
        updateMaxMarks(selectedSubject, numValue);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeout);
  }, [inputValue, selectedSubject, selectedExamSubject?.maxMarks, updateMaxMarks]);

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm font-medium whitespace-nowrap">Max Marks:</Label>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => {
          const value = e.target.value;
          // Only allow numeric input
          if (/^\d*$/.test(value)) {
            setInputValue(value);
          }
        }}
        className="w-24 text-right"
      />
    </div>
  );
}

// Debounced Passing Marks Input Component
function PassingMarksInput({ 
  selectedSubject, 
  examSubjectsForMarks, 
  updatePassingMarks 
}: {
  selectedSubject: string;
  examSubjectsForMarks: any[];
  updatePassingMarks: (examSubjectId: string, passingMarks: number) => void;
}) {
  const selectedExamSubject = examSubjectsForMarks.find((es: any) => es.id === selectedSubject);
  const [inputValue, setInputValue] = useState<string>(String(selectedExamSubject?.passingMarks || ''));
  const lastSavedValueRef = useRef<number | null>(null);

  // Sync input value when selected subject changes
  useEffect(() => {
    const currentValue = selectedExamSubject?.passingMarks || 0;
    setInputValue(String(currentValue));
    lastSavedValueRef.current = currentValue; // Track the current saved value
  }, [selectedSubject]);

  // Debounce the API call
  useEffect(() => {
    const timeout = setTimeout(() => {
      const numValue = parseInt(inputValue);
      const newValue = inputValue === '' ? 0 : numValue;
      
      // Only update if the value has changed from what we last saved
      if (newValue !== lastSavedValueRef.current && !isNaN(numValue)) {
        updatePassingMarks(selectedSubject, newValue);
        lastSavedValueRef.current = newValue; // Update our tracking
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeout);
  }, [inputValue, selectedSubject, updatePassingMarks]);

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm font-medium whitespace-nowrap">Passing Marks:</Label>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => {
          const value = e.target.value;
          // Only allow numeric input
          if (/^\d*$/.test(value)) {
            setInputValue(value);
          }
        }}
        className="w-24 text-right"
      />
    </div>
  );
}

// Student Mark Row Component
function StudentMarkRow({
  index,
  student,
  existingMark,
  maxMarks,
  examSubjectId,
  onChange,
}: {
  index: number;
  student: any;
  existingMark: any;
  maxMarks: number;
  examSubjectId: string;
  onChange: (data: {studentId: string, examSubjectId: string, marksObtained: string, remarks: string, isAbsent: boolean}) => void;
}) {
  const { toast } = useToast();
  const [marksValue, setMarksValue] = useState<string>(
    existingMark?.marksObtained ? parseFloat(existingMark.marksObtained).toString() : ""
  );
  const [remarksValue, setRemarksValue] = useState<string>(existingMark?.remarks || "");
  const [isAbsent, setIsAbsent] = useState<boolean>(existingMark?.isAbsent || false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Sync with existingMark when it changes
  useEffect(() => {
    setMarksValue(existingMark?.marksObtained ? parseFloat(existingMark.marksObtained).toString() : "");
    setRemarksValue(existingMark?.remarks || "");
    setIsAbsent(existingMark?.isAbsent || false);
  }, [existingMark]);

  // Notify parent of changes
  const handleChange = (newMarks?: string, newRemarks?: string, newAbsent?: boolean) => {
    onChange({
      studentId: student.id,
      examSubjectId: examSubjectId,
      marksObtained: newMarks !== undefined ? newMarks : marksValue,
      remarks: newRemarks !== undefined ? newRemarks : remarksValue,
      isAbsent: newAbsent !== undefined ? newAbsent : isAbsent,
    });
  };

  const handleMarksChange = (value: string) => {
    setMarksValue(value);
    
    // Validate marks
    if (value && !isNaN(parseFloat(value))) {
      const numValue = parseFloat(value);
      if (numValue > maxMarks) {
        setHasError(true);
        toast({
          title: "Invalid marks",
          description: `Marks cannot be more than ${maxMarks}`,
          variant: "destructive",
        });
        return;
      } else if (numValue < 0) {
        setHasError(true);
        toast({
          title: "Invalid marks",
          description: "Marks cannot be negative",
          variant: "destructive",
        });
        return;
      }
    }
    
    setHasError(false);
    handleChange(value, undefined, undefined);
  };

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
      <TableCell className="text-muted-foreground">{student.admissionNumber}</TableCell>
      <TableCell>
        <Input
          type="number"
          placeholder="Enter marks"
          className={`w-32 ${hasError ? 'border-red-500 focus:border-red-500' : ''}`}
          value={marksValue}
          onChange={(e) => handleMarksChange(e.target.value)}
          max={maxMarks}
          min={0}
          disabled={isAbsent}
        />
      </TableCell>
      <TableCell>
        <Input
          placeholder="Remarks"
          className="w-full"
          value={remarksValue}
          onChange={(e) => {
            setRemarksValue(e.target.value);
            handleChange(undefined, e.target.value, undefined);
          }}
        />
      </TableCell>
      <TableCell className="text-center">
        <input 
          type="checkbox" 
          className="w-4 h-4 cursor-pointer"
          checked={isAbsent}
          onChange={(e) => {
            setIsAbsent(e.target.checked);
            handleChange(undefined, undefined, e.target.checked);
          }}
        />
      </TableCell>
    </TableRow>
  );
}

export default function ExamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [examToDelete, setExamToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedExamForClasses, setSelectedExamForClasses] = useState<string | null>(null);
  const [isManageClassesDialogOpen, setIsManageClassesDialogOpen] = useState(false);
  const [dirtyMarks, setDirtyMarks] = useState<Record<string, any>>({});
  const [selectedClassForResults, setSelectedClassForResults] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("exams");

  // Fetch academic sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/academic-sessions"],
  });

  // Fetch exams
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["/api/exams", sessionFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sessionFilter && sessionFilter !== "all") params.append("academicSessionId", sessionFilter);
      if (typeFilter && typeFilter !== "all") params.append("examType", typeFilter);
      const response = await apiRequest("GET", `/api/exams?${params}`);
      return response.json();
    },
  });

  // Fetch all exam classes for status determination (optimized bulk endpoint)
  const { data: allExamClasses = [] } = useQuery({
    queryKey: ["/api/exam-classes/all"],
    queryFn: async () => {
      if (exams.length === 0) return [];
      
      // Fetch all exam classes in one request instead of N requests
      const examIds = exams.map((exam: any) => exam.id).join(',');
      const response = await apiRequest("GET", `/api/exams/bulk/classes?examIds=${examIds}`);
      return response.json();
    },
    enabled: exams.length > 0,
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ["/api/subjects"],
  });

  // Fetch exam classes (for marks entry)
  const { data: examClasses = [] } = useQuery({
    queryKey: ["/api/exams", selectedExam, "classes"],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExam}/classes`);
      return response.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch exam subjects for marks entry
  const { data: examSubjectsForMarks = [] } = useQuery({
    queryKey: ["/api/exams", selectedExam, "subjects"],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExam}/subjects`);
      return response.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch class-subject assignments to filter exam subjects by class
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["/api/class-subject-assignments", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const response = await apiRequest("GET", `/api/class-subject-assignments?classId=${selectedClass}`);
      return response.json();
    },
    enabled: !!selectedClass,
  });

  // Fetch classes for selected exam (for class management)
  const { data: currentExamClasses = [] } = useQuery({
    queryKey: ["/api/exams", selectedExamForClasses, "classes"],
    queryFn: async () => {
      if (!selectedExamForClasses) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExamForClasses}/classes`);
      return response.json();
    },
    enabled: !!selectedExamForClasses,
  });

  // Fetch students
  const { data: studentsData } = useQuery({
    queryKey: ["/api/students"],
  });

  const students = studentsData?.students || [];

  // Fetch exam marks
  const { data: examMarks = [] } = useQuery({
    queryKey: ["/api/exams", selectedExam, "marks"],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExam}/marks`);
      return response.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch exam results
  const { data: examResults = [] } = useQuery({
    queryKey: ["/api/exams", selectedExam, "results"],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExam}/results`);
      return response.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch classes for selected exam (for results filtering)
  const { data: examClassesForResults = [] } = useQuery({
    queryKey: ["/api/exams", selectedExam, "classes-for-results"],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest("GET", `/api/exams/${selectedExam}/classes`);
      return response.json();
    },
    enabled: !!selectedExam,
  });

  // Filter exam results by selected class
  const filteredExamResults = selectedClassForResults 
    ? examResults.filter((result: any) => {
        const student = students.find((s: any) => s.id === result.studentId);
        return student?.classId === selectedClassForResults;
      })
    : [];

  // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async (data: z.infer<typeof examFormSchema>) => {
      const response = await apiRequest("POST", "/api/exams", {
        ...data,
        totalMarks: parseInt(data.totalMarks),
        passingMarks: parseInt(data.passingMarks),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      setIsCreateDialogOpen(false);
      examForm.reset();
      toast({ 
        title: "Exam created successfully",
        description: "Click the 'Classes' button to assign classes to this exam"
      });
    },
    onError: () => {
      toast({ title: "Failed to create exam", variant: "destructive" });
    },
  });

  // Delete exam mutation
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      const response = await apiRequest("DELETE", `/api/exams/${examId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({ title: "Exam deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete exam", variant: "destructive" });
    },
  });

  // Add class to exam mutation
  const addClassToExamMutation = useMutation({
    mutationFn: async ({ examId, classId }: any) => {
      const response = await apiRequest("POST", `/api/exams/${examId}/classes`, {
        classId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExamForClasses, "classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-classes/all"] });
      toast({ title: "Class added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add class", variant: "destructive" });
    },
  });

  // Remove class from exam mutation
  const removeClassFromExamMutation = useMutation({
    mutationFn: async ({ examId, classId }: any) => {
      const response = await apiRequest("DELETE", `/api/exams/${examId}/classes/${classId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExamForClasses, "classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-classes/all"] });
      toast({ title: "Class removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove class", variant: "destructive" });
    },
  });

  // Update exam subject max marks mutation
  const updateExamSubjectMaxMarksMutation = useMutation({
    mutationFn: async ({ examSubjectId, maxMarks }: { examSubjectId: string; maxMarks: number }) => {
      const response = await apiRequest("PATCH", `/api/exam-subjects/${examSubjectId}`, {
        maxMarks
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExam, "subjects"] });
      // Silent success - no toast to avoid overwhelming the user
    },
    onError: () => {
      toast({ title: "Failed to update max marks", variant: "destructive" });
    },
  });

  // Update exam subject passing marks mutation
  const updateExamSubjectPassingMarksMutation = useMutation({
    mutationFn: async ({ examSubjectId, passingMarks }: { examSubjectId: string; passingMarks: number }) => {
      const response = await apiRequest("PATCH", `/api/exam-subjects/${examSubjectId}`, {
        passingMarks
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExam, "subjects"] });
      // Silent success - no toast to avoid overwhelming the user
    },
    onError: () => {
      toast({ title: "Failed to update passing marks", variant: "destructive" });
    },
  });

  // Enter marks mutation
  const enterMarksMutation = useMutation({
    mutationFn: async ({ examId, data }: any) => {
      const response = await apiRequest("POST", `/api/exams/${examId}/marks`, {
        ...data,
        marksObtained: parseFloat(data.marksObtained),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExam, "marks"] });
      toast({ title: "Marks entered successfully" });
    },
    onError: () => {
      toast({ title: "Failed to enter marks", variant: "destructive" });
    },
  });

  // Batch save marks mutation
  const batchSaveMarksMutation = useMutation({
    mutationFn: async ({ examId, marks }: { examId: string; marks: any[] }) => {
      const response = await apiRequest("POST", `/api/exams/${examId}/marks/batch`, marks);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExam, "marks"] });
      setDirtyMarks({});
      toast({ title: "All marks saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save marks", variant: "destructive" });
    },
  });

  // Calculate results mutation
  const calculateResultsMutation = useMutation({
    mutationFn: async (examId: string) => {
      const response = await apiRequest("POST", `/api/exams/${examId}/calculate-results`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedExam, "results"] });
      toast({ title: "Results calculated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to calculate results", variant: "destructive" });
    },
  });

  // Form for creating exam
  const examForm = useForm<z.infer<typeof examFormSchema>>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      name: "",
      description: "",
      examType: "mid_term",
      academicSessionId: "",
      totalMarks: "",
      passingMarks: "",
    },
  });

  const getExamStatus = (exam: any) => {
    // Check if exam has classes assigned
    const hasClasses = allExamClasses.some((ec: any) => ec.examId === exam.id);
    
    if (!hasClasses) {
      return { label: "Assign Classes", variant: "secondary" as const };
    }
    
    const now = new Date();
    const start = new Date(exam.startDate);
    const end = new Date(exam.endDate);

    if (now < start) return { label: "Upcoming", variant: "secondary" as const };
    if (now > end) return { label: "Completed", variant: "default" as const };
    return { label: "Ongoing", variant: "destructive" as const };
  };

  const getGradeColor = (grade: string) => {
    if (grade === "A+" || grade === "A") return "bg-green-500";
    if (grade === "B+" || grade === "B") return "bg-blue-500";
    if (grade === "C") return "bg-yellow-500";
    if (grade === "D") return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/more")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-purple-600" />
              Exam Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Exam Management</DialogTitle>
                  <DialogDescription>
                    Create exams, add subjects, enter student marks, and generate results with grades and report cards.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Creating an Exam</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>Click "Create Exam" and enter exam name (e.g., "First Term Exam 2024")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Select exam type (Mid-Term, Final, Quarterly, Unit Test)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Set start date, end date, total marks and passing marks</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">4.</span>
                        <span>Add subjects with maximum marks for each subject</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Entering Marks</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Go to Marks Entry tab → Select exam and subject</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Enter marks for each student (system validates against max marks)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Add remarks if needed (e.g., "Excellent performance", "Needs improvement")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Marks are saved automatically</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Generating Results</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Once all marks entered, go to Results tab</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Click "Calculate Results" - system computes grades, percentages</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Download individual report cards or class-wise results</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Results show Pass/Fail status based on passing marks</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">First Term Exam for Class 8. Create exam "Class 8 First Term" → Add subjects: Math (100), Science (100), English (100) → Enter marks for 40 students → Click "Calculate Results" → Download report cards → Distribute to parents!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">Create and manage exams, enter marks, and generate results</p>
        </div>
        </div>
        {(user?.role === "admin" || user?.role === "super_admin") && activeTab === "exams" && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Exam</DialogTitle>
                <DialogDescription>Add a new exam to the system</DialogDescription>
              </DialogHeader>
              <Form {...examForm}>
                <form onSubmit={examForm.handleSubmit((data) => createExamMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={examForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Mid-Term Exam 2024" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={examForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Exam description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={examForm.control}
                      name="examType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exam Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mid_term">Mid-Term</SelectItem>
                              <SelectItem value="final">Final</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="unit_test">Unit Test</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={examForm.control}
                      name="academicSessionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Academic Session</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select session" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sessions.map((session: any) => (
                                <SelectItem key={session.id} value={session.id}>
                                  {format(new Date(session.startDate), "yyyy")} - {format(new Date(session.endDate), "yyyy")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={examForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className="justify-start text-left font-normal">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={examForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className="justify-start text-left font-normal">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={examForm.control}
                      name="totalMarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Marks</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={examForm.control}
                      name="passingMarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passing Marks</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="40" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createExamMutation.isPending}>
                      {createExamMutation.isPending ? "Creating..." : "Create Exam"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="exams" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList className="h-12 p-1.5 gap-1">
          <TabsTrigger value="exams" className="px-6 py-2.5 text-sm font-medium">Exams</TabsTrigger>
          <TabsTrigger value="marks" className="px-6 py-2.5 text-sm font-medium">Marks Entry</TabsTrigger>
          <TabsTrigger value="results" className="px-6 py-2.5 text-sm font-medium">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Exams</CardTitle>
              <CardDescription>View and manage all exams</CardDescription>
              <div className="flex gap-4 mt-4">
                <Select value={sessionFilter} onValueChange={setSessionFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {format(new Date(session.startDate), "yyyy")} - {format(new Date(session.endDate), "yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mid_term">Mid-Term</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="unit_test">Unit Test</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {examsLoading ? (
                <p>Loading exams...</p>
              ) : exams.length === 0 ? (
                <p className="text-muted-foreground">No exams found</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[200px] font-semibold">Name</TableHead>
                        <TableHead className="w-[140px] font-semibold">Type</TableHead>
                        <TableHead className="w-[260px] font-semibold">Date Range</TableHead>
                        <TableHead className="w-[120px] text-center font-semibold">Total Marks</TableHead>
                        <TableHead className="w-[130px] text-center font-semibold">Passing Marks</TableHead>
                        <TableHead className="w-[140px] font-semibold">Status</TableHead>
                        <TableHead className="w-[200px] text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((exam: any) => {
                        const status = getExamStatus(exam);
                        const typeLabel = exam.examType === 'mid_term' ? 'Mid Term' : 
                                         exam.examType === 'final' ? 'Final' :
                                         exam.examType === 'quarterly' ? 'Quarterly' :
                                         exam.examType === 'unit_test' ? 'Unit Test' : 'Other';
                        return (
                          <TableRow key={exam.id} className="hover:bg-muted/30">
                            <TableCell className="font-semibold">{exam.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {typeLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col gap-1 py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-medium w-10">From:</span>
                                  <span className="font-medium">{format(new Date(exam.startDate), "MMM dd, yyyy")}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-medium w-10">To:</span>
                                  <span className="font-medium">{format(new Date(exam.endDate), "MMM dd, yyyy")}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                                {exam.totalMarks}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold">
                                {exam.passingMarks}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="whitespace-nowrap">{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedExamForClasses(exam.id);
                                  setIsManageClassesDialogOpen(true);
                                }}
                                className="whitespace-nowrap"
                              >
                                <GraduationCap className="h-4 w-4 mr-1" />
                                Classes
                              </Button>
                              {(user?.role === "admin" || user?.role === "super_admin") && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setExamToDelete({ id: exam.id, name: exam.name })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marks" className="space-y-4">
          {/* Filter Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle>Select Filters</CardTitle>
              <CardDescription>Choose exam, class, and subject to enter marks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap items-end">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Exam</Label>
                  <Select 
                    value={selectedExam || ""} 
                    onValueChange={(value) => {
                      setSelectedExam(value);
                      setSelectedClass(null);
                      setSelectedSubject(null);
                    }}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam: any) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedExam && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Class</Label>
                    <Select 
                      value={selectedClass || ""} 
                      onValueChange={(value) => {
                        setSelectedClass(value);
                        setSelectedSubject(null);
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {examClasses
                          .sort((a: any, b: any) => {
                            const getGradeNum = (grade: string) => {
                              if (!grade) return 999;
                              if (grade.toLowerCase().includes('playschool')) return 0;
                              if (grade.toLowerCase().includes('nursery')) return 0.5;
                              if (grade.toLowerCase().includes('lkg') || grade.toLowerCase().includes('kg1')) return 0.7;
                              if (grade.toLowerCase().includes('ukg') || grade.toLowerCase().includes('kg2')) return 0.9;
                              const match = grade.match(/\d+/);
                              return match ? parseInt(match[0]) : 999;
                            };
                            
                            const gradeA = a.class ? getGradeNum(a.class.grade) : 999;
                            const gradeB = b.class ? getGradeNum(b.class.grade) : 999;
                            
                            if (gradeA !== gradeB) return gradeA - gradeB;
                            
                            const sectionA = a.class?.section || '';
                            const sectionB = b.class?.section || '';
                            return sectionA.localeCompare(sectionB);
                          })
                          .map((ec: any) => {
                            const className = ec.class 
                              ? `${ec.class.grade}${ec.class.section ? ' ' + ec.class.section : ''}` 
                              : 'Unknown';
                            return (
                              <SelectItem key={ec.classId} value={ec.classId}>
                                {className}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {selectedClass && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Subject</Label>
                    <Select value={selectedSubject || ""} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {examSubjectsForMarks
                          .filter((es: any) => 
                            classSubjects.some((cs: any) => cs.subjectId === es.subjectId)
                          )
                          .map((es: any) => (
                            <SelectItem key={es.id} value={es.id}>
                              {es.subject?.name || 'Unknown Subject'}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Marks Configuration Card */}
          {selectedSubject && (
            <Card>
              <CardContent className="py-3">
                <div className="flex gap-6 flex-wrap items-center">
                  <MaxMarksInput 
                    selectedSubject={selectedSubject}
                    examSubjectsForMarks={examSubjectsForMarks}
                    updateMaxMarks={(examSubjectId: string, maxMarks: number) => {
                      updateExamSubjectMaxMarksMutation.mutate({
                        examSubjectId,
                        maxMarks
                      });
                    }}
                  />
                  <PassingMarksInput 
                    selectedSubject={selectedSubject}
                    examSubjectsForMarks={examSubjectsForMarks}
                    updatePassingMarks={(examSubjectId: string, passingMarks: number) => {
                      updateExamSubjectPassingMarksMutation.mutate({
                        examSubjectId,
                        passingMarks
                      });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Marks Entry Card */}
          {selectedExam && selectedClass && selectedSubject && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Enter Marks</CardTitle>
                  <CardDescription>Enter marks for students in the selected class and subject</CardDescription>
                </div>
                <Button
                    onClick={() => {
                      if (Object.keys(dirtyMarks).length === 0) {
                        toast({
                          title: "No changes to save",
                          description: "Please make some changes before saving.",
                        });
                        return;
                      }
                      
                      // Prepare data for batch save - filter out empty marks (but keep absent students)
                      const marksToSave = Object.values(dirtyMarks)
                        .filter((mark: any) => {
                          // Include if marks are entered OR if student is marked as absent
                          const hasMarks = mark.marksObtained !== "" && 
                                          mark.marksObtained !== null && 
                                          mark.marksObtained !== undefined;
                          const isAbsent = mark.isAbsent === true;
                          return hasMarks || isAbsent;
                        })
                        .map((mark: any) => ({
                          studentId: mark.studentId,
                          examSubjectId: mark.examSubjectId,
                          marksObtained: mark.marksObtained || null,
                          remarks: mark.remarks,
                          isAbsent: mark.isAbsent || false,
                        }));
                      
                      if (marksToSave.length === 0) {
                        toast({
                          title: "No valid marks to save",
                          description: "Please enter marks before saving.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Call batch save mutation
                      batchSaveMarksMutation.mutate({
                        examId: selectedExam!,
                        marks: marksToSave,
                      });
                    }}
                    disabled={batchSaveMarksMutation.isPending || Object.keys(dirtyMarks).length === 0}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {batchSaveMarksMutation.isPending ? "Saving..." : `Save All${Object.keys(dirtyMarks).length > 0 ? ` (${Object.keys(dirtyMarks).length})` : ""}`}
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead className="w-40">Marks (out of {examSubjectsForMarks.find((es: any) => es.id === selectedSubject)?.maxMarks || 100})</TableHead>
                        <TableHead className="w-48">Remarks</TableHead>
                        <TableHead className="w-24 text-center">Absent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students
                        .filter((student: any) => student.classId === selectedClass)
                        .map((student: any, index: number) => {
                        const existingMark = examMarks.find(
                          (m: any) => m.studentId === student.id && m.examSubjectId === selectedSubject
                        );
                        
                        // Find the selected exam subject for max marks
                        const selectedExamSubject = examSubjectsForMarks.find((es: any) => es.id === selectedSubject);
                        const maxMarks = selectedExamSubject?.maxMarks || 100;
                        
                        return (
                          <StudentMarkRow
                            key={student.id}
                            index={index}
                            student={student}
                            existingMark={existingMark}
                            maxMarks={maxMarks}
                            examSubjectId={selectedSubject!}
                            onChange={(data) => {
                              const key = `${data.studentId}-${data.examSubjectId}`;
                              setDirtyMarks((prev) => ({
                                ...prev,
                                [key]: data,
                              }));
                            }}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Exam Results</CardTitle>
                  <CardDescription>View and calculate exam results</CardDescription>
                </div>
                {selectedExam && selectedClassForResults && (user?.role === "admin" || user?.role === "super_admin") && (() => {
                  // Check if there are any students with marks in the selected class
                  const studentsInClass = students.filter((s: any) => s.classId === selectedClassForResults);
                  const hasMarksForClass = studentsInClass.some((student: any) => 
                    examMarks.some((mark: any) => mark.studentId === student.id)
                  );
                  
                  // Only show button if class has students with marks
                  return hasMarksForClass && (
                    <Button
                      onClick={() => calculateResultsMutation.mutate(selectedExam)}
                      disabled={calculateResultsMutation.isPending}
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Calculate Results
                    </Button>
                  );
                })()}
              </div>
              <div className="flex gap-4 mt-4">
                <Select value={selectedExam || ""} onValueChange={(value) => {
                  setSelectedExam(value);
                  setSelectedClassForResults(null);
                }}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((exam: any) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedExam && examClassesForResults.length > 0 && (
                  <Select value={selectedClassForResults || ""} onValueChange={setSelectedClassForResults}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {examClassesForResults.map((examClass: any) => {
                        // Get class name from class object
                        const className = examClass.class?.name || 
                          (examClass.class?.grade && examClass.class?.section 
                            ? `${examClass.class.grade} ${examClass.class.section}` 
                            : "Unknown Class");
                        return (
                          <SelectItem key={examClass.classId} value={examClass.classId}>
                            {className}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedExam ? (
                <p className="text-muted-foreground">Please select an exam to view results</p>
              ) : !selectedClassForResults ? (
                <p className="text-muted-foreground">Please select a class to view results</p>
              ) : examResults.length === 0 ? (
                <p className="text-muted-foreground">No results available. Calculate results first.</p>
              ) : filteredExamResults.length === 0 ? (
                <p className="text-muted-foreground">No results found for the selected class.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Total Marks</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExamResults.map((result: any) => {
                      const student = students.find((s: any) => s.id === result.studentId);
                      return (
                        <TableRow key={result.id}>
                          <TableCell>{result.rank || "-"}</TableCell>
                          <TableCell>
                            {student ? `${student.firstName} ${student.lastName}` : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {result.totalMarksObtained} / {result.totalMaxMarks}
                          </TableCell>
                          <TableCell>{parseFloat(result.percentage).toFixed(2)}%</TableCell>
                          <TableCell>
                            <Badge className={getGradeColor(result.grade)}>
                              {result.grade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={result.result === "pass" ? "default" : "destructive"}>
                              {result.result.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const response = await apiRequest("GET", `/api/exams/${selectedExam}/students/${result.studentId}/report-card`);
                                  const reportData = await response.json();
                                  
                                  // Create HTML content for the report card
                                  const htmlContent = `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <title>Report Card - ${reportData.student.firstName} ${reportData.student.lastName}</title>
                                      <style>
                                        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                                        h1 { text-align: center; color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
                                        .header { text-align: center; margin-bottom: 30px; }
                                        .info { display: flex; justify-content: space-between; margin: 20px 0; }
                                        .info-item { flex: 1; }
                                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                        th { background-color: #4F46E5; color: white; }
                                        tr:nth-child(even) { background-color: #f9f9f9; }
                                        .summary { margin: 30px 0; padding: 20px; background-color: #f0f0f0; border-radius: 8px; }
                                        .summary-item { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
                                        .pass { color: green; font-weight: bold; }
                                        .fail { color: red; font-weight: bold; }
                                        @media print { body { padding: 20px; } }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="header">
                                        <h1>Report Card</h1>
                                        <h2>${reportData.exam.name}</h2>
                                      </div>
                                      
                                      <div class="info">
                                        <div class="info-item">
                                          <strong>Student Name:</strong> ${reportData.student.firstName} ${reportData.student.lastName}<br>
                                          <strong>Admission No:</strong> ${reportData.student.admissionNumber || 'N/A'}
                                        </div>
                                        <div class="info-item" style="text-align: right;">
                                          <strong>Class:</strong> ${reportData.student.className || 'N/A'}<br>
                                          <strong>Rank:</strong> ${reportData.result?.rank || 'N/A'}
                                        </div>
                                      </div>
                                      
                                      <table>
                                        <thead>
                                          <tr>
                                            <th>Subject</th>
                                            <th>Max Marks</th>
                                            <th>Marks Obtained</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          ${reportData.subjects.map((sub: any) => `
                                            <tr>
                                              <td>${sub.subjectName || 'Unknown'}</td>
                                              <td>${sub.maxMarks}</td>
                                              <td>${sub.marksObtained !== null ? sub.marksObtained : (sub.isAbsent ? 'Absent' : 'Not Entered')}</td>
                                              <td>${sub.marksObtained !== null ? (sub.marksObtained >= (sub.passingMarks || 0) ? '<span class="pass">Pass</span>' : '<span class="fail">Fail</span>') : '-'}</td>
                                            </tr>
                                          `).join('')}
                                        </tbody>
                                      </table>
                                      
                                      <div class="summary">
                                        <div class="summary-item">
                                          <span><strong>Total Marks:</strong></span>
                                          <span>${reportData.result?.totalMarksObtained || 0} / ${reportData.result?.totalMaxMarks || 0}</span>
                                        </div>
                                        <div class="summary-item">
                                          <span><strong>Percentage:</strong></span>
                                          <span>${reportData.result?.percentage || 0}%</span>
                                        </div>
                                        <div class="summary-item">
                                          <span><strong>Grade:</strong></span>
                                          <span>${reportData.result?.grade || 'N/A'}</span>
                                        </div>
                                        <div class="summary-item">
                                          <span><strong>Result:</strong></span>
                                          <span class="${reportData.result?.result === 'pass' ? 'pass' : 'fail'}">${reportData.result?.result?.toUpperCase() || 'N/A'}</span>
                                        </div>
                                      </div>
                                      
                                      <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
                                        Generated on ${new Date().toLocaleDateString()}
                                      </div>
                                    </body>
                                    </html>
                                  `;
                                  
                                  // Open in new window
                                  const printWindow = window.open('', '_blank');
                                  if (printWindow) {
                                    printWindow.document.write(htmlContent);
                                    printWindow.document.close();
                                  }
                                } catch (error) {
                                  toast({ 
                                    title: "Failed to generate report card", 
                                    variant: "destructive" 
                                  });
                                }
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={examToDelete !== null} onOpenChange={(open) => !open && setExamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the exam "{examToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (examToDelete) {
                  deleteExamMutation.mutate(examToDelete.id);
                  setExamToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Exam Classes Dialog */}
      <Dialog open={isManageClassesDialogOpen} onOpenChange={setIsManageClassesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Classes - {exams.find((e: any) => e.id === selectedExamForClasses)?.name || "Exam"}
            </DialogTitle>
            <DialogDescription>
              Select classes for this exam. Selected classes will appear as badges below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Assigned Classes as Badges */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Assigned Classes ({currentExamClasses.length})
              </Label>
              <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded-md bg-muted/30">
                {currentExamClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes assigned yet</p>
                ) : (
                  currentExamClasses
                    .sort((a: any, b: any) => {
                      const getGradeNum = (grade: string) => {
                        if (!grade) return 999;
                        if (grade.toLowerCase().includes('playschool')) return 0;
                        if (grade.toLowerCase().includes('nursery')) return 0.5;
                        if (grade.toLowerCase().includes('lkg') || grade.toLowerCase().includes('kg1')) return 0.7;
                        if (grade.toLowerCase().includes('ukg') || grade.toLowerCase().includes('kg2')) return 0.9;
                        const match = grade.match(/\d+/);
                        return match ? parseInt(match[0]) : 999;
                      };
                      
                      const gradeA = a.class ? getGradeNum(a.class.grade) : 999;
                      const gradeB = b.class ? getGradeNum(b.class.grade) : 999;
                      
                      if (gradeA !== gradeB) return gradeA - gradeB;
                      
                      const sectionA = a.class?.section || '';
                      const sectionB = b.class?.section || '';
                      return sectionA.localeCompare(sectionB);
                    })
                    .map((examClass: any) => {
                      const className = examClass.class 
                        ? `${examClass.class.grade}${examClass.class.section ? ' ' + examClass.class.section : ''}` 
                        : 'Unknown';
                      return (
                        <div
                          key={examClass.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                        >
                          <span>{className}</span>
                          <button
                            onClick={() => {
                              removeClassFromExamMutation.mutate({
                                examId: selectedExamForClasses,
                                classId: examClass.classId,
                              });
                            }}
                            disabled={removeClassFromExamMutation.isPending}
                            className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Add Class Dropdown */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Add Classes</Label>
              <Select
                onValueChange={(classId) => {
                  if (classId) {
                    addClassToExamMutation.mutate({
                      examId: selectedExamForClasses,
                      classId: classId,
                    });
                  }
                }}
                disabled={addClassToExamMutation.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a class to add..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {classes
                    .filter((cls: any) => 
                      !currentExamClasses.some((ec: any) => ec.classId === cls.id)
                    )
                    .sort((a: any, b: any) => {
                      const getGradeNum = (grade: string) => {
                        if (grade.toLowerCase().includes('playschool')) return 0;
                        if (grade.toLowerCase().includes('nursery')) return 0.5;
                        if (grade.toLowerCase().includes('lkg') || grade.toLowerCase().includes('kg1')) return 0.7;
                        if (grade.toLowerCase().includes('ukg') || grade.toLowerCase().includes('kg2')) return 0.9;
                        const match = grade.match(/\d+/);
                        return match ? parseInt(match[0]) : 999;
                      };
                      
                      const gradeA = getGradeNum(a.grade);
                      const gradeB = getGradeNum(b.grade);
                      
                      if (gradeA !== gradeB) return gradeA - gradeB;
                      
                      const sectionA = a.section || '';
                      const sectionB = b.section || '';
                      return sectionA.localeCompare(sectionB);
                    })
                    .map((cls: any) => {
                      const className = `${cls.grade}${cls.section ? ' ' + cls.section : ''}`;
                      return (
                        <SelectItem key={cls.id} value={cls.id}>
                          {className}
                        </SelectItem>
                      );
                    })}
                  {classes.filter((cls: any) => 
                    !currentExamClasses.some((ec: any) => ec.classId === cls.id)
                  ).length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      All classes have been added
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsManageClassesDialogOpen(false);
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
