import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, CheckCircle, Upload, Trash2, Building, Eye, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { validateGrade, sortClasses } from "@shared/classUtils";

interface TeacherImportData {
  name: string;
  contactNumber: string;
  email?: string;
  designation?: string;
  schoolIdNumber?: string;
  maxDailyPeriods?: number;
  aadhar?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  dateOfBirth?: string;
  fatherHusbandName?: string;
  address?: string;
  category?: string;
  religion?: string;
  originalRowNumber: number;
}

interface StudentImportData {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  grade: string;
  section: string;
  rollNumber?: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  originalRowNumber: number;
}

interface AssignmentImportData {
  teacherSchoolId: string;
  grade: string;
  section: string;
  subjectCode?: string; // Auto-generated server-side
  subjectName: string;
  weeklyFrequency: number;
  originalRowNumber: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CellError {
  message: string;
}

interface School {
  id: string;
  name: string;
}

export default function BulkReviewPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherImportData[]>([]);
  const [students, setStudents] = useState<StudentImportData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentImportData[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [cellErrors, setCellErrors] = useState<Record<string, CellError>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [classesToCreate, setClassesToCreate] = useState<Array<{ grade: string; section: string }>>([]);
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean;
    stage: string;
    percentage: number;
  }>({ isImporting: false, stage: '', percentage: 0 });
  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState<number | null>(null);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number | null>(null);
  const [validTeacherIds, setValidTeacherIds] = useState<Set<string>>(new Set());
  const [showErrorsFirst, setShowErrorsFirst] = useState(false);

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ["/api/school-info"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/school-info");
      return await response.json();
    },
    enabled: !!schoolId,
  });

  // Fetch existing teachers to validate assignment teacher IDs
  const { data: existingTeachersData } = useQuery({
    queryKey: ["/api/teachers", schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/teachers?schoolId=${schoolId}`);
      const data = await response.json();
      return data.teachers || [];
    },
    enabled: !!schoolId,
  });

  // Fetch timetable structure to calculate weekly period limit
  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!schoolId,
  });

  // Validate weekly period allocations per class
  const validateWeeklyPeriods = (assignmentsList: AssignmentImportData[]): Record<string, CellError> => {
    // Calculate weekly period cap dynamically based on timetable structure
    // Formula: (teaching periods per day) × (working days per week)
    const structure = timetableStructure as any;
    const teachingPeriodsPerDay = structure?.timeSlots?.filter((slot: any) => !slot.isBreak).length || 7;
    const workingDaysPerWeek = structure?.workingDays?.length || 6;
    const WEEKLY_PERIOD_CAP = teachingPeriodsPerDay * workingDaysPerWeek;
    
    const newErrors: Record<string, CellError> = {};
    
    // Group assignments by class (grade-section)
    const assignmentsByClass = new Map<string, Array<{ index: number; assignment: AssignmentImportData }>>();
    
    assignmentsList.forEach((assignment, index) => {
      if (assignment.grade && assignment.section) {
        const classKey = `${assignment.grade}-${assignment.section}`;
        if (!assignmentsByClass.has(classKey)) {
          assignmentsByClass.set(classKey, []);
        }
        assignmentsByClass.get(classKey)!.push({ index, assignment });
      }
    });
    
    // Calculate totals and check limits for each class
    assignmentsByClass.forEach((classAssignments, classKey) => {
      const totalPeriods = classAssignments.reduce(
        (sum, { assignment }) => sum + (assignment.weeklyFrequency || 0), 
        0
      );
      
      if (totalPeriods > WEEKLY_PERIOD_CAP) {
        const exceedBy = totalPeriods - WEEKLY_PERIOD_CAP;
        const [grade, section] = classKey.split('-');
        const className = `Class ${grade}-${section}`;
        const errorMessage = `${className}: Total of ${totalPeriods} periods exceeds weekly limit of ${WEEKLY_PERIOD_CAP} (over by ${exceedBy}). Reduce period counts for this class.`;
        
        // Add error to all assignments in this class
        classAssignments.forEach(({ index }) => {
          newErrors[`assignment-${index}-weeklyFrequency`] = { message: errorMessage };
        });
      }
    });
    
    return newErrors;
  };

  useEffect(() => {
    const storedData = sessionStorage.getItem('bulkUploadData');
    
    if (!storedData) {
      toast({
        variant: "destructive",
        title: "No Data Found",
        description: "No uploaded data found. Please upload a file first."
      });
      setLocation('/settings/bulk-upload');
      return;
    }

    try {
      const parsedData = JSON.parse(storedData);
      
      // For school admins, schoolId comes from the parsed data
      // (Super admins are now blocked from using smart upload)
      if (parsedData.schoolId) {
        setSchoolId(parsedData.schoolId);
      }
      setTeachers(parsedData.teachers || []);
      setStudents(parsedData.students || []);
      
      // Subject codes are now auto-generated server-side during import
      setAssignments(parsedData.assignments || []);
      setValidationErrors(parsedData.errors || []);
      setClassesToCreate(parsedData.classesToCreate || []);
      
      const errors: Record<string, CellError> = {};
      (parsedData.errors || []).forEach((error: ValidationError) => {
        // Define assignment-specific fields first (check these before generic field names)
        const assignmentFields = ['teacherSchoolId', 'grade', 'section', 'subjectName', 'weeklyFrequency'];
        const teacherFields = ['name', 'contactNumber', 'schoolIdNumber', 'email', 'designation', 'aadhar', 'gender', 'bloodGroup', 'dateOfBirth', 'fatherHusbandName', 'address', 'category', 'religion'];
        const studentFields = ['firstName', 'lastName', 'admissionNumber', 'rollNumber', 'emergencyContact', 'email', 'contactNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'address'];
        
        let type: 'teacher' | 'student' | 'assignment';
        
        // Check assignment fields first to avoid false matches (e.g., teacherSchoolId contains "teacher")
        if (assignmentFields.includes(error.field)) {
          type = 'assignment';
        } else if (teacherFields.includes(error.field)) {
          type = 'teacher';
        } else if (studentFields.includes(error.field)) {
          type = 'student';
        } else {
          // Fallback: try to find which array has a matching row number
          const teacherIndex = parsedData.teachers.findIndex((t: TeacherImportData) => t.originalRowNumber === error.row);
          const studentIndex = parsedData.students.findIndex((s: StudentImportData) => s.originalRowNumber === error.row);
          const assignmentIndex = parsedData.assignments.findIndex((a: AssignmentImportData) => a.originalRowNumber === error.row);
          
          if (teacherIndex >= 0) type = 'teacher';
          else if (studentIndex >= 0) type = 'student';
          else if (assignmentIndex >= 0) type = 'assignment';
          else type = 'assignment'; // default fallback
        }
        
        let index = -1;
        if (type === 'teacher') {
          index = parsedData.teachers.findIndex((t: TeacherImportData) => t.originalRowNumber === error.row);
        } else if (type === 'student') {
          index = parsedData.students.findIndex((s: StudentImportData) => s.originalRowNumber === error.row);
        } else {
          index = parsedData.assignments.findIndex((a: AssignmentImportData) => a.originalRowNumber === error.row);
        }
        
        if (index >= 0) {
          errors[`${type}-${index}-${error.field}`] = { message: error.message };
        }
      });
      
      // Validate weekly period allocations immediately after loading assignments
      if (parsedData.assignments && parsedData.assignments.length > 0) {
        const periodErrors = validateWeeklyPeriods(parsedData.assignments);
        Object.assign(errors, periodErrors);
      }
      
      setCellErrors(errors);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Failed to load uploaded data. Please try uploading again."
      });
      setLocation('/settings/bulk-upload');
    }
  }, [toast, setLocation]);

  // Build set of valid teacher IDs from uploaded teachers + existing database teachers
  useEffect(() => {
    const ids = new Set<string>();
    
    // Add uploaded teacher IDs
    teachers.forEach(teacher => {
      if (teacher.schoolIdNumber && teacher.schoolIdNumber.trim()) {
        ids.add(teacher.schoolIdNumber.trim());
      }
    });
    
    // Add existing database teacher IDs
    if (existingTeachersData && Array.isArray(existingTeachersData)) {
      existingTeachersData.forEach((teacher: any) => {
        if (teacher.schoolIdNumber && teacher.schoolIdNumber.trim()) {
          ids.add(teacher.schoolIdNumber.trim());
        }
      });
    }
    
    setValidTeacherIds(ids);
  }, [teachers, existingTeachersData]);

  // Validate teacher IDs in assignments whenever validTeacherIds changes
  useEffect(() => {
    if (validTeacherIds.size === 0 || assignments.length === 0) return;
    
    const newErrors = { ...cellErrors };
    
    // Clear previous teacher ID validation errors
    Object.keys(newErrors).forEach(key => {
      if (key.includes('-teacherSchoolId') && newErrors[key].message.includes('Unknown Teacher School ID')) {
        delete newErrors[key];
      }
    });
    
    // Check each assignment's teacher ID
    assignments.forEach((assignment, index) => {
      if (assignment.teacherSchoolId && assignment.teacherSchoolId.trim()) {
        const teacherId = assignment.teacherSchoolId.trim();
        
        if (!validTeacherIds.has(teacherId)) {
          newErrors[`assignment-${index}-teacherSchoolId`] = {
            message: 'Unknown Teacher School ID - not in uploaded sheet or database'
          };
        }
      }
    });
    
    setCellErrors(newErrors);
  }, [validTeacherIds, assignments]);

  // Validate subject code consistency on load
  useEffect(() => {
    if (assignments.length === 0) return;
    
    const newErrors = { ...cellErrors };
    
    // Clear previous subject code consistency errors
    Object.keys(newErrors).forEach(key => {
      if (key.includes('-subjectCode') && newErrors[key].message.includes('should use the same subject code')) {
        delete newErrors[key];
      }
    });
    
    // Validate subject code consistency within same grade
    const gradeSubjectMap = new Map<string, Map<string, { code: string; indices: number[] }>>();
    
    assignments.forEach((assignment, idx) => {
      if (assignment.grade && assignment.subjectName && assignment.subjectCode) {
        const grade = assignment.grade.trim();
        const subjectName = assignment.subjectName.trim().toLowerCase();
        const subjectCode = assignment.subjectCode.trim();
        
        if (!gradeSubjectMap.has(grade)) {
          gradeSubjectMap.set(grade, new Map());
        }
        
        const subjectMap = gradeSubjectMap.get(grade)!;
        
        if (!subjectMap.has(subjectName)) {
          subjectMap.set(subjectName, { code: subjectCode, indices: [idx] });
        } else {
          const existing = subjectMap.get(subjectName)!;
          existing.indices.push(idx);
          
          // If codes differ, mark all as errors
          if (existing.code !== subjectCode) {
            existing.indices.forEach(errorIdx => {
              const errorAssignment = assignments[errorIdx];
              newErrors[`assignment-${errorIdx}-subjectCode`] = {
                message: `All sections of Class ${grade} for "${errorAssignment.subjectName}" should use the same subject code (found: ${existing.code}, ${subjectCode})`
              };
            });
          }
        }
      }
    });
    
    setCellErrors(newErrors);
  }, [assignments]);

  const removeTeacher = (index: number) => {
    const newTeachers = teachers.filter((_, i) => i !== index);
    setTeachers(newTeachers);
    
    const newErrors = { ...cellErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`teacher-${index}-`)) {
        delete newErrors[key];
      } else if (key.startsWith('teacher-')) {
        const match = key.match(/^teacher-(\d+)-(.+)$/);
        if (match) {
          const rowIndex = parseInt(match[1]);
          if (rowIndex > index) {
            const field = match[2];
            newErrors[`teacher-${rowIndex - 1}-${field}`] = newErrors[key];
            delete newErrors[key];
          }
        }
      }
    });
    setCellErrors(newErrors);
  };

  const removeStudent = (index: number) => {
    const newStudents = students.filter((_, i) => i !== index);
    setStudents(newStudents);
    
    const newErrors = { ...cellErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`student-${index}-`)) {
        delete newErrors[key];
      } else if (key.startsWith('student-')) {
        const match = key.match(/^student-(\d+)-(.+)$/);
        if (match) {
          const rowIndex = parseInt(match[1]);
          if (rowIndex > index) {
            const field = match[2];
            newErrors[`student-${rowIndex - 1}-${field}`] = newErrors[key];
            delete newErrors[key];
          }
        }
      }
    });
    setCellErrors(newErrors);
  };

  const removeAssignment = (index: number) => {
    const newAssignments = assignments.filter((_, i) => i !== index);
    setAssignments(newAssignments);
    
    const newErrors = { ...cellErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`assignment-${index}-`)) {
        delete newErrors[key];
      } else if (key.startsWith('assignment-')) {
        const match = key.match(/^assignment-(\d+)-(.+)$/);
        if (match) {
          const rowIndex = parseInt(match[1]);
          if (rowIndex > index) {
            const field = match[2];
            newErrors[`assignment-${rowIndex - 1}-${field}`] = newErrors[key];
            delete newErrors[key];
          }
        }
      }
    });
    setCellErrors(newErrors);
  };

  const updateTeacher = (index: number, field: keyof TeacherImportData, value: any) => {
    const newTeachers = [...teachers];
    (newTeachers[index] as any)[field] = value;
    setTeachers(newTeachers);
    
    const errorKey = `teacher-${index}-${field}`;
    const newErrors = { ...cellErrors };
    
    // Remove existing error for this field
    if (newErrors[errorKey]) {
      delete newErrors[errorKey];
    }
    
    // Validate required fields in real-time
    if (field === 'name' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'Name is required' };
    } else if (field === 'contactNumber') {
      if (!value || value.trim() === '') {
        newErrors[errorKey] = { message: 'Mobile number is required' };
      } else if (!/^\d{10}$/.test(value)) {
        newErrors[errorKey] = { message: 'Mobile number must be exactly 10 digits' };
      }
    } else if (field === 'schoolIdNumber' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'School ID is required' };
    } else if (field === 'email' && value && value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      newErrors[errorKey] = { message: 'Invalid email format' };
    }
    
    setCellErrors(newErrors);
  };

  const updateStudent = (index: number, field: keyof StudentImportData, value: any) => {
    const newStudents = [...students];
    (newStudents[index] as any)[field] = value;
    setStudents(newStudents);
    
    const errorKey = `student-${index}-${field}`;
    const newErrors = { ...cellErrors };
    
    // Remove existing error for this field
    if (newErrors[errorKey]) {
      delete newErrors[errorKey];
    }
    
    // Validate required fields in real-time
    if (field === 'firstName' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'First name is required' };
    } else if (field === 'lastName' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'Last name is required' };
    } else if (field === 'admissionNumber' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'Admission number is required' };
    } else if (field === 'grade') {
      // Validate grade format using shared validation utility
      const gradeValidation = validateGrade(value);
      if (!gradeValidation.isValid) {
        newErrors[errorKey] = { message: gradeValidation.error || 'Invalid grade' };
      }
    } else if (field === 'contactNumber' && value && value.trim() !== '' && !/^\d{10}$/.test(value)) {
      newErrors[errorKey] = { message: 'Contact number must be exactly 10 digits' };
    } else if (field === 'email' && value && value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      newErrors[errorKey] = { message: 'Invalid email format' };
    }
    
    // Real-time roll number duplicate validation
    if (field === 'rollNumber' || field === 'grade' || field === 'section') {
      // Clear all roll number errors for this class first
      const currentStudent = newStudents[index];
      const classKey = `${currentStudent.grade}-${currentStudent.section || ''}`;
      
      // Clear previous roll number errors for students in this class
      Object.keys(newErrors).forEach(key => {
        if (key.includes('-rollNumber')) {
          delete newErrors[key];
        }
      });
      
      // Check for roll number duplicates within same class-section
      const rollNumberMap = new Map<string, number[]>();
      newStudents.forEach((student, idx) => {
        if (student.rollNumber && student.rollNumber.trim() !== '') {
          const studentClassKey = `${student.grade}-${student.section || ''}`;
          const rollKey = `${studentClassKey}|${student.rollNumber.trim()}`;
          
          if (!rollNumberMap.has(rollKey)) {
            rollNumberMap.set(rollKey, []);
          }
          rollNumberMap.get(rollKey)!.push(idx);
        }
      });
      
      // Add errors for duplicates
      rollNumberMap.forEach((indices, key) => {
        if (indices.length > 1) {
          const [classKey, rollNumber] = key.split('|');
          const [grade, section] = classKey.split('-');
          const sectionDisplay = section ? `-${section}` : '';
          
          indices.forEach(idx => {
            newErrors[`student-${idx}-rollNumber`] = { 
              message: `Roll number ${rollNumber} is duplicate in Class ${grade}${sectionDisplay}` 
            };
          });
        }
      });
    }
    
    setCellErrors(newErrors);
  };

  const updateAssignment = (index: number, field: keyof AssignmentImportData, value: any) => {
    const newAssignments = [...assignments];
    (newAssignments[index] as any)[field] = value;
    
    // Subject codes are auto-generated server-side during import
    
    setAssignments(newAssignments);
    
    // Clear the current field error
    const errorKey = `assignment-${index}-${field}`;
    const newErrors = { ...cellErrors };
    if (newErrors[errorKey]) {
      delete newErrors[errorKey];
    }
    
    // Validate required fields in real-time
    if (field === 'teacherSchoolId' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'Teacher School ID is required' };
    } else if (field === 'grade') {
      // Validate grade format using shared validation utility
      const gradeValidation = validateGrade(value);
      if (!gradeValidation.isValid) {
        newErrors[errorKey] = { message: gradeValidation.error || 'Invalid grade' };
      }
    } else if (field === 'subjectName' && (!value || value.trim() === '')) {
      newErrors[errorKey] = { message: 'Subject name is required' };
    } else if (field === 'weeklyFrequency') {
      if (!value || value < 1) {
        newErrors[errorKey] = { message: 'Weekly frequency must be at least 1' };
      }
    }
    
    // Re-validate duplicates when grade/section/subject changes
    if (field === 'grade' || field === 'section' || field === 'subjectName') {
      // Clear previous duplicate and subject code errors
      Object.keys(newErrors).forEach(key => {
        if (key.includes('-subjectCode') && (
          newErrors[key].message.includes('Duplicate assignment') ||
          newErrors[key].message.includes('should use the same subject code')
        )) {
          delete newErrors[key];
        }
      });
      
      // Check for duplicate class-subject assignments
      const assignmentMap = new Map<string, number[]>();
      newAssignments.forEach((assignment, idx) => {
        if (assignment.grade && assignment.subjectCode) {
          const section = assignment.section || '';
          const assignmentKey = `${assignment.grade}-${section}-${assignment.subjectCode}`;
          
          if (!assignmentMap.has(assignmentKey)) {
            assignmentMap.set(assignmentKey, []);
          }
          assignmentMap.get(assignmentKey)!.push(idx);
        }
      });
      
      // Add errors for duplicates
      assignmentMap.forEach((indices) => {
        if (indices.length > 1) {
          indices.forEach(idx => {
            newErrors[`assignment-${idx}-subjectCode`] = { 
              message: `Duplicate assignment for this class-subject combination` 
            };
          });
        }
      });
      
      // Validate subject code consistency within same grade
      // Rule: Same subject name in same grade should have same subject code across all sections
      const gradeSubjectMap = new Map<string, Map<string, { code: string; indices: number[] }>>();
      
      newAssignments.forEach((assignment, idx) => {
        if (assignment.grade && assignment.subjectName && assignment.subjectCode) {
          const grade = assignment.grade.trim();
          const subjectName = assignment.subjectName.trim().toLowerCase();
          const subjectCode = assignment.subjectCode.trim();
          
          if (!gradeSubjectMap.has(grade)) {
            gradeSubjectMap.set(grade, new Map());
          }
          
          const subjectMap = gradeSubjectMap.get(grade)!;
          
          if (!subjectMap.has(subjectName)) {
            subjectMap.set(subjectName, { code: subjectCode, indices: [idx] });
          } else {
            const existing = subjectMap.get(subjectName)!;
            existing.indices.push(idx);
            
            // If codes differ, mark all as errors
            if (existing.code !== subjectCode) {
              existing.indices.forEach(errorIdx => {
                const errorAssignment = newAssignments[errorIdx];
                const section = errorAssignment.section ? `-${errorAssignment.section}` : '';
                newErrors[`assignment-${errorIdx}-subjectCode`] = {
                  message: `All sections of Class ${grade} for "${errorAssignment.subjectName}" should use the same subject code (found: ${existing.code}, ${subjectCode})`
                };
              });
            }
          }
        }
      });
    }
    
    // Validate teacher ID exists when editing teacherSchoolId
    if (field === 'teacherSchoolId' && value && value.trim()) {
      const teacherId = value.trim();
      if (validTeacherIds.size > 0 && !validTeacherIds.has(teacherId)) {
        newErrors[errorKey] = {
          message: 'Unknown Teacher School ID - not in uploaded sheet or database'
        };
      }
    }
    
    // Re-validate teacher workload when teacher/frequency changes
    if (field === 'teacherSchoolId' || field === 'weeklyFrequency') {
      // Clear previous teacher workload errors
      Object.keys(newErrors).forEach(key => {
        if (key.includes('-teacherSchoolId') && newErrors[key].message.includes('Teacher limit reached')) {
          delete newErrors[key];
        }
      });
      
      // Group assignments by teacher to check workload
      const teacherAssignmentMap = new Map<string, { indices: number[], totalPeriods: number }>();
      newAssignments.forEach((assignment, idx) => {
        if (assignment.teacherSchoolId && assignment.weeklyFrequency) {
          const teacherId = assignment.teacherSchoolId.trim();
          
          if (!teacherAssignmentMap.has(teacherId)) {
            teacherAssignmentMap.set(teacherId, { indices: [], totalPeriods: 0 });
          }
          
          const teacherData = teacherAssignmentMap.get(teacherId)!;
          teacherData.indices.push(idx);
          teacherData.totalPeriods += assignment.weeklyFrequency;
        }
      });
      
      // Calculate teacher weekly capacity dynamically
      const structure = timetableStructure as any;
      const workingDaysPerWeek = structure?.workingDays?.length || 6;
      const schoolDefaultMaxPeriods = (school as any)?.defaultMaxPeriodsPerDay || 6;
      
      teacherAssignmentMap.forEach((data, teacherId) => {
        // Find teacher in uploaded data or existing teachers
        const uploadedTeacher = teachers.find(t => t.schoolIdNumber === teacherId);
        const existingTeacher = existingTeachersData?.find((t: any) => t.schoolIdNumber === teacherId);
        
        // Priority: uploaded sheet > existing teacher > school default
        const teacherMaxDailyPeriods = 
          uploadedTeacher?.maxDailyPeriods ?? 
          existingTeacher?.maxDailyPeriods ?? 
          schoolDefaultMaxPeriods;
        
        const teacherWeeklyCapacity = teacherMaxDailyPeriods * workingDaysPerWeek;
        
        if (data.totalPeriods > teacherWeeklyCapacity) {
          data.indices.forEach(idx => {
            newErrors[`assignment-${idx}-teacherSchoolId`] = { 
              message: `Teacher limit reached - ${data.totalPeriods} periods assigned, max ${teacherWeeklyCapacity} allowed (${teacherMaxDailyPeriods} periods/day × ${workingDaysPerWeek} days)` 
            };
          });
        }
      });
    }
    
    // Re-validate weekly periods for all assignments when frequency/grade/section changes
    if (field === 'weeklyFrequency' || field === 'grade' || field === 'section') {
      // Remove old period-related errors (but keep required field errors we just added)
      Object.keys(newErrors).forEach(key => {
        if (key.includes('weeklyFrequency') && newErrors[key].message.includes('exceeds weekly limit')) {
          delete newErrors[key];
        }
      });
      
      // Calculate new period errors (only if required field validation passed)
      if (!newErrors[errorKey] || !newErrors[errorKey].message.includes('required')) {
        const periodErrors = validateWeeklyPeriods(newAssignments);
        Object.assign(newErrors, periodErrors);
      }
    }
    
    setCellErrors(newErrors);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const requestBody: any = {
        teachers,
        students,
        assignments
      };
      
      if (schoolId) {
        requestBody.schoolId = schoolId;
      }
      
      // Start import and get sessionId
      const response = await apiRequest("POST", "/api/bulk-upload/import", requestBody);
      const { sessionId } = await response.json();
      
      // Set importing state
      setImportProgress({ isImporting: true, stage: 'Starting import', percentage: 0 });
      
      // Start polling for progress
      return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const progressResponse = await apiRequest("GET", `/api/bulk-upload/import/progress/${sessionId}`);
            const progressData = await progressResponse.json();
            
            // Update progress state
            setImportProgress({
              isImporting: true,
              stage: progressData.stage,
              percentage: progressData.percentage
            });
            
            // Check if completed
            if (progressData.completed) {
              clearInterval(pollInterval);
              setImportProgress({ isImporting: false, stage: '', percentage: 0 });
              
              if (progressData.error) {
                reject(new Error(progressData.error));
              } else {
                resolve(progressData);
              }
            }
          } catch (error) {
            clearInterval(pollInterval);
            setImportProgress({ isImporting: false, stage: '', percentage: 0 });
            reject(error);
          }
        }, 500);
        
        // Cleanup on component unmount
        return () => clearInterval(pollInterval);
      });
    },
    onSuccess: () => {
      toast({
        title: "Import Successful",
        description: "Data has been imported successfully. Next step: Generate login credentials for teachers and students in User Management."
      });
      sessionStorage.removeItem('bulkUploadData');
      sessionStorage.removeItem('bulkUploadSchoolId');
      setLocation('/settings');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import data"
      });
    }
  });

  const hasErrors = Object.keys(cellErrors).length > 0;
  const errorCount = Object.keys(cellErrors).length;

  // Precompute error indices sets for O(1) lookup performance
  const errorIndicesSets = useMemo(() => {
    const teacherErrors = new Set<number>();
    const studentErrors = new Set<number>();
    const assignmentErrors = new Set<number>();
    
    Object.keys(cellErrors).forEach(key => {
      const match = key.match(/^(teacher|student|assignment)-(\d+)-/);
      if (match) {
        const [, type, indexStr] = match;
        const index = parseInt(indexStr, 10);
        
        if (type === 'teacher') teacherErrors.add(index);
        else if (type === 'student') studentErrors.add(index);
        else if (type === 'assignment') assignmentErrors.add(index);
      }
    });
    
    return { teacherErrors, studentErrors, assignmentErrors };
  }, [cellErrors]);

  // Memoized sorted teachers with O(1) error checking and stable index tracking
  const sortedTeachers = useMemo(() => {
    if (!showErrorsFirst) return teachers.map((teacher, index) => ({ ...teacher, __originalIndex: index }));
    
    // Decorate with index, sort, then preserve original index
    const decorated = teachers.map((teacher, index) => ({ ...teacher, __originalIndex: index }));
    decorated.sort((a, b) => {
      const aHasError = errorIndicesSets.teacherErrors.has(a.__originalIndex);
      const bHasError = errorIndicesSets.teacherErrors.has(b.__originalIndex);
      
      if (aHasError && !bHasError) return -1;
      if (!aHasError && bHasError) return 1;
      return 0;
    });
    return decorated;
  }, [teachers, showErrorsFirst, errorIndicesSets.teacherErrors]);

  // Memoized sorted students with O(1) error checking and stable index tracking
  const sortedStudents = useMemo(() => {
    if (!showErrorsFirst) return students.map((student, index) => ({ ...student, __originalIndex: index }));
    
    // Decorate with index, sort, then preserve original index
    const decorated = students.map((student, index) => ({ ...student, __originalIndex: index }));
    decorated.sort((a, b) => {
      const aHasError = errorIndicesSets.studentErrors.has(a.__originalIndex);
      const bHasError = errorIndicesSets.studentErrors.has(b.__originalIndex);
      
      if (aHasError && !bHasError) return -1;
      if (!aHasError && bHasError) return 1;
      return 0;
    });
    return decorated;
  }, [students, showErrorsFirst, errorIndicesSets.studentErrors]);

  // Memoized sorted assignments with O(1) error checking and stable index tracking
  const sortedAssignments = useMemo(() => {
    if (!showErrorsFirst) return assignments.map((assignment, index) => ({ ...assignment, __originalIndex: index }));
    
    // Decorate with index, sort, then preserve original index
    const decorated = assignments.map((assignment, index) => ({ ...assignment, __originalIndex: index }));
    decorated.sort((a, b) => {
      const aHasError = errorIndicesSets.assignmentErrors.has(a.__originalIndex);
      const bHasError = errorIndicesSets.assignmentErrors.has(b.__originalIndex);
      
      if (aHasError && !bHasError) return -1;
      if (!aHasError && bHasError) return 1;
      return 0;
    });
    return decorated;
  }, [assignments, showErrorsFirst, errorIndicesSets.assignmentErrors]);

  return (
    <div>
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/settings/bulk-upload')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
            </Button>
          </div>
          {importProgress.isImporting ? (
            <div className="space-y-2 w-full max-w-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{importProgress.stage}</span>
                <span className="text-sm font-medium">{importProgress.percentage}%</span>
              </div>
              <Progress value={importProgress.percentage} className="w-full" />
            </div>
          ) : (
            <Button
              onClick={() => importMutation.mutate()}
              disabled={hasErrors || importMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : "Import Data"}
            </Button>
          )}
        </div>
      </header>

      <div className="p-6 overflow-y-auto h-full">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Review & Edit Data</h2>
            <p className="text-muted-foreground">
              Review the parsed data below. Fix any validation errors before importing.
            </p>
            {school && (
              <div className="flex items-center gap-2 mt-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Importing to:
                </span>
                <Badge variant="secondary">{school.name}</Badge>
              </div>
            )}
          </div>

          {hasErrors && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Validation Errors ({errorCount})</span>
                </CardTitle>
                <CardDescription>
                  Please fix all errors before importing. Cells with errors are highlighted in red.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {classesToCreate.length > 0 && (
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Auto-Create Classes</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Will auto-create {classesToCreate.length} new class{classesToCreate.length > 1 ? 'es' : ''}: {classesToCreate.map(c => `${c.grade}-${c.section}`).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasErrors && (teachers.length > 0 || students.length > 0 || assignments.length > 0) && (
            <div className="px-4 py-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">Ready to Import</h4>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                    All validation checks passed. You can now import the data.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="teachers" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="teachers" className="relative">
                  Teachers ({teachers.length})
                  {errorIndicesSets.teacherErrors.size > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                      {errorIndicesSets.teacherErrors.size}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="students" className="relative">
                  Students ({students.length})
                  {errorIndicesSets.studentErrors.size > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                      {errorIndicesSets.studentErrors.size}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="assignments" className="relative">
                  Assignments ({assignments.length})
                  {errorIndicesSets.assignmentErrors.size > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                      {errorIndicesSets.assignmentErrors.size}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              {hasErrors && (
                <Button
                  variant={showErrorsFirst ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowErrorsFirst(!showErrorsFirst)}
                  className="flex items-center gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {showErrorsFirst ? "Show Normal Order" : "Show Errors First"}
                </Button>
              )}
            </div>

            <TabsContent value="teachers" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Teachers Data</CardTitle>
                  <CardDescription>
                    Review and edit teacher information. Required fields: Name, Mobile Number, School ID
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left text-sm font-medium">Row</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Name*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Mobile*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium w-64">Email</th>
                          <th className="px-4 py-2 text-left text-sm font-medium w-32">School ID*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium w-24">Max Period per day</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTeachers.map((teacher, displayIndex) => {
                          const index = teacher.__originalIndex;
                          return (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2 text-sm">{index + 1}</td>
                            <td className="px-4 py-2">
                              <Input
                                value={teacher.name || ''}
                                onChange={(e) => updateTeacher(index, 'name', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`teacher-${index}-name`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`teacher-${index}-name`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`teacher-${index}-name`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={teacher.contactNumber || ''}
                                onChange={(e) => updateTeacher(index, 'contactNumber', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`teacher-${index}-contactNumber`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`teacher-${index}-contactNumber`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`teacher-${index}-contactNumber`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={teacher.email || ''}
                                onChange={(e) => updateTeacher(index, 'email', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`teacher-${index}-email`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`teacher-${index}-email`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`teacher-${index}-email`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={teacher.schoolIdNumber || ''}
                                onChange={(e) => updateTeacher(index, 'schoolIdNumber', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`teacher-${index}-schoolIdNumber`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`teacher-${index}-schoolIdNumber`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`teacher-${index}-schoolIdNumber`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={teacher.maxDailyPeriods || ''}
                                onChange={(e) => updateTeacher(index, 'maxDailyPeriods', e.target.value)}
                                className="h-8"
                                min="1"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedTeacherIndex(index)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTeacher(index)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Students Data</CardTitle>
                  <CardDescription>
                    Review and edit student information. Required fields: First Name, Last Name, Admission Number, Grade (Section is optional)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left text-sm font-medium">Row</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">First Name*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Last Name*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Admission No*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Grade*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Section</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Roll No</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStudents.map((student, displayIndex) => {
                          const index = student.__originalIndex;
                          return (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2 text-sm">{index + 1}</td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.firstName || ''}
                                onChange={(e) => updateStudent(index, 'firstName', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-firstName`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-firstName`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-firstName`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.lastName || ''}
                                onChange={(e) => updateStudent(index, 'lastName', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-lastName`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-lastName`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-lastName`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.admissionNumber || ''}
                                onChange={(e) => updateStudent(index, 'admissionNumber', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-admissionNumber`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-admissionNumber`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-admissionNumber`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.grade || ''}
                                onChange={(e) => updateStudent(index, 'grade', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-grade`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-grade`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-grade`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.section || ''}
                                onChange={(e) => updateStudent(index, 'section', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-section`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-section`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-section`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={student.rollNumber || ''}
                                onChange={(e) => updateStudent(index, 'rollNumber', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`student-${index}-rollNumber`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`student-${index}-rollNumber`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`student-${index}-rollNumber`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedStudentIndex(index)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeStudent(index)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Class-Subject-Teacher Assignments</CardTitle>
                  <CardDescription>
                    Review and edit assignment information. Required: Teacher School ID, Grade, Subject Name, Weekly Frequency (Section is optional). Subject codes are auto-generated based on grade and subject name.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Period Allocation Warning Banner */}
                  {assignments.some((_, index) => cellErrors[`assignment-${index}-weeklyFrequency`]) && (
                    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg" role="alert" aria-live="polite">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                            Period Allocation Issues Detected
                          </h4>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            Some classes exceed the weekly period limit. Review the highlighted rows below and reduce the weekly frequency values to fix these errors before importing.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left text-sm font-medium">Row</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Teacher School ID*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Grade*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Section</th>
                          <th className="px-4 py-2 text-left text-sm font-medium w-64">Subject Name*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Weekly Freq*</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showErrorsFirst ? sortedAssignments : sortClasses(sortedAssignments)).map((assignment, displayIndex) => {
                          const index = assignment.__originalIndex;
                          return (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2 text-sm">{displayIndex + 1}</td>
                            <td className="px-4 py-2">
                              {/* Teacher name helper text */}
                              {assignment.teacherSchoolId && assignment.teacherSchoolId.trim() && (() => {
                                const teacherId = assignment.teacherSchoolId.trim();
                                // Try to find teacher name from uploaded teachers
                                const uploadedTeacher = teachers.find(t => t.schoolIdNumber?.trim() === teacherId);
                                if (uploadedTeacher) {
                                  return <p className="text-[10px] text-muted-foreground mb-0.5">{uploadedTeacher.name}</p>;
                                }
                                // Try to find teacher name from database teachers
                                if (existingTeachersData && Array.isArray(existingTeachersData)) {
                                  const dbTeacher = existingTeachersData.find((t: any) => t.schoolIdNumber?.trim() === teacherId);
                                  if (dbTeacher) {
                                    return <p className="text-[10px] text-muted-foreground mb-0.5">{dbTeacher.name}</p>;
                                  }
                                }
                                return null;
                              })()}
                              <Input
                                value={assignment.teacherSchoolId || ''}
                                onChange={(e) => updateAssignment(index, 'teacherSchoolId', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`assignment-${index}-teacherSchoolId`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`assignment-${index}-teacherSchoolId`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`assignment-${index}-teacherSchoolId`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={assignment.grade || ''}
                                onChange={(e) => updateAssignment(index, 'grade', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`assignment-${index}-grade`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`assignment-${index}-grade`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`assignment-${index}-grade`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={assignment.section || ''}
                                onChange={(e) => updateAssignment(index, 'section', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`assignment-${index}-section`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`assignment-${index}-section`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`assignment-${index}-section`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 w-64">
                              <Input
                                value={assignment.subjectName || ''}
                                onChange={(e) => updateAssignment(index, 'subjectName', e.target.value)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`assignment-${index}-subjectName`] && "border-destructive"
                                )}
                              />
                              {cellErrors[`assignment-${index}-subjectName`] && (
                                <p className="text-xs text-destructive mt-1">
                                  {cellErrors[`assignment-${index}-subjectName`].message}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={assignment.weeklyFrequency || ''}
                                onChange={(e) => updateAssignment(index, 'weeklyFrequency', parseInt(e.target.value) || 0)}
                                className={cn(
                                  "h-8",
                                  cellErrors[`assignment-${index}-weeklyFrequency`] && "border-destructive bg-destructive/5"
                                )}
                              />
                              {cellErrors[`assignment-${index}-weeklyFrequency`] && (
                                <div className="flex items-start gap-1 mt-1">
                                  <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-destructive font-medium">
                                    {cellErrors[`assignment-${index}-weeklyFrequency`].message}
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAssignment(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Teacher Details Dialog */}
      <Dialog open={selectedTeacherIndex !== null} onOpenChange={(open) => !open && setSelectedTeacherIndex(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher Details - {selectedTeacherIndex !== null ? teachers[selectedTeacherIndex]?.name : ''}</DialogTitle>
            <DialogDescription>
              Complete information including all imported fields
            </DialogDescription>
          </DialogHeader>
          {selectedTeacherIndex !== null && teachers[selectedTeacherIndex] && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Mobile Number</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].contactNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">School ID</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].schoolIdNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Designation</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].designation || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Aadhaar Number</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].aadhar || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <p className="text-sm mt-1 capitalize">{teachers[selectedTeacherIndex].gender || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].bloodGroup || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].dateOfBirth || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Father/Husband Name</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].fatherHusbandName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].category || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Religion</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].religion || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-sm mt-1">{teachers[selectedTeacherIndex].address || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      <Dialog open={selectedStudentIndex !== null} onOpenChange={(open) => !open && setSelectedStudentIndex(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details - {selectedStudentIndex !== null ? `${students[selectedStudentIndex]?.firstName} ${students[selectedStudentIndex]?.lastName}` : ''}</DialogTitle>
            <DialogDescription>
              Complete information including all imported fields
            </DialogDescription>
          </DialogHeader>
          {selectedStudentIndex !== null && students[selectedStudentIndex] && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].firstName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].lastName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Admission Number</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].admissionNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Grade</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].grade || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Section</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].section || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Roll Number</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].rollNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact Number</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].contactNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].dateOfBirth || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <p className="text-sm mt-1 capitalize">{students[selectedStudentIndex].gender || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].bloodGroup || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Emergency Contact</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].emergencyContact || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-sm mt-1">{students[selectedStudentIndex].address || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
