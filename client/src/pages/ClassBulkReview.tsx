import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateGrade } from "@shared/classUtils";

interface ClassImportData {
  grade: string;
  section?: string;
  requiredSubjects: string;
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

export default function ClassBulkReview() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassImportData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, CellError>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);

  // Load data from sessionStorage on mount
  useEffect(() => {
    const storedData = sessionStorage.getItem('classBulkData');
    if (!storedData) {
      toast({
        variant: "destructive",
        title: "No Data Found",
        description: "No uploaded data found. Please upload a file first."
      });
      setLocation('/classes/bulk-upload');
      return;
    }

    try {
      const parsedClasses = JSON.parse(storedData);
      setClasses(parsedClasses);
      validateAllDataWithDatabase(parsedClasses);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Failed to load uploaded data. Please try uploading again."
      });
      setLocation('/classes/bulk-upload');
    }
  }, [toast, setLocation]);

  // Validate all data with database checks
  const validateAllDataWithDatabase = async (classData: ClassImportData[]) => {
    const errors: Record<string, CellError> = {};
    const classMap = new Map<string, number>(); // Track grade-section combinations and their first occurrence

    // Get existing classes from database for validation
    let existingClasses: any[] = [];
    try {
      const classesResponse = await apiRequest("GET", "/api/classes");
      existingClasses = await classesResponse.json();
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Failed to validate against existing data"
      });
    }

    classData.forEach((classItem, index) => {
      // Required fields validation
      if (!classItem.grade || classItem.grade.trim() === '') {
        errors[`${index}-grade`] = { message: 'Grade is required' };
      }

      // Section validation - only allow single alphabetic characters or empty
      if (classItem.section && classItem.section.trim()) {
        const sectionValue = classItem.section.trim();
        // Check if section is "NA" or not a single alphabetic character
        if (sectionValue === 'NA' || sectionValue === 'na' || sectionValue === 'N/A') {
          errors[`${index}-section`] = { message: 'Use empty field for classes without sections, not "NA"' };
        } else if (!/^[A-Za-z]$/.test(sectionValue)) {
          errors[`${index}-section`] = { message: 'Section must be a single letter (A, B, C) or empty' };
        }
      }

      if (!classItem.requiredSubjects || classItem.requiredSubjects.trim() === '') {
        errors[`${index}-requiredSubjects`] = { message: 'Required subjects is required' };
      } else {
        // Validate subjects format (comma-separated)
        const subjectNames = classItem.requiredSubjects.split(',').map(s => s.trim()).filter(Boolean);
        if (subjectNames.length === 0) {
          errors[`${index}-requiredSubjects`] = { message: 'At least one subject is required' };
        }
        // Additional format validation - check for empty subject names
        const emptySubjects = classItem.requiredSubjects.split(',').some(s => s.trim() === '');
        if (emptySubjects) {
          errors[`${index}-requiredSubjects`] = { message: 'Subject names cannot be empty. Check for extra commas.' };
        }
      }

      // Check for duplicate grade-section combinations
      const classKey = `${classItem.grade.trim()}-${(classItem.section || '').trim()}`;
      if (classMap.has(classKey)) {
        const firstOccurrence = classMap.get(classKey)!;
        const displaySection = classItem.section ? ` ${classItem.section}` : '';
        errors[`${index}-grade`] = { message: `Duplicate class Grade ${classItem.grade}${displaySection} found in row ${firstOccurrence + 1}` };
        // Also mark the first occurrence as having a duplicate
        errors[`${firstOccurrence}-grade`] = { message: `Duplicate class Grade ${classItem.grade}${displaySection} found in row ${index + 1}` };
      } else {
        // Check against database
        const existingClass = existingClasses.find(
          existingCls => existingCls.grade === classItem.grade.trim() && 
                        (existingCls.section || '') === (classItem.section || '').trim()
        );
        if (existingClass) {
          const displaySection = classItem.section ? ` ${classItem.section}` : '';
          errors[`${index}-grade`] = { message: `Class ${classItem.grade}${displaySection} already exists in this school` };
        } else {
          classMap.set(classKey, index);
        }
      }

      // Grade format validation using shared validation utility
      if (classItem.grade && classItem.grade.trim() !== '') {
        const gradeValidation = validateGrade(classItem.grade);
        if (!gradeValidation.isValid) {
          errors[`${index}-grade`] = { message: gradeValidation.error || 'Invalid grade' };
        }
      }
    });

    setValidationErrors(errors);
  };

  // Update cell value
  const updateCellValue = (index: number, field: keyof ClassImportData, value: string) => {
    const updatedClasses = [...classes];
    updatedClasses[index] = { ...updatedClasses[index], [field]: value };
    setClasses(updatedClasses);
    
    // Validate single field with updated classes array
    validateSingleField(index, field, value, updatedClasses);
  };

  // Validate single field
  const validateSingleField = async (index: number, field: keyof ClassImportData, value: string, updatedClasses: ClassImportData[]) => {
    const newErrors = { ...validationErrors };
    
    // Clear existing error for this field
    delete newErrors[`${index}-${field}`];

    // Get existing classes from database for validation
    let existingClasses: any[] = [];
    try {
      const classesResponse = await apiRequest("GET", "/api/classes");
      existingClasses = await classesResponse.json();
    } catch (error) {
      console.error("Error fetching data:", error);
    }

    // For duplicate-prone fields, clear all related errors and re-validate all rows
    if (['grade', 'section'].includes(field)) {
      // Clear all errors for this field type across all rows
      Object.keys(newErrors).forEach(errorKey => {
        if (errorKey.endsWith(`-${field}`) || errorKey.endsWith('-grade')) {
          delete newErrors[errorKey];
        }
      });

      // Re-validate all grade-section combinations
      const classMap = new Map<string, number>();
      updatedClasses.forEach((classItem, idx) => {
        if (classItem.grade && classItem.grade.trim() !== '') {
          // Validate grade format first using shared validation utility
          const gradeValidation = validateGrade(classItem.grade);
          if (!gradeValidation.isValid) {
            newErrors[`${idx}-grade`] = { message: gradeValidation.error || 'Invalid grade' };
            // Skip duplicate/database checks if format is invalid
            return;
          }
          
          // Validate section format for current item
          if (classItem.section && classItem.section.trim()) {
            const sectionValue = classItem.section.trim();
            if (sectionValue === 'NA' || sectionValue === 'na' || sectionValue === 'N/A') {
              newErrors[`${idx}-section`] = { message: 'Use empty field for classes without sections, not "NA"' };
            } else if (!/^[A-Za-z]$/.test(sectionValue)) {
              newErrors[`${idx}-section`] = { message: 'Section must be a single letter (A, B, C) or empty' };
            }
          }

          const classKey = `${classItem.grade.trim()}-${(classItem.section || '').trim()}`;
          
          if (classMap.has(classKey)) {
            const firstOccurrence = classMap.get(classKey)!;
            const displaySection = classItem.section ? ` ${classItem.section}` : '';
            newErrors[`${idx}-grade`] = { message: `Duplicate class Grade ${classItem.grade}${displaySection} found in row ${firstOccurrence + 1}` };
            newErrors[`${firstOccurrence}-grade`] = { message: `Duplicate class Grade ${classItem.grade}${displaySection} found in row ${idx + 1}` };
          } else {
            // Check against database
            const existingClass = existingClasses.find(
              existingCls => existingCls.grade === classItem.grade.trim() && 
                            (existingCls.section || '') === (classItem.section || '').trim()
            );
            if (existingClass) {
              const displaySection = classItem.section ? ` ${classItem.section}` : '';
              newErrors[`${idx}-grade`] = { message: `Class ${classItem.grade}${displaySection} already exists in this school` };
            } else {
              classMap.set(classKey, idx);
            }
          }
        }
      });
    } else {
      // Validate individual field
      if (field === 'grade') {
        // Validate grade format using shared validation utility
        const gradeValidation = validateGrade(value);
        if (!gradeValidation.isValid) {
          newErrors[`${index}-${field}`] = { message: gradeValidation.error || 'Invalid grade' };
        }
      } else if (field === 'section') {
        if (value && value.trim()) {
          const sectionValue = value.trim();
          if (sectionValue === 'NA' || sectionValue === 'na' || sectionValue === 'N/A') {
            newErrors[`${index}-${field}`] = { message: 'Use empty field for classes without sections, not "NA"' };
          } else if (!/^[A-Za-z]$/.test(sectionValue)) {
            newErrors[`${index}-${field}`] = { message: 'Section must be a single letter (A, B, C) or empty' };
          }
        }
      } else if (field === 'requiredSubjects') {
        if (!value || value.trim() === '') {
          newErrors[`${index}-${field}`] = { message: 'Required subjects is required' };
        } else {
          const subjectNames = value.split(',').map(s => s.trim()).filter(Boolean);
          if (subjectNames.length === 0) {
            newErrors[`${index}-${field}`] = { message: 'At least one subject is required' };
          }
          // Additional format validation - check for empty subject names
          const emptySubjects = value.split(',').some(s => s.trim() === '');
          if (emptySubjects) {
            newErrors[`${index}-${field}`] = { message: 'Subject names cannot be empty. Check for extra commas.' };
          }
        }
      }
    }

    setValidationErrors(newErrors);
  };

  // Remove row function
  const removeRow = (index: number) => {
    const updatedClasses = classes.filter((_, i) => i !== index);
    setClasses(updatedClasses);
    
    // Clear validation errors for the removed row and update errors for remaining rows
    const newErrors: Record<string, CellError> = {};
    Object.entries(validationErrors).forEach(([key, error]) => {
      const [rowIndex, field] = key.split('-');
      const rowNum = parseInt(rowIndex);
      
      if (rowNum < index) {
        // Keep errors for rows before the removed one
        newErrors[key] = error;
      } else if (rowNum > index) {
        // Adjust row numbers for rows after the removed one
        const newKey = `${rowNum - 1}-${field}`;
        newErrors[newKey] = error;
      }
      // Skip errors for the removed row (rowNum === index)
    });
    
    setValidationErrors(newErrors);
    
    // Re-validate all data to check for new duplicate issues
    setTimeout(() => {
      validateAllDataWithDatabase(updatedClasses);
    }, 100);
    
    toast({
      title: "Row Removed",
      description: `Class row ${index + 1} has been removed from import.`
    });
  };

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async (classData: ClassImportData[]) => {
      const response = await apiRequest("POST", "/api/classes/bulk-upload", { classes: classData });
      return await response.json();
    },
    onSuccess: (data: any) => {
      sessionStorage.removeItem('classBulkData'); // Clean up
      
      if (data.errors && data.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Partial Import",
          description: `${data.imported} classes imported successfully, ${data.errors.length} failed.`
        });
      } else {
        toast({
          title: "Import Successful",
          description: `${data.imported} classes imported successfully.`
        });
        setLocation('/classes');
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import classes"
      });
    }
  });

  // Handle import
  const handleImport = () => {
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      toast({
        variant: "destructive",
        title: "Validation Errors",
        description: "Please fix all validation errors before importing."
      });
      return;
    }

    bulkUploadMutation.mutate(classes);
  };

  // Get validation summary
  const errorCount = Object.keys(validationErrors).length;
  const canImport = errorCount === 0 && classes.length > 0;

  return (
    <div className="container mx-auto p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/classes/bulk-upload')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Review Class Data</h1>
          <p className="text-muted-foreground">
            Review and edit class information. Click on any cell to edit.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {errorCount === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              )}
              Import Summary
            </div>
            <Button
              onClick={handleImport}
              disabled={!canImport || bulkUploadMutation.isPending}
              className="ml-auto"
            >
              {bulkUploadMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Classes
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg md:text-xl font-semibold text-blue-600">{classes.length}</div>
              <div className="text-muted-foreground">Total Classes</div>
            </div>
            <div className="text-center">
              <div className={cn("text-lg md:text-xl font-semibold", errorCount === 0 ? "text-green-600" : "text-red-600")}>
                {errorCount}
              </div>
              <div className="text-muted-foreground">Validation Errors</div>
            </div>
            <div className="text-center">
              <div className={cn("text-lg md:text-xl font-semibold", canImport ? "text-green-600" : "text-gray-400")}>
                {canImport ? "Ready" : "Not Ready"}
              </div>
              <div className="text-muted-foreground">Import Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Class Data Preview</CardTitle>
          <CardDescription>
            Review and edit class information. Click on any cell to edit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Row</th>
                  <th className="text-left p-2 font-medium">Grade *</th>
                  <th className="text-left p-2 font-medium">Section</th>
                  <th className="text-left p-2 font-medium">Required Subjects *</th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((classItem, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm text-muted-foreground">
                      {classItem.originalRowNumber}
                    </td>
                    
                    {/* Grade Cell */}
                    <td className="p-2">
                      <div className="relative">
                        {editingCell === `${index}-grade` ? (
                          <input
                            type="text"
                            value={classItem.grade || ''}
                            onChange={(e) => updateCellValue(index, 'grade', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingCell(null);
                            }}
                            className={cn(
                              "w-full px-2 py-1 border rounded text-sm",
                              validationErrors[`${index}-grade`] ? "border-red-300 focus:border-red-500" : "border-gray-300"
                            )}
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${index}-grade`)}
                            className={cn(
                              "p-1 cursor-pointer hover:bg-muted/50 rounded text-sm min-h-[24px] flex items-center",
                              validationErrors[`${index}-grade`] && "bg-red-50 border border-red-200"
                            )}
                          >
                            {classItem.grade || <span className="text-muted-foreground">Click to edit</span>}
                            {validationErrors[`${index}-grade`] && (
                              <span className="ml-2 text-red-500" title={validationErrors[`${index}-grade`].message}>
                                ⚠️
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Section Cell */}
                    <td className="p-2">
                      <div className="relative">
                        {editingCell === `${index}-section` ? (
                          <input
                            type="text"
                            value={classItem.section || ''}
                            onChange={(e) => updateCellValue(index, 'section', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingCell(null);
                            }}
                            className={cn(
                              "w-full px-2 py-1 border rounded text-sm",
                              validationErrors[`${index}-section`] ? "border-red-300 focus:border-red-500" : "border-gray-300"
                            )}
                            autoFocus
                            placeholder="A, B, C or leave empty"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${index}-section`)}
                            className={cn(
                              "p-1 cursor-pointer hover:bg-muted/50 rounded text-sm min-h-[24px] flex items-center",
                              validationErrors[`${index}-section`] && "bg-red-50 border border-red-200"
                            )}
                          >
                            {classItem.section || <span className="text-muted-foreground">Optional</span>}
                            {validationErrors[`${index}-section`] && (
                              <span className="ml-2 text-red-500" title={validationErrors[`${index}-section`].message}>
                                ⚠️
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Required Subjects Cell */}
                    <td className="p-2">
                      <div className="relative">
                        {editingCell === `${index}-requiredSubjects` ? (
                          <input
                            type="text"
                            value={classItem.requiredSubjects || ''}
                            onChange={(e) => updateCellValue(index, 'requiredSubjects', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingCell(null);
                            }}
                            className={cn(
                              "w-full px-2 py-1 border rounded text-sm",
                              validationErrors[`${index}-requiredSubjects`] ? "border-red-300 focus:border-red-500" : "border-gray-300"
                            )}
                            autoFocus
                            placeholder="Mathematics, Science, English"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${index}-requiredSubjects`)}
                            className={cn(
                              "p-1 cursor-pointer hover:bg-muted/50 rounded text-sm min-h-[24px] flex items-center",
                              validationErrors[`${index}-requiredSubjects`] && "bg-red-50 border border-red-200"
                            )}
                          >
                            <span className="flex-1 truncate">
                              {classItem.requiredSubjects || <span className="text-muted-foreground">Click to edit</span>}
                            </span>
                            {validationErrors[`${index}-requiredSubjects`] && (
                              <span className="ml-2 text-red-500 flex-shrink-0" title={validationErrors[`${index}-requiredSubjects`].message}>
                                ⚠️
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions Cell */}
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(index)}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        title="Remove this row from import"
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

      {/* Error Summary Section */}
      {errorCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Validation Errors ({errorCount})
            </CardTitle>
            <CardDescription className="text-red-700">
              Fix these errors before importing your classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(validationErrors).map(([key, error]) => {
                const [rowIndex, field] = key.split('-');
                const rowNumber = parseInt(rowIndex) + 1;
                const fieldName = field === 'requiredSubjects' ? 'Required Subjects' : 
                                field === 'grade' ? 'Grade' : 'Section';
                
                return (
                  <div 
                    key={key} 
                    className="flex items-start gap-2 p-2 bg-white rounded border border-red-200 cursor-pointer hover:bg-red-25"
                    onClick={() => setEditingCell(key)}
                  >
                    <span className="text-red-600 font-medium text-sm">
                      Row {rowNumber} - {fieldName}:
                    </span>
                    <span className="text-red-700 text-sm flex-1">
                      {error.message}
                    </span>
                    <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">
                      Click to fix
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Data Examples */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Data Format Examples
          </CardTitle>
          <CardDescription className="text-blue-700">
            Use these examples to understand the correct format for your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-800 mb-2">✅ Correct Format:</h4>
                <div className="bg-white p-3 rounded border text-sm space-y-1">
                  <div><strong>Grade:</strong> 9, 10, 11, 12</div>
                  <div><strong>Section:</strong> A, B, C (single letter or empty)</div>
                  <div><strong>Subjects:</strong> Mathematics, Science, English</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-red-800 mb-2">❌ Incorrect Format:</h4>
                <div className="bg-white p-3 rounded border text-sm space-y-1">
                  <div><strong>Grade:</strong> <span className="text-red-600">Nine, Class 9</span></div>
                  <div><strong>Section:</strong> <span className="text-red-600">A,B,C, NA, N/A</span></div>
                  <div><strong>Subjects:</strong> <span className="text-red-600">Math; Science| English</span></div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded border">
              <h4 className="font-medium text-blue-800 mb-2">Sample Valid Rows:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-2">Grade</th>
                      <th className="text-left p-2">Section</th>
                      <th className="text-left p-2">Required Subjects</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2">9</td>
                      <td className="p-2">A</td>
                      <td className="p-2">Mathematics, Science, English, Social Studies</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">10</td>
                      <td className="p-2">B</td>
                      <td className="p-2">Mathematics, Physics, Chemistry, Biology</td>
                    </tr>
                    <tr>
                      <td className="p-2">11</td>
                      <td className="p-2"></td>
                      <td className="p-2">Mathematics, Computer Science, English</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-sm text-blue-700">
              <p><strong>Important Notes:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>Grade must be numeric (9, 10, 11, 12)</li>
                <li>Section must be a single letter (A, B, C) or left empty</li>
                <li>Do NOT use "NA", "N/A" or similar - leave section empty instead</li>
                <li>For multiple sections of same grade, create separate rows</li>
                <li>Subjects must be separated by commas and exist in your system</li>
                <li>Subject names are case-insensitive but must match exactly</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      {errorCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Validation Errors Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-orange-700 space-y-2">
              <p>Please fix the following issues before importing:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Red highlighted cells contain validation errors</li>
                <li>Click on any cell to edit its value</li>
                <li>Use the trash icon to remove unwanted rows</li>
                <li>Subjects should be comma-separated (e.g., "Math,Science,English")</li>
                <li>Section must be single letter (A, B, C) or empty, not "NA"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}