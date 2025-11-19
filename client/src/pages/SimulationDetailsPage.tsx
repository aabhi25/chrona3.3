import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import SimulationGrid from "@/features/load-simulation/SimulationGrid";

interface LoadSimulation {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SimulationDetailsPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: simulation, isLoading } = useQuery<LoadSimulation>({
    queryKey: [`/api/load-simulations/${id}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/load-simulations/${id}`);
      return await response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Simulation Not Found</h2>
          <p className="text-gray-600 mb-4">The simulation you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/teacher-planner?tab=load-simulation")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teacher Planner
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/teacher-planner?tab=load-simulation")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{simulation.name}</h1>
            <p className="text-gray-600">{simulation.description || "No description"}</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            simulation.status === "draft"
              ? "bg-gray-100 text-gray-700"
              : simulation.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {simulation.status}
        </span>
      </div>

      {/* Simulation Grid */}
      <Card className="border-orange-200">
        <CardContent className="p-6">
          <SimulationGrid simulationId={id!} />
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200">
        <CardContent className="pt-6">
          <p className="text-sm text-orange-800">
            <strong>Note:</strong> All data in this simulation is completely isolated from your production data. 
            You can experiment freely without affecting your actual school operations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
