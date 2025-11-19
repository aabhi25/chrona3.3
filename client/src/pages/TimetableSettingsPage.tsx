import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import type { TimetableStructure, InsertTimetableStructure } from "@shared/schema";
import { InteractiveTimetableGrid } from "@/components/InteractiveTimetableGrid";

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

const defaultWorkingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Function to sort working days in proper order
const sortWorkingDays = (days: string[]): string[] => {
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return dayOrder.filter(day => days.includes(day));
};

const defaultTimeSlots: TimeSlot[] = [
  { period: 1, startTime: "07:30", endTime: "08:15" },
  { period: 2, startTime: "08:15", endTime: "09:00" },
  { period: 3, startTime: "09:00", endTime: "09:45" },
  { period: 4, startTime: "09:45", endTime: "10:15" },
  { period: 5, startTime: "10:15", endTime: "11:00", isBreak: true },
  { period: 6, startTime: "11:00", endTime: "11:45" },
  { period: 7, startTime: "11:45", endTime: "12:30" },
  { period: 8, startTime: "12:30", endTime: "13:15" },
];

export default function TimetableSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Check if we're in onboarding mode
  const isOnboarding = new URLSearchParams(window.location.search).get('onboarding') === '1';
  
  const [editMode, setEditMode] = useState(isOnboarding); // Auto-enable edit mode for onboarding
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  
  const [structure, setStructure] = useState<InsertTimetableStructure>({
    schoolId: user?.schoolId || "", 
    periodsPerDay: 8,
    workingDays: defaultWorkingDays,
    timeSlots: defaultTimeSlots,
  });

  // Update structure when user context changes
  useEffect(() => {
    if (user?.schoolId) {
      setStructure(prev => ({
        ...prev,
        schoolId: user.schoolId
      }));
    }
  }, [user?.schoolId]);

  // Fetch current timetable structure
  const { data: currentStructure, isLoading: isStructureLoading } = useQuery({
    queryKey: ["/api/timetable-structure"],
    enabled: !!user?.schoolId,
  });

  // Update local structure when data is fetched
  useEffect(() => {
    if (currentStructure && typeof currentStructure === 'object' && 'id' in currentStructure && currentStructure.id) {
      const typedStructure = currentStructure as TimetableStructure;
      setStructure({
        schoolId: typedStructure.schoolId,
        periodsPerDay: typedStructure.periodsPerDay,
        workingDays: typedStructure.workingDays,
        timeSlots: typedStructure.timeSlots,
        isActive: typedStructure.isActive,
      });
    }
  }, [currentStructure]);

  // Update structure mutation
  const updateStructureMutation = useMutation({
    mutationFn: (data: InsertTimetableStructure) =>
      apiRequest("POST", "/api/timetable-structure", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: isOnboarding 
          ? "Timetable structure configured successfully! You can now access all timetable features." 
          : "Timetable structure updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable-structure"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-structure-status"] }); // Invalidate status for guard
      
      // Only disable edit mode if NOT in onboarding mode
      // In onboarding, keep edit mode active so the save button stays visible
      if (!isOnboarding) {
        setEditMode(false);
      }
      
      // Navigate back to timetable if in onboarding mode
      if (isOnboarding) {
        setTimeout(() => setLocation("/timetable"), 1000); // Small delay to show success message
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update timetable structure",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (hasValidationErrors) {
      toast({
        title: "Cannot Save",
        description: "Please fix all validation errors before saving.",
        variant: "destructive",
      });
      return;
    }
    updateStructureMutation.mutate(structure);
  };

  const handleGoBack = () => {
    if (isOnboarding) {
      // In onboarding mode, don't allow going back without configuring
      toast({
        title: "Configuration Required",
        description: "Please complete the timetable structure configuration to continue.",
        variant: "destructive",
      });
      return;
    }
    setLocation("/timetable");
  };

  // Format time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!structure?.timeSlots) return actualPeriod;
    
    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of structure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };


  return (
    <div>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Timetable Settings
              </h2>
              <p className="text-muted-foreground">Configure your school's timetable structure</p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Onboarding Banner */}
          {isOnboarding && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900">
                    Welcome! Let's configure your timetable structure
                  </h3>
                  <p className="mt-1 text-blue-700">
                    Before you can access timetable features, we need to set up your school's basic structure including working days, periods, and timing. 
                    This is a one-time setup that will make everything else much easier.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Please complete the configuration below and click "Save and Continue" to proceed.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isStructureLoading ? (
            <div className="text-center py-8">Loading timetable structure...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Timetable Structure</h3>
                <div className="flex items-center space-x-2">
                  {/* Show Edit Structure button for admins and super admins to allow structure changes */}
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <Button
                      variant={editMode ? "outline" : "default"}
                      onClick={() => setEditMode(!editMode)}
                      data-testid="button-edit-mode"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {editMode ? "Cancel" : "Edit Structure"}
                    </Button>
                  )}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      {hasValidationErrors && (
                        <div className="flex items-center text-red-600 text-sm">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Fix errors to save
                        </div>
                      )}
                      <Button
                        onClick={handleSave}
                        disabled={updateStructureMutation.isPending || hasValidationErrors}
                        data-testid="button-save-structure"
                        className={isOnboarding ? "bg-blue-600 hover:bg-blue-700" : ""}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isOnboarding ? "Save and Continue" : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Grid View */}
              <InteractiveTimetableGrid
                structure={structure}
                onStructureChange={setStructure}
                editMode={editMode}
                onValidationChange={setHasValidationErrors}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}