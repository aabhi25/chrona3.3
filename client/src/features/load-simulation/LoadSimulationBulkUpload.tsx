import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from 'xlsx';

interface LoadSimulationBulkUploadProps {
  simulationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedData {
  teachers: Array<{
    name: string;
    employeeId: string;
    contactNumber?: string;
    email?: string;
    maxPeriodsPerDay?: number;
  }>;
  classSubjects: Array<{
    grade: string;
    section?: string;
    subjectName: string;
    subjectCode: string;
    weeklyPeriods: number;
    teacherEmployeeId?: string;
  }>;
}

export function LoadSimulationBulkUpload({ simulationId, open, onOpenChange }: LoadSimulationBulkUploadProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Download template
  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();

    // Teachers sheet
    const teachersData = [
      {
        'Teacher Name*': 'Rajesh Kumar',
        'Employee ID*': 'T001',
        'Contact Number': '9876543210',
        'Email': 'rajesh@school.com',
        'Max Periods per day': '6'
      },
      {
        'Teacher Name*': 'Priya Sharma',
        'Employee ID*': 'T002',
        'Contact Number': '9876543211',
        'Email': 'priya@school.com',
        'Max Periods per day': '7'
      },
      {
        'Teacher Name*': 'Amit Patel',
        'Employee ID*': 'T003',
        'Contact Number': '9876543212',
        'Email': 'amit@school.com',
        'Max Periods per day': '6'
      }
    ];
    const teachersSheet = XLSX.utils.json_to_sheet(teachersData);
    teachersSheet['!cols'] = [
      { wch: 25 }, // Teacher Name
      { wch: 15 }, // Employee ID
      { wch: 18 }, // Contact Number
      { wch: 30 }, // Email
      { wch: 18 }  // Max Periods/Day
    ];
    XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

    // Classes & Subjects sheet
    const classSubjectsData = [
      {
        'Class/Grade*': 'Playschool',
        'Section': '',
        'Subject Name*': 'Play Activities',
        'Subject Code': 'PLAY',
        'Weekly Periods*': '5',
        'Teacher Employee ID': 'T001',
        '': '',
        '📋 Allowed Classes': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
      },
      {
        'Class/Grade*': 'Nursery',
        'Section': 'A',
        'Subject Name*': 'English',
        'Subject Code': 'ENG',
        'Weekly Periods*': '6',
        'Teacher Employee ID': 'T002',
        '': '',
        '📋 Allowed Classes': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
      },
      {
        'Class/Grade*': '1',
        'Section': 'A',
        'Subject Name*': 'Mathematics',
        'Subject Code': 'MATH',
        'Weekly Periods*': '7',
        'Teacher Employee ID': 'T003',
        '': '',
        '📋 Allowed Classes': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
      },
      {
        'Class/Grade*': '5',
        'Section': 'B',
        'Subject Name*': 'Science',
        'Subject Code': 'SCI',
        'Weekly Periods*': '6',
        'Teacher Employee ID': 'T002',
        '': '',
        '📋 Allowed Classes': 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12'
      }
    ];
    const classSubjectsSheet = XLSX.utils.json_to_sheet(classSubjectsData);
    classSubjectsSheet['!cols'] = [
      { wch: 18 }, // Class/Grade
      { wch: 10 }, // Section
      { wch: 25 }, // Subject Name
      { wch: 15 }, // Subject Code
      { wch: 18 }, // Weekly Periods
      { wch: 22 }, // Teacher Employee ID
      { wch: 2 },  // Empty column
      { wch: 50 }  // Reference column
    ];
    XLSX.utils.book_append_sheet(workbook, classSubjectsSheet, 'Classes & Subjects');

    // Instructions sheet
    const instructionsData = [
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '' },
      { '': '' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '1. TEACHERS SHEET' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Teacher Name*: Full name of the teacher (required)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Employee ID*: Unique identifier for the teacher (required)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Contact Number: Mobile number (optional)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Email: Email address (optional)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Max Periods per day: Maximum teaching periods per day (optional, default: 7)' },
      { '': '' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '2. CLASSES & SUBJECTS SHEET' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Class/Grade*: Class name (Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12) (required)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Section: Section name (A, B, C, etc.) - leave empty if no section (optional)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Subject Name*: Name of the subject (required)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Subject Code: Short code for subject (optional, auto-generated if empty)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Weekly Periods*: Number of periods per week (required, 1-50)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Teacher Employee ID: Employee ID from Teachers sheet (optional)' },
      { '': '' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '3. IMPORTANT NOTES' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Fields marked with * are required' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Employee IDs must match exactly between sheets' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Classes will be created automatically if they don\'t exist' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Subjects can be reused across different classes' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • This upload will ADD to existing simulation data (not replace)' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Teacher assignments are optional - you can add them later' },
      { '': '' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '4. VALIDATION' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Weekly periods must respect the school\'s timetable limit' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Duplicate subjects in same class will be rejected' },
      { 'LOAD SIMULATION BULK UPLOAD INSTRUCTIONS': '   • Invalid class names will be rejected' }
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    XLSX.writeFile(workbook, `load-simulation-bulk-upload-template.xlsx`);
    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your simulation data for import."
    });
  };

  // File validation
  const validateFile = (file: File): boolean => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)"
      });
      return false;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "File size must be less than 5MB"
      });
      return false;
    }

    return true;
  };

  // Parse Excel file
  const parseExcelFile = (file: File): Promise<ParsedData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

          // Parse Teachers sheet
          const teachersSheet = workbook.Sheets['Teachers'];
          const teachersData = teachersSheet ? XLSX.utils.sheet_to_json(teachersSheet) : [];
          
          const teachers = teachersData.map((row: any) => ({
            name: row['Teacher Name*']?.toString().trim() || '',
            employeeId: row['Employee ID*']?.toString().trim() || '',
            contactNumber: row['Contact Number']?.toString().trim(),
            email: row['Email']?.toString().trim(),
            maxPeriodsPerDay: row['Max Periods per day'] ? Number(row['Max Periods per day']) : undefined
          }));

          // Parse Classes & Subjects sheet
          const classSubjectsSheet = workbook.Sheets['Classes & Subjects'];
          const classSubjectsData = classSubjectsSheet ? XLSX.utils.sheet_to_json(classSubjectsSheet) : [];
          
          const classSubjects = classSubjectsData.map((row: any) => ({
            grade: row['Class/Grade*']?.toString().trim() || '',
            section: row['Section']?.toString().trim() || undefined,
            subjectName: row['Subject Name*']?.toString().trim() || '',
            subjectCode: row['Subject Code']?.toString().trim() || '',
            weeklyPeriods: Number(row['Weekly Periods*']) || 0,
            teacherEmployeeId: row['Teacher Employee ID']?.toString().trim() || undefined
          }));

          resolve({ teachers, classSubjects });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const parsedData = await parseExcelFile(file);
      
      // Add row numbers for tracking
      const reviewData = {
        teachers: parsedData.teachers.map((t, index) => ({
          ...t,
          originalRowNumber: index + 2 // +2 for header row and 1-based indexing
        })),
        classSubjects: parsedData.classSubjects.map((cs, index) => ({
          ...cs,
          originalRowNumber: index + 2
        }))
      };
      
      // Store in sessionStorage
      sessionStorage.setItem('loadSimulationBulkData', JSON.stringify(reviewData));
      
      // Navigate to review page
      onOpenChange(false);
      setLocation(`/simulation/${simulationId}/bulk-review`);
      
      toast({
        title: "File Processed",
        description: "Review your data before submitting"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process file"
      });
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset input
    }
  }, [toast, simulationId, onOpenChange, setLocation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle>Bulk Upload via Excel</DialogTitle>
              <DialogDescription>
                Upload classes, subjects, periods, teachers, and assignments all at once
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Section */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-1">Step 1: Download Template</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Get the Excel template with example data and instructions
                </p>
                <Button onClick={downloadTemplate} variant="outline" size="sm" className="bg-white">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Upload className="h-5 w-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">Step 2: Upload Filled Template</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Fill the template with your data and upload it here
                </p>
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Select Excel File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-500">Selected: {selectedFile.name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-orange-600 border-t-transparent rounded-full" />
                <p className="text-sm text-orange-700">Processing your file...</p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• This upload will ADD to your existing simulation data</p>
            <p>• Maximum file size: 5MB</p>
            <p>• Supported formats: .xlsx, .xls</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
