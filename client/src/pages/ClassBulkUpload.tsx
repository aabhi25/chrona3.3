import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface ClassImportData {
  grade: string;
  section?: string;
  requiredSubjects: string;
  originalRowNumber: number; // Store original spreadsheet row number
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function ClassBulkUpload() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Template download functionality
  const downloadTemplate = () => {
    const templateData = [
      {
        'Grade': 'Playschool',
        'Section': '',
        'Required Subjects': 'Play Activities, Rhymes',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Playschool'
      },
      {
        'Grade': 'Pre-Nursery',
        'Section': '',
        'Required Subjects': 'Basic Concepts, Story Time',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Pre-Nursery'
      },
      {
        'Grade': 'Nursery',
        'Section': 'A',
        'Required Subjects': 'English, Mathematics, EVS',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Nursery'
      },
      {
        'Grade': 'LKG',
        'Section': 'A',
        'Required Subjects': 'English, Mathematics, EVS, Drawing',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'LKG'
      },
      {
        'Grade': 'UKG',
        'Section': 'B',
        'Required Subjects': 'English, Mathematics, EVS, Computer, GK',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'UKG'
      },
      {
        'Grade': '1',
        'Section': 'A',
        'Required Subjects': 'English, Hindi, Mathematics, EVS',
        '': '',
        '📋 Allowed Classes (Reference Only)': '1, 2, 3, 4, 5'
      },
      {
        'Grade': '5',
        'Section': 'B',
        'Required Subjects': 'English, Hindi, Mathematics, Science, Social Science',
        '': '',
        '📋 Allowed Classes (Reference Only)': '6, 7, 8, 9, 10'
      },
      {
        'Grade': '9',
        'Section': 'A',
        'Required Subjects': 'English, Hindi, Mathematics, Science, Social Science',
        '': '',
        '📋 Allowed Classes (Reference Only)': '11, 12'
      },
      {
        'Grade': '10',
        'Section': '',
        'Required Subjects': 'English, Mathematics, Science, Social Science',
        '': '',
        '📋 Allowed Classes (Reference Only)': ''
      },
      {
        'Grade': '12',
        'Section': 'A',
        'Required Subjects': 'English, Physics, Chemistry, Mathematics, Computer Science',
        '': '',
        '📋 Allowed Classes (Reference Only)': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Apply light background color to reference column (column E, index 4)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 4 }); // Column E (0-indexed = 4)
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");
    
    // Add instructions sheet
    const instructions = [
      ['ALLOWED CLASS GRADES:'],
      ['Pre-Primary: Playschool, Pre-Nursery, Nursery, LKG, UKG'],
      ['Primary & Secondary: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10'],
      ['Senior Secondary: 11, 12'],
      [''],
      ['IMPORTANT NOTES:'],
      ['- Grade: Use EXACT values from the allowed list above (case-sensitive)'],
      ['- Section: Optional. Leave blank or use single letter (A, B, C, etc.)'],
      ['- Required Subjects: Comma-separated list of subject names'],
      ['- Each Grade-Section combination must be unique'],
      [''],
      ['EXAMPLES:'],
      ['- Pre-primary without section: Grade="Playschool", Section=""'],
      ['- Pre-primary with section: Grade="LKG", Section="A"'],
      ['- Numeric grade with section: Grade="10", Section="B"'],
      ['- Numeric grade without section: Grade="9", Section=""'],
      [''],
      ['NOTE: Section is optional. If you want multiple sections for a grade,'],
      ['create separate rows: Grade="5", Section="A" and Grade="5", Section="B"'],
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    
    // Set column widths for classes sheet
    const columnWidths = [
      { wch: 15 }, // Grade
      { wch: 10 }, // Section
      { wch: 50 }, // Required Subjects
      { wch: 3 },  // Empty spacing gap
      { wch: 28 }  // Reference column
    ];
    worksheet['!cols'] = columnWidths;
    
    // Set column widths for instructions sheet
    instructionsSheet['!cols'] = [{ wch: 80 }];

    XLSX.writeFile(workbook, 'class-import-template.xlsx', { cellStyles: true });
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
        const parsedClasses = jsonData.map((row: any, index) => {
          const classData: any = {
            originalRowNumber: index + 1 // Row numbering starts from 1
          };
          
          // Map all fields as-is
          if (row['Grade']) classData.grade = row['Grade'].toString().trim();
          if (row['Section']) classData.section = row['Section'].toString().trim();
          if (row['Required Subjects']) classData.requiredSubjects = row['Required Subjects'].toString().trim();
          
          return classData;
        });
        
        setIsProcessing(false);
        
        // Store data in sessionStorage and navigate to review page
        sessionStorage.setItem('classBulkData', JSON.stringify(parsedClasses));
        setLocation('/classes/bulk-review');
        
        toast({
          title: "File Uploaded",
          description: `Parsed ${parsedClasses.length} class records. Redirecting to review page...`
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
          onClick={() => setLocation('/classes')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Bulk Import Classes</h1>
          <p className="text-muted-foreground">
            Upload an Excel file to import multiple classes at once
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
              Get the Excel template with the correct format for class data
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
                <li>Grade</li>
                <li>Required Subjects</li>
              </ul>
              
              <p className="font-medium mt-4 mb-2">Optional fields:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Section</li>
              </ul>
              
              <p className="font-medium mt-4 mb-2">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Separate multiple subjects with commas (e.g., Mathematics, Science, English)</li>
                <li>Leave Section empty if class has no sections</li>
                <li>Grade: Use allowed values (Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Class Data
            </CardTitle>
            <CardDescription>
              Select an Excel file (.xlsx or .xls) containing class information
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
                <p>Selected file: {selectedFile.name}</p>
                <p>Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
            
            {isProcessing && (
              <div className="text-sm text-blue-600">
                Processing file, please wait...
              </div>
            )}
            
            <div className="text-sm text-muted-foreground border-t pt-4">
              <p className="font-medium mb-2">File Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Excel format (.xlsx or .xls)</li>
                <li>Maximum file size: 5MB</li>
                <li>First row must contain headers</li>
                <li>Use the provided template for best results</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col items-center text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-medium mb-1">Download Template</h3>
              <p className="text-muted-foreground">Get the Excel template with proper format</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-medium mb-1">Fill & Upload</h3>
              <p className="text-muted-foreground">Add your class data and upload the file</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h3 className="font-medium mb-1">Review & Import</h3>
              <p className="text-muted-foreground">Review data and complete the import</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}