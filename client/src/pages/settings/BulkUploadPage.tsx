import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileSpreadsheet, Upload, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface School {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  adminName: string;
  adminEmail?: string;
  isActive: boolean;
}

export default function BulkUploadPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  const isSuperAdmin = user?.role === "super_admin";

  // Block super admin access - they should not use smart upload
  if (isSuperAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="outline"
          onClick={() => setLocation('/settings')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Button>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Super Admins cannot use the Smart Upload feature. This feature is only available for School Admins to manage their own school's data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/schools");
      return await response.json();
    },
    enabled: false, // Never fetch for super admin now
  });

  const downloadTemplate = async () => {
    try {
      const response = await apiRequest("GET", "/api/bulk-upload/template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-upload-template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Template Downloaded",
        description: "Use this template to prepare your bulk upload data."
      });
    } catch (error) {
      console.error("Error downloading template:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download the template. Please try again."
      });
    }
  };

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

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "File size must be less than 5MB"
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    if (isSuperAdmin && !selectedSchoolId) {
      toast({
        variant: "destructive",
        title: "School Required",
        description: "Please select a school before uploading the file."
      });
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (isSuperAdmin && selectedSchoolId) {
        formData.append('schoolId', selectedSchoolId);
      }

      const response = await apiRequest("POST", "/api/bulk-upload/parse", formData);
      const parsedData = await response.json();

      if (parsedData.errors && parsedData.errors.length > 0) {
        toast({
          title: "Validation Errors Found",
          description: `Found ${parsedData.errors.length} validation errors. You can review and fix them in the next step.`,
        });
      } else {
        toast({
          title: "File Parsed Successfully",
          description: "No validation errors found. Proceed to review."
        });
      }

      sessionStorage.setItem('bulkUploadData', JSON.stringify(parsedData));
      if (isSuperAdmin && selectedSchoolId) {
        sessionStorage.setItem('bulkUploadSchoolId', selectedSchoolId);
      }
      setLocation('/settings/bulk-upload/review');
    } catch (error: any) {
      console.error("Error parsing file:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to parse the uploaded file"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, setLocation, isSuperAdmin, selectedSchoolId]);

  return (
    <div>
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/settings')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              Smart Upload <span className="text-lg font-normal text-muted-foreground">(Students, Teachers & Class Subjects)</span>
            </h2>
            <p className="text-muted-foreground">
              Upload teachers, students, and class-subject assignments in a single Excel file
            </p>
          </div>

          {isSuperAdmin && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                As a Super Admin, you must select a school before uploading data.
              </AlertDescription>
            </Alert>
          )}

          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Select School</CardTitle>
                <CardDescription>
                  Choose the school where you want to import the data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="school-select">School *</Label>
                  <Select
                    value={selectedSchoolId}
                    onValueChange={setSelectedSchoolId}
                  >
                    <SelectTrigger id="school-select">
                      <SelectValue placeholder="Select a school..." />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolsLoading ? (
                        <SelectItem value="loading" disabled>Loading schools...</SelectItem>
                      ) : schools.length === 0 ? (
                        <SelectItem value="no-schools" disabled>No schools available</SelectItem>
                      ) : (
                        schools
                          .filter((school: School) => school.isActive)
                          .map((school: School) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Step 1: Download Template</span>
              </CardTitle>
              <CardDescription>
                Download the Excel template with example data and instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5" />
                <span>Step 2: Prepare Your Data</span>
              </CardTitle>
              <CardDescription>
                Fill in the template with your data following these guidelines:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Teachers Sheet:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Mandatory fields marked with *</strong>: Name, Mobile Number, School ID</li>
                  <li>Mobile numbers must be unique (10 digits)</li>
                  <li>School IDs must be unique across all teachers</li>
                  <li>Email must be valid format (if provided)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Students Sheet:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Mandatory fields marked with *</strong>: First Name, Last Name, Admission Number, Grade, Section</li>
                  <li>Admission numbers must be unique</li>
                  <li>Class (Grade + Section) must already exist in the system</li>
                  <li>Contact numbers must be 10 digits (if provided)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Assignments Sheet:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>All fields marked with * are mandatory</strong></li>
                  <li>Teacher School ID must match a teacher from Teachers sheet or database</li>
                  <li>Class (Grade + Section) must exist in the system</li>
                  <li>Subject Name is required (Subject Code is auto-generated)</li>
                  <li>Subject codes are automatically generated based on subject name and grade (e.g., MAT5, SCI10)</li>
                  <li>No duplicate class-subject assignments allowed</li>
                  <li>Weekly Frequency must be at least 1</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Step 3: Upload Your File</span>
              </CardTitle>
              <CardDescription>
                Upload the completed Excel file for validation and review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select Excel File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {isProcessing && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Processing file...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
