import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Download, FileSpreadsheet, BookOpen, ArrowLeft } from "lucide-react";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";

export default function ClassBulkImportPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Template download functionality
  const downloadTemplate = () => {
    const templateData = [
      {
        'Grade': '9',
        'Section': 'A',
        'Required Subjects': 'Mathematics, Science, English, History'
      },
      {
        'Grade': '9',
        'Section': 'B',
        'Required Subjects': 'Mathematics, Science, English, History'
      },
      {
        'Grade': '10',
        'Section': 'A',
        'Required Subjects': 'Mathematics, Science, English, History, Geography'
      },
      {
        'Grade': '10',
        'Section': '',
        'Required Subjects': 'Mathematics, Science, English, History, Geography'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");
    
    // Set column widths
    const columnWidths = [
      { wch: 10 }, // Grade
      { wch: 10 }, // Section
      { wch: 40 }  // Required Subjects
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.writeFile(workbook, 'class-import-template.xlsx');
    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your class data for import."
    });
  };

  const handleProceedToUpload = () => {
    setLocation('/classes/bulk-upload');
  };

  const handleBack = () => {
    setLocation('/classes');
  };

  return (
    <div className="container mx-auto p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Classes
        </Button>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Add Multiple Classes
            </CardTitle>
            <CardDescription>
              Use our Excel-based import system to add multiple classes with validation and review.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {/* Excel Format Information */}
            <div className="bg-muted/50 p-6 rounded-lg">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Excel Format Requirements
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium mb-3">Required columns:</p>
                  <div className="grid grid-cols-1 gap-3 ml-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <code className="bg-muted px-2 py-1 rounded text-xs">Grade</code>
                      <span className="text-muted-foreground">- Class grade (e.g., 9, 10, 11, 12)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <code className="bg-muted px-2 py-1 rounded text-xs">Required Subjects</code>
                      <span className="text-muted-foreground">- Subjects separated by commas (e.g., Mathematics, Science, English)</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="font-medium mb-3">Optional columns:</p>
                  <div className="grid grid-cols-1 gap-3 ml-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <code className="bg-muted px-2 py-1 rounded text-xs">Section</code>
                      <span className="text-muted-foreground">- Section name (e.g., A, B, C) or leave empty</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <h5 className="font-medium text-gray-900 dark:text-gray-100">Important Notes:</h5>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• Use commas (,) to separate multiple subjects</li>
                    <li>• Leave Section empty if class has no sections</li>
                    <li>• Missing subjects will be automatically created during import</li>
                    <li>• Review and validation system included</li>
                    <li>• Excel format (.xlsx) supported</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Download Template */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
                data-testid="button-download-template"
              >
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
            </div>

            {/* How it works section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How it works:</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600 font-bold">1</span>
                    </div>
                    <h5 className="font-medium mb-2">Download Template</h5>
                    <p className="text-muted-foreground text-sm">Get the Excel template with proper format</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600 font-bold">2</span>
                    </div>
                    <h5 className="font-medium mb-2">Upload & Review</h5>
                    <p className="text-muted-foreground text-sm">Upload your file and review with validation</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600 font-bold">3</span>
                    </div>
                    <h5 className="font-medium mb-2">Import</h5>
                    <p className="text-muted-foreground text-sm">Complete the import after validation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-cancel-import"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToUpload}
                data-testid="button-proceed-to-upload"
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Proceed to Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}