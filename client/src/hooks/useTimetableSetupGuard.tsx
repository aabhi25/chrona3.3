import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

interface TimetableStatusResponse {
  configured: boolean;
}

/**
 * Hook to check if timetable structure configuration is complete for the school
 * Used to enforce mandatory configuration before accessing timetable features
 */
export function useTimetableSetupGuard() {
  const { user } = useAuth();

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["timetable-structure-status", user?.schoolId],
    queryFn: async (): Promise<TimetableStatusResponse> => {
      const response = await apiRequest("GET", "/api/timetable-structure/status");
      return await response.json();
    },
    enabled: !!user?.schoolId,
  });

  const isConfigured = statusData?.configured ?? false;
  const canAccess = isConfigured || isLoading; // Allow access while loading to prevent flashing
  
  // Determine what action to take if not configured
  const getRedirectAction = () => {
    if (isLoading) return null;
    if (isConfigured) return null;
    
    // Admin and super_admin should be redirected to settings to configure
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return 'redirect-to-settings';
    }
    
    // Other roles should see a locked screen
    return 'show-locked';
  };

  return {
    isConfigured,
    isLoading,
    canAccess,
    redirectAction: getRedirectAction(),
    user
  };
}