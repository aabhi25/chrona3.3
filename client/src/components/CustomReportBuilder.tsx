import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FilterBuilder } from "./FilterBuilder";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CustomReportBuilderProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editReport?: any;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface ReportConfig {
  label: string;
  description: string;
  category: string;
  dataSource: string;
  selectedFields: string[];
  filters: any[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  groupBy: string;
}

export function CustomReportBuilder({ open, onClose, onSuccess, editReport }: CustomReportBuilderProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [config, setConfig] = useState<ReportConfig>({
    label: '',
    description: '',
    category: 'academic',
    dataSource: '',
    selectedFields: [],
    filters: [],
    sortBy: '',
    sortOrder: 'asc',
    groupBy: '',
  });

  const { data: dataSources } = useQuery<{ dataSources: Array<{ id: string; label: string }> }>({
    queryKey: ['/api/custom-reports/datasources'],
    enabled: open,
  });

  const { data: availableFields, refetch: refetchFields } = useQuery<{ fields: Array<{ name: string; label: string; type: string; filterable: boolean; sortable: boolean }> }>({
    queryKey: ['/api/custom-reports/fields', config.dataSource],
    enabled: !!config.dataSource,
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editReport 
        ? `/api/custom-reports/${editReport.id}`
        : '/api/custom-reports';
      const method = editReport ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Report ${editReport ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editReport ? 'update' : 'create'} report`,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (editReport) {
      setConfig({
        label: editReport.label || '',
        description: editReport.description || '',
        category: editReport.category || 'academic',
        dataSource: editReport.dataSource || '',
        selectedFields: editReport.selectedFields || [],
        filters: editReport.filters || [],
        sortBy: editReport.sortBy || '',
        sortOrder: editReport.sortOrder || 'asc',
        groupBy: editReport.groupBy || '',
      });
    }
  }, [editReport]);

  useEffect(() => {
    if (config.dataSource) {
      refetchFields();
    }
  }, [config.dataSource, refetchFields]);

  const handleClose = () => {
    setCurrentStep(1);
    setConfig({
      label: '',
      description: '',
      category: 'academic',
      dataSource: '',
      selectedFields: [],
      filters: [],
      sortBy: '',
      sortOrder: 'asc',
      groupBy: '',
    });
    onClose();
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleSave = () => {
    createReportMutation.mutate(config);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return config.label.trim() !== '' && config.category !== '';
      case 2:
        return config.dataSource !== '';
      case 3:
        return config.selectedFields.length > 0;
      case 4:
      case 5:
        return true;
      default:
        return false;
    }
  };

  const toggleField = (fieldName: string) => {
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.includes(fieldName)
        ? prev.selectedFields.filter(f => f !== fieldName)
        : [...prev.selectedFields, fieldName]
    }));
  };

  const toggleAllFields = () => {
    if (!availableFields?.fields) return;
    
    const allFieldNames = availableFields.fields.map((f: any) => f.name);
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.length === allFieldNames.length
        ? []
        : allFieldNames
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Report Name *</Label>
              <Input
                id="label"
                value={config.label}
                onChange={(e) => setConfig({ ...config, label: e.target.value })}
                placeholder="e.g., Student Attendance Summary"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Brief description of this report..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={config.category}
                onValueChange={(value) => setConfig({ ...config, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="dataSource">Select Data Source *</Label>
              <Select
                value={config.dataSource}
                onValueChange={(value) => setConfig({ ...config, dataSource: value, selectedFields: [] })}
              >
                <SelectTrigger id="dataSource">
                  <SelectValue placeholder="Choose a data source..." />
                </SelectTrigger>
                <SelectContent>
                  {dataSources?.dataSources?.map((ds: any) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.dataSource && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Data Source Selected</CardTitle>
                  <CardDescription>
                    {dataSources?.dataSources?.find((ds: any) => ds.id === config.dataSource)?.label}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Fields to Include *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAllFields}
              >
                {config.selectedFields.length === availableFields?.fields?.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableFields?.fields?.map((field: any) => (
                    <div key={field.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.name}
                        checked={config.selectedFields.includes(field.name)}
                        onCheckedChange={() => toggleField(field.name)}
                      />
                      <label
                        htmlFor={field.name}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {field.label}
                        <span className="text-xs text-muted-foreground ml-2">({field.type})</span>
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              {config.selectedFields.length} field(s) selected
            </p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <FilterBuilder
              availableFields={availableFields?.fields || []}
              filters={config.filters}
              onChange={(filters) => setConfig({ ...config, filters })}
            />
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={config.sortBy || "none"}
                onValueChange={(value) => setConfig({ ...config, sortBy: value === "none" ? "" : value })}
              >
                <SelectTrigger id="sortBy">
                  <SelectValue placeholder="Choose field to sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableFields?.fields
                    ?.filter((f: any) => f.sortable)
                    .map((field: any) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {config.sortBy && config.sortBy !== "none" && (
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Select
                  value={config.sortOrder}
                  onValueChange={(value: 'asc' | 'desc') => setConfig({ ...config, sortOrder: value })}
                >
                  <SelectTrigger id="sortOrder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Report Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div><strong>Name:</strong> {config.label}</div>
                <div><strong>Category:</strong> {config.category}</div>
                <div><strong>Data Source:</strong> {dataSources?.dataSources?.find((ds: any) => ds.id === config.dataSource)?.label}</div>
                <div><strong>Fields:</strong> {config.selectedFields.length} selected</div>
                <div><strong>Filters:</strong> {config.filters.length} configured</div>
                {config.sortBy && <div><strong>Sorting:</strong> {config.sortBy} ({config.sortOrder})</div>}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const stepTitles = [
    'Basic Information',
    'Data Source',
    'Select Fields',
    'Add Filters',
    'Sorting & Review',
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editReport ? 'Edit' : 'Create'} Custom Report
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 5: {stepTitles[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step < currentStep ? 'bg-primary text-primary-foreground' : ''}
                    ${step === currentStep ? 'bg-primary text-primary-foreground' : ''}
                    ${step > currentStep ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 5 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {renderStep()}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!canProceed() || createReportMutation.isPending}
            >
              {createReportMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editReport ? 'Update' : 'Create'} Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
