import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherImportData {
  name: string;
  contactNumber: string;
  email?: string;
  designation?: string;
  schoolIdNumber?: string;
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

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CellError {
  message: string;
}

export default function TeacherBulkReview() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherImportData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, CellError>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // Load data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('teacherBulkData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setTeachers(parsedData);
        validateAllData(parsedData);
      } catch (error) {
        console.error('Error parsing stored data:', error);
        toast({
          variant: "destructive",
          title: "Error Loading Data",
          description: "Failed to load uploaded data. Please try uploading again."
        });
        setLocation('/teachers/bulk-upload');
      }
    } else {
      toast({
        variant: "destructive",
        title: "No Data Found",
        description: "No uploaded data found. Please upload a file first."
      });
      setLocation('/teachers/bulk-upload');
    }
  }, [toast, setLocation]);

  // Validate all data
  const validateAllData = (teacherData: TeacherImportData[]) => {
    const errors: Record<string, CellError> = {};
    const schoolIdMap = new Map<string, number>(); // Track school IDs and their first occurrence
    const mobileMap = new Map<string, number>(); // Track mobile numbers and their first occurrence
    const emailMap = new Map<string, number>(); // Track email addresses and their first occurrence

    teacherData.forEach((teacher, index) => {
      const rowNumber = teacher.originalRowNumber;

      // Required fields validation
      if (!teacher.name || teacher.name.trim() === '') {
        errors[`${index}-name`] = { message: 'Name is required' };
      }

      // Mobile number validation
      if (!teacher.contactNumber || teacher.contactNumber.trim() === '') {
        errors[`${index}-contactNumber`] = { message: 'Mobile number is required' };
      } else if (!/^\d{10}$/.test(teacher.contactNumber)) {
        errors[`${index}-contactNumber`] = { message: 'Mobile number must be exactly 10 digits' };
      } else {
        // Check for duplicate mobile numbers within batch
        const mobile = teacher.contactNumber.trim();
        if (mobileMap.has(mobile)) {
          const firstOccurrence = mobileMap.get(mobile)!;
          errors[`${index}-contactNumber`] = { message: `Duplicate mobile number found in row ${firstOccurrence + 1}` };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-contactNumber`] = { message: `Duplicate mobile number found in row ${index + 1}` };
        } else {
          mobileMap.set(mobile, index);
        }
      }

      // School ID uniqueness validation (if provided)
      if (teacher.schoolIdNumber && teacher.schoolIdNumber.trim() !== '') {
        const schoolId = teacher.schoolIdNumber.trim();
        if (schoolIdMap.has(schoolId)) {
          const firstOccurrence = schoolIdMap.get(schoolId)!;
          errors[`${index}-schoolIdNumber`] = { message: `Duplicate School ID found in row ${firstOccurrence + 1}` };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-schoolIdNumber`] = { message: `Duplicate School ID found in row ${index + 1}` };
        } else {
          schoolIdMap.set(schoolId, index);
        }
      }

      // Email validation (if provided)
      if (teacher.email && teacher.email.trim() !== '') {
        const email = teacher.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors[`${index}-email`] = { message: 'Invalid email format' };
        } else {
          // Check for duplicate email addresses within batch
          if (emailMap.has(email)) {
            const firstOccurrence = emailMap.get(email)!;
            errors[`${index}-email`] = { message: `Duplicate email found in row ${firstOccurrence + 1}` };
            // Also mark the first occurrence as having a duplicate
            errors[`${firstOccurrence}-email`] = { message: `Duplicate email found in row ${index + 1}` };
          } else {
            emailMap.set(email, index);
          }
        }
      }

      // Aadhaar validation (if provided)
      if (teacher.aadhar && teacher.aadhar.trim() !== '') {
        if (!/^\d{12}$/.test(teacher.aadhar)) {
          errors[`${index}-aadhar`] = { message: 'Aadhaar number must be exactly 12 digits' };
        }
      }

      // Gender validation (if provided)
      if (teacher.gender && teacher.gender.trim() !== '') {
        const gender = teacher.gender.toLowerCase().trim();
        if (!['male', 'female', 'other'].includes(gender)) {
          errors[`${index}-gender`] = { message: 'Gender must be male, female, or other' };
        }
      }
    });

    setValidationErrors(errors);
  };

  // Update cell value
  const updateCellValue = (index: number, field: keyof TeacherImportData, value: string) => {
    const updatedTeachers = [...teachers];
    updatedTeachers[index] = { ...updatedTeachers[index], [field]: value };
    setTeachers(updatedTeachers);
    
    // Validate single field with updated teachers array
    validateSingleField(index, field, value, updatedTeachers);
  };

  // Validate single field
  const validateSingleField = (index: number, field: keyof TeacherImportData, value: string, currentTeachers: TeacherImportData[] = teachers) => {
    const cellKey = `${index}-${field}`;
    const newErrors = { ...validationErrors };

    // For duplicate-prone fields, clear all related errors and re-validate all rows
    if (['contactNumber', 'email', 'schoolIdNumber'].includes(field)) {
      // Clear all errors for this field type across all rows
      Object.keys(newErrors).forEach(errorKey => {
        if (errorKey.endsWith(`-${field}`)) {
          delete newErrors[errorKey];
        }
      });

      // Re-validate all rows for this field type using the current teachers data
      currentTeachers.forEach((teacher, teacherIndex) => {
        const teacherCellKey = `${teacherIndex}-${field}`;
        const teacherValue = field === 'contactNumber' ? teacher.contactNumber :
                           field === 'email' ? teacher.email :
                           field === 'schoolIdNumber' ? teacher.schoolIdNumber : '';

        if (teacherValue && teacherValue.trim() !== '') {
          const trimmedValue = teacherValue.trim();
          
          // For the current field being edited, use the new value
          const valueToCheck = teacherIndex === index ? value.trim() : trimmedValue;
          
          if (field === 'contactNumber') {
            if (!valueToCheck) {
              newErrors[teacherCellKey] = { message: 'Mobile number is required' };
            } else if (!/^\d{10}$/.test(valueToCheck)) {
              newErrors[teacherCellKey] = { message: 'Mobile number must be exactly 10 digits' };
            } else {
              // Check for duplicates
              const duplicateIndex = currentTeachers.findIndex((otherTeacher, otherIndex) => {
                if (otherIndex === teacherIndex) return false;
                const otherValue = otherTeacher.contactNumber?.trim();
                const otherValueToCheck = otherIndex === index ? value.trim() : otherValue;
                return otherValueToCheck === valueToCheck;
              });
              
              if (duplicateIndex !== -1) {
                newErrors[teacherCellKey] = { message: `Duplicate mobile number found in row ${duplicateIndex + 1}` };
              }
            }
          } else if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueToCheck)) {
            newErrors[teacherCellKey] = { message: 'Invalid email format' };
          } else {
            // Check for duplicates
            const duplicateIndex = currentTeachers.findIndex((otherTeacher, otherIndex) => {
              if (otherIndex === teacherIndex) return false;
              
              const otherValue = field === 'email' ? otherTeacher.email :
                               field === 'schoolIdNumber' ? otherTeacher.schoolIdNumber : '';
              
              const otherValueToCheck = otherIndex === index ? value.trim() : otherValue?.trim();
              return otherValueToCheck === valueToCheck;
            });
            
            if (duplicateIndex !== -1) {
              const fieldName = field === 'email' ? 'email' : 'School ID';
              newErrors[teacherCellKey] = { message: `Duplicate ${fieldName} found in row ${duplicateIndex + 1}` };
            }
          }
        } else if (field === 'contactNumber' && teacherIndex === index) {
          // Handle required field validation for the field being edited
          if (!value || value.trim() === '') {
            newErrors[teacherCellKey] = { message: 'Mobile number is required' };
          }
        }
      });
    } else {
      // For non-duplicate fields, simple validation
      switch (field) {
        case 'name':
          if (!value || value.trim() === '') {
            newErrors[cellKey] = { message: 'Name is required' };
          }
          break;
        case 'aadhar':
          if (value && value.trim() !== '' && !/^\d{12}$/.test(value)) {
            newErrors[cellKey] = { message: 'Aadhaar number must be exactly 12 digits' };
          }
          break;
        case 'gender':
          if (value && value.trim() !== '' && !['male', 'female', 'other'].includes(value.toLowerCase())) {
            newErrors[cellKey] = { message: 'Gender must be male, female, or other' };
          }
          break;
      }
    }

    setValidationErrors(newErrors);
  };

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async (teacherData: TeacherImportData[]) => {
      const response = await apiRequest("POST", "/api/teachers/bulk-upload", { teachers: teacherData });
      return await response.json();
    },
    onSuccess: (data: any) => {
      sessionStorage.removeItem('teacherBulkData'); // Clean up
      
      if (data.errors && data.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Partial Import",
          description: `${data.imported} teachers imported successfully, ${data.errors.length} failed.`
        });
      } else {
        toast({
          title: "Success",
          description: `Successfully imported ${data.imported || teachers.length} teachers`
        });
      }
      setLocation('/teachers');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to import teachers"
      });
    }
  });

  const handleSubmit = () => {
    const errorCount = Object.keys(validationErrors).length;
    if (errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Validation Errors",
        description: `Please fix ${errorCount} validation errors before submitting`
      });
      return;
    }

    bulkUploadMutation.mutate(teachers);
  };

  const getCellError = (index: number, field: string) => {
    return validationErrors[`${index}-${field}`];
  };

  const renderEditableCell = (
    teacher: TeacherImportData,
    index: number,
    field: keyof TeacherImportData,
    type: 'text' | 'select' = 'text',
    options?: string[]
  ) => {
    const cellKey = `${index}-${field}`;
    const isEditing = editingCell === cellKey;
    const error = getCellError(index, field);
    const value = teacher[field] || '';

    const cellClassName = cn(
      "min-h-8 px-1 py-1 text-xs border-0 bg-transparent cursor-pointer hover:bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-left w-full break-all whitespace-normal leading-tight resize-none overflow-hidden",
      error && "bg-red-50 border border-red-200"
    );

    if (type === 'select' && options) {
      return (
        <div className="relative">
          <Select
            value={value.toString() || 'not_specified'}
            onValueChange={(newValue) => updateCellValue(index, field, newValue === 'not_specified' ? '' : newValue)}
          >
            <SelectTrigger className={cn(cellClassName, "min-h-8 whitespace-normal break-all leading-tight")}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_specified">Not specified</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <textarea
          value={value.toString()}
          onChange={(e) => updateCellValue(index, field, e.target.value)}
          className={cn(cellClassName, "resize-none overflow-hidden min-h-8 leading-tight")}
          placeholder={field === 'name' || field === 'contactNumber' ? 'Required' : 'Optional'}
          rows={1}
          style={{
            height: 'auto',
            minHeight: '2rem'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
        {error && (
          <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1">
            <AlertTriangle className="h-3 w-3 text-red-500" />
          </div>
        )}
      </div>
    );
  };

  const errorCount = Object.keys(validationErrors).length;
  const hasData = teachers.length > 0;

  return (
    <div className="container mx-auto p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem('teacherBulkData');
            setLocation('/teachers/bulk-upload');
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Review Teacher Data</h1>
          <p className="text-sm text-muted-foreground">
            Review and edit the uploaded teacher data before final submission
          </p>
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              {errorCount > 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Validation Issues ({errorCount})</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Ready to Submit</span>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {teachers.length} teachers loaded
            </div>
          </CardTitle>
          {errorCount > 0 && (
            <CardDescription className="text-amber-600 text-sm">
              Please fix validation errors (marked with ⚠️) before submitting
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Editable Table */}
      {hasData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Teacher Data</CardTitle>
            <CardDescription className="text-sm">
              Click on any cell to edit. Required fields: Name*, Mobile Number*
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="border rounded-lg">
              <table className="w-full border-collapse text-sm table-fixed">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-8">Row</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Name*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Mobile*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-32">Email</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Designation</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">School ID</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Gender</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Blood Group</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Date of Birth</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-28">Father/Husband</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-28">Address</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Category</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Religion</th>
                    <th className="text-left px-1 py-1 font-medium text-xs w-20">Aadhaar</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-1 py-1 text-xs text-muted-foreground border-r bg-gray-50 w-8">
                        {index + 1}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(teacher, index, 'name')}
                        {getCellError(index, 'name') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'name')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(teacher, index, 'contactNumber')}
                        {getCellError(index, 'contactNumber') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'contactNumber')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-32">
                        {renderEditableCell(teacher, index, 'email')}
                        {getCellError(index, 'email') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'email')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(teacher, index, 'designation')}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(teacher, index, 'schoolIdNumber')}
                        {getCellError(index, 'schoolIdNumber') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'schoolIdNumber')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(teacher, index, 'gender', 'select', ['male', 'female', 'other'])}
                        {getCellError(index, 'gender') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'gender')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(teacher, index, 'bloodGroup')}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(teacher, index, 'dateOfBirth')}
                      </td>
                      <td className="px-1 py-1 border-r w-28">
                        {renderEditableCell(teacher, index, 'fatherHusbandName')}
                      </td>
                      <td className="px-1 py-1 border-r w-28">
                        {renderEditableCell(teacher, index, 'address')}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(teacher, index, 'category')}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(teacher, index, 'religion')}
                      </td>
                      <td className="px-1 py-1 w-20">
                        {renderEditableCell(teacher, index, 'aadhar')}
                        {getCellError(index, 'aadhar') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'aadhar')?.message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {hasData && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-sm text-muted-foreground">
            {errorCount > 0 ? (
              <span className="text-amber-600">
                {errorCount} validation errors need to be fixed
              </span>
            ) : (
              <span className="text-green-600">
                All data validated successfully
              </span>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={errorCount > 0 || bulkUploadMutation.isPending}
            size="default"
          >
            {bulkUploadMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing Teachers...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {teachers.length} Teachers
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}