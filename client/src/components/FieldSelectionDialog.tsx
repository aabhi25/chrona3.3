import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, CheckCircle2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FieldOption {
  id: string;
  label: string;
  category: string;
}

interface FieldSelectionDialogProps {
  type: 'students' | 'teachers';
  count: number;
  availableFields: FieldOption[];
  onClose: () => void;
}

const categoryColors = {
  basic: 'bg-blue-100 text-blue-800',
  contact: 'bg-green-100 text-green-800',
  personal: 'bg-purple-100 text-purple-800',
  guardian: 'bg-orange-100 text-orange-800',
  medical: 'bg-red-100 text-red-800',
  system: 'bg-gray-100 text-gray-800',
  academic: 'bg-indigo-100 text-indigo-800',
  workload: 'bg-yellow-100 text-yellow-800',
  schedule: 'bg-pink-100 text-pink-800'
};

const categoryLabels = {
  basic: 'Basic Info',
  contact: 'Contact Details',
  personal: 'Personal Info',
  guardian: 'Guardian Details',
  medical: 'Medical Info',
  system: 'System Info',
  academic: 'Academic Info',
  workload: 'Workload Info',
  schedule: 'Schedule Info'
};

export function FieldSelectionDialog({ type, count, availableFields, onClose }: FieldSelectionDialogProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Group fields by category
  const fieldsByCategory = availableFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldOption[]>);

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleSelectAll = (category: string) => {
    const categoryFields = fieldsByCategory[category].map(f => f.id);
    const allSelected = categoryFields.every(id => selectedFields.includes(id));
    
    if (allSelected) {
      // Deselect all in this category
      setSelectedFields(prev => prev.filter(id => !categoryFields.includes(id)));
    } else {
      // Select all in this category
      setSelectedFields(prev => [...prev, ...categoryFields.filter(id => !prev.includes(id))]);
    }
  };

  const handleDownload = async () => {
    if (selectedFields.length === 0) {
      alert('Please select at least one field to download');
      return;
    }

    setIsDownloading(true);
    try {
      // Use apiRequest for proper authentication
      const response = await apiRequest('POST', '/api/download-excel', {
        type,
        fields: selectedFields
      });

      // Check if response is ok before processing
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Get the blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Download failed. Please try again.';
      alert(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleQuickSelect = (preset: string) => {
    let fieldsToSelect: string[] = [];
    
    if (preset === 'essential') {
      if (type === 'students') {
        fieldsToSelect = ['admissionNumber', 'firstName', 'lastName', 'rollNumber', 'className', 'contactNumber'];
      } else {
        fieldsToSelect = ['employeeId', 'name', 'email', 'contactNumber', 'subjects'];
      }
    } else if (preset === 'contact') {
      if (type === 'students') {
        fieldsToSelect = ['firstName', 'lastName', 'className', 'email', 'contactNumber', 'guardianName', 'guardianContact'];
      } else {
        fieldsToSelect = ['name', 'email', 'contactNumber'];
      }
    } else if (preset === 'all') {
      fieldsToSelect = availableFields.map(f => f.id);
    }

    setSelectedFields(fieldsToSelect);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Download {type === 'students' ? 'Student' : 'Teacher'} Data
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Select the fields you want to include in your Excel file ({count} records)
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Quick Selection Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect('essential')}
            >
              Essential Fields
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect('contact')}
            >
              Contact Info
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect('all')}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFields([])}
            >
              Clear All
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {Object.entries(fieldsByCategory).map(([category, fields]) => {
              const categoryFieldIds = fields.map(f => f.id);
              const selectedInCategory = categoryFieldIds.filter(id => selectedFields.includes(id)).length;
              const isAllSelected = selectedInCategory === categoryFieldIds.length;
              const isPartialSelected = selectedInCategory > 0 && selectedInCategory < categoryFieldIds.length;

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={categoryColors[category as keyof typeof categoryColors]}
                      >
                        {categoryLabels[category as keyof typeof categoryLabels] || category}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({selectedInCategory}/{categoryFieldIds.length} selected)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAll(category)}
                      className="text-xs"
                    >
                      {isAllSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
                    {fields.map(field => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={field.id}
                          checked={selectedFields.includes(field.id)}
                          onCheckedChange={() => handleFieldToggle(field.id)}
                        />
                        <label
                          htmlFor={field.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        
        <div className="border-t p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleDownload}
                disabled={selectedFields.length === 0 || isDownloading}
                className="min-w-32"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}