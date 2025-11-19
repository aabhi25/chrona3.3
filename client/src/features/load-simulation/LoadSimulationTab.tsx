import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface LoadSimulation {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function LoadSimulationTab() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSimName, setNewSimName] = useState("");
  const [newSimDescription, setNewSimDescription] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [simulationToDelete, setSimulationToDelete] = useState<LoadSimulation | null>(null);

  // Fetch all simulations
  const { data: simulations, isLoading } = useQuery<LoadSimulation[]>({
    queryKey: ["/api/load-simulations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/load-simulations");
      return await response.json();
    },
  });

  // Create simulation mutation
  const createSimulation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest("POST", "/api/load-simulations", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Simulation created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/load-simulations"] });
      setCreateDialogOpen(false);
      setNewSimName("");
      setNewSimDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create simulation",
        variant: "destructive",
      });
    },
  });

  // Delete simulation mutation
  const deleteSimulation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/load-simulations/${id}`);
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Simulation deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/load-simulations"] });
      setDeleteDialogOpen(false);
      setSimulationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete simulation",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (sim: LoadSimulation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSimulationToDelete(sim);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (simulationToDelete) {
      deleteSimulation.mutate(simulationToDelete.id);
    }
  };

  const handleCreateSimulation = () => {
    if (!newSimName.trim()) {
      toast({
        title: "Validation Error",
        description: "Simulation name is required",
        variant: "destructive",
      });
      return;
    }
    createSimulation.mutate({ name: newSimName, description: newSimDescription });
  };

  return (
    <div className="space-y-4">
      {/* Header Section - More Compact */}
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-orange-900 text-lg">Teacher Load Simulation</CardTitle>
          <CardDescription className="text-orange-700 text-sm">
            Create "what-if" scenarios to optimize teacher allocations without affecting your production data.
            Each simulation has its own classes, subjects, and teachers completely separate from your actual school data.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Simulations List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Staffing Simulations</CardTitle>
              <CardDescription className="text-sm">
                Manage and compare different staffing scenarios
              </CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Simulation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : simulations && simulations.filter(sim => sim.name !== "Current School Staffing").length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="text-sm">
                  <TableHead className="py-2">Name</TableHead>
                  <TableHead className="py-2">Description</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                  <TableHead className="py-2">Created</TableHead>
                  <TableHead className="text-right py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulations.filter(sim => sim.name !== "Current School Staffing").map((sim) => (
                  <TableRow 
                    key={sim.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setLocation(`/simulation/${sim.id}`)}
                  >
                    <TableCell className="font-medium py-3">{sim.name}</TableCell>
                    <TableCell className="text-sm text-gray-600 py-3">
                      {sim.description || "NA"}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          sim.status === "draft"
                            ? "bg-gray-100 text-gray-700"
                            : sim.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {sim.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 py-3">
                      {new Date(sim.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDeleteClick(sim, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Plus className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No simulations yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first simulation to start exploring teacher load optimization
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="h-4 w-4 mr-2" />
                Create First Simulation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Simulation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Simulation</DialogTitle>
            <DialogDescription>
              Create a new teacher load simulation scenario. This will not affect your actual school data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sim-name">Simulation Name</Label>
              <Input
                id="sim-name"
                value={newSimName}
                onChange={(e) => setNewSimName(e.target.value)}
                placeholder="e.g., 2025 Staff Optimization"
              />
            </div>
            <div>
              <Label htmlFor="sim-description">Description (Optional)</Label>
              <Input
                id="sim-description"
                value={newSimDescription}
                onChange={(e) => setNewSimDescription(e.target.value)}
                placeholder="Brief description of this scenario"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSimulation}
                disabled={createSimulation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {createSimulation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Simulation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{simulationToDelete?.name}"? This will permanently remove all classes, subjects, and teachers from this simulation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteSimulation.isPending}
              variant="destructive"
            >
              {deleteSimulation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
