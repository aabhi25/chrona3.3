import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@assets/chrona-logo.png";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/first-login-password-change", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Password changed successfully! You can now access the dashboard.",
      });
      
      // Invalidate user auth state to trigger refetch with updated isFirstLogin status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Update the token in localStorage if returned
      if (data.token) {
        localStorage.setItem("authToken", data.token);
      }
      
      // Redirect to dashboard
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      newPassword,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoImage} 
              alt="Chrona Logo" 
              className="h-16 w-auto -mr-2"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Chrona
            </span>
          </div>
          <div className="flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-orange-500 mr-2" />
            <CardTitle>Change Password Required</CardTitle>
          </div>
          <CardDescription>
            This is your first login. Please change your temporary password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-2" data-testid="form-change-password">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-confirm-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </form>
          
          <div className="mt-4 pt-4 border-t dark:border-gray-700/60">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout and Use Portal Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}