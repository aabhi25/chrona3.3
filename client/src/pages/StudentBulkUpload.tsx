import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface StudentImportData {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
  rollNumber?: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  originalRowNumber: number; // Store original spreadsheet row number
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function StudentBulkUpload() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Template download functionality
  const downloadTemplate = () => {
    const templateData = [
      {
        'First Name': 'Aarav',
        'Last Name': 'Kumar',
        'Admission Number': 'STU001',
        'Grade': 'Playschool',
        'Section': '',
        'Roll Number': '1',
        'Email': '',
        'Contact Number': '9876543210',
        'Date of Birth': '2019-03-15',
        'Gender': 'male',
        'Blood Group': 'O+',
        'Address': '123 Main Street, City',
        'Emergency Contact': '9876543211',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Playschool'
      },
      {
        'First Name': 'Priya',
        'Last Name': 'Sharma',
        'Admission Number': 'STU002',
        'Grade': 'LKG',
        'Section': 'A',
        'Roll Number': '2',
        'Email': '',
        'Contact Number': '9876543212',
        'Date of Birth': '2018-08-22',
        'Gender': 'female',
        'Blood Group': 'A+',
        'Address': '456 Park Avenue, City',
        'Emergency Contact': '9876543213',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Pre-Nursery'
      },
      {
        'First Name': 'Rahul',
        'Last Name': 'Patel',
        'Admission Number': 'STU003',
        'Grade': '5',
        'Section': 'B',
        'Roll Number': '15',
        'Email': 'rahul.patel@student.com',
        'Contact Number': '9876543214',
        'Date of Birth': '2013-11-10',
        'Gender': 'male',
        'Blood Group': 'B+',
        'Address': '789 Lake Road, City',
        'Emergency Contact': '9876543215',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Nursery'
      },
      {
        'First Name': 'Ananya',
        'Last Name': 'Singh',
        'Admission Number': 'STU004',
        'Grade': '10',
        'Section': 'A',
        'Roll Number': '8',
        'Email': 'ananya.singh@student.com',
        'Contact Number': '9876543216',
        'Date of Birth': '2008-05-18',
        'Gender': 'female',
        'Blood Group': 'AB+',
        'Address': '321 Garden Street, City',
        'Emergency Contact': '9876543217',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'LKG'
      },
      {
        'First Name': '',
        'Last Name': '',
        'Admission Number': '',
        'Grade': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'UKG'
      },
      {
        'First Name': '',
        'Last Name': '',
        'Admission Number': '',
        'Grade': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '1, 2, 3, 4, 5'
      },
      {
        'First Name': '',
        'Last Name': '',
        'Admission Number': '',
        'Grade': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '6, 7, 8, 9, 10'
      },
      {
        'First Name': '',
        'Last Name': '',
        'Admission Number': '',
        'Grade': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '11, 12'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Apply light background color to reference column (column O, index 14)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 14 }); // Column O (0-indexed = 14)
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          fill: { 
            patternType: "solid",
            fgColor: { rgb: "E8F4F8" },
            bgColor: { rgb: "E8F4F8" }
          },
          alignment: { vertical: "center" }
        };
      }
    }
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    
    // Add instructions sheet
    const instructions = [
      ['ALLOWED CLASS GRADES:'],
      ['Pre-Primary: Playschool, Pre-Nursery, Nursery, LKG, UKG'],
      ['Primary & Secondary: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10'],
      ['Senior Secondary: 11, 12'],
      [''],
      ['IMPORTANT NOTES:'],
      ['- Grade: Use one of the allowed values listed above (e.g., "LKG", "5", "10")'],
      ['- Section: Optional. Leave blank or use single letter (A, B, C, etc.)'],
      ['- Contact Number: Must be exactly 10 digits'],
      ['- Admission Number: Must be unique for each student'],
      ['- Gender: Use "male", "female", or "other"'],
      ['- Date of Birth: Format YYYY-MM-DD (e.g., 2008-05-15)'],
      [''],
      ['EXAMPLES:'],
      ['- Pre-primary without section: Grade="Playschool", Section=""'],
      ['- Pre-primary with section: Grade="LKG", Section="A"'],
      ['- Numeric grade with section: Grade="10", Section="B"'],
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    
    // Set column widths for student sheet
    const columnWidths = [
      { wch: 20 }, // First Name
      { wch: 20 }, // Last Name
      { wch: 18 }, // Admission Number
      { wch: 15 }, // Grade
      { wch: 10 }, // Section
      { wch: 12 }, // Roll Number
      { wch: 25 }, // Email
      { wch: 15 }, // Contact Number
      { wch: 15 }, // Date of Birth
      { wch: 10 }, // Gender
      { wch: 12 }, // Blood Group
      { wch: 30 }, // Address
      { wch: 15 }, // Emergency Contact
      { wch: 3 },  // Empty spacing gap
      { wch: 28 }  // Reference column
    ];
    worksheet['!cols'] = columnWidths;
    
    // Set column widths for instructions sheet
    instructionsSheet['!cols'] = [{ wch: 80 }];

    XLSX.writeFile(workbook, 'student-import-template.xlsx', { cellStyles: true });
    toast({
      title: "Template Downloaded",
      description: "Template includes instructions sheet with allowed class grades."
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

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setSelectedFile(file);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({
            variant: "destructive",
            title: "Empty File",
            description: "The uploaded file contains no data"
          });
          setIsProcessing(false);
          return;
        }

        // Parse data as-is without validation and navigate to review page
        const parsedStudents = jsonData.map((row: any, index) => {
          const student: any = {
            originalRowNumber: index + 2 // Account for header row
          };
          
          // Map all fields as-is
          if (row['First Name']) student.firstName = row['First Name'].toString().trim();
          if (row['Last Name']) student.lastName = row['Last Name'].toString().trim();
          if (row['Admission Number']) student.admissionNumber = row['Admission Number'].toString().trim();
          // Handle separate Grade and Section columns (new format)
          if (row['Grade'] && row['Section']) {
            student.grade = row['Grade'].toString().trim();
            student.section = row['Section'].toString().trim().toUpperCase();
            student.classId = `${student.grade} ${student.section}`; // For backend compatibility
          }
          // Backward compatibility: Handle combined Class column (old format)
          else if (row['Class']) {
            const classValue = row['Class'].toString().trim();
            // Parse class value into grade and section (e.g., "1 A", "1-A", "1A")
            const classMatch = classValue.match(/^(\d+)\s*[-\s]*([A-Za-z]+)$/);
            if (classMatch) {
              student.grade = classMatch[1];
              student.section = classMatch[2].toUpperCase();
            } else {
              // Fallback: if parsing fails, use the whole value as grade
              student.grade = classValue;
              student.section = '';
            }
            student.classId = classValue; // Keep for backward compatibility
          }
          // Handle individual Grade or Section columns if only one is present
          else {
            if (row['Grade']) student.grade = row['Grade'].toString().trim();
            if (row['Section']) student.section = row['Section'].toString().trim().toUpperCase();
          }
          if (row['Roll Number']) student.rollNumber = row['Roll Number'].toString().trim();
          if (row['Email']) student.email = row['Email'].toString().trim();
          if (row['Contact Number']) student.contactNumber = row['Contact Number'].toString().trim();
          if (row['Date of Birth']) student.dateOfBirth = row['Date of Birth'].toString().trim();
          if (row['Gender']) student.gender = row['Gender'].toString().toLowerCase().trim();
          if (row['Blood Group']) student.bloodGroup = row['Blood Group'].toString().trim();
          if (row['Address']) student.address = row['Address'].toString().trim();
          if (row['Emergency Contact']) student.emergencyContact = row['Emergency Contact'].toString().trim();
          
          return student;
        });
        
        setIsProcessing(false);
        
        // Store data in sessionStorage and navigate to review page
        sessionStorage.setItem('studentBulkData', JSON.stringify(parsedStudents));
        setLocation('/students/bulk-review');
        
        toast({
          title: "File Uploaded",
          description: `Parsed ${parsedStudents.length} student records. Redirecting to review page...`
        });
      } catch (error) {
        console.error('Error parsing file:', error);
        toast({
          variant: "destructive",
          title: "Error Processing File",
          description: "Unable to read the Excel file. Please check the format."
        });
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  }, [toast, setLocation]);

  return (
    <div className="container mx-auto p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/students')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Bulk Import Students</h1>
          <p className="text-muted-foreground">
            Upload an Excel file to import multiple students at once
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Template
            </CardTitle>
            <CardDescription>
              Get the Excel template with the correct format for student data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Required fields:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>First Name</li>
                <li>Last Name</li>
                <li>Admission Number</li>
                <li>Grade</li>
                <li>Section</li>
              </ul>
              
              <p className="font-medium mt-4 mb-2">Optional fields:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Roll Number</li>
                <li>Email</li>
                <li>Contact Number</li>
                <li>Date of Birth</li>
                <li>Gender</li>
                <li>Blood Group</li>
                <li>Address</li>
                <li>Emergency Contact</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Student Data
            </CardTitle>
            <CardDescription>
              Select an Excel file (.xlsx or .xls) containing student information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file">Excel File</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </div>
            
            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            
            {isProcessing && (
              <div className="text-sm text-blue-600">
                Processing file... Please wait.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">📋 Data Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First Name, Last Name, Admission Number, Grade, and Section are required</li>
                <li>• Admission numbers must be unique within your school</li>
                <li>• Contact numbers must be exactly 10 digits (if provided)</li>
                <li>• Email addresses must be valid format (if provided)</li>
                <li>• Grade and Section should match existing classes in your school</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">⚡ Process Overview</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Step 1: Upload your Excel file</li>
                <li>• Step 2: Review and edit data on the next page</li>
                <li>• Step 3: Fix any validation errors</li>
                <li>• Step 4: Submit for final import</li>
                <li>• You can edit any cell before final submission</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}