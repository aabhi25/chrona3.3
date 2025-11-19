import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  UserPlus,
  Users,
  UserCheck,
  Mail,
  Phone,
  BookOpen,
  Search,
  Edit,
  User,
  GraduationCap,
  Download,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { z } from "zod";
import * as XLSX from "xlsx";
import { sortClasses } from "@shared/classUtils";

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  classId?: string;
  rollNumber?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  status: "active" | "inactive" | "graduated" | "transferred";
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    grade: string;
    section: string;
  };
}


interface Class {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
}

const studentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(255, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(255, "Last name too long"),
  admissionNumber: z.string().min(1, "Admission number is required").max(50, "Admission number too long"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  contactNumber: z.string().min(10, "Contact number must be at least 10 digits").max(15, "Contact number too long").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().optional().or(z.literal("")),
  classId: z.string().min(1, "Class is required"),
  rollNumber: z.string().max(20, "Roll number too long").optional().or(z.literal("")),
  bloodGroup: z.string().max(5, "Blood group too long").optional().or(z.literal("")),
  emergencyContact: z.string().max(15, "Emergency contact too long").optional().or(z.literal("")),
});


type StudentFormData = z.infer<typeof studentFormSchema>;

export default function StudentsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const studentForm = useForm<StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      admissionNumber: "",
      email: "",
      contactNumber: "",
      dateOfBirth: "",
      gender: undefined,
      address: "",
      classId: "",
      rollNumber: "",
      bloodGroup: "",
      emergencyContact: "",
    },
  });


  // Students infinite query
  const {
    data: studentsData,
    isLoading: isStudentsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ students: Student[], totalCount: number }>({
    queryKey: ["/api/students", { classId: selectedClass !== "all" ? selectedClass : undefined }],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const params = new URLSearchParams({ 
        offset: offset.toString(),
        limit: '12' // Load 12 students per page
      });
      
      if (selectedClass !== "all") {
        params.append('classId', selectedClass);
      }
      
      const response = await apiRequest("GET", `/api/students?${params.toString()}`);
      return response.json() as Promise<{ students: Student[], totalCount: number }>;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.students && lastPage.students.length === 12) {
        const totalLoaded = allPages.reduce((sum, page) => sum + page.students.length, 0);
        return totalLoaded;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array of students
  const students = studentsData?.pages.flatMap(page => page.students) || [];
  const totalStudents = studentsData?.pages[0]?.totalCount || 0;

  // Intersection observer for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Auto-load more students when reaching bottom
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Set up intersection observer for auto-loading
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, students.length]);

  // Classes query
  const {
    data: classes = [],
    isLoading: isClassesLoading,
  } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });


  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const response = await apiRequest("POST", "/api/students", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setIsStudentDialogOpen(false);
      studentForm.reset();
      toast({
        title: "Success",
        description: "Student created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive",
      });
    },
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<StudentFormData>) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PUT", `/api/students/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setIsStudentDialogOpen(false);
      setEditingStudent(null);
      clearImageState();
      studentForm.reset();
      toast({
        title: "Success",
        description: "Student updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive",
      });
    },
  });

  const handleCreateStudent = async (data: StudentFormData) => {
    try {
      // Create student first
      const studentResult = await createStudentMutation.mutateAsync(data);
      
      // If there's a profile image, upload it
      if (selectedProfileImage && studentResult.id) {
        try {
          const profilePictureUrl = await uploadProfilePicture(studentResult.id, selectedProfileImage);
          
          toast({
            title: "Success",
            description: "Student and profile picture added successfully",
          });
        } catch (uploadError) {
          console.error("Profile picture upload failed:", uploadError);
          toast({
            title: "Warning",
            description: "Student created but profile picture upload failed",
            variant: "destructive",
          });
        }
        
        // Clean up after profile picture upload (success or failure)
        setIsStudentDialogOpen(false);
        clearImageState();
        studentForm.reset();
        return;
      }
      
      // If no profile picture, just close the dialog
      setIsStudentDialogOpen(false);
      clearImageState();
      studentForm.reset();
    } catch (error) {
      // Error is already handled by the mutation
    }
  };

  const handleUpdateStudent = async (data: StudentFormData) => {
    if (!editingStudent) return;
    
    try {
      // If a new profile image is selected, upload it first
      if (selectedProfileImage) {
        await uploadProfilePicture(editingStudent.id, selectedProfileImage);
      }
      
      // Update student with form data (profile picture URL is already updated by upload)
      updateStudentMutation.mutate({ id: editingStudent.id, ...data });
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/students/template", {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student_import_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Template downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handleBulkImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/students/bulk-import", {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Import failed");
      }

      setImportResults(result);
      
      // Refresh students data
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });

      toast({
        title: "Import Complete",
        description: `${result.studentsCreated} students imported successfully`,
      });

    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import students",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Profile picture upload function
  const uploadProfilePicture = async (studentId: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    const token = localStorage.getItem("authToken");
    const response = await fetch(`/api/students/${studentId}/upload-profile-picture`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload profile picture');
    }
    
    const result = await response.json();
    
    // Force immediate cache invalidation and refetch to show the updated profile picture
    await queryClient.invalidateQueries({ queryKey: ["/api/students"] });
    await queryClient.refetchQueries({ queryKey: ["/api/students"] });
    
    return result.profilePictureUrl;
  };

  const clearImageState = () => {
    setSelectedProfileImage(null);
    setProfileImagePreview(null);
    // Reset the file input
    const fileInput = document.getElementById('student-profile-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleProfileImageSelect = (file: File) => {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid image file (JPEG, PNG, GIF, or WebP)",
        variant: "destructive",
      });
      return;
    }

    setSelectedProfileImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfileImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExportStudents = async () => {
    try {
      // Use filtered students instead of all students
      const studentsToExport = filteredStudents;

      // Prepare data for Excel
      const workbook = XLSX.utils.book_new();
      
      // Create header row
      const headers = [
        "Admission Number",
        "First Name", 
        "Last Name",
        "Class",
        "Roll Number",
        "Email",
        "Contact Number",
        "Date of Birth",
        "Gender",
        "Blood Group",
        "Address",
        "Emergency Contact",
        "Status"
      ];

      // Create data rows
      const data = [headers];
      
      studentsToExport.forEach(student => {
        const classInfo = student.class ? `${student.class.grade} ${student.class.section}` : '';
        data.push([
          student.admissionNumber || '',
          student.firstName || '',
          student.lastName || '',
          classInfo,
          student.rollNumber || '',
          student.email || '',
          student.contactNumber || '',
          student.dateOfBirth || '',
          student.gender || '',
          student.bloodGroup || '',
          student.address || '',
          student.emergencyContact || '',
          student.status || 'active'
        ]);
      });

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      const columnWidths = [
        { wch: 15 }, // Admission Number
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 10 }, // Class
        { wch: 10 }, // Roll Number
        { wch: 25 }, // Email
        { wch: 15 }, // Contact Number
        { wch: 15 }, // Date of Birth
        { wch: 10 }, // Gender
        { wch: 10 }, // Blood Group
        { wch: 30 }, // Address
        { wch: 15 }, // Emergency Contact
        { wch: 10 }  // Status
      ];
      worksheet['!cols'] = columnWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      
      // Generate buffer and download
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `students_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${studentsToExport.length} students to Excel successfully`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export students data",
        variant: "destructive",
      });
    }
  };





  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    clearImageState(); // Clear any previous profile image state
    studentForm.reset({
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      email: student.email || "",
      contactNumber: student.contactNumber || "",
      dateOfBirth: student.dateOfBirth || "",
      gender: student.gender,
      address: student.address || "",
      classId: student.classId || "",
      rollNumber: student.rollNumber || "",
      bloodGroup: student.bloodGroup || "",
      emergencyContact: student.emergencyContact || "",
    });
    setIsStudentDialogOpen(true);
  };

  // Filter and sort students based on search term, class, and status
  const filteredStudents = students
    .filter(student => {
      const matchesSearch = 
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesClass = selectedClass === "all" || student.classId === selectedClass;
      
      return matchesSearch && matchesClass;
    })
    .sort((a, b) => {
      // Sort alphabetically by first name, then by last name
      const firstNameComparison = a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
      if (firstNameComparison !== 0) {
        return firstNameComparison;
      }
      return a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase());
    });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-purple-600" />
            Students
          </h1>
          <p className="text-sm text-muted-foreground">Manage student records and profiles</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-student-actions">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Student
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => {
                  setEditingStudent(null);
                  clearImageState();
                  studentForm.reset();
                  setIsStudentDialogOpen(true);
                }}
                data-testid="menu-add-single-student"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Single Student
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLocation('/students/bulk-upload')}
                data-testid="menu-bulk-import"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Multiple Students
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-students"
                />
              </div>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full md:w-[200px]" data-testid="filter-class">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {sortClasses(classes).map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.grade} {cls.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Students ({totalStudents})</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportStudents} data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isStudentsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-4 w-36" />
                </Card>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No students found</h3>
              <p className="text-muted-foreground">
                {students.length === 0
                  ? "No students have been added yet."
                  : "No students match your current filters."
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.map((student) => (
                <Card 
                  key={student.id} 
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20 cursor-pointer bg-gradient-to-br from-white to-gray-50/30 dark:from-slate-900 dark:to-slate-800/30" 
                  data-testid={`student-card-${student.id}`}
                  onClick={() => setLocation(`/students/${student.id}`)}
                >
                  {/* Decorative gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
                  
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          {student.profilePictureUrl ? (
                            <>
                              <img
                                src={student.profilePictureUrl}
                                alt={`${student.firstName} ${student.lastName}'s profile`}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md dark:border-slate-700 group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                                }}
                              />
                              <div 
                                className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center absolute top-0 left-0 border-2 border-white shadow-md dark:border-slate-700"
                                style={{ display: 'none' }}
                              >
                                <User className="h-6 w-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-md dark:border-slate-700 group-hover:scale-105 transition-transform duration-200">
                              <User className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base mb-0.5 truncate" data-testid={`student-name-${student.id}`}>
                            {student.firstName} {student.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {student.admissionNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStudent(student);
                          }}
                          className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                          data-testid={`edit-student-${student.id}`}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pb-4">
                    {/* Class Information */}
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex-shrink-0 mt-0.5">
                        <BookOpen className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Class</p>
                        {student.class ? (
                          <p className="text-sm font-medium">
                            Class {student.class.grade} {student.class.section}
                          </p>
                        ) : (
                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                            Not Assigned
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Roll Number */}
                    {student.rollNumber && (
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex-shrink-0 mt-0.5">
                          <GraduationCap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Roll No</p>
                          <p className="text-sm font-medium">{student.rollNumber}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Infinite scroll load more trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more students...</span>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  onClick={loadMore}
                  className="text-muted-foreground"
                  data-testid="button-load-more"
                >
                  Load more students
                </Button>
              )}
            </div>
          )}

          {!hasNextPage && students.length > 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              You've reached the end of the list
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Form Dialog */}
      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "Edit Student" : "Add New Student"}
            </DialogTitle>
            <DialogDescription>
              {editingStudent 
                ? "Update the student information below."
                : "Fill in the student information below. All required fields are marked with an asterisk."
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...studentForm}>
            <form onSubmit={studentForm.handleSubmit(editingStudent ? handleUpdateStudent : handleCreateStudent)} className="space-y-2">
              {/* Profile Picture Upload Section */}
              <div className="flex flex-col items-center space-y-2 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="relative w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border overflow-hidden">
                  {profileImagePreview ? (
                    <>
                      <img 
                        src={profileImagePreview} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      <button
                        type="button"
                        onClick={clearImageState}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </>
                  ) : editingStudent?.profilePictureUrl ? (
                    <>
                      <img 
                        src={editingStudent.profilePictureUrl} 
                        alt="Current profile" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Set preview to trigger the file selection interface
                          setProfileImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-600"
                        title="Change image"
                      >
                        ✎
                      </button>
                    </>
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleProfileImageSelect(file);
                      }
                    }}
                    className="hidden"
                    id="edit-student-profile-image-input"
                  />
                  <label
                    htmlFor="edit-student-profile-image-input"
                    className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    {editingStudent?.profilePictureUrl && !profileImagePreview ? 'Change Photo' : 'Choose Photo'}
                  </label>
                  <span className="text-xs text-gray-500 self-center">Max 5MB, JPG/PNG</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={studentForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter first name" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter last name" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={studentForm.control}
                  name="admissionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter admission number" {...field} data-testid="input-admission-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter roll number" {...field} data-testid="input-roll-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={studentForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.grade} {cls.section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date-of-birth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={studentForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter blood group" {...field} data-testid="input-blood-group" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={studentForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter contact number" {...field} data-testid="input-contact-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={studentForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter address" {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="emergencyContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact" {...field} data-testid="input-emergency-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsStudentDialogOpen(false);
                    setEditingStudent(null);
                    studentForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createStudentMutation.isPending || updateStudentMutation.isPending}
                  data-testid="button-submit-student"
                >
                  {createStudentMutation.isPending || updateStudentMutation.isPending 
                    ? "Saving..." 
                    : editingStudent ? "Update Student" : "Create Student"
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportDialogOpen} onOpenChange={setIsBulkImportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Import Students
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to import multiple students at once. Download the template first to ensure proper formatting.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            {/* Step 1: Download Template */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 text-sm font-bold rounded-full flex items-center justify-center">1</span>
                Download Template
              </h4>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  Download the Excel template with the correct format for student data
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadTemplate}
                  data-testid="button-download-template"
                  className="w-full"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Excel Template
                </Button>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 text-sm font-bold rounded-full flex items-center justify-center">2</span>
                Upload Excel File
              </h4>
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Drop your Excel file here, or click to browse</p>
                    <p className="text-xs text-gray-500">Supports .xlsx and .xls files (max 10MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setSelectedFile(file || null);
                      if (file) {
                        setImportResults(null);
                      }
                    }}
                    data-testid="input-file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    Choose File
                  </label>
                </div>
              </div>
            </div>

            {/* Import Instructions */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h5 className="font-medium text-yellow-800 mb-2">Important Notes:</h5>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Ensure all required fields are filled (First Name, Last Name, Admission Number, Class)</li>
                <li>• Admission numbers must be unique across all students</li>
                <li>• Class names must match existing classes in the system</li>
                <li>• Invalid rows will be skipped and reported after import</li>
              </ul>
            </div>

            {/* Import Results */}
            {importResults && (
              <div className="space-y-2">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h5 className="font-medium text-green-800 mb-2">Import Results</h5>
                  <div className="text-sm text-green-700">
                    <p className="font-medium">✅ Successfully imported: {importResults.studentsCreated} students</p>
                    {importResults.errors && importResults.errors.length > 0 && (
                      <p className="text-orange-700">⚠️ Errors in {importResults.errors.length} rows</p>
                    )}
                  </div>
                </div>

                {/* Error Details */}
                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200 max-h-40 overflow-y-auto">
                    <h6 className="font-medium text-red-800 mb-2">Import Errors:</h6>
                    <div className="space-y-2">
                      {importResults.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium text-red-700">Row {error.row}:</span>
                          <ul className="ml-4 text-red-600">
                            {error.errors.map((err: string, errIndex: number) => (
                              <li key={errIndex}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* File Selection Display */}
            {selectedFile && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{selectedFile.name}</span>
                    <span className="text-xs text-blue-600">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setImportResults(null);
                      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    }}
                    className="h-6 w-6 p-0 text-blue-600"
                  >
                    ×
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkImportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              disabled={!selectedFile || isImporting}
              onClick={handleBulkImport}
              data-testid="button-import-students"
            >
              {isImporting ? "Importing..." : "Import Students"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}