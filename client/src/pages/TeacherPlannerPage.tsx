import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import LoadSimulationTab from '@/features/load-simulation/LoadSimulationTab';
import CurrentSchoolStaffing from '@/features/load-simulation/CurrentSchoolStaffing';

export default function TeacherPlannerPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("current-staffing");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'load-simulation') {
      setActiveTab('load-simulation');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/more")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI Teacher Requirement Planner
              </h1>
              <p className="text-sm text-muted-foreground">
                Plan and optimize your school's teaching staff requirements
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-2">
            <TabsTrigger value="current-staffing">Current School Staffing</TabsTrigger>
            <TabsTrigger value="load-simulation">AI Staffing Scenarios</TabsTrigger>
          </TabsList>

          <TabsContent value="current-staffing" className="space-y-6">
            <CurrentSchoolStaffing />
          </TabsContent>

          <TabsContent value="load-simulation" className="space-y-6">
            <LoadSimulationTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
