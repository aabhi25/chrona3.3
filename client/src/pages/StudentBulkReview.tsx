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

interface StudentImportData {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string; // Keep for backend compatibility, will be derived from grade-section
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

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CellError {
  message: string;
}

export default function StudentBulkReview() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentImportData[]>([]);

  // Function to remove a row
  const removeRow = (index: number) => {
    const newStudents = students.filter((_, i) => i !== index);
    setStudents(newStudents);
    
    // Clean up validation errors for removed row and adjust indices
    const newValidationErrors = { ...validationErrors };
    const fieldsToCheck = ['firstName', 'lastName', 'admissionNumber', 'grade', 'section', 'rollNumber', 'email', 'contactNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'address', 'emergencyContact'];
    
    // Remove errors for the deleted row
    fieldsToCheck.forEach(field => {
      delete newValidationErrors[`${index}-${field}`];
    });
    
    // Adjust indices for remaining rows
    const adjustedErrors: Record<string, CellError> = {};
    Object.keys(newValidationErrors).forEach(key => {
      const match = key.match(/^(\d+)-(.+)$/);
      if (match) {
        const rowIndex = parseInt(match[1]);
        const field = match[2];
        if (rowIndex > index) {
          // Shift index down by 1
          adjustedErrors[`${rowIndex - 1}-${field}`] = newValidationErrors[key];
        } else if (rowIndex < index) {
          // Keep same index
          adjustedErrors[key] = newValidationErrors[key];
        }
        // Skip the deleted row (rowIndex === index)
      } else {
        adjustedErrors[key] = newValidationErrors[key];
      }
    });
    
    setValidationErrors(adjustedErrors);
  };
  const [validationErrors, setValidationErrors] = useState<Record<string, CellError>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);

