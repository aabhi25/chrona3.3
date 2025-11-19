import TimetableGrid from "@/components/TimetableGrid";
import TimetableGenerationWorkflow from "@/components/TimetableGenerationWorkflow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, RefreshCw, Sparkles, Loader2, CheckCircle, AlertCircle, Users, BookOpen, Target, Award, Info, Brain, Zap, Shield, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { sortClasses } from "@shared/classUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function TimetableView() {
  const [, setLocation] = useLocation();
  const [showGenerationWorkflow, setShowGenerationWorkflow] = useState(false);
  const [isGeneratingSchoolTimetable, setIsGeneratingSchoolTimetable] = useState(false);
  const [showSmartGenerationResult, setShowSmartGenerationResult] = useState(false);
  const [smartGenerationResult, setSmartGenerationResult] = useState<any>(null);
  const [isAIInfoDialogOpen, setIsAIInfoDialogOpen] = useState(false);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<'mode' | 'review' | 'progress'>('mode');
  const [isLoadingValidation, setIsLoadingValidation] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressData, setProgressData] = useState({ 
    progress: 0, 
    estimatedTime: 0, 
    status: 'Initializing...',
    currentClass: '',
    totalClasses: 0,
    completedClasses: 0
  });
  const [selectedMode, setSelectedMode] = useState<'all' | 'missing'>('all');
  const [classesToGenerate, setClassesToGenerate] = useState<any[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Check URL parameters to auto-open generation dialog
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openGenerateDialog') === 'true') {
      setShowGenerationDialog(true);
      setDialogStep('mode');
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOpenSettings = () => {
    setLocation("/timetable/settings");
  };

  const handleWorkflowSuccess = (result: any) => {
    console.log("Timetable generation successful:", result);
  };

  const handleSmartGeneration = () => {
    setDialogStep('mode');
    setShowGenerationDialog(true);
  };

  const handleModeSelection = async (mode: 'all' | 'missing') => {
    setSelectedMode(mode);
    setIsLoadingValidation(true);
    setCapacityWarning(null);
    
    try {
      // Validate classes using the new endpoint
      const validationResponse = await apiRequest("GET", `/api/timetable/validate-classes?mode=${mode}`);
      const validationData = await validationResponse.json();
      
      // Only use valid classes that meet all criteria
      const validClasses = validationData.validClasses || [];
      setClassesToGenerate(validClasses);
      
      // Initialize selectedClassIds (all selected by default for both modes)
      setSelectedClassIds(validClasses.map((c: any) => c.id));
      
      // Show warning if there are invalid classes
      if (validationData.invalidCount > 0) {
        toast({
          title: "Some Classes Cannot Be Generated",
          description: `${validationData.invalidCount} class(es) skipped due to missing subjects or teachers. Only showing classes ready for generation.`,
          variant: "default",
        });
      }
      
      setIsLoadingValidation(false);
      setDialogStep('review');
    } catch (error: any) {
      setIsLoadingValidation(false);
      toast({
        title: "Failed to Load Classes",
        description: error.message || "Could not load class information",
        variant: "destructive",
      });
    }
  };

  const confirmAndGenerate = async () => {
    // Determine which classes to generate - use selected classes for both modes
    const targetClassIds = selectedClassIds.length > 0
      ? selectedClassIds
      : undefined;
    
    // Check capacity before generation if targeting specific classes
    if (targetClassIds && targetClassIds.length > 0) {
      try {
        const capacityResponse = await apiRequest("POST", "/api/timetable/check-capacity", {
          classIds: targetClassIds
        });
        const capacityData = await capacityResponse.json();
        
        if (capacityData.status === 'insufficient') {
          toast({
            title: "Insufficient Teacher Capacity",
            description: capacityData.message,
            variant: "destructive",
          });
          return;
        } else if (capacityData.status === 'warning') {
          setCapacityWarning(capacityData.message);
          // Continue with generation but show warning
        }
      } catch (error: any) {
        console.error('Capacity check failed:', error);
        // Continue with generation even if capacity check fails
      }
    }
    
    setShowGenerationDialog(false);
    setShowProgressDialog(true);
    setIsGeneratingSchoolTimetable(true);
    
    setProgressData({
      progress: 0,
      estimatedTime: 0,
      status: 'Starting generation...',
      currentClass: '',
      totalClasses: 0,
      completedClasses: 0
    });

    try {
      const requestBody: any = { mode: selectedMode };
      if (targetClassIds) {
        requestBody.targetClassIds = targetClassIds;
      }
      
      const response = await apiRequest("POST", "/api/timetable/generate-smart", requestBody);
      const result = await response.json();
      
      if (result.jobId) {
        setGenerationJobId(result.jobId);
        pollProgress(result.jobId);
      } else {
        setShowProgressDialog(false);
        setSmartGenerationResult(result);
        setShowSmartGenerationResult(true);
        setIsGeneratingSchoolTimetable(false);
        toast({
          title: "Smart Generation Complete",
          description: `Generated timetables using ${result.strategy} strategy with ${result.qualityScore}% quality score`,
        });
      }
    } catch (error: any) {
      setShowProgressDialog(false);
      setIsGeneratingSchoolTimetable(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate smart timetable",
        variant: "destructive",
      });
    }
  };

  const pollProgress = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiRequest("GET", `/api/timetable/generation-progress/${jobId}`);
        const progress = await response.json();
        
        setProgressData({
          progress: progress.progress || 0,
          estimatedTime: progress.estimatedTime || 0,
          status: progress.status || 'Processing...',
          currentClass: progress.currentClass || '',
          totalClasses: progress.totalClasses || 0,
          completedClasses: progress.completedClasses || 0
        });

        if (progress.error) {
          clearInterval(pollInterval);
          setShowProgressDialog(false);
          setIsGeneratingSchoolTimetable(false);
          toast({
            title: "Generation Failed",
            description: progress.error,
            variant: "destructive",
          });
          return;
        }

        if (progress.completed) {
          clearInterval(pollInterval);
          setShowProgressDialog(false);
          setSmartGenerationResult(progress.result);
          setShowSmartGenerationResult(true);
          setIsGeneratingSchoolTimetable(false);
          toast({
            title: "Smart Generation Complete",
            description: `Generated timetables using ${progress.result.strategy} strategy with ${progress.result.qualityScore}% quality score`,
          });
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    }, 1000);
  };

  return (
    <div>
      {/* Header */}
      <header className="border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-6 w-6 text-purple-600" />
              Timetable Management
            </h2>
            <p className="text-sm text-muted-foreground">View and manage school timetables</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleSmartGeneration}
              className="group relative bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-semibold px-8 py-4 rounded-xl shadow-[0_8px_30px_rgb(147,51,234,0.3)] hover:shadow-[0_12px_40px_rgb(147,51,234,0.5)] transition-all duration-300 flex items-center space-x-4 border-0 hover:scale-105 active:scale-100 before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-white/40 after:via-white/20 after:to-transparent after:opacity-0 after:-translate-x-full hover:after:translate-x-full after:transition-transform after:duration-700"
              disabled={isGeneratingSchoolTimetable}
            >
              <div className="flex items-center space-x-3 relative z-10">
                <div className="p-1.5 bg-white/30 rounded-full shadow-lg backdrop-blur-sm">
                  {isGeneratingSchoolTimetable ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5 animate-sparkle-bounce" />
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold">
                    {isGeneratingSchoolTimetable ? 'Generating...' : 'Generate Smart Timetable'}
                  </span>
                  <span className="text-xs text-white/90 font-medium">
                    AI-powered intelligent scheduling
                  </span>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="p-2 h-10 w-10 rounded-full bg-purple-50 backdrop-blur-sm border-2 border-purple-400 hover:border-purple-600 hover:bg-purple-100 hover:shadow-[0_8px_20px_rgba(147,51,234,0.4)] transition-all duration-300 hover:scale-105 active:scale-100"
              onClick={() => setIsAIInfoDialogOpen(true)}
            >
              <Info className="h-4 w-4 text-purple-600" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="p-2">
        <TimetableGrid 
          isGeneratingSchoolTimetable={isGeneratingSchoolTimetable}
          setIsGeneratingSchoolTimetable={setIsGeneratingSchoolTimetable}
          onOpenSettings={handleOpenSettings}
          onOpenGenerationDialog={handleSmartGeneration}
        />
        
        <TimetableGenerationWorkflow
          isOpen={showGenerationWorkflow}
          onClose={() => setShowGenerationWorkflow(false)}
          isGenerating={isGeneratingSchoolTimetable}
          setIsGenerating={setIsGeneratingSchoolTimetable}
          onSuccess={handleWorkflowSuccess}
        />

        {/* Combined Generation Dialog */}
        <Dialog open={showGenerationDialog} onOpenChange={setShowGenerationDialog}>
          <DialogContent className={dialogStep === 'review' ? "sm:max-w-3xl max-h-[85vh]" : "sm:max-w-2xl"}>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg">
                  {dialogStep === 'mode' ? <Sparkles className="h-5 w-5 text-white" /> : <CheckCircle className="h-5 w-5 text-white" />}
                </div>
                <span>{dialogStep === 'mode' ? 'Select Generation Mode' : 'Review Timetable Generation'}</span>
              </DialogTitle>
              <DialogDescription>
                {dialogStep === 'mode' 
                  ? 'Choose how you want to generate your timetables'
                  : selectedMode === 'all' 
                    ? 'The following classes will have their timetables regenerated. Existing timetables will be replaced.'
                    : 'Timetables will be generated only for the following classes that don\'t have one yet.'}
              </DialogDescription>
            </DialogHeader>

            {/* Mode Selection Step */}
            {dialogStep === 'mode' && !isLoadingValidation && (
              <>
                <div className="space-y-2">
                  <Card 
                    className="cursor-pointer transition-all hover:shadow-lg border-2 hover:border-purple-500"
                    onClick={() => handleModeSelection('all')}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/50 dark:to-pink-800/50 rounded-lg">
                          <RefreshCw className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">Generate Master Timetable for All Classes</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Regenerate timetables for all classes in your school. This will replace existing timetables with freshly optimized schedules.
                          </p>
                          <div className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/40">
                              <CheckCircle className="h-3 w-3 mr-1 text-purple-600 dark:text-purple-400" />
                              Comprehensive
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/40">
                              <Zap className="h-3 w-3 mr-1 text-purple-600 dark:text-purple-400" />
                              Full Optimization
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer transition-all hover:shadow-lg border-2 hover:border-pink-500"
                    onClick={() => handleModeSelection('missing')}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-800/50 dark:to-purple-800/50 rounded-lg">
                          <Target className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">Generate for Classes Without Timetables</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Only generate timetables for classes that don't have one yet. Existing timetables will be preserved.
                          </p>
                          <div className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="bg-pink-50 dark:bg-pink-900/40">
                              <Shield className="h-3 w-3 mr-1 text-pink-600 dark:text-pink-400" />
                              Preserves Existing
                            </Badge>
                            <Badge variant="outline" className="bg-pink-50 dark:bg-pink-900/40">
                              <Clock className="h-3 w-3 mr-1 text-pink-600 dark:text-pink-400" />
                              Quick Fill
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowGenerationDialog(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </>
            )}

            {/* Loading State */}
            {isLoadingValidation && (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="h-12 w-12 text-purple-600 animate-spin" />
                <p className="text-muted-foreground">Validating classes...</p>
              </div>
            )}

            {/* Review Step */}
            {dialogStep === 'review' && !isLoadingValidation && (
              <>
                <div className="space-y-2">
                  {/* Summary Card */}
                  <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/40 dark:to-pink-900/40 border-purple-200 dark:border-purple-700/60">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white dark:bg-gray-800/80 rounded-lg">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {selectedMode === 'missing' ? 'Selected Classes' : 'Classes to Generate'}
                            </p>
                            <p className="text-lg md:text-xl font-semibold text-purple-600">
                              {selectedClassIds.length} / {classesToGenerate.length}
                            </p>
                          </div>
                        </div>
                        <Badge variant={selectedMode === 'all' ? 'default' : 'secondary'} className="text-sm">
                          {selectedMode === 'all' ? 'Full Regeneration' : 'Fill Missing Only'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Classes List */}
                  {classesToGenerate.length > 0 ? (
                    <div className="border rounded-lg">
                      <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Classes List</h4>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedClassIds(classesToGenerate.map(c => c.id))}
                            className="h-7 text-xs"
                          >
                            Select All
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedClassIds([])}
                            className="h-7 text-xs"
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
                          {sortClasses(classesToGenerate).map((classItem: any) => (
                            <div
                              key={classItem.id}
                              className="flex items-center space-x-2 p-2 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700/60 cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                setSelectedClassIds(prev => 
                                  prev.includes(classItem.id)
                                    ? prev.filter(id => id !== classItem.id)
                                    : [...prev, classItem.id]
                                );
                              }}
                            >
                              <Checkbox
                                checked={selectedClassIds.includes(classItem.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedClassIds(prev =>
                                    checked
                                      ? [...prev, classItem.id]
                                      : prev.filter(id => id !== classItem.id)
                                  );
                                }}
                              />
                              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded">
                                <BookOpen className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="text-sm font-medium">
                                Class {classItem.grade} {classItem.section}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/40 dark:border-blue-700/60">
                      <CardContent className="pt-6 pb-6">
                        <div className="text-center py-8">
                          <div className="flex justify-center mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                              <CheckCircle className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <p className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                            {selectedMode === 'all' 
                              ? 'No classes available for generation'
                              : 'All classes already have timetables'}
                          </p>
                          {selectedMode === 'missing' && (
                            <p className="text-sm text-blue-700 dark:text-blue-300/90 mt-2">
                              Every class has a complete timetable. You can view or edit existing timetables from the main page.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Warning for full regeneration */}
                  {selectedMode === 'all' && classesToGenerate.length > 0 && (
                    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/40 dark:border-orange-700/60">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              Warning: Existing timetables will be replaced
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Capacity Warning */}
                  {capacityWarning && (
                    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              Teacher Capacity Warning
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                              {capacityWarning}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* No classes selected warning - only show if there are classes available but none selected */}
                  {classesToGenerate.length > 0 && selectedClassIds.length === 0 && (
                    <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                              No classes selected
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                              Please select at least one class to generate timetables.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setDialogStep('mode')}
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={confirmAndGenerate}
                    disabled={classesToGenerate.length === 0 || selectedClassIds.length === 0}
                    className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Timetables
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Progress Tracking Dialog */}
        <Dialog open={showProgressDialog} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
                <span>Generating Timetables</span>
              </DialogTitle>
              <DialogDescription>
                Please wait while we optimize your school timetables
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-purple-600">{progressData.progress}%</span>
                </div>
                <Progress 
                  value={progressData.progress} 
                  className="h-3"
                />
              </div>

              <div className="space-y-3">
                {progressData.totalClasses > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Classes</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {progressData.completedClasses} / {progressData.totalClasses}
                    </span>
                  </div>
                )}

                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    {progressData.status}
                  </p>
                  {progressData.currentClass && (
                    <p className="text-xs text-muted-foreground ml-6 mt-1">
                      Current: {progressData.currentClass}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Smart Generation Result Dialog */}
        <Dialog open={showSmartGenerationResult}>
          <DialogContent className="sm:max-w-2xl [&>button]:hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <span>Smart Generation Complete</span>
              </DialogTitle>
              <DialogDescription>
                Your timetables have been generated using AI-powered optimization
              </DialogDescription>
            </DialogHeader>

            {smartGenerationResult && (
              <div className="space-y-2">
                {/* Strategy & Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        <span>Generation Strategy</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="mb-2 capitalize">
                        {smartGenerationResult.strategy?.replace('_', ' ')}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {smartGenerationResult.strategy === 'individual' && 'Individual class optimization for maximum precision'}
                        {smartGenerationResult.strategy === 'staged_hybrid' && 'Multi-stage approach balancing efficiency and quality'}
                        {smartGenerationResult.strategy === 'lightweight_bulk' && 'Efficient bulk processing for large schools'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Award className="h-4 w-4 text-purple-600" />
                        <span>Quality Score</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <Progress 
                            value={smartGenerationResult.qualityScore || 0} 
                            className="h-2" 
                          />
                        </div>
                        <span className="text-lg md:text-xl font-semibold text-purple-600">
                          {smartGenerationResult.qualityScore || 0}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {(smartGenerationResult.qualityScore || 0) >= 90 && 'Excellent optimization'}
                        {(smartGenerationResult.qualityScore || 0) >= 80 && (smartGenerationResult.qualityScore || 0) < 90 && 'Good optimization'}
                        {(smartGenerationResult.qualityScore || 0) >= 70 && (smartGenerationResult.qualityScore || 0) < 80 && 'Fair optimization'}
                        {(smartGenerationResult.qualityScore || 0) < 70 && 'Needs improvement'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Results Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Users className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-lg md:text-xl font-semibold">{smartGenerationResult.generatedClasses || 0}</p>
                          <p className="text-sm text-muted-foreground">Classes Generated</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-lg md:text-xl font-semibold">{smartGenerationResult.totalPeriods || 0}</p>
                          <p className="text-sm text-muted-foreground">Total Periods</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        {(smartGenerationResult.conflicts || 0) === 0 ? (
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        ) : (
                          <AlertCircle className="h-8 w-8 text-orange-600" />
                        )}
                        <div>
                          <p className="text-lg md:text-xl font-semibold">{smartGenerationResult.conflicts || 0}</p>
                          <p className="text-sm text-muted-foreground">Conflicts</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recommendations */}
                {(smartGenerationResult.conflicts || 0) > 0 && (
                  <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/40 dark:border-orange-700/60">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2 text-orange-800 dark:text-orange-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-orange-700 dark:text-orange-300/90">
                        <li>• Review teacher assignments for overlapping schedules</li>
                        <li>• Consider adjusting subject frequencies to reduce conflicts</li>
                        <li>• You can manually resolve conflicts in the timetable grid</li>
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {(smartGenerationResult.conflicts || 0) === 0 && (
                  <Card className="border-green-200 bg-green-50 dark:bg-green-900/40 dark:border-green-700/60">
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2 text-green-800 dark:text-green-300">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">
                          {smartGenerationResult.detailedMessage?.includes('⚠️') 
                            ? 'Generation Complete with Unassigned Periods' 
                            : 'Perfect Generation!'}
                        </span>
                      </div>
                      {smartGenerationResult.detailedMessage ? (
                        <div className="text-sm mt-3">
                          {smartGenerationResult.detailedMessage.split('\n').map((line: string, index: number) => (
                            <p key={index} className={
                              line.includes('⚠️') ? 'text-orange-700 dark:text-orange-300 font-medium' :
                              line.includes('📚') ? 'text-green-700 dark:text-green-300 font-medium mt-2' :
                              line.includes('•') ? 'text-green-700 dark:text-green-300 ml-4' :
                              line.includes('ℹ️') ? 'text-blue-700 dark:text-blue-300 mt-2 italic' :
                              'text-green-700 dark:text-green-300'
                            }>
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-700 dark:text-green-300/90 mt-1">
                          No conflicts detected. Your timetables are ready to use.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => {
                    setShowSmartGenerationResult(false);
                    window.location.reload(); // Refresh to show new timetables
                  }}>
                    View Timetables
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* AI Smart Timetable Info Dialog */}
        <Dialog open={isAIInfoDialogOpen} onOpenChange={setIsAIInfoDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center space-x-2 text-xl">
                <div className="p-1.5 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                  AI Smart Timetable Features
                </span>
              </DialogTitle>
              <DialogDescription className="text-sm">
                Discover the powerful AI capabilities that make timetable generation effortless
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              {/* What's AI in it Section */}
              <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-900/50 dark:via-cyan-900/50 dark:to-teal-900/50 border-2 border-blue-200 dark:border-blue-700/60 rounded-xl p-5 mb-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg shadow-md">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    What's AI in it?
                  </h3>
                </div>
                <div className="space-y-2.5 text-sm">
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    Our AI Smart Timetable uses <strong className="text-blue-600 dark:text-blue-400">advanced constraint-solving algorithms</strong> combined with <strong className="text-cyan-600 dark:text-cyan-400">machine learning-inspired optimization</strong> to create perfect schedules automatically.
                  </p>
                  <ul className="space-y-2 ml-1 mt-3">
                    <li className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200"><strong className="text-blue-600 dark:text-blue-400">Intelligent Decision Making:</strong> Analyzes constraints and makes thousands of smart decisions per second.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200"><strong className="text-cyan-600 dark:text-cyan-400">Adaptive Learning:</strong> Learns from patterns and selects the best strategy for your school.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200"><strong className="text-teal-600 dark:text-teal-400">Conflict Prevention:</strong> Detects and prevents scheduling conflicts before they occur.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200"><strong className="text-blue-600 dark:text-blue-400">Continuous Optimization:</strong> Constantly evaluates and improves schedule quality (98-99% scores).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button onClick={() => setIsAIInfoDialogOpen(false)} className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600">
                <Brain className="h-4 w-4 mr-2" />
                Got it!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}