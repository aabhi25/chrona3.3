import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, AlertCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SimulationGrid from "./SimulationGrid";
import { useState, useEffect } from "react";

export default function CurrentSchoolStaffing() {
  const { toast } = useToast();
  const [currentStaffingId, setCurrentStaffingId] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const { data: simulations, isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["/api/load-simulations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/load-simulations");
      return await response.json();
    },
  });

  useEffect(() => {
    if (simulations && !hasChecked) {
      const currentStaffing = simulations.find((s: any) => s.name === "Current School Staffing");
      if (currentStaffing) {
        setCurrentStaffingId(currentStaffing.id);
      }
      setHasChecked(true);
    }
  }, [simulations, hasChecked]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/load-simulations/current-school-staffing/sync");
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentStaffingId(data.id);
      setShowSyncDialog(false);
      toast({
        title: "Success",
        description: "Current staffing data synced successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/load-simulations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/load-simulations/${data.id}`] });
    },
    onError: (error: any) => {
      setShowSyncDialog(false);
      toast({
        title: "Error",
        description: error.message || "Failed to sync staffing data",
        variant: "destructive",
      });
    },
  });

  const handleSyncClick = () => {
    setShowSyncDialog(true);
  };

  const handleSyncConfirm = () => {
    syncMutation.mutate();
  };

  if (isLoadingSimulations) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Loading simulations...</p>
        </div>
      </div>
    );
  }

  if (hasChecked && !currentStaffingId) {
    return (
      <>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No current staffing data found. Click below to sync from production.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleSyncClick} 
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync from Production
              </>
            )}
          </Button>
        </div>

        <AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Sync from Production
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <div className="font-medium text-foreground">
                  This will overwrite any existing changes you made in this simulation.
                </div>
                <div>
                  All your current simulation data will be replaced with fresh data from your production system. This action cannot be undone.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={syncMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSyncConfirm}
                disabled={syncMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Yes, Sync Now"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (!currentStaffingId) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Alert className="flex-1 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              This view uses real school data in simulation mode. Changes made here are sandboxed and don't affect the live system
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleSyncClick} 
            disabled={syncMutation.isPending}
            variant="outline"
            className="ml-4"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync from Production
              </>
            )}
          </Button>
        </div>

        <SimulationGrid simulationId={currentStaffingId} />
      </div>

      <AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Sync from Production
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current changes with fresh production data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSyncConfirm}
              disabled={syncMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync Now"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
