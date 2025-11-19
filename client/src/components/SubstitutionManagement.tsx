import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, UserCheck, RefreshCw, Loader2, Users, BookOpen, Calendar as CalendarIcon, X, Info, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getCurrentDateIST, parseISTDate, getWeekStartDateIST, toISTDateString } from "@shared/utils/dateUtils";

interface Substitution {
  id: string;
  date: string;
  period: number;
  status: string;
  originalTeacher: { id: string; name: string };
  substituteTeacher?: { id: string; name: string };
  class: { id: string; name: string };
  subject: { id: string; name: string };
  reason?: string;
  notes?: string;
  suggestions?: Array<{
    teacherId: string;
    teacherName: string;
    score: number;
    reasons: Array<{ reason: string; score: number }>;
    classes: string[];
    subjects: string[];
    profilePictureUrl?: string;
    schoolIdNumber?: string;
    employeeId?: string;
  }>;
}

interface Teacher {
  id: string;
  name: string;
}

interface QualifiedTeacher extends Teacher {
  isAvailable: boolean;
  conflictMessage?: string;
  priority: 'P1' | 'P2';
  priorityReason: string;
}

export default function SubstitutionManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubstitution, setSelectedSubstitution] = useState<Substitution | null>(null);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<string>("");
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [substitutionToCancel, setSubstitutionToCancel] = useState<string | null>(null);
  const [processingSubstitutionId, setProcessingSubstitutionId] = useState<string | null>(null);
  const [qualifiedTeachers, setQualifiedTeachers] = useState<QualifiedTeacher[]>([]);
  const [isLoadingQualified, setIsLoadingQualified] = useState(false);
  
  // History date picker state - default to today in IST
  const todayIST = getCurrentDateIST();
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<Date>(parseISTDate(todayIST));
  
  // State for collapsible class cards in history
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  
  // State for collapsible date sections in the new date-grouped layout
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  
  // State to track which substitution details are expanded
  const [expandedSubstitutions, setExpandedSubstitutions] = useState<Set<string>>(new Set());

  const { data: substitutions = [], isLoading, isFetching, refetch } = useQuery<Substitution[]>({
    queryKey: ["/api/substitutions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/substitutions");
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  const { data: teachersResponse } = useQuery<{ teachers: Teacher[], totalCount: number }>({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teachers?limit=1000");
      return response.json();
    },
    enabled: user?.role === "admin",
  });
  
  const teachers = teachersResponse?.teachers || [];

  const { data: urgentSubstitutions = [] } = useQuery<Substitution[]>({
    queryKey: ["/api/substitutions/urgent"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/substitutions/urgent");
      return response.json();
    },
    enabled: user?.role === "admin",
    refetchInterval: 5000,
  });

  // Fetch timetable structure to get time slots and breaks
  const { data: timetableStructure } = useQuery({
    queryKey: ["/api/timetable-structure"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-structure");
      return response.json();
    },
    enabled: user?.role === "admin",
  });

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!timetableStructure?.timeSlots) return actualPeriod;

    // Count only non-break periods up to the current period
    let teachingPeriodCount = 0;
    for (const slot of timetableStructure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  const suggestSubstituteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/substitutions/${id}/suggest`);
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedSubstitution({ ...selectedSubstitution!, suggestions: data.suggestions });
      setIsSuggestionDialogOpen(true);
      setProcessingSubstitutionId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions"] });
    },
    onError: (error: any) => {
      setProcessingSubstitutionId(null);
      toast({
        title: "Failed to Generate Suggestions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignSubstituteMutation = useMutation({
    mutationFn: async ({ id, substituteTeacherId, teacherName }: { id: string; substituteTeacherId: string; teacherName?: string }) => {
      const response = await apiRequest("POST", `/api/substitutions/${id}/assign`, { substituteTeacherId });
      return { response: response.json(), teacherName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
      setIsAssignDialogOpen(false);
      setSelectedSubstitution(null);
      setSelectedSubstituteId("");
      toast({
        description: data.teacherName 
          ? `${data.teacherName} has been assigned successfully`
          : "Substitute has been assigned successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Assign Substitute",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelSubstitutionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/substitutions/${id}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
      toast({
        title: "Substitution Cancelled",
        description: "The substitution has been cancelled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Cancel Substitution",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSuggestSubstitute = (substitution: Substitution) => {
    setSelectedSubstitution(substitution);
    setProcessingSubstitutionId(substitution.id);
    suggestSubstituteMutation.mutate(substitution.id);
  };

  const handleAssignFromSuggestions = (teacherId: string, teacherName: string) => {
    setIsSuggestionDialogOpen(false);
    assignSubstituteMutation.mutate({ id: selectedSubstitution!.id, substituteTeacherId: teacherId, teacherName });
  };

  const handleManualAssign = async (substitution: Substitution) => {
    setSelectedSubstitution(substitution);
    setIsAssignDialogOpen(true);
    setIsLoadingQualified(true);
    setQualifiedTeachers([]);
    
    // Validate teachers in parallel for better performance
    try {
      // Get class assignments to check for same-subject teachers and class teacher
      const assignmentsResponse = await apiRequest("GET", "/api/class-subject-assignments");
      const assignments = await assignmentsResponse.json();
      
      // Find teachers who teach this subject
      const sameSubjectTeacherIds = new Set(
        assignments
          .filter((a: any) => a.subjectId === substitution.subject.id)
          .map((a: any) => a.teacherId)
      );
      
      // Filter out the absent teacher
      const teachersToValidate = teachers.filter(t => t.id !== substitution.originalTeacher.id);
      
      // Calculate the week start (Monday) for this substitution date using IST timezone
      const substitutionDate = parseISTDate(substitution.date);
      const weekStartDate = getWeekStartDateIST(substitutionDate);
      const weekStart = toISTDateString(weekStartDate);
      
      // Validate all teachers in parallel
      const validationPromises = teachersToValidate.map(async (teacher) => {
        try {
          const response = await apiRequest("POST", "/api/timetable/validate-manual-assignment", {
            classId: substitution.class.id,
            teacherId: teacher.id,
            subjectId: substitution.subject.id,
            day: new Date(substitution.date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
            period: substitution.period,
            weekStart: weekStart
          });
          
          const validation = await response.json();
          
          // Only return available teachers
          if (validation.isValid) {
            // Calculate priority based on subject match
            const isSameSubject = sameSubjectTeacherIds.has(teacher.id);
            
            let priority: 'P1' | 'P2' = isSameSubject ? 'P1' : 'P2';
            let priorityReason = isSameSubject ? 'Teaches Same Subject' : 'Other Subject';
            
            return {
              ...teacher,
              isAvailable: true,
              priority,
              priorityReason
            } as QualifiedTeacher;
          }
          return null;
        } catch (error) {
          console.error(`Validation failed for teacher ${teacher.name}:`, error);
          return null;
        }
      });
      
      // Wait for all validations to complete
      const results = await Promise.all(validationPromises);
      
      // Filter out null values (unavailable teachers)
      const validatedTeachers = results.filter((t): t is QualifiedTeacher => t !== null);
      
      // Sort: P1 first, then P2, then alphabetically
      validatedTeachers.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority === 'P1' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      setQualifiedTeachers(validatedTeachers);
    } catch (error) {
      console.error("Error validating teachers:", error);
      toast({
        title: "Validation Error",
        description: "Could not validate teacher availability",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQualified(false);
    }
  };

  const handleCancelSubstitution = (id: string) => {
    setSubstitutionToCancel(id);
    setIsCancelDialogOpen(true);
  };

  const confirmCancelSubstitution = () => {
    if (substitutionToCancel) {
      cancelSubstitutionMutation.mutate(substitutionToCancel);
      setIsCancelDialogOpen(false);
      setSubstitutionToCancel(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const groupSubstitutionsByClass = (subs: Substitution[]) => {
    const grouped = new Map<string, Substitution[]>();
    subs.forEach((sub) => {
      const className = sub.class.name;
      if (!grouped.has(className)) {
        grouped.set(className, []);
      }
      grouped.get(className)!.push(sub);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // Group substitutions by date
  const groupSubstitutionsByDate = (subs: Substitution[]) => {
    const grouped = new Map<string, Substitution[]>();
    subs.forEach(sub => {
      const date = sub.date; // YYYY-MM-DD format
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(sub);
    });
    
    // Sort by date (earliest first) and then sort substitutions within each date by class and period
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort dates ascending (earliest first)
      .map(([date, subs]) => [
        date,
        subs.sort((a, b) => {
          // Sort by class name first (alphabetically)
          const classCompare = a.class.name.localeCompare(b.class.name);
          if (classCompare !== 0) {
            return classCompare;
          }
          // Then sort by period within the same class
          return a.period - b.period;
        })
      ] as [string, Substitution[]]);
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const toggleSubstitutionExpansion = (id: string, date?: string) => {
    setExpandedSubstitutions(prev => {
      // If clicking the same one, deselect it
      if (prev.has(id)) {
        return new Set();
      }
      // Otherwise, select only this one (clear all others)
      const newSet = new Set([id]);
      
      // Auto-expand the date card when expanding a substitution
      if (date) {
        setExpandedDates(prevDates => {
          const newDates = new Set(prevDates);
          newDates.add(date);
          return newDates;
        });
      }
      
      return newSet;
    });
  };

  // Format date for display (e.g., "Tuesday, 7 Oct 2025")
  const formatDateHeader = (dateStr: string) => {
    const date = parseISTDate(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
      suggested: { label: "Suggested", variant: "default" as const, icon: CheckCircle },
      assigned: { label: "Assigned", variant: "default" as const, icon: UserCheck },
      completed: { label: "Completed", variant: "outline" as const, icon: CheckCircle },
      cancelled: { label: "Cancelled", variant: "destructive" as const, icon: AlertCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 font-medium">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderSubstitutionItem = (sub: Substitution, showActions = true) => (
    <div
      key={sub.id}
      className="bg-card border border-border/40 rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header: Subject, Period & Date */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{sub.subject.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>Period {getTeachingPeriodNumber(sub.period)} • {formatDate(sub.date)}</span>
            </div>
          </div>

          {/* Teacher Info */}
          <div className="flex items-center gap-2 text-sm">
            {sub.substituteTeacher ? (
              <>
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-500" />
                <span className="text-muted-foreground">Substitute:</span>
                <span className="font-medium text-green-600 dark:text-green-500">
                  {sub.substituteTeacher.name}
                </span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                <span className="text-muted-foreground">Absent:</span>
                <span className="font-medium">{sub.originalTeacher.name}</span>
              </>
            )}
          </div>

          {/* Reason or Cancellation Notes */}
          {(sub.status === 'cancelled' && sub.notes) ? (
            <div className="text-xs text-muted-foreground bg-destructive/10 rounded-md px-3 py-1.5 border border-destructive/30">
              <span className="font-semibold">Cancellation:</span> {sub.notes}
            </div>
          ) : sub.reason && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5 border border-border/30">
              <span className="font-semibold">Reason:</span> {sub.reason}
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-start gap-3">
            {(sub.status === "pending" || sub.status === "suggested") && (
              <>
                <div className="flex items-center gap-2 p-0.5 bg-muted/30 rounded-lg border border-border/50">
                  <Button
                    size="sm"
                    onClick={() => handleSuggestSubstitute(sub)}
                    disabled={processingSubstitutionId === sub.id}
                    className="h-7 px-3 text-xs bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-sm"
                  >
                    {processingSubstitutionId === sub.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    ) : (
                      <UserCheck className="h-3 w-3 mr-1.5" />
                    )}
                    AI Suggestions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManualAssign(sub)}
                    className="h-7 px-3 text-xs bg-background hover:bg-muted"
                  >
                    Manual Assign
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancelSubstitution(sub.id)}
                  disabled={cancelSubstitutionMutation.isPending}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const toggleClassExpansion = (className: string) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(className)) {
        newSet.delete(className);
      } else {
        newSet.add(className);
      }
      return newSet;
    });
  };

  // Render date-grouped substitutions (Option A: Date-Grouped Cards)
  const renderDateGroupedSubstitutions = (subs: Substitution[], showActions = true) => {
    const grouped = groupSubstitutionsByDate(subs);
    
    return (
      <div className="space-y-4">
        {grouped.map(([date, dateSubs]) => {
          const isDateExpanded = expandedDates.has(date);
          
          return (
            <Card key={date} className="overflow-hidden border-2">
              {/* Date Header */}
              <div 
                className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-b px-5 py-4 cursor-pointer hover:from-blue-500/15 hover:via-purple-500/15 hover:to-pink-500/15 transition-colors"
                onClick={() => toggleDateExpansion(date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-bold">{formatDateHeader(date)}</h3>
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {dateSubs.length} substitution{dateSubs.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <ChevronDown 
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      isDateExpanded ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Compact Period Badges (Grouped by Class) */}
              <div className="px-5 py-4 bg-muted/30 space-y-3">
                {(() => {
                  // Group substitutions by class
                  const byClass = new Map<string, Substitution[]>();
                  dateSubs.forEach(sub => {
                    if (!byClass.has(sub.class.name)) {
                      byClass.set(sub.class.name, []);
                    }
                    byClass.get(sub.class.name)!.push(sub);
                  });

                  // Sort classes alphabetically and render each class on its own line
                  return Array.from(byClass.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([className, classSubs]) => (
                      <div key={className} className="space-y-2">
                        {/* Class Name Label */}
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {className.replace('Class ', '')}
                          </div>
                          <span className="text-sm font-semibold text-muted-foreground">{className}</span>
                        </div>
                        
                        {/* Period Badges for this class */}
                        <div className="flex flex-wrap gap-2 pl-10">
                          {classSubs.map(sub => {
                            const isExpanded = expandedSubstitutions.has(sub.id);
                            const teachingPeriod = getTeachingPeriodNumber(sub.period);
                            
                            return (
                              <button
                                key={sub.id}
                                onClick={() => toggleSubstitutionExpansion(sub.id, date)}
                                className={`
                                  inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 
                                  transition-all duration-200 font-medium text-sm
                                  ${isExpanded 
                                    ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105' 
                                    : 'bg-card hover:bg-muted border-border hover:border-primary/50 hover:shadow-sm'
                                  }
                                `}
                              >
                                <span className={`font-bold ${isExpanded ? 'text-primary-foreground' : 'text-primary'}`}>
                                  P{teachingPeriod}
                                </span>
                                <span className="text-xs opacity-75">•</span>
                                <BookOpen className={`h-3.5 w-3.5 ${isExpanded ? 'opacity-90' : 'opacity-70'}`} />
                                <span className="truncate max-w-[120px]">{sub.subject.name}</span>
                                {sub.substituteTeacher && (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                })()}
              </div>

              {/* Expanded Details (Show expanded substitutions) */}
              {isDateExpanded && (
                <CardContent className="p-5 space-y-3 bg-background">
                  {dateSubs.filter(sub => expandedSubstitutions.has(sub.id)).map(sub => (
                    <div key={sub.id} className="bg-card border border-border/40 rounded-lg p-4">
                      {renderSubstitutionItem(sub, showActions)}
                    </div>
                  ))}
                  
                  {dateSubs.filter(sub => expandedSubstitutions.has(sub.id)).length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Click on a period badge above to view details
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderGroupedSubstitutions = (subs: Substitution[], showActions = true, collapsible = false) => {
    const grouped = groupSubstitutionsByClass(subs);
    
    return (
      <div className="space-y-6">
        {grouped.map(([className, classSubs]) => {
          const isExpanded = collapsible ? expandedClasses.has(className) : true;
          
          return (
            <Card key={className} className="overflow-hidden border-2">
              <div 
                className={`bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-b px-4 py-3 ${
                  collapsible ? 'cursor-pointer hover:from-blue-500/15 hover:via-purple-500/15 hover:to-pink-500/15 transition-colors' : ''
                }`}
                onClick={() => collapsible && toggleClassExpansion(className)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                      {className.replace('Class ', '')}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{className}</h3>
                      <p className="text-sm text-muted-foreground">
                        {classSubs.length} substitution{classSubs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {collapsible && (
                    <ChevronDown 
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </div>
              </div>
              {isExpanded && (
                <CardContent className="p-4 space-y-3">
                  {classSubs.map(sub => renderSubstitutionItem(sub, showActions))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Access Restricted</h3>
        <p className="text-muted-foreground text-center mt-2">
          Only administrators can manage substitutions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get today's date in IST
  const today = getCurrentDateIST();
  
  // Filter out past dates and only show today/future substitutions
  const urgentSubs = substitutions.filter(
    (s) => (s.status === "pending" || (s.status === "suggested" && !s.substituteTeacher)) && s.date >= today
  );
  const upcomingSubs = substitutions.filter((s) => 
    ((s.status === "suggested" && s.substituteTeacher) || s.status === "assigned") && s.date >= today
  );
  
  // Filter history by selected date
  const selectedDateStr = selectedHistoryDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const completedSubs = substitutions.filter((s) => 
    (s.status === "completed" || s.status === "cancelled") && s.date === selectedDateStr
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Teacher Substitutions</h2>
          <p className="text-muted-foreground">
            Manage substitute teachers for absent staff
          </p>
        </div>
        <Button 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/substitutions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
          }} 
          variant="outline" 
          size="sm"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {urgentSubstitutions.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-orange-50/50 dark:from-orange-950/20 dark:to-orange-950/10">
          <CardHeader className="py-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertCircle className="h-3.5 w-3.5" />
              Urgent: {urgentSubstitutions.length} substitution(s) needed within 24 hours
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <Tabs defaultValue="urgent" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="urgent">
            Urgent ({urgentSubs.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingSubs.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({completedSubs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urgent" className="space-y-3">
          {urgentSubs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All Good!</h3>
                <p className="text-muted-foreground text-center mt-2">
                  No urgent substitutions needed at the moment
                </p>
              </CardContent>
            </Card>
          ) : (
            renderDateGroupedSubstitutions(urgentSubs, true)
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3">
          {upcomingSubs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Upcoming Substitutions</h3>
                <p className="text-muted-foreground text-center mt-2">
                  Upcoming substitutions will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            renderDateGroupedSubstitutions(upcomingSubs, true)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Date Picker */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Select Date:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedHistoryDate.toLocaleDateString('en-IN', { 
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata'
                      })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedHistoryDate}
                      onSelect={(date) => date && setSelectedHistoryDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* History List */}
          {completedSubs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No History for {selectedHistoryDate.toLocaleDateString('en-IN', { 
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Kolkata'
                })}</h3>
                <p className="text-muted-foreground text-center mt-2">
                  No completed or cancelled substitutions on this date
                </p>
              </CardContent>
            </Card>
          ) : (
            renderGroupedSubstitutions(completedSubs, false, true)
          )}
        </TabsContent>
      </Tabs>

      {/* Suggestions Dialog */}
      <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader className="border-b pb-4 pr-10">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-xl font-semibold">AI Suggested Substitute Teachers</DialogTitle>
              <Button
                onClick={() => selectedSubstitution && handleSuggestSubstitute(selectedSubstitution)}
                disabled={!!(selectedSubstitution && processingSubstitutionId === selectedSubstitution.id)}
                className="flex-shrink-0 h-8 px-3 text-xs bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all"
              >
                {selectedSubstitution && processingSubstitutionId === selectedSubstitution.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                )}
                Regenerate
              </Button>
            </div>
          </DialogHeader>

          {selectedSubstitution?.suggestions && selectedSubstitution.suggestions.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 py-2">
              {selectedSubstitution.suggestions.map((suggestion) => (
                <Card key={suggestion.teacherId} className="hover:shadow-md hover:border-primary/50 transition-all duration-200 border-2">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-5">
                      {/* Profile Picture */}
                      <div className="flex-shrink-0">
                        {suggestion.profilePictureUrl ? (
                          <img
                            src={suggestion.profilePictureUrl}
                            alt={suggestion.teacherName}
                            className="h-14 w-14 rounded-full object-cover border-2 border-border shadow-sm"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {suggestion.teacherName.charAt(0)}
                          </div>
                        )}
                      </div>
                      
                      {/* Teacher Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Name and ID */}
                            <div>
                              <h4 className="font-bold text-base text-foreground truncate mb-1">
                                {suggestion.teacherName}
                              </h4>
                              {(suggestion.schoolIdNumber || suggestion.employeeId) && (
                                <p className="text-sm text-muted-foreground">
                                  ID: {suggestion.schoolIdNumber || suggestion.employeeId}
                                </p>
                              )}
                            </div>
                            
                            {/* Classes and Subjects */}
                            <div className="space-y-1.5">
                              {suggestion.classes && suggestion.classes.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-muted-foreground min-w-[70px]">Classes:</span>
                                  <span className="text-sm text-foreground">{suggestion.classes.join(', ')}</span>
                                </div>
                              )}
                              {suggestion.subjects && suggestion.subjects.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-muted-foreground min-w-[70px]">Subjects:</span>
                                  <span className="text-sm text-foreground">{suggestion.subjects.join(', ')}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Score with Info */}
                            <div className="flex items-center gap-2 pt-1">
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                                Score: {suggestion.score}/130
                              </Badge>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 rounded-full hover:bg-muted">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80" align="start" side="top">
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm">Score Breakdown</h4>
                                    <div className="space-y-2">
                                      {suggestion.reasons.map((item, index) => (
                                        <div key={index} className="flex items-start justify-between gap-3 text-xs">
                                          <div className="flex items-start gap-2 flex-1">
                                            <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-muted-foreground leading-relaxed">{item.reason}</span>
                                          </div>
                                          <span className="text-primary font-semibold flex-shrink-0">+{item.score}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {suggestion.reasons.length === 0 && (
                                      <p className="text-xs text-muted-foreground">No scoring details available</p>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          
                          {/* Assign Button */}
                          <Button
                            onClick={() => handleAssignFromSuggestions(suggestion.teacherId, suggestion.teacherName)}
                            disabled={assignSubstituteMutation.isPending}
                            className="flex-shrink-0 h-8 px-3 text-xs font-medium"
                          >
                            {assignSubstituteMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Assign"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-base text-muted-foreground">No suitable substitutes found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Assign Substitute</DialogTitle>
            <DialogDescription>
              Select a teacher to substitute for this period
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Teacher</label>
              {isLoadingQualified ? (
                <div className="mt-2 flex items-center justify-center p-4 border rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Finding available teachers...</span>
                </div>
              ) : (
                <>
                  <Select value={selectedSubstituteId} onValueChange={setSelectedSubstituteId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualifiedTeachers.length === 0 ? (
                        <div className="p-4 text-sm text-center text-muted-foreground">
                          No available teachers found for this time slot
                        </div>
                      ) : (
                        qualifiedTeachers.map(teacher => (
                          <SelectItem 
                            key={teacher.id} 
                            value={teacher.id}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                teacher.priority === 'P1' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {teacher.priority}
                              </span>
                              <span className="flex-1">{teacher.name}</span>
                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedSubstituteId && qualifiedTeachers.find(t => t.id === selectedSubstituteId) && (
                    <div className="mt-2 text-sm text-muted-foreground flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>
                        {qualifiedTeachers.find(t => t.id === selectedSubstituteId)?.priorityReason}
                      </span>
                    </div>
                  )}
                  {qualifiedTeachers.length > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-green-700 dark:text-green-400">P1 Priority:</strong> Teachers who teach the same subject or are the class teacher
                        <br />
                        <strong className="text-blue-700 dark:text-blue-400">P2 Priority:</strong> Other available teachers
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedSubstituteId("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSubstituteId && selectedSubstitution) {
                  const selectedTeacher = teachers.find(t => t.id === selectedSubstituteId);
                  assignSubstituteMutation.mutate({
                    id: selectedSubstitution.id,
                    substituteTeacherId: selectedSubstituteId,
                    teacherName: selectedTeacher?.name,
                  });
                }
              }}
              disabled={!selectedSubstituteId || assignSubstituteMutation.isPending}
            >
              {assignSubstituteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Assign Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Substitution</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this substitution? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelDialogOpen(false);
                setSubstitutionToCancel(null);
              }}
            >
              No, Keep It
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelSubstitution}
              disabled={cancelSubstitutionMutation.isPending}
            >
              {cancelSubstitutionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
