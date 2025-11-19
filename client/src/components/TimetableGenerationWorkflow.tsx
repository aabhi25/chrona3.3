import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, RefreshCw, ArrowRight, ArrowLeft, Users, BookOpen, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ClassStatus {
  classId: string;
  className: string;
  grade: string;
  section: string | null;
  hasExistingTimetable: boolean;
  hasAssignments: boolean;
  entryCount: number;
}

interface WorkflowData {
  allClasses: ClassStatus[];
  classesWithTimetables: ClassStatus[];
  classesWithoutTimetables: ClassStatus[];
  classesWithoutAssignments: ClassStatus[];
  summary: {
    totalClasses: number;
    withTimetables: number;
    withoutTimetables: number;
    withoutAssignments: number;
  };
}

interface TimetableGenerationWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  onSuccess: (result: any) => void;
}

enum WorkflowStep {
  CHECKING = 1,
  OPTION_SELECTION = 2,
  REVIEW = 3,
  CONFIRMATION = 4
}

type GenerationOption = 'overwrite_all' | 'create_new_only';

export default function TimetableGenerationWorkflow({
  isOpen,
  onClose,
  isGenerating,
  setIsGenerating,
  onSuccess
}: TimetableGenerationWorkflowProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(WorkflowStep.CHECKING);
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [selectedOption, setSelectedOption] = useState<GenerationOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(WorkflowStep.CHECKING);
      setWorkflowData(null);
      setSelectedOption(null);
      setError(null);
      checkExistingTimetables();
    }
  }, [isOpen]);

  const checkExistingTimetables = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('GET', '/api/check-existing-master-timetables');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to check existing timetables');
      }

      setWorkflowData(data);
      
      // If no classes have existing timetables, skip to review step
      if (data.summary.withTimetables === 0) {
        setSelectedOption('create_new_only');
        setCurrentStep(WorkflowStep.REVIEW);
      } else {
        setCurrentStep(WorkflowStep.OPTION_SELECTION);
      }
    } catch (error) {
      console.error('Error checking existing timetables:', error);
      setError('Failed to check existing timetables. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (option: GenerationOption) => {
    setSelectedOption(option);
    setCurrentStep(WorkflowStep.REVIEW);
  };

  const getAffectedClasses = (): ClassStatus[] => {
    if (!workflowData || !selectedOption) return [];
    
    if (selectedOption === 'overwrite_all') {
      return workflowData.allClasses.filter(cls => cls.hasAssignments);
    } else {
      return workflowData.classesWithoutTimetables;
    }
  };

  const handleConfirmGeneration = async () => {
    if (!selectedOption || !workflowData) return;
    
    setIsGenerating(true);
    setCurrentStep(WorkflowStep.CONFIRMATION);
    
    try {
      const affectedClasses = getAffectedClasses();
      const targetClassIds = affectedClasses.map(cls => cls.classId);
      
      const requestBody = {
        overwriteExisting: selectedOption === 'overwrite_all',
        targetClasses: targetClassIds
      };

      const response = await apiRequest('POST', '/api/generate-school-timetable', requestBody);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to generate timetables');
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });

      onSuccess(result);
      onClose();
      
      toast({
        title: "Timetables Generated Successfully",
        description: `Generated timetables for ${result.generatedCount} classes`,
      });
      
    } catch (error) {
      console.error('Error generating timetables:', error);
      setError('Failed to generate timetables. Please try again.');
      toast({
        title: "Generation Failed",
        description: "Failed to generate timetables. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    if (currentStep === WorkflowStep.REVIEW) {
      if (workflowData?.summary.withTimetables === 0) {
        setCurrentStep(WorkflowStep.CHECKING);
        checkExistingTimetables();
      } else {
        setCurrentStep(WorkflowStep.OPTION_SELECTION);
      }
    } else if (currentStep === WorkflowStep.OPTION_SELECTION) {
      setCurrentStep(WorkflowStep.CHECKING);
      checkExistingTimetables();
    }
  };

  const renderProgressBar = () => {
    const progress = (currentStep / 4) * 100;
    return (
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Step {currentStep} of 4</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>
    );
  };

  const renderStep1Checking = () => (
    <div className="space-y-6">
      <div className="text-center">
        <RefreshCw className="h-12 w-12 mx-auto mb-4 text-purple-600 animate-spin" />
        <h3 className="text-lg font-semibold mb-2">Checking Existing Timetables</h3>
        <p className="text-muted-foreground">
          Analyzing which classes already have master timetables...
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkExistingTimetables}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );

  const renderStep2OptionSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-orange-600" />
        <h3 className="text-lg font-semibold mb-2">Existing Timetables Found</h3>
        <p className="text-muted-foreground">
          {workflowData?.summary.withTimetables} classes already have master timetables. 
          Please choose how to proceed:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card 
          className={`cursor-pointer transition-all border-2 ${
            selectedOption === 'overwrite_all' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-purple-300'
          }`}
          onClick={() => setSelectedOption('overwrite_all')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              <span>Option A: Create master timetable for all classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              This will overwrite existing master timetables and create new ones for all classes with assignments.
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {workflowData?.summary.withTimetables} will be overwritten
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {workflowData?.summary.withoutTimetables} will be newly created
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all border-2 ${
            selectedOption === 'create_new_only' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-purple-300'
          }`}
          onClick={() => setSelectedOption('create_new_only')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Users className="h-5 w-5 text-green-600" />
              <span>Option B: Create master timetable only for classes without existing timetables</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              This will preserve existing master timetables and only create new ones for classes that don't have them.
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {workflowData?.summary.withTimetables} will be preserved
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {workflowData?.summary.withoutTimetables} will be newly created
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={() => handleOptionSelect(selectedOption!)}
          disabled={!selectedOption}
          className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep3Review = () => {
    const affectedClasses = getAffectedClasses();
    const overwrittenClasses = affectedClasses.filter(cls => cls.hasExistingTimetable);
    const newClasses = affectedClasses.filter(cls => !cls.hasExistingTimetable);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold mb-2">Review Affected Classes</h3>
          <p className="text-muted-foreground">
            Please review the classes that will be affected by this operation:
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedOption === 'overwrite_all' ? 'All Classes' : 'Classes Without Existing Timetables'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overwrittenClasses.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <h4 className="font-medium text-orange-800">Will be Overwritten ({overwrittenClasses.length})</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {overwrittenClasses.map((cls) => (
                    <Badge key={cls.classId} variant="secondary" className="bg-orange-100 text-orange-800">
                      {cls.className} ({cls.entryCount} entries)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {newClasses.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <h4 className="font-medium text-green-800">Will be Newly Created ({newClasses.length})</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {newClasses.map((cls) => (
                    <Badge key={cls.classId} variant="secondary" className="bg-green-100 text-green-800">
                      {cls.className}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {workflowData?.classesWithoutAssignments && workflowData.classesWithoutAssignments.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-gray-600" />
                  <h4 className="font-medium text-gray-800">Will be Skipped - No Assignments ({workflowData.classesWithoutAssignments.length})</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {workflowData.classesWithoutAssignments.map((cls) => (
                    <Badge key={cls.classId} variant="secondary" className="bg-gray-100 text-gray-800">
                      {cls.className}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These classes don't have teacher-subject assignments and will be automatically skipped.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Summary</h4>
              <p className="text-blue-700 text-sm">
                {affectedClasses.length} classes will have timetables generated. 
                {overwrittenClasses.length > 0 && ` ${overwrittenClasses.length} existing timetables will be replaced.`}
                {workflowData?.classesWithoutAssignments && workflowData.classesWithoutAssignments.length > 0 && 
                  ` ${workflowData.classesWithoutAssignments.length} classes will be skipped due to missing assignments.`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleConfirmGeneration}
            className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
            disabled={affectedClasses.length === 0}
          >
            Generate Timetables
            <RefreshCw className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderStep4Confirmation = () => (
    <div className="space-y-6">
      <div className="text-center">
        <RefreshCw className="h-12 w-12 mx-auto mb-4 text-purple-600 animate-spin" />
        <h3 className="text-lg font-semibold mb-2">Generating Timetables</h3>
        <p className="text-muted-foreground">
          Please wait while we generate the master timetables. This may take a few moments...
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Generation Failed</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <div className="flex space-x-2 mt-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentStep(WorkflowStep.REVIEW)}
            >
              Back to Review
            </Button>
            <Button 
              size="sm" 
              onClick={handleConfirmGeneration}
              className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case WorkflowStep.CHECKING:
        return renderStep1Checking();
      case WorkflowStep.OPTION_SELECTION:
        return renderStep2OptionSelection();
      case WorkflowStep.REVIEW:
        return renderStep3Review();
      case WorkflowStep.CONFIRMATION:
        return renderStep4Confirmation();
      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (currentStep) {
      case WorkflowStep.CHECKING:
        return "Checking Existing Timetables";
      case WorkflowStep.OPTION_SELECTION:
        return "Select Generation Option";
      case WorkflowStep.REVIEW:
        return "Review Affected Classes";
      case WorkflowStep.CONFIRMATION:
        return "Generating Timetables";
      default:
        return "Generate School Timetable";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-purple-600" />
            <span>{getDialogTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {renderProgressBar()}
          {renderCurrentStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}