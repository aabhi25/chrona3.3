import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TestTube } from "lucide-react";
import { useLocation } from "wouter";
import { TimetableTestSuite } from "@/components/TimetableTestSuite";

export default function TimetableTestPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/timetable")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Timetable
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <TestTube className="h-6 w-6" />
            Timetable Testing Suite
          </h1>
          <p className="text-muted-foreground">
            Comprehensive testing for timetable functionality and data integrity
          </p>
        </div>
      </div>

      {/* Test Suite */}
      <TimetableTestSuite />

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>About These Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <h4 className="font-medium">Test Coverage</h4>
              <p className="text-sm text-muted-foreground">
                This test suite validates critical timetable functionality including:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                <li>• Saturday free period teacher assignments</li>
                <li>• Academic session ID validation and consistency</li>
                <li>• Teacher deletion and reassignment workflows</li>
                <li>• Multiple day assignment operations</li>
                <li>• Free period to subject conversions</li>
                <li>• Data integrity after database operations</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium">Usage Guidelines</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                <li>• Run tests after making timetable changes</li>
                <li>• All tests should pass for a healthy system</li>
                <li>• Failed tests indicate issues requiring attention</li>
                <li>• Tests use authenticated API calls with your current session</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}