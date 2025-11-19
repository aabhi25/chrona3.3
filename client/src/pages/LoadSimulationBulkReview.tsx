import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TeacherData {
  name: string;
  employeeId: string;
  contactNumber?: string;
  email?: string;
  maxPeriodsPerDay?: number;
  originalRowNumber: number;
}

interface ClassSubjectData {
  grade: string;
  section?: string;
  subjectName: string;
  subjectCode: string;
  weeklyPeriods: number;
  teacherEmployeeId?: string;
  originalRowNumber: number;
}

interface ReviewData {
  teachers: TeacherData[];
  classSubjects: ClassSubjectData[];
}

interface CellError {
  message: string;
}

interface ClassPeriodTotal {
  classKey: string;
  displayName: string;
  totalPeriods: number;
  maxPeriodsPerWeek: number;
  isOverLimit: boolean;
}

export default function LoadSimulationBulkReview() {
  const [, params] = useRoute("/simulation/:id/bulk-review");
  const simulationId = params?.id || "";
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, CellError>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [classPeriodTotals, setClassPeriodTotals] = useState<ClassPeriodTotal[]>([]);

  // Fetch school settings for max periods validation
  const { data: schoolSettings } = useQuery({
    queryKey: ['/api/school-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/school-settings');
      return response.json();
    }
  });

  const maxPeriodsPerWeek = schoolSettings?.maxPeriodsPerDay ? schoolSettings.maxPeriodsPerDay * 6 : 42;

  // Load data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('loadSimulationBulkData');
    if (storedData) {
      try {
        const parsedData: ReviewData = JSON.parse(storedData);
        setTeachers(parsedData.teachers || []);
        setClassSubjects(parsedData.classSubjects || []);
        validateAllData(parsedData.teachers || [], parsedData.classSubjects || []);
        calculateClassPeriodTotals(parsedData.classSubjects || []);
      } catch (error) {
        console.error('Error parsing stored data:', error);
        toast({
          variant: "destructive",
          title: "Error Loading Data",
          description: "Failed to load uploaded data. Please try uploading again."
        });
        setLocation(`/simulation/${simulationId}`);
      }
    } else {
      toast({
        variant: "destructive",
        title: "No Data Found",
        description: "No uploaded data found. Please upload a file first."
      });
      setLocation(`/simulation/${simulationId}`);
    }
  }, [toast, setLocation, simulationId]);

  // Generate subject code using standardized grade-specific logic (3 chars + grade)
  const generateSubjectCode = (name: string, grade: string, existingCodes: string[]): string => {
    // Create base code from first 3 letters of subject name
    const baseCode = name
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .substring(0, 3)
      .toUpperCase();
    
    // Create grade-specific code
    let code = `${baseCode}${grade}`;
    let counter = 1;
    while (existingCodes.includes(code)) {
      code = `${baseCode}${grade}_${counter}`;
      counter++;
    }
    
    return code;
  };

  // Calculate class period totals
  const calculateClassPeriodTotals = (subjects: ClassSubjectData[]) => {
    const totalsMap = new Map<string, { displayName: string; total: number }>();

    subjects.forEach((subject) => {
      const classKey = `${subject.grade}-${subject.section || ''}`;
      
      // Format class name for better readability
      let displayName = subject.grade;
      // Add "Class" prefix for numeric grades
      if (!isNaN(Number(subject.grade))) {
        displayName = `Class ${subject.grade}`;
      }
      // Add section if exists
      if (subject.section) {
        displayName = `${displayName} ${subject.section}`;
      }
      
      if (!totalsMap.has(classKey)) {
        totalsMap.set(classKey, { displayName, total: 0 });
      }
      
      const current = totalsMap.get(classKey)!;
      current.total += subject.weeklyPeriods;
    });

    const totals: ClassPeriodTotal[] = Array.from(totalsMap.entries()).map(([classKey, data]) => ({
      classKey,
      displayName: data.displayName,
      totalPeriods: data.total,
      maxPeriodsPerWeek,
      isOverLimit: data.total > maxPeriodsPerWeek
    }));

    setClassPeriodTotals(totals);
  };

  // Validate all data
  const validateAllData = (teacherData: TeacherData[], classSubjectData: ClassSubjectData[]) => {
    const errors: Record<string, CellError> = {};
    const employeeIdMap = new Map<string, number>();
    const classSubjectMap = new Map<string, number>();

    // Validate teachers
    teacherData.forEach((teacher, index) => {
      // Required fields
      if (!teacher.name || teacher.name.trim() === '') {
        errors[`teacher-${index}-name`] = { message: 'Name is required' };
      }

      if (!teacher.employeeId || teacher.employeeId.trim() === '') {
        errors[`teacher-${index}-employeeId`] = { message: 'Employee ID is required' };
      } else {
        // Check for duplicate employee IDs
        const employeeId = teacher.employeeId.trim();
        if (employeeIdMap.has(employeeId)) {
          const firstOccurrence = employeeIdMap.get(employeeId)!;
          errors[`teacher-${index}-employeeId`] = { 
            message: `Duplicate Employee ID found in row ${firstOccurrence + 1}` 
          };
        } else {
          employeeIdMap.set(employeeId, index);
        }
      }

      // Contact number validation
      if (teacher.contactNumber && !/^\d{10}$/.test(teacher.contactNumber)) {
        errors[`teacher-${index}-contactNumber`] = { message: 'Must be 10 digits' };
      }

      // Email validation
      if (teacher.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) {
        errors[`teacher-${index}-email`] = { message: 'Invalid email format' };
      }

      // Max periods validation
      if (teacher.maxPeriodsPerDay !== undefined) {
        const maxPeriods = Number(teacher.maxPeriodsPerDay);
        if (isNaN(maxPeriods) || maxPeriods < 1 || maxPeriods > 10) {
          errors[`teacher-${index}-maxPeriodsPerDay`] = { message: 'Must be 1-10' };
        }
      }
    });

    // Validate class subjects
    classSubjectData.forEach((subject, index) => {
      // Required fields
      if (!subject.grade || subject.grade.trim() === '') {
        errors[`subject-${index}-grade`] = { message: 'Class/Grade is required' };
      }

      if (!subject.subjectName || subject.subjectName.trim() === '') {
        errors[`subject-${index}-subjectName`] = { message: 'Subject name is required' };
      }

      const periods = Number(subject.weeklyPeriods);
      if (isNaN(periods) || periods < 1 || periods > 50) {
        errors[`subject-${index}-weeklyPeriods`] = { message: 'Must be 1-50' };
      }

      // Check for duplicate subject in same class (use subject code if present, otherwise use subject name)
      const subjectIdentifier = subject.subjectCode?.trim() || subject.subjectName?.trim() || '';
      const classSubjectKey = `${subject.grade}-${subject.section || ''}-${subjectIdentifier}`;
      if (classSubjectMap.has(classSubjectKey)) {
        const firstOccurrence = classSubjectMap.get(classSubjectKey)!;
        errors[`subject-${index}-subjectCode`] = { 
          message: `Duplicate subject in this class (row ${firstOccurrence + 1})` 
        };
      } else {
        classSubjectMap.set(classSubjectKey, index);
      }

      // Validate teacher employee ID exists if provided
      if (subject.teacherEmployeeId && subject.teacherEmployeeId.trim() !== '') {
        const teacherExists = teacherData.some(t => t.employeeId === subject.teacherEmployeeId);
        if (!teacherExists) {
          errors[`subject-${index}-teacherEmployeeId`] = { 
            message: 'Teacher not found in Teachers sheet' 
          };
        }
      }
    });

    setValidationErrors(errors);
  };

  // Update teacher cell
  const updateTeacherCell = (index: number, field: keyof TeacherData, value: string) => {
    const updatedTeachers = [...teachers];
    // Convert numeric fields properly
    if (field === 'maxPeriodsPerDay') {
      const numValue = value.trim() === '' ? undefined : Number(value);
      updatedTeachers[index] = { ...updatedTeachers[index], [field]: numValue };
    } else {
      updatedTeachers[index] = { ...updatedTeachers[index], [field]: value };
    }
    setTeachers(updatedTeachers);
    validateAllData(updatedTeachers, classSubjects);
  };

  // Update subject cell
  const updateSubjectCell = (index: number, field: keyof ClassSubjectData, value: string | number) => {
    const updatedSubjects = [...classSubjects];
    // Convert numeric fields properly
    if (field === 'weeklyPeriods') {
      const numValue = typeof value === 'string' ? Number(value) || 0 : value;
      updatedSubjects[index] = { ...updatedSubjects[index], [field]: numValue };
    } else {
      updatedSubjects[index] = { ...updatedSubjects[index], [field]: value };
    }
    setClassSubjects(updatedSubjects);
    validateAllData(teachers, updatedSubjects);
    calculateClassPeriodTotals(updatedSubjects);
  };

  // Remove subject
  const removeSubject = (index: number) => {
    const updatedSubjects = classSubjects.filter((_, i) => i !== index);
    setClassSubjects(updatedSubjects);
    validateAllData(teachers, updatedSubjects);
    calculateClassPeriodTotals(updatedSubjects);
  };

  // Remove teacher with recalculation
  const removeTeacherWithValidation = (index: number) => {
    const updatedTeachers = teachers.filter((_, i) => i !== index);
    setTeachers(updatedTeachers);
    validateAllData(updatedTeachers, classSubjects);
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Auto-generate subject codes for any missing codes using grade-specific logic
      // Group by grade and subject name to ensure same code for same subject in same grade
      const gradeSubjectCodeMap = new Map<string, string>(); // "grade|subjectName" -> code
      const allExistingCodes: string[] = [];
      
      const processedSubjects = classSubjects.map(cs => {
        let subjectCode = cs.subjectCode?.trim();
        
        // If no subject code, auto-generate it using grade-specific logic
        if (!subjectCode) {
          const gradeSubjectKey = `${cs.grade}|${cs.subjectName}`;
          
          // Check if we already generated a code for this subject in this grade
          if (gradeSubjectCodeMap.has(gradeSubjectKey)) {
            subjectCode = gradeSubjectCodeMap.get(gradeSubjectKey)!;
          } else {
            // Generate new grade-specific code (3 chars + grade)
            subjectCode = generateSubjectCode(cs.subjectName, cs.grade, allExistingCodes);
            gradeSubjectCodeMap.set(gradeSubjectKey, subjectCode);
            allExistingCodes.push(subjectCode);
          }
        } else {
          // User provided code, add to existing codes
          allExistingCodes.push(subjectCode);
        }
        
        return {
          grade: cs.grade,
          section: cs.section,
          subjectName: cs.subjectName,
          subjectCode: subjectCode,
          weeklyPeriods: cs.weeklyPeriods,
          teacherEmployeeId: cs.teacherEmployeeId
        };
      });

      const response = await apiRequest(
        'POST',
        `/api/load-simulations/${simulationId}/bulk-upload`,
        {
          teachers: teachers.map(t => ({
            name: t.name,
            employeeId: t.employeeId,
            contactNumber: t.contactNumber,
            email: t.email,
            maxPeriodsPerDay: t.maxPeriodsPerDay
          })),
          classSubjects: processedSubjects
        }
      );

      return response.json();
    },
    onSuccess: (data) => {
      sessionStorage.removeItem('loadSimulationBulkData');
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${data.success} items`
      });
      setLocation(`/simulation/${simulationId}`);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message
      });
    }
  });

  const handleSubmit = () => {
    const hasErrors = Object.keys(validationErrors).length > 0;
    const hasOverLimitClasses = classPeriodTotals.some(c => c.isOverLimit);

    if (hasErrors) {
      toast({
        variant: "destructive",
        title: "Validation Errors",
        description: "Please fix all validation errors before submitting"
      });
      return;
    }

    if (hasOverLimitClasses) {
      toast({
        variant: "destructive",
        title: "Weekly Periods Limit Exceeded",
        description: "Some classes exceed the maximum weekly periods limit"
      });
      return;
    }

    submitMutation.mutate();
  };

  const hasErrors = Object.keys(validationErrors).length > 0;
  const hasOverLimitClasses = classPeriodTotals.some(c => c.isOverLimit);

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation(`/simulation/${simulationId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Simulation
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Review Bulk Upload</h1>
            <p className="text-gray-600 mt-1">
              Review and validate your data before importing
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={hasErrors || hasOverLimitClasses || submitMutation.isPending}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {submitMutation.isPending ? 'Submitting...' : 'Confirm & Submit'}
          </Button>
        </div>
      </div>

      {/* Validation Summary */}
      {(hasErrors || hasOverLimitClasses) && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">Validation Issues Found</h4>
                <p className="text-sm text-red-700">
                  {hasErrors && `${Object.keys(validationErrors).length} validation error(s)`}
                  {hasErrors && hasOverLimitClasses && ' and '}
                  {hasOverLimitClasses && `${classPeriodTotals.filter(c => c.isOverLimit).length} class(es) exceed weekly periods limit`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Period Totals Summary */}
      {classPeriodTotals.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Periods Summary by Class</CardTitle>
            <CardDescription>Total weekly periods for each class</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {classPeriodTotals.map((classTotal) => (
                <Badge
                  key={classTotal.classKey}
                  variant={classTotal.isOverLimit ? "destructive" : "default"}
                  className={cn(
                    "px-3 py-1",
                    !classTotal.isOverLimit && "bg-green-100 text-green-800 hover:bg-green-200"
                  )}
                >
                  {classTotal.displayName}: {classTotal.totalPeriods}/{classTotal.maxPeriodsPerWeek}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teachers Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Teachers ({teachers.length})</CardTitle>
          <CardDescription>Review and edit teacher information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Row</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name*</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Employee ID*</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Max Periods per day</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600">{teacher.originalRowNumber}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={teacher.name}
                        onChange={(e) => updateTeacherCell(index, 'name', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`teacher-${index}-name`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`teacher-${index}-name`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`teacher-${index}-name`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={teacher.employeeId}
                        onChange={(e) => updateTeacherCell(index, 'employeeId', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`teacher-${index}-employeeId`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`teacher-${index}-employeeId`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`teacher-${index}-employeeId`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={teacher.contactNumber || ''}
                        onChange={(e) => updateTeacherCell(index, 'contactNumber', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`teacher-${index}-contactNumber`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`teacher-${index}-contactNumber`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`teacher-${index}-contactNumber`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={teacher.email || ''}
                        onChange={(e) => updateTeacherCell(index, 'email', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`teacher-${index}-email`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`teacher-${index}-email`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`teacher-${index}-email`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={teacher.maxPeriodsPerDay || ''}
                        onChange={(e) => updateTeacherCell(index, 'maxPeriodsPerDay', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`teacher-${index}-maxPeriodsPerDay`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`teacher-${index}-maxPeriodsPerDay`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`teacher-${index}-maxPeriodsPerDay`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTeacherWithValidation(index)}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Class Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classes & Subjects ({classSubjects.length})</CardTitle>
          <CardDescription>Review and edit class and subject information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Row</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Class*</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Section</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Subject Name*</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Weekly Periods*</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Teacher ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classSubjects.map((subject, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600">{subject.originalRowNumber}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={subject.grade}
                        onChange={(e) => updateSubjectCell(index, 'grade', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`subject-${index}-grade`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`subject-${index}-grade`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`subject-${index}-grade`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={subject.section || ''}
                        onChange={(e) => updateSubjectCell(index, 'section', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={subject.subjectName}
                        onChange={(e) => updateSubjectCell(index, 'subjectName', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`subject-${index}-subjectName`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`subject-${index}-subjectName`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`subject-${index}-subjectName`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={subject.subjectCode}
                        onChange={(e) => updateSubjectCell(index, 'subjectCode', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`subject-${index}-subjectCode`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`subject-${index}-subjectCode`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`subject-${index}-subjectCode`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={subject.weeklyPeriods}
                        onChange={(e) => updateSubjectCell(index, 'weeklyPeriods', parseInt(e.target.value) || 0)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`subject-${index}-weeklyPeriods`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`subject-${index}-weeklyPeriods`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`subject-${index}-weeklyPeriods`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={subject.teacherEmployeeId || ''}
                        onChange={(e) => updateSubjectCell(index, 'teacherEmployeeId', e.target.value)}
                        className={cn(
                          "h-8 text-sm",
                          validationErrors[`subject-${index}-teacherEmployeeId`] && "border-red-500"
                        )}
                      />
                      {validationErrors[`subject-${index}-teacherEmployeeId`] && (
                        <p className="text-xs text-red-600 mt-1">
                          {validationErrors[`subject-${index}-teacherEmployeeId`].message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubject(index)}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