  // Load data from sessionStorage on mount
  useEffect(() => {
    const storedData = sessionStorage.getItem('studentBulkData');
    if (!storedData) {
      toast({
        variant: "destructive",
        title: "No Data Found",
        description: "No uploaded data found. Please upload a file first."
      });
      setLocation('/students/bulk-upload');
      return;
    }

    try {
      const parsedStudents = JSON.parse(storedData);
      setStudents(parsedStudents);
      validateAllDataWithDatabase(parsedStudents);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Failed to load uploaded data. Please try uploading again."
      });
      setLocation('/students/bulk-upload');
    }
  }, [toast, setLocation]);

  // Validate all data with database checks
  const validateAllDataWithDatabase = async (studentData: StudentImportData[]) => {
    const errors: Record<string, CellError> = {};
    const admissionNumberMap = new Map<string, number>(); // Track admission numbers and their first occurrence
    const emailMap = new Map<string, number>(); // Track email addresses and their first occurrence
    const contactMap = new Map<string, number>(); // Track contact numbers and their first occurrence

    // Get existing students and classes from database for validation
    let existingStudents: any[] = [];
    let classes: any[] = [];
    try {
      const [studentsResponse, classesResponse] = await Promise.all([
        apiRequest("GET", "/api/students"),
        apiRequest("GET", "/api/classes")
      ]);
      const studentsData = await studentsResponse.json();
      existingStudents = studentsData.students || [];
      classes = await classesResponse.json();
      
      // Sort classes by grade then section for dropdown display
      const sortedClasses = classes.sort((a, b) => {
        const gradeA = parseInt(a.grade) || 0;
        const gradeB = parseInt(b.grade) || 0;
        if (gradeA !== gradeB) return gradeA - gradeB;
        
        // Handle null/empty sections properly
        const sectionA = a.section || '';
        const sectionB = b.section || '';
        return sectionA.localeCompare(sectionB);
      });
      setAvailableClasses(sortedClasses);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Failed to validate against existing data"
      });
    }

    studentData.forEach((student, index) => {
      // Required fields validation
      if (!student.firstName || student.firstName.trim() === '') {
        errors[`${index}-firstName`] = { message: 'First name is required' };
      }

      if (!student.lastName || student.lastName.trim() === '') {
        errors[`${index}-lastName`] = { message: 'Last name is required' };
      }

      if (!student.admissionNumber || student.admissionNumber.trim() === '') {
        errors[`${index}-admissionNumber`] = { message: 'Admission number is required' };
      } else {
        const admissionNumber = student.admissionNumber.trim();
        
        // Check for duplicate admission numbers within batch
        if (admissionNumberMap.has(admissionNumber)) {
          const firstOccurrence = admissionNumberMap.get(admissionNumber)!;
          errors[`${index}-admissionNumber`] = { message: `Duplicate admission number found in row ${firstOccurrence + 1}` };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-admissionNumber`] = { message: `Duplicate admission number found in row ${index + 1}` };
        } else {
          // Check against database
          const existingWithSameAdmission = existingStudents.find(
            existingStudent => existingStudent.admissionNumber === admissionNumber
          );
          if (existingWithSameAdmission) {
            errors[`${index}-admissionNumber`] = { message: 'Admission number already exists in database' };
          } else {
            admissionNumberMap.set(admissionNumber, index);
          }
        }
      }

      // Validate grade and section fields - check if combination exists in school
      if (!student.grade || student.grade.trim() === '') {
        errors[`${index}-grade`] = { message: 'Grade is required' };
      }
      // Section is optional - no validation needed
      
      // If grade is provided, validate the class exists (with or without section)
      if (student.grade && student.grade.trim() !== '') {
        const grade = student.grade.trim();
        const section = student.section ? student.section.trim() : '';
        
        let classExists;
        if (section === '') {
          // Find class with empty or null section
          classExists = classes.find(cls => 
            cls.grade.toString() === grade && 
            (!cls.section || cls.section.trim() === '')
          );
        } else {
          // Find class with specific section
          classExists = classes.find(cls => 
            cls.grade.toString() === grade && 
            cls.section && cls.section.toLowerCase() === section.toLowerCase()
          );
        }
        
        if (!classExists) {
          if (section === '') {
            errors[`${index}-grade`] = { message: 'This grade does not exist or requires a section' };
          } else {
            errors[`${index}-grade`] = { message: 'This grade-section combination does not exist' };
            errors[`${index}-section`] = { message: 'This grade-section combination does not exist' };
          }
        } else {
          // Set the classId for backend compatibility
          student.classId = classExists.id;
        }
      }

      // Contact number validation (if provided)
      if (student.contactNumber && student.contactNumber.trim() !== '') {
        const contact = student.contactNumber.trim();
        if (!/^\d{10}$/.test(contact)) {
          errors[`${index}-contactNumber`] = { message: 'Contact number must be exactly 10 digits' };
        } else {
          // Check for duplicate contact numbers within batch
          if (contactMap.has(contact)) {
            const firstOccurrence = contactMap.get(contact)!;
            errors[`${index}-contactNumber`] = { message: `Duplicate contact number found in row ${firstOccurrence + 1}` };
            // Also mark the first occurrence as having a duplicate
            errors[`${firstOccurrence}-contactNumber`] = { message: `Duplicate contact number found in row ${index + 1}` };
          } else {
            // Check against database
            const existingWithSameContact = existingStudents.find(
              existingStudent => existingStudent.contactNumber === contact
            );
            if (existingWithSameContact) {
              errors[`${index}-contactNumber`] = { message: 'Contact number already exists in database' };
            } else {
              contactMap.set(contact, index);
            }
          }
        }
      }

      // Email validation (if provided)
      if (student.email && student.email.trim() !== '') {
        const email = student.email.trim();
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

      // Gender validation (if provided)
      if (student.gender && student.gender.trim() !== '') {
        const gender = student.gender.toLowerCase().trim();
        if (!['male', 'female', 'other'].includes(gender)) {
          errors[`${index}-gender`] = { message: 'Gender must be male, female, or other' };
        }
      }
    });

    // Check for duplicate roll numbers within the same class
    const classRollNumberMap = new Map<string, Map<string, number>>();
    
    studentData.forEach((student, index) => {
      if (student.rollNumber && student.rollNumber.trim() !== '' && 
          student.grade && student.grade.trim() !== '') {
        
        const rollNumber = student.rollNumber.trim();
        const grade = student.grade.trim();
        const section = student.section ? student.section.trim() : '';
        const classKey = `${grade}-${section}`;
        
        if (!classRollNumberMap.has(classKey)) {
          classRollNumberMap.set(classKey, new Map());
        }
        
        const rollNumberMap = classRollNumberMap.get(classKey)!;
        
        if (rollNumberMap.has(rollNumber)) {
          const firstOccurrence = rollNumberMap.get(rollNumber)!;
          const className = section ? `Class ${grade} ${section}` : `Class ${grade}`;
          
          errors[`${index}-rollNumber`] = { 
            message: `Duplicate roll number ${rollNumber} in ${className} (also in row ${firstOccurrence + 1})` 
          };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-rollNumber`] = { 
            message: `Duplicate roll number ${rollNumber} in ${className} (also in row ${index + 1})` 
          };
        } else {
          rollNumberMap.set(rollNumber, index);
        }
      }
    });

    setValidationErrors(errors);
  };

  // Validate all data (synchronous version for compatibility)
  const validateAllData = (studentData: StudentImportData[]) => {
    const errors: Record<string, CellError> = {};
    const admissionNumberMap = new Map<string, number>(); // Track admission numbers and their first occurrence
    const emailMap = new Map<string, number>(); // Track email addresses and their first occurrence
    const contactMap = new Map<string, number>(); // Track contact numbers and their first occurrence

    studentData.forEach((student, index) => {
      // Required fields validation
      if (!student.firstName || student.firstName.trim() === '') {
        errors[`${index}-firstName`] = { message: 'First name is required' };
      }

      if (!student.lastName || student.lastName.trim() === '') {
        errors[`${index}-lastName`] = { message: 'Last name is required' };
      }

      if (!student.admissionNumber || student.admissionNumber.trim() === '') {
        errors[`${index}-admissionNumber`] = { message: 'Admission number is required' };
      } else {
        // Check for duplicate admission numbers within batch
        const admissionNumber = student.admissionNumber.trim();
        if (admissionNumberMap.has(admissionNumber)) {
          const firstOccurrence = admissionNumberMap.get(admissionNumber)!;
          errors[`${index}-admissionNumber`] = { message: `Duplicate admission number found in row ${firstOccurrence + 1}` };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-admissionNumber`] = { message: `Duplicate admission number found in row ${index + 1}` };
        } else {
          admissionNumberMap.set(admissionNumber, index);
        }
      }

      // Validate grade format using shared validation utility
      const gradeValidation = validateGrade(student.grade);
      if (!gradeValidation.isValid) {
        errors[`${index}-grade`] = { message: gradeValidation.error || 'Invalid grade' };
      }
      // Section is optional - no validation needed
      // Note: Full class validation is handled in validateAllDataWithDatabase since it requires API data

      // Contact number validation (if provided)
      if (student.contactNumber && student.contactNumber.trim() !== '') {
        const contact = student.contactNumber.trim();
        if (!/^\d{10}$/.test(contact)) {
          errors[`${index}-contactNumber`] = { message: 'Contact number must be exactly 10 digits' };
        } else {
          // Check for duplicate contact numbers within batch
          if (contactMap.has(contact)) {
            const firstOccurrence = contactMap.get(contact)!;
            errors[`${index}-contactNumber`] = { message: `Duplicate contact number found in row ${firstOccurrence + 1}` };
            // Also mark the first occurrence as having a duplicate
            errors[`${firstOccurrence}-contactNumber`] = { message: `Duplicate contact number found in row ${index + 1}` };
          } else {
            contactMap.set(contact, index);
          }
        }
      }

      // Email validation (if provided)
      if (student.email && student.email.trim() !== '') {
        const email = student.email.trim();
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

      // Gender validation (if provided)
      if (student.gender && student.gender.trim() !== '') {
        const gender = student.gender.toLowerCase().trim();
        if (!['male', 'female', 'other'].includes(gender)) {
          errors[`${index}-gender`] = { message: 'Gender must be male, female, or other' };
        }
      }
    });

    // Check for duplicate roll numbers within the same class
    const classRollNumberMap = new Map<string, Map<string, number>>();
    
    studentData.forEach((student, index) => {
      if (student.rollNumber && student.rollNumber.trim() !== '' && 
          student.grade && student.grade.trim() !== '') {
        
        const rollNumber = student.rollNumber.trim();
        const grade = student.grade.trim();
        const section = student.section ? student.section.trim() : '';
        const classKey = `${grade}-${section}`;
        
        if (!classRollNumberMap.has(classKey)) {
          classRollNumberMap.set(classKey, new Map());
        }
        
        const rollNumberMap = classRollNumberMap.get(classKey)!;
        
        if (rollNumberMap.has(rollNumber)) {
          const firstOccurrence = rollNumberMap.get(rollNumber)!;
          const className = section ? `Class ${grade} ${section}` : `Class ${grade}`;
          
          errors[`${index}-rollNumber`] = { 
            message: `Duplicate roll number ${rollNumber} in ${className} (also in row ${firstOccurrence + 1})` 
          };
          // Also mark the first occurrence as having a duplicate
          errors[`${firstOccurrence}-rollNumber`] = { 
            message: `Duplicate roll number ${rollNumber} in ${className} (also in row ${index + 1})` 
          };
        } else {
          rollNumberMap.set(rollNumber, index);
        }
      }
    });

    setValidationErrors(errors);
  };

  // Synchronous validation for single field editing (doesn't check database)
  const validateSingleFieldSync = (index: number, field: keyof StudentImportData, value: string, currentStudents: StudentImportData[] = students) => {
    const cellKey = `${index}-${field}`;
    const newErrors = { ...validationErrors };

    // Clear error for current field
    delete newErrors[cellKey];

    // Basic field validation
    switch (field) {
      case 'firstName':
        if (!value || value.trim() === '') {
          newErrors[cellKey] = { message: 'First name is required' };
        }
        break;
      case 'lastName':
        if (!value || value.trim() === '') {
          newErrors[cellKey] = { message: 'Last name is required' };
        }
        break;
      case 'admissionNumber':
        if (!value || value.trim() === '') {
          newErrors[cellKey] = { message: 'Admission number is required' };
        }
        break;
      case 'grade':
        {
          // Validate grade format first using shared validation utility
          const gradeValidation = validateGrade(value);
          if (!gradeValidation.isValid) {
            newErrors[cellKey] = { message: gradeValidation.error || 'Invalid grade' };
          } else {
            // Validate class exists
            const currentStudent = currentStudents[index];
            const grade = value.trim();
            const section = currentStudent.section ? currentStudent.section.trim() : '';
            
            let classExists;
            if (section === '') {
              classExists = availableClasses.find(cls => 
                cls.grade.toString() === grade && 
                (!cls.section || cls.section.trim() === '')
              );
            } else {
              classExists = availableClasses.find(cls => 
                cls.grade.toString() === grade && 
                cls.section && cls.section.toLowerCase() === section.toLowerCase()
              );
            }
            
            if (!classExists) {
              if (section === '') {
                newErrors[cellKey] = { message: 'This grade does not exist or requires a section' };
              } else {
                newErrors[cellKey] = { message: 'This grade-section combination does not exist' };
                newErrors[`${index}-section`] = { message: 'This grade-section combination does not exist' };
              }
            } else {
              // Update classId
              currentStudents[index].classId = classExists.id;
              // Clear related errors
              delete newErrors[`${index}-section`];
            }
          }
        }
        break;
      case 'section':
        // Validate class exists with current grade
        const currentStudent = currentStudents[index];
        if (currentStudent && currentStudent.grade && currentStudent.grade.trim() !== '') {
          const grade = currentStudent.grade.trim();
          const section = value ? value.trim() : '';
          
          let classExists;
          if (section === '') {
            classExists = availableClasses.find(cls => 
              cls.grade.toString() === grade && 
              (!cls.section || cls.section.trim() === '')
            );
          } else {
            classExists = availableClasses.find(cls => 
              cls.grade.toString() === grade && 
              cls.section && cls.section.toLowerCase() === section.toLowerCase()
            );
          }
          
          if (!classExists) {
            if (section === '') {
              delete newErrors[cellKey];
              newErrors[`${index}-grade`] = { message: 'This grade does not exist or requires a section' };
            } else {
              newErrors[cellKey] = { message: 'This grade-section combination does not exist' };
              newErrors[`${index}-grade`] = { message: 'This grade-section combination does not exist' };
            }
          } else {
            // Update classId
            currentStudents[index].classId = classExists.id;
            // Clear related errors
            delete newErrors[`${index}-grade`];
          }
        }
        break;
      case 'contactNumber':
        if (value && value.trim() !== '' && !/^\d{10}$/.test(value.trim())) {
          newErrors[cellKey] = { message: 'Contact number must be exactly 10 digits' };
        }
        break;
      case 'email':
        if (value && value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          newErrors[cellKey] = { message: 'Invalid email format' };
        }
        break;
      case 'gender':
        if (value && value.trim() !== '' && !['male', 'female', 'other'].includes(value.toLowerCase().trim())) {
          newErrors[cellKey] = { message: 'Gender must be male, female, or other' };
        }
        break;
    }

    setValidationErrors(newErrors);
  };

  // Update cell value
  const updateCellValue = (index: number, field: keyof StudentImportData, value: string) => {
    const updatedStudents = [...students];
    updatedStudents[index] = { ...updatedStudents[index], [field]: value };
    setStudents(updatedStudents);
    
    // Validate single field with updated students array (non-async version for editing)
    validateSingleFieldSync(index, field, value, updatedStudents);
  };

  // Validate single field with database checks
  const validateSingleField = async (index: number, field: keyof StudentImportData, value: string, currentStudents: StudentImportData[] = students) => {
    const cellKey = `${index}-${field}`;
    const newErrors = { ...validationErrors };

    // For duplicate-prone fields, clear all related errors and re-validate all rows
    if (['admissionNumber', 'email', 'contactNumber', 'rollNumber'].includes(field)) {
      // Get existing students from database for validation
      let existingStudents: any[] = [];
      try {
        const response = await apiRequest("GET", "/api/students");
        existingStudents = await response.json();
      } catch (error) {
        console.error("Error fetching existing students:", error);
      }

      // Clear all errors for this field type across all rows
      Object.keys(newErrors).forEach(errorKey => {
        if (errorKey.endsWith(`-${field}`)) {
          delete newErrors[errorKey];
        }
      });

      // Re-validate all rows for this field type using the current students data
      currentStudents.forEach((student, studentIndex) => {
        const studentCellKey = `${studentIndex}-${field}`;
        const studentValue = field === 'admissionNumber' ? student.admissionNumber :
                           field === 'email' ? student.email :
                           field === 'contactNumber' ? student.contactNumber : '';

        if (studentValue && studentValue.trim() !== '') {
          const trimmedValue = studentValue.trim();
          
          // For the current field being edited, use the new value
          const valueToCheck = studentIndex === index ? value.trim() : trimmedValue;
          
          if (field === 'contactNumber' && !/^\d{10}$/.test(valueToCheck)) {
            newErrors[studentCellKey] = { message: 'Contact number must be exactly 10 digits' };
          } else if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueToCheck)) {
            newErrors[studentCellKey] = { message: 'Invalid email format' };
          } else {
            // Check for duplicates within current batch
            const duplicateIndex = currentStudents.findIndex((otherStudent, otherIndex) => {
              if (otherIndex === studentIndex) return false;
              
              if (field === 'rollNumber') {
                // For roll numbers, only check within the same class
                const currentGrade = studentIndex === index ? currentStudents[studentIndex].grade : currentStudents[studentIndex].grade;
                const currentSection = studentIndex === index ? currentStudents[studentIndex].section : currentStudents[studentIndex].section;
                const otherGrade = otherStudent.grade;
                const otherSection = otherStudent.section;
                
                // Only consider it a duplicate if same class
                if (currentGrade === otherGrade && currentSection === otherSection) {
                  const otherValue = otherStudent.rollNumber;
                  const otherValueToCheck = otherIndex === index ? value.trim() : otherValue?.trim();
                  return otherValueToCheck === valueToCheck;
                }
                return false;
              } else {
                const otherValue = field === 'admissionNumber' ? otherStudent.admissionNumber :
                                 field === 'email' ? otherStudent.email :
                                 field === 'contactNumber' ? otherStudent.contactNumber : '';
                
                const otherValueToCheck = otherIndex === index ? value.trim() : otherValue?.trim();
                return otherValueToCheck === valueToCheck;
              }
            });
            
            if (duplicateIndex !== -1) {
              if (field === 'rollNumber') {
                const currentStudent = currentStudents[studentIndex];
                const className = currentStudent.section ? `Class ${currentStudent.grade} ${currentStudent.section}` : `Class ${currentStudent.grade}`;
                newErrors[studentCellKey] = { message: `Duplicate roll number ${valueToCheck} in ${className} (also in row ${duplicateIndex + 1})` };
              } else {
                newErrors[studentCellKey] = { message: `Duplicate ${field === 'admissionNumber' ? 'admission number' : field === 'contactNumber' ? 'contact number' : 'email'} found in row ${duplicateIndex + 1}` };
              }
            } else {
              // Check against database for admission number and contact number
              if (field === 'admissionNumber' || field === 'contactNumber') {
                const existingStudent = existingStudents.find(existingStudent => {
                  if (field === 'admissionNumber') {
                    return existingStudent.admissionNumber === valueToCheck;
                  } else if (field === 'contactNumber') {
                    return existingStudent.contactNumber === valueToCheck;
                  }
                  return false;
                });
                
                if (existingStudent) {
                  const fieldName = field === 'admissionNumber' ? 'Admission number' : 'Contact number';
                  newErrors[studentCellKey] = { message: `${fieldName} already exists in database` };
                }
              }
            }
          }
        }
      });
      
      // Validate required fields
      if (field === 'admissionNumber' && (!value || value.trim() === '')) {
        newErrors[cellKey] = { message: 'Admission number is required' };
      }
    } else {
      // For non-duplicate fields, simple validation
      switch (field) {
        case 'firstName':
          if (!value || value.trim() === '') {
            newErrors[cellKey] = { message: 'First name is required' };
          }
          break;
        case 'lastName':
          if (!value || value.trim() === '') {
            newErrors[cellKey] = { message: 'Last name is required' };
          }
          break;
        case 'grade':
          {
            // Validate grade format first using shared validation utility
            const gradeValidation = validateGrade(value);
            if (!gradeValidation.isValid) {
              newErrors[cellKey] = { message: gradeValidation.error || 'Invalid grade' };
            } else {
              // Validate the grade exists (with or without section)
              const currentStudent = students[index];
              if (currentStudent) {
                const grade = value.trim();
                const section = currentStudent.section ? currentStudent.section.trim() : '';
                
                let classExists;
                if (section === '') {
                  // Find class with empty or null section
                  classExists = availableClasses.find(cls => 
                    cls.grade.toString() === grade && 
                    (!cls.section || cls.section.trim() === '')
                  );
                } else {
                  // Find class with specific section
                  classExists = availableClasses.find(cls => 
                    cls.grade.toString() === grade && 
                    cls.section && cls.section.toLowerCase() === section.toLowerCase()
                  );
                }
                
                if (!classExists) {
                  if (section === '') {
                    newErrors[cellKey] = { message: 'This grade does not exist or requires a section' };
                  } else {
                    newErrors[cellKey] = { message: 'This grade-section combination does not exist' };
                    const sectionKey = `${index}-section`;
                    newErrors[sectionKey] = { message: 'This grade-section combination does not exist' };
                  }
                } else {
                  // Clear errors and update classId
                  delete newErrors[cellKey];
                  const sectionKey = `${index}-section`;
                  delete newErrors[sectionKey];
                  // Update the student's classId for backend compatibility
                  currentStudent.classId = classExists.id;
                }
              }
            }
          }
          break;
        case 'section':
          // Section is optional, only validate if value is provided
          const currentStudent = students[index];
          if (currentStudent && currentStudent.grade && currentStudent.grade.trim() !== '') {
            const grade = currentStudent.grade.trim();
            const section = value ? value.trim() : '';
            
            let classExists;
            if (section === '') {
              // Find class with empty or null section
              classExists = availableClasses.find(cls => 
                cls.grade.toString() === grade && 
                (!cls.section || cls.section.trim() === '')
              );
            } else {
              // Find class with specific section
              classExists = availableClasses.find(cls => 
                cls.grade.toString() === grade && 
                cls.section && cls.section.toLowerCase() === section.toLowerCase()
              );
            }
            
            if (!classExists) {
              if (section === '') {
                // Clear section error but set grade error
                delete newErrors[cellKey];
                const gradeKey = `${index}-grade`;
                newErrors[gradeKey] = { message: 'This grade does not exist or requires a section' };
              } else {
                newErrors[cellKey] = { message: 'This grade-section combination does not exist' };
                const gradeKey = `${index}-grade`;
                newErrors[gradeKey] = { message: 'This grade-section combination does not exist' };
              }
            } else {
              // Clear errors and update classId
              delete newErrors[cellKey];
              const gradeKey = `${index}-grade`;
              delete newErrors[gradeKey];
              // Update the student's classId for backend compatibility
              currentStudent.classId = classExists.id;
            }
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
    mutationFn: async (studentData: StudentImportData[]) => {
      const response = await apiRequest("POST", "/api/students/bulk-upload", { students: studentData });
      return await response.json();
    },
    onSuccess: (data: any) => {
      sessionStorage.removeItem('studentBulkData'); // Clean up
      
      if (data.errors && data.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Partial Import",
          description: `${data.imported} students imported successfully, ${data.errors.length} failed.`
        });
      } else {
        toast({
          title: "Success",
          description: `Successfully imported ${data.imported || students.length} students`
        });
      }
      setLocation('/students');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to import students"
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

    bulkUploadMutation.mutate(students);
  };

  const getCellError = (index: number, field: keyof StudentImportData) => {
    return validationErrors[`${index}-${field}`];
  };

  // Render editable cell
  const renderEditableCell = (student: StudentImportData, index: number, field: keyof StudentImportData) => {
    const value = student[field] || '';
    const error = getCellError(index, field);
    
    const cellClassName = cn(
      "min-h-8 px-1 py-1 text-xs border-0 bg-transparent cursor-pointer hover:bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-left w-full break-all whitespace-normal leading-tight resize-none overflow-hidden",
      error && "bg-red-50 border border-red-200"
    );

    // Special handling for select fields
    if (field === 'gender') {
      const options = ['male', 'female', 'other'];
      return (
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
      );
    }

    // Special handling for class field when there's a validation error
    if (field === 'classId' && error && error.message.includes('does not exist in school')) {
      return (
        <Select
          value={value.toString() || 'select_class'}
          onValueChange={(newValue) => updateCellValue(index, field, newValue === 'select_class' ? '' : newValue)}
        >
          <SelectTrigger className={cn(cellClassName, "min-h-8 whitespace-normal break-all leading-tight")}>
            <SelectValue placeholder="Select class..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="select_class">Select a class...</SelectItem>
            {availableClasses.map((cls) => (
              <SelectItem key={cls.id} value={cls.section ? `${cls.grade}-${cls.section}` : cls.grade}>
                {cls.section ? `Class ${cls.grade} ${cls.section}` : `Class ${cls.grade}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Regular textarea for all other fields
    return (
      <div>
        <textarea
          value={value.toString()}
          onChange={(e) => updateCellValue(index, field, e.target.value)}
          className={cn(cellClassName, "resize-none overflow-hidden min-h-8 leading-tight")}
          placeholder={['firstName', 'lastName', 'admissionNumber', 'classId'].includes(field) ? 'Required' : 'Optional'}
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
      </div>
    );
  };

  const errorCount = Object.keys(validationErrors).length;
  const hasData = students.length > 0;

  return (
    <div className="container mx-auto p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem('studentBulkData');
            setLocation('/students/bulk-upload');
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Review Student Data</h1>
          <p className="text-sm text-muted-foreground">
            Review and edit the uploaded student data before final submission
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
              {students.length} students loaded
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
            <CardTitle className="text-base">Student Data</CardTitle>
            <CardDescription className="text-sm">
              Click on any cell to edit. Required fields: First Name*, Last Name*, Admission Number*, Grade*. Section is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="border rounded-lg">
              <table className="w-full border-collapse text-sm table-fixed">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-8">Row</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-8"></th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">First Name*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Last Name*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Admission No*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-12">Grade*</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-12">Section</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-12">Roll No</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-32">Email</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Contact</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-20">Date of Birth</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Gender</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-16">Blood Group</th>
                    <th className="text-left px-1 py-1 font-medium text-xs border-r w-24">Address</th>
                    <th className="text-left px-1 py-1 font-medium text-xs w-20">Emergency Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-1 py-1 text-xs text-muted-foreground border-r bg-gray-50 w-8">
                        {index + 1}
                      </td>
                      <td className="px-1 py-1 border-r w-8 text-center">
                        <button
                          onClick={() => removeRow(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
                          title="Remove this row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(student, index, 'firstName')}
                        {getCellError(index, 'firstName') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'firstName')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(student, index, 'lastName')}
                        {getCellError(index, 'lastName') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'lastName')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(student, index, 'admissionNumber')}
                        {getCellError(index, 'admissionNumber') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'admissionNumber')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-12">
                        {renderEditableCell(student, index, 'grade')}
                        {getCellError(index, 'grade') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'grade')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-12">
                        {renderEditableCell(student, index, 'section')}
                        {getCellError(index, 'section') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'section')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-12">
                        {renderEditableCell(student, index, 'rollNumber')}
                        {getCellError(index, 'rollNumber') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'rollNumber')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-32">
                        {renderEditableCell(student, index, 'email')}
                        {getCellError(index, 'email') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'email')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(student, index, 'contactNumber')}
                        {getCellError(index, 'contactNumber') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'contactNumber')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-20">
                        {renderEditableCell(student, index, 'dateOfBirth')}
                        {getCellError(index, 'dateOfBirth') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'dateOfBirth')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(student, index, 'gender')}
                        {getCellError(index, 'gender') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'gender')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-16">
                        {renderEditableCell(student, index, 'bloodGroup')}
                        {getCellError(index, 'bloodGroup') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'bloodGroup')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 border-r w-24">
                        {renderEditableCell(student, index, 'address')}
                        {getCellError(index, 'address') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'address')?.message}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 w-20">
                        {renderEditableCell(student, index, 'emergencyContact')}
                        {getCellError(index, 'emergencyContact') && (
                          <div className="text-xs text-red-500 mt-0.5 break-words">
                            {getCellError(index, 'emergencyContact')?.message}
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

      {/* Submit Section */}
      {hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {errorCount > 0 ? (
                  <span className="text-amber-600">
                    Fix {errorCount} validation errors before submitting
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
                className="min-w-[120px]"
              >
                {bulkUploadMutation.isPending ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Import {students.length} Students
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}