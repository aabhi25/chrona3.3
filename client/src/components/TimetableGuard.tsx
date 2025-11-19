import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useTimetableSetupGuard } from "@/hooks/useTimetableSetupGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Settings, Clock, AlertCircle } from "lucide-react";

interface TimetableGuardProps {
  children: ReactNode;
}

/**
 * Guards timetable routes to ensure mandatory configuration is completed
 * - Redirects admins to settings if not configured
 * - Shows locked screen to other roles
 * - Allows access if configured
 */
export function TimetableGuard({ children }: TimetableGuardProps) {
  const { isConfigured, isLoading, redirectAction, user } = useTimetableSetupGuard();
  const [, setLocation] = useLocation();

  // Handle redirects for admins
  useEffect(() => {
    if (redirectAction === 'redirect-to-settings') {
      setLocation("/timetable/settings?onboarding=1");
    }
  }, [redirectAction, setLocation]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading timetable configuration...</p>
        </div>
      </div>
    );
  }

  // Show loading state when redirecting to prevent flash
  if (redirectAction === 'redirect-to-settings') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to timetable setup...</p>
        </div>
      </div>
    );
  }

  // Show locked screen for non-admin users when not configured
  if (redirectAction === 'show-locked') {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <Lock className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-xl text-orange-800">
                Timetable Configuration Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="space-y-2">
                <p className="text-orange-700">
                  Your school's timetable structure needs to be configured before you can access timetable features.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Please contact your school administrator to complete the setup.</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-orange-200">
                <h4 className="font-medium text-orange-800 mb-2">Required Configuration:</h4>
                <ul className="text-sm text-orange-700 space-y-1 text-left max-w-md mx-auto">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    Working days for the school
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    Class periods and timing
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    Break schedules
                  </li>
                </ul>
              </div>

              <div className="pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setLocation("/dashboard")}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If configured or admin being redirected, show the children
  return <>{children}</>;
}