import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagementTable } from "@/components/UserManagementTable";
import { Users, GraduationCap, UserCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState("students");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    setLocation('/');
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/more")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage login credentials for students, teachers, and parents
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Students</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Teachers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student & Parent Credentials</CardTitle>
              <CardDescription>
                Manage login credentials for students and their parents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagementTable role="student" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teacher Credentials</CardTitle>
              <CardDescription>
                Manage login credentials for all teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagementTable role="teacher" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
