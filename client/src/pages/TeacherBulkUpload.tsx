import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

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
  originalRowNumber: number; // Store original spreadsheet row number
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function TeacherBulkUpload() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Template download functionality
  const downloadTemplate = () => {
    const templateData = [
      {
        'Name': 'John Doe',
        'Mobile Number': '9876543210',
        'Email': 'john.doe@school.com',
        'Designation': 'Senior Teacher',
        'School ID': 'T001',
        'Aadhaar Number': '123456789012',
        'Gender': 'male',
        'Blood Group': 'O+',
        'Date of Birth': '1985-05-15',
        'Father/Husband Name': 'Mr. Doe Sr.',
        'Address': '123 Main Street, City',
        'Category': 'General',
        'Religion': 'Hindu'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Name
      { wch: 15 }, // Mobile Number
      { wch: 25 }, // Email
      { wch: 20 }, // Designation
      { wch: 12 }, // School ID
      { wch: 15 }, // Aadhaar Number
      { wch: 10 }, // Gender
      { wch: 12 }, // Blood Group
      { wch: 15 }, // Date of Birth
      { wch: 20 }, // Father/Husband Name
      { wch: 30 }, // Address
      { wch: 12 }, // Category
      { wch: 12 }  // Religion
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.writeFile(workbook, 'teacher-import-template.xlsx');
    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your teacher data for import."
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
        const parsedTeachers = jsonData.map((row: any, index) => {
          const teacher: any = {
            originalRowNumber: index + 2 // Account for header row
          };
          
          // Map all fields as-is
          if (row['Name']) teacher.name = row['Name'].toString().trim();
          if (row['Mobile Number']) teacher.contactNumber = row['Mobile Number'].toString().trim();
          if (row['Email']) teacher.email = row['Email'].toString().trim();
          if (row['Designation']) teacher.designation = row['Designation'].toString().trim();
          if (row['School ID']) teacher.schoolIdNumber = row['School ID'].toString().trim();
          if (row['Aadhaar Number']) teacher.aadhar = row['Aadhaar Number'].toString().trim();
          if (row['Gender']) teacher.gender = row['Gender'].toString().toLowerCase().trim();
          if (row['Blood Group']) teacher.bloodGroup = row['Blood Group'].toString().trim();
          if (row['Date of Birth']) teacher.dateOfBirth = row['Date of Birth'].toString().trim();
          if (row['Father/Husband Name']) teacher.fatherHusbandName = row['Father/Husband Name'].toString().trim();
          if (row['Address']) teacher.address = row['Address'].toString().trim();
          if (row['Category']) teacher.category = row['Category'].toString().trim();
          if (row['Religion']) teacher.religion = row['Religion'].toString().trim();
          
          return teacher;
        });
        
        setIsProcessing(false);
        
        // Store data in sessionStorage and navigate to review page
        sessionStorage.setItem('teacherBulkData', JSON.stringify(parsedTeachers));
        setLocation('/teachers/bulk-review');
        
        toast({
          title: "File Uploaded",
          description: `Parsed ${parsedTeachers.length} teacher records. Redirecting to review page...`
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
          onClick={() => setLocation('/teachers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Bulk Teacher Import</h1>
          <p className="text-muted-foreground">Upload an Excel file to import multiple teachers at once</p>
        </div>
      </div>

      {/* Instructions and Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Instructions
          </CardTitle>
          <CardDescription>
            Follow these steps to import teachers from an Excel file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">1</div>
              <div>
                <p className="font-medium">Download the template</p>
                <p className="text-muted-foreground">Use our Excel template to ensure proper formatting</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">2</div>
              <div>
                <p className="font-medium">Fill in teacher data</p>
                <p className="text-muted-foreground">Only Name and Mobile Number are required (10 digits)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
              <div>
                <p className="font-medium">Upload and review</p>
                <p className="text-muted-foreground">Upload your file to proceed to the review page where you can edit and validate data</p>
              </div>
            </div>
          </div>

          <Button onClick={downloadTemplate} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Download Excel Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Select an Excel file (.xlsx or .xls) containing teacher data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <Label htmlFor="file-upload">Excel File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="mt-1"
              />
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-sm">Processing file...</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}