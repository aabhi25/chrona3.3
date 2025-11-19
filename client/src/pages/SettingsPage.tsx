import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/ThemeProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, User, Mail, Lock, Database, Globe, Save, UserX, RefreshCw, GraduationCap, Phone, Calendar, MapPin, Users, BookOpen, CalendarDays, Plus, CheckCircle, Clock, ArrowRight, Settings as SettingsIcon, Loader2, Upload, FileSpreadsheet, Key, Trash2, Edit, RotateCw, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  // Update profile form when user data loads
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
  }, [user]);



  // School Settings state (Admin only)
  const [schoolSettingsForm, setSchoolSettingsForm] = useState({
    defaultMaxPeriodsPerDay: 6
  });

  // OpenAI API Key state (Admin only)
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isEditingOpenaiKey, setIsEditingOpenaiKey] = useState(false);

  // Timetable structure check
  const [showTimetableAlert, setShowTimetableAlert] = useState(false);

  // Database download state (Super Admin only)
  const [isDownloadingDatabase, setIsDownloadingDatabase] = useState(false);

  // Clear School Data state (Admin only)
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [clearDataPassword, setClearDataPassword] = useState("");
  
  // Query to check if timetable structure exists
  const { data: timetableStructure, isLoading: timetableLoading, isError: timetableError } = useQuery({
    queryKey: ["/api/timetable-structure"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/timetable-structure");
      return await response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const passwordChangeMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("PUT", "/api/auth/password", passwordData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangingPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Update school settings mutation
  const updateSchoolSettingsMutation = useMutation({
    mutationFn: async (settingsData: { defaultMaxPeriodsPerDay: number }) => {
      if (!user?.schoolId) throw new Error("School ID not found");
      const response = await apiRequest("PATCH", `/api/schools/${user.schoolId}/settings`, settingsData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "School settings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update school settings",
        variant: "destructive",
      });
    },
  });

  // Fetch school data for admin users
  const { data: schoolData, isLoading: loadingSchool } = useQuery({
    queryKey: ["/api/schools", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const response = await apiRequest("GET", `/api/schools/${user.schoolId}`);
      return await response.json();
    },
    enabled: (user?.role === 'admin' || user?.role === 'super_admin') && !!user?.schoolId
  });

  // Update school settings form when school data loads
  useEffect(() => {
    if (schoolData) {
      setSchoolSettingsForm({
        defaultMaxPeriodsPerDay: schoolData.defaultMaxPeriodsPerDay || 6
      });
    }
  }, [schoolData]);


  // Fetch OpenAI API Key status for school admin
  const { data: openaiKeyData } = useQuery({
    queryKey: ["/api/school/openai-api-key"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/school/openai-api-key");
      return await response.json();
    },
    enabled: user?.role === 'admin'
  });

  // Update OpenAI API Key mutation
  const updateOpenaiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await apiRequest("PUT", "/api/school/openai-api-key", { apiKey });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "OpenAI API key updated successfully",
      });
      setIsEditingOpenaiKey(false);
      setOpenaiApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/school/openai-api-key"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update OpenAI API key",
        variant: "destructive",
      });
    },
  });








  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordForm.currentPassword) {
      toast({
        title: "Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!passwordForm.newPassword) {
      toast({
        title: "Error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Error", 
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    passwordChangeMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const profileUpdateMutation = useMutation({
    mutationFn: async (profileData: { firstName: string; lastName: string; email?: string }) => {
      const response = await apiRequest("PUT", "/api/auth/profile", profileData);
      return await response.json();
    },
    onSuccess: (updatedUser) => {
      // Update the user data in cache
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });
  // Clear school data mutation (Admin only)
  const clearSchoolDataMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/school/clear-data", { password });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All school data cleared successfully. You can now start fresh.",
      });
      setShowPasswordDialog(false);
      setClearDataPassword("");
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      // Optionally refresh the page after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear school data",
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileForm.firstName.trim()) {
      toast({
        title: "Error",
        description: "First name is required",
        variant: "destructive",
      });
      return;
    }
    
    // Build update payload - only include email if it has a value
    const updatePayload: any = {
      firstName: profileForm.firstName,
      lastName: profileForm.lastName
    };
    
    if (profileForm.email && profileForm.email.trim()) {
      updatePayload.email = profileForm.email;
    }
    
    profileUpdateMutation.mutate(updatePayload);
  };


  // Clear School Data handlers
  const handleConfirmClearData = () => {
    setShowClearDataConfirm(false);
    setShowPasswordDialog(true);
  };

  const handleClearData = () => {
    if (!clearDataPassword) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }
    clearSchoolDataMutation.mutate(clearDataPassword);
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-3xl font-bold mb-1">Settings</h2>
            <p className="text-lg text-muted-foreground">Manage your account and system preferences</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto space-y-2">
          
          {/* Profile Information - Only for non-student roles */}
          {user?.role !== 'student' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      data-testid="input-email"
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={profileUpdateMutation.isPending}
                    data-testid="button-update-profile"
                  >
                    {profileUpdateMutation.isPending ? "Updating..." : "Update Profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <div className="space-y-2">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">
                      Last changed: {user?.passwordChangedAt 
                        ? new Date(user.passwordChangedAt).toLocaleString() 
                        : "Never (use this to set a new password)"}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsChangingPassword(true)}
                    data-testid="button-change-password"
                  >
                    Change Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-2">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      data-testid="input-current-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      data-testid="input-new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      type="submit" 
                      disabled={passwordChangeMutation.isPending}
                      data-testid="button-save-password"
                    >
                      {passwordChangeMutation.isPending ? "Changing..." : "Save Password"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsChangingPassword(false)}
                      data-testid="button-cancel-password"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>System Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Role</Label>
                    <p className="text-sm text-muted-foreground capitalize">
                      {user?.role?.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Account Created</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">User ID</Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {user?.id}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Application Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <h4 className="font-medium">Theme</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose your preferred theme
                  </p>
                  <div className="flex space-x-2">
                    <Button 
                      variant={theme === "light" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("light")}
                      data-testid="button-theme-light"
                    >
                      Light
                    </Button>
                    <Button 
                      variant={theme === "dark" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("dark")}
                      data-testid="button-theme-dark"
                    >
                      Dark
                    </Button>
                    <Button 
                      variant={theme === "system" ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setTheme("system")}
                      data-testid="button-theme-system"
                    >
                      System
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Bulk Upload - Admin only */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <div className="flex items-baseline space-x-1">
                    <span>Smart Upload</span>
                    <span className="text-sm font-normal text-muted-foreground">(Students, Teachers & Class Subjects)</span>
                  </div>
                </CardTitle>
                <CardDescription>
                  Upload multiple teachers, students, and class-subject assignments at once using an Excel file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-start space-x-4 p-4 border rounded-lg">
                    <FileSpreadsheet className="h-8 w-8 text-primary mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Import from Excel</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload an Excel file containing teachers, students, and their class-subject assignments. The system will validate the data and allow you to review before importing.
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                        <li>• Auto-validates data against existing records</li>
                        <li>• Creates teacher and student user accounts automatically</li>
                        <li>• Auto-creates subjects if they don't exist</li>
                        <li>• Review and edit data before final import</li>
                      </ul>
                      <Button 
                        onClick={() => {
                          // Check if timetable structure is configured
                          if (!timetableLoading && !timetableStructure) {
                            setShowTimetableAlert(true);
                            return;
                          }
                          
                          // If structure exists or still loading, proceed
                          setLocation('/settings/bulk-upload');
                        }}
                        disabled={timetableLoading}
                      >
                        {timetableLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Start Smart Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clear School Data - Admin Only */}
          {user?.role === 'admin' && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <Trash2 className="h-5 w-5" />
                  <span>Clear School Data</span>
                </CardTitle>
                <CardDescription>
                  Remove all school data and start fresh. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">⚠️ Warning</h4>
                    <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                      This action will permanently delete all of the following data:
                    </p>
                    <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 mb-4 ml-4">
                      <li>• All teachers and their records</li>
                      <li>• All students and their records</li>
                      <li>• All classes and subjects</li>
                      <li>• All timetables and schedules</li>
                      <li>• All fees, transport, and other management data</li>
                    </ul>
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      ✓ Your admin login and academic sessions will be preserved
                    </p>
                  </div>
                  
                  <AlertDialog open={showClearDataConfirm} onOpenChange={setShowClearDataConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All School Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>
                            This action will permanently delete all school data including teachers, students, 
                            classes, timetables, and all other records.
                          </p>
                          <p className="font-medium text-foreground">
                            Your admin account and academic sessions will be preserved so you can start fresh.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleConfirmClearData}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Yes, Clear All Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Password Verification Dialog */}
                  <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Verify Your Password</DialogTitle>
                        <DialogDescription>
                          Please enter your admin password to confirm this action.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="clearDataPassword">Admin Password</Label>
                          <Input
                            id="clearDataPassword"
                            type="password"
                            value={clearDataPassword}
                            onChange={(e) => setClearDataPassword(e.target.value)}
                            placeholder="Enter your password"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleClearData();
                              }
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowPasswordDialog(false);
                            setClearDataPassword("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleClearData}
                          disabled={clearSchoolDataMutation.isPending || !clearDataPassword}
                        >
                          {clearSchoolDataMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Clear All Data
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OpenAI API Key Management - School Admin Only */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>OpenAI API Key (AI Features)</span>
                </CardTitle>
                <CardDescription>
                  Configure your school's OpenAI API key to power AI features like Chroney AI assistant, smart timetable generation, and other AI-powered tools
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 p-4">
                  <div className="flex items-start space-x-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        School-Specific API Key
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        This API key will be used exclusively for your school. All AI features including Chroney AI, teacher planner, and smart timetable will use this key for all users (teachers, students, parents) in your school.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">API Key Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {openaiKeyData?.hasApiKey 
                          ? `Configured: ${openaiKeyData.maskedApiKey}` 
                          : "Not configured - AI features will be unavailable"}
                      </p>
                    </div>
                    <Badge variant={openaiKeyData?.hasApiKey ? "default" : "secondary"}>
                      {openaiKeyData?.hasApiKey ? "Active" : "Not Set"}
                    </Badge>
                  </div>

                  {!isEditingOpenaiKey ? (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setIsEditingOpenaiKey(true)}
                        variant="outline"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {openaiKeyData?.hasApiKey ? "Update API Key" : "Add API Key"}
                      </Button>
                      {openaiKeyData?.hasApiKey && (
                        <Button
                          onClick={() => updateOpenaiKeyMutation.mutate("")}
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Key
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="space-y-2">
                        <Label htmlFor="openaiApiKey">
                          OpenAI API Key
                        </Label>
                        <Input
                          id="openaiApiKey"
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          placeholder="sk-..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => updateOpenaiKeyMutation.mutate(openaiApiKey)}
                          disabled={updateOpenaiKeyMutation.isPending || !openaiApiKey.startsWith('sk-')}
                        >
                          {updateOpenaiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {openaiKeyData?.hasApiKey ? "Update Key" : "Save Key"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingOpenaiKey(false);
                            setOpenaiApiKey("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Features Powered by OpenAI:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Chroney AI - Intelligent school assistant</li>
                    <li>• Teacher Planner - AI-powered staffing optimization</li>
                    <li>• Smart Timetable - AI-assisted schedule generation</li>
                    <li>• Analytics & Insights - Data-driven recommendations</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Super Admin Section */}
          {user?.role === 'super_admin' && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span>Super Admin Tools</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Advanced system management tools (super admin only)
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Database Backup</h4>
                  <p className="text-sm text-muted-foreground">
                    Download a complete backup of the database including schema and all data in SQL format.
                  </p>
                  <Button
                    onClick={async () => {
                      try {
                        setIsDownloadingDatabase(true);
                        
                        toast({
                          title: "Preparing Download",
                          description: "Exporting database... This may take a minute for large databases.",
                        });

                        // Get auth token from localStorage
                        const token = localStorage.getItem("authToken");
                        if (!token) {
                          throw new Error("Authentication required. Please log in again.");
                        }

                        // Use native fetch instead of apiRequest to handle streaming response
                        const response = await fetch("/api/super-admin/download-database", {
                          method: "GET",
                          credentials: "include",
                          headers: {
                            "Authorization": `Bearer ${token}`,
                            "Accept": "application/sql",
                          },
                        });
                        
                        if (!response.ok) {
                          const error = await response.json().catch(() => ({ message: "Failed to download database" }));
                          throw new Error(error.message || "Failed to download database");
                        }

                        // Get filename from Content-Disposition header or use default
                        const contentDisposition = response.headers.get('Content-Disposition');
                        let filename = 'chrona_database.sql';
                        if (contentDisposition) {
                          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                          if (filenameMatch) {
                            filename = filenameMatch[1];
                          }
                        }

                        // Convert response to blob and download
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        
                        // Clean up
                        setTimeout(() => {
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        }, 100);

                        toast({
                          title: "Success",
                          description: `Database backup downloaded successfully as ${filename}`,
                        });
                      } catch (error) {
                        console.error("Database download error:", error);
                        toast({
                          title: "Error",
                          description: error instanceof Error ? error.message : "Failed to download database backup",
                          variant: "destructive",
                        });
                      } finally {
                        setIsDownloadingDatabase(false);
                      }
                    }}
                    disabled={isDownloadingDatabase}
                    className="flex items-center space-x-2"
                  >
                    {isDownloadingDatabase ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Exporting Database...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Download Database</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timetable Structure Check Alert */}
          <AlertDialog open={showTimetableAlert} onOpenChange={setShowTimetableAlert}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  Timetable Structure Not Configured
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Before you can use Smart Upload, you need to configure your school's timetable structure first.
                  </p>
                  <p className="text-sm">
                    The timetable structure includes:
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                    <li>Working days (Monday-Saturday)</li>
                    <li>Number of periods per day</li>
                    <li>Time slots for each period</li>
                    <li>Break periods</li>
                  </ul>
                  <p className="text-sm font-medium">
                    This ensures proper class-subject assignments during the import process.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  setShowTimetableAlert(false);
                  setLocation('/timetable/settings');
                }}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Configure Timetable Structure
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>

      </div>
    </div>
  );
}