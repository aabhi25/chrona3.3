import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Truck, MapPin, Users, Route, Plus, Search, Filter, Edit, Trash2, Eye, Info, Bus, IndianRupee, Lightbulb } from "lucide-react";

// Schema definitions
const transportRouteSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  description: z.string().optional(),
  startLocation: z.string().min(1, "Start location is required"),
  endLocation: z.string().min(1, "End location is required"),
  estimatedDuration: z.number().min(1, "Duration must be greater than 0"),
  isActive: z.boolean().default(true),
});

const transportVehicleSchema = z.object({
  vehicleNumber: z.string().min(1, "Vehicle number is required"),
  vehicleType: z.enum(["bus", "van", "car"]),
  capacity: z.number().min(1, "Capacity must be greater than 0"),
  driverName: z.string().min(1, "Driver name is required"),
  driverContact: z.string().min(1, "Driver contact is required"),
  isActive: z.boolean().default(true),
});

const studentAssignmentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  routeId: z.string().min(1, "Route is required"),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Dropoff location is required"),
  isActive: z.boolean().default(true),
});

const transportStopSchema = z.object({
  name: z.string().min(1, "Stop name is required"),
  latitude: z.coerce.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180).max(180, "Invalid longitude"),
  routeId: z.string().min(1, "Route is required"),
  stopOrder: z.coerce.number().min(1, "Stop order must be greater than 0"),
  isActive: z.boolean().default(true),
});

type TransportRouteFormData = z.infer<typeof transportRouteSchema>;
type TransportVehicleFormData = z.infer<typeof transportVehicleSchema>;
type StudentAssignmentFormData = z.infer<typeof studentAssignmentSchema>;
type TransportStopFormData = z.infer<typeof transportStopSchema>;

interface TransportRoute {
  id: string;
  name: string;
  description?: string;
  startLocation: string;
  endLocation: string;
  estimatedDuration: number;
  isActive: boolean;
  schoolId: string;
  createdAt: string;
}

interface TransportVehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  capacity: number;
  driverName: string;
  driverContact: string;
  isActive: boolean;
  schoolId: string;
  createdAt: string;
}

interface StudentAssignment {
  id: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  pickupLocation: string;
  dropoffLocation: string;
  isActive: boolean;
  schoolId: string;
  createdAt: string;
}

interface TransportStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId: string;
  routeName: string;
  stopOrder: number;
  isActive: boolean;
  schoolId: string;
  createdAt: string;
}

export default function TransportManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  
  // State management
  const [isAddRouteDialogOpen, setIsAddRouteDialogOpen] = useState(false);
  const [isAddVehicleDialogOpen, setIsAddVehicleDialogOpen] = useState(false);
  const [isAddStudentAssignmentDialogOpen, setIsAddStudentAssignmentDialogOpen] = useState(false);
  const [isAddStopDialogOpen, setIsAddStopDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);
  const [editingStudentAssignment, setEditingStudentAssignment] = useState<StudentAssignment | null>(null);
  const [editingStop, setEditingStop] = useState<TransportStop | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Queries and mutations
  const { data: routes = [], isLoading: isLoadingRoutes } = useQuery({
    queryKey: ["/api/transport-routes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transport-routes");
      return await response.json() as TransportRoute[];
    },
  });

  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["/api/transport-vehicles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transport-vehicles");
      return await response.json() as TransportVehicle[];
    },
  });

  const { data: studentsResponse } = useQuery<{ students: any[], totalCount: number }>({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/students?limit=10000");
      return await response.json();
    },
  });
  
  const students = studentsResponse?.students || [];

  const { data: studentAssignments = [] } = useQuery({
    queryKey: ["/api/transport-student-assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transport-student-assignments");
      return await response.json() as StudentAssignment[];
    },
  });

  const { data: transportStops = [] } = useQuery({
    queryKey: ["/api/transport-stops"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transport-stops");
      return await response.json() as TransportStop[];
    },
  });

  // Mutations
  const createRouteMutation = useMutation({
    mutationFn: async (data: TransportRouteFormData) => {
      const response = await apiRequest("POST", "/api/transport-routes", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setIsAddRouteDialogOpen(false);
      routeForm.reset();
      toast({
        title: "Success",
        description: "Route created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create route",
        variant: "destructive",
      });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransportRouteFormData }) => {
      const response = await apiRequest("PUT", `/api/transport-routes/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setIsAddRouteDialogOpen(false);
      setEditingRoute(null);
      routeForm.reset();
      toast({
        title: "Success",
        description: "Route updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route",
        variant: "destructive",
      });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/transport-routes/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      toast({
        title: "Success",
        description: "Route deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete route",
        variant: "destructive",
      });
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: TransportVehicleFormData) => {
      const response = await apiRequest("POST", "/api/transport-vehicles", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-vehicles"] });
      setIsAddVehicleDialogOpen(false);
      vehicleForm.reset();
      toast({
        title: "Success",
        description: "Vehicle added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vehicle",
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransportVehicleFormData }) => {
      const response = await apiRequest("PUT", `/api/transport-vehicles/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-vehicles"] });
      setIsAddVehicleDialogOpen(false);
      setEditingVehicle(null);
      vehicleForm.reset();
      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/transport-vehicles/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vehicle",
        variant: "destructive",
      });
    },
  });

  const createStudentAssignmentMutation = useMutation({
    mutationFn: async (data: StudentAssignmentFormData) => {
      const response = await apiRequest("POST", `/api/students/${data.studentId}/assign-transport`, {
        routeId: data.routeId,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        isActive: data.isActive,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-student-assignments"] });
      setIsAddStudentAssignmentDialogOpen(false);
      studentAssignmentForm.reset();
      toast({
        title: "Success",
        description: "Student assigned to transport successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign student",
        variant: "destructive",
      });
    },
  });

  const updateStudentAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StudentAssignmentFormData }) => {
      const response = await apiRequest("PUT", `/api/transport-student-assignments/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-student-assignments"] });
      setIsAddStudentAssignmentDialogOpen(false);
      setEditingStudentAssignment(null);
      studentAssignmentForm.reset();
      toast({
        title: "Success",
        description: "Student assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const deleteStudentAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/transport-student-assignments/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-student-assignments"] });
      toast({
        title: "Success",
        description: "Student assignment deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete assignment",
        variant: "destructive",
      });
    },
  });

  const createStopMutation = useMutation({
    mutationFn: async (data: TransportStopFormData) => {
      const response = await apiRequest("POST", "/api/transport-stops", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-stops"] });
      setIsAddStopDialogOpen(false);
      stopForm.reset();
      toast({
        title: "Success",
        description: "Transport stop created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stop",
        variant: "destructive",
      });
    },
  });

  const updateStopMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransportStopFormData }) => {
      const response = await apiRequest("PUT", `/api/transport-stops/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-stops"] });
      setIsAddStopDialogOpen(false);
      setEditingStop(null);
      stopForm.reset();
      toast({
        title: "Success",
        description: "Transport stop updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stop",
        variant: "destructive",
      });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/transport-stops/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-stops"] });
      toast({
        title: "Success",
        description: "Transport stop deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stop",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const handleRouteSubmit = (data: TransportRouteFormData) => {
    if (editingRoute) {
      updateRouteMutation.mutate({ id: editingRoute.id, data });
    } else {
      createRouteMutation.mutate(data);
    }
  };

  const handleVehicleSubmit = (data: TransportVehicleFormData) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const handleEditRoute = (route: TransportRoute) => {
    setEditingRoute(route);
    routeForm.reset({
      name: route.name,
      description: route.description || "",
      startLocation: route.startLocation,
      endLocation: route.endLocation,
      estimatedDuration: route.estimatedDuration,
      isActive: route.isActive,
    });
    setIsAddRouteDialogOpen(true);
  };

  const handleEditVehicle = (vehicle: TransportVehicle) => {
    setEditingVehicle(vehicle);
    vehicleForm.reset({
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType as "bus" | "van" | "car",
      capacity: vehicle.capacity,
      driverName: vehicle.driverName,
      driverContact: vehicle.driverContact,
      isActive: vehicle.isActive,
    });
    setIsAddVehicleDialogOpen(true);
  };

  const handleStudentAssignmentSubmit = (data: StudentAssignmentFormData) => {
    if (editingStudentAssignment) {
      updateStudentAssignmentMutation.mutate({ id: editingStudentAssignment.id, data });
    } else {
      createStudentAssignmentMutation.mutate(data);
    }
  };

  const handleEditStudentAssignment = (assignment: StudentAssignment) => {
    setEditingStudentAssignment(assignment);
    studentAssignmentForm.reset({
      studentId: assignment.studentId,
      routeId: assignment.routeId,
      pickupLocation: assignment.pickupLocation,
      dropoffLocation: assignment.dropoffLocation,
      isActive: assignment.isActive,
    });
    setIsAddStudentAssignmentDialogOpen(true);
  };

  // Form setup
  const routeForm = useForm<TransportRouteFormData>({
    resolver: zodResolver(transportRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      startLocation: "",
      endLocation: "",
      estimatedDuration: 30,
      isActive: true,
    },
  });

  const vehicleForm = useForm<TransportVehicleFormData>({
    resolver: zodResolver(transportVehicleSchema),
    defaultValues: {
      vehicleNumber: "",
      vehicleType: "bus",
      capacity: 30,
      driverName: "",
      driverContact: "",
      isActive: true,
    },
  });

  const studentAssignmentForm = useForm<StudentAssignmentFormData>({
    resolver: zodResolver(studentAssignmentSchema),
    defaultValues: {
      studentId: "",
      routeId: "",
      pickupLocation: "",
      dropoffLocation: "",
      isActive: true,
    },
  });

  const stopForm = useForm<TransportStopFormData>({
    resolver: zodResolver(transportStopSchema),
    defaultValues: {
      name: "",
      latitude: 0,
      longitude: 0,
      routeId: "",
      stopOrder: 1,
      isActive: true,
    },
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile Header */}
      <div className="md:hidden border-b bg-background px-4 py-3">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight flex items-center gap-2">
              <Bus className="h-6 w-6 text-purple-600" />
              Transport Management
            </h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Transport Management</DialogTitle>
                  <DialogDescription>
                    Comprehensive transport management system for managing routes, vehicles, stops, and student transport assignments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Getting Started</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>Create transport routes with start and end locations</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Add vehicles with driver details and capacity information</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Define stops along each route with precise locations</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Managing Routes & Stops</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Assign students to specific routes and stops</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Track pickup and dropoff locations for each student</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Monitor route capacity and student distribution</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IndianRupee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Transport Fees</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Set up transport fees based on distance or route</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Link transport fees to the Fee Management module</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Generate transport fee invoices for assigned students</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">Your school needs to organize transport for Sector 15 area. Go to Routes → Create "Sector 15 Route" → Vehicles → Add bus details → Stops → Add pickup points → Students → Assign students to this route with their nearest stop!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage transport routes, vehicles, and students
          </p>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block p-4 lg:p-6 border-b">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bus className="h-6 w-6 text-purple-600" />
            Transport Management
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Transport Management</DialogTitle>
                  <DialogDescription>
                    Comprehensive transport management system for managing routes, vehicles, stops, and student transport assignments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Getting Started</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>Create transport routes with start and end locations</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Add vehicles with driver details and capacity information</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Define stops along each route with precise locations</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Managing Routes & Stops</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Assign students to specific routes and stops</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Track pickup and dropoff locations for each student</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Monitor route capacity and student distribution</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IndianRupee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Transport Fees</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Set up transport fees based on distance or route</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Link transport fees to the Fee Management module</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Generate transport fee invoices for assigned students</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">Your school needs to organize transport for Sector 15 area. Go to Routes → Create "Sector 15 Route" → Vehicles → Add bus details → Stops → Add pickup points → Students → Assign students to this route with their nearest stop!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage transport routes, vehicles, and student assignments
          </p>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-4 lg:p-6">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
          <div className="border-b">
            <TabsList className="flex flex-wrap justify-start bg-transparent p-0 h-auto w-full">
              <TabsTrigger value="overview" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Overview</TabsTrigger>
              <TabsTrigger value="routes" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Routes</TabsTrigger>
              <TabsTrigger value="vehicles" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Vehicles</TabsTrigger>
              <TabsTrigger value="stops" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Stops</TabsTrigger>
              <TabsTrigger value="students" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Students</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Routes Card - Blue */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                    <Route className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Routes</p>
                  <p className="text-3xl font-bold text-gray-900">{routes.filter(r => r.isActive).length}</p>
                  <p className="text-xs text-gray-500 mt-2">Active transport routes</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Vehicles Card - Orange */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md">
                    <Truck className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Vehicles</p>
                  <p className="text-3xl font-bold text-gray-900">{vehicles.filter(v => v.isActive).length}</p>
                  <p className="text-xs text-gray-500 mt-2">Available vehicles</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Students Using Transport Card - Purple */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Students Using Transport</p>
                  <p className="text-3xl font-bold text-gray-900">{studentAssignments.length}</p>
                  <p className="text-xs text-gray-500 mt-2">Active assignments</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Total Stops Card - Green */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Stops</p>
                  <p className="text-3xl font-bold text-gray-900">{transportStops.filter(stop => stop.isActive).length}</p>
                  <p className="text-xs text-gray-500 mt-2">Pickup/drop stops</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routes" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => { 
                setEditingRoute(null); 
                routeForm.reset(); 
                setIsAddRouteDialogOpen(true); 
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Route
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transport Routes</CardTitle>
                  <CardDescription>
                    Manage transport routes and their stops
                  </CardDescription>
                </div>
                <Dialog open={isAddRouteDialogOpen} onOpenChange={setIsAddRouteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingRoute(null); routeForm.reset(); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Route
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingRoute ? "Edit Route" : "Add New Route"}</DialogTitle>
                      <DialogDescription>
                        {editingRoute ? "Update the route details below." : "Create a new transport route for your school."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...routeForm}>
                      <form onSubmit={routeForm.handleSubmit(handleRouteSubmit)} className="space-y-2">
                        <FormField
                          control={routeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Route Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., North Zone Route" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={routeForm.control}
                            name="startLocation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Location</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Main Gate" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={routeForm.control}
                            name="endLocation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Location</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., School" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={routeForm.control}
                          name="estimatedDuration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estimated Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={routeForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional route description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddRouteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={createRouteMutation.isPending || updateRouteMutation.isPending}
                          >
                            {createRouteMutation.isPending || updateRouteMutation.isPending ? "Saving..." : editingRoute ? "Update" : "Create"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder="Search routes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                {isLoadingRoutes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : routes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No routes found. Create your first transport route to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route Name</TableHead>
                        <TableHead>Start → End</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routes
                        .filter(route => 
                          route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          route.startLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          route.endLocation.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((route) => (
                          <TableRow key={route.id}>
                            <TableCell className="font-medium">{route.name}</TableCell>
                            <TableCell>{route.startLocation} → {route.endLocation}</TableCell>
                            <TableCell>{route.estimatedDuration} min</TableCell>
                            <TableCell>
                              <Badge variant={route.isActive ? "default" : "secondary"}>
                                {route.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditRoute(route)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Route</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{route.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <DialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteRouteMutation.mutate(route.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </DialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => { 
                setEditingVehicle(null); 
                vehicleForm.reset(); 
                setIsAddVehicleDialogOpen(true); 
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Vehicles</CardTitle>
                  <CardDescription>
                    Manage vehicle information and driver assignments
                  </CardDescription>
                </div>
                <Dialog open={isAddVehicleDialogOpen} onOpenChange={setIsAddVehicleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingVehicle(null); vehicleForm.reset(); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Vehicle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
                      <DialogDescription>
                        {editingVehicle ? "Update the vehicle details below." : "Register a new vehicle for transport services."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...vehicleForm}>
                      <form onSubmit={vehicleForm.handleSubmit(handleVehicleSubmit)} className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={vehicleForm.control}
                            name="vehicleNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vehicle Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., KA-05-1234" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={vehicleForm.control}
                            name="vehicleType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vehicle Type</FormLabel>
                                <FormControl>
                                  <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="bus">Bus</option>
                                    <option value="van">Van</option>
                                    <option value="car">Car</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={vehicleForm.control}
                          name="capacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Seating Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={vehicleForm.control}
                            name="driverName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Driver Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Full name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={vehicleForm.control}
                            name="driverContact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Driver Contact</FormLabel>
                                <FormControl>
                                  <Input placeholder="Phone number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddVehicleDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                          >
                            {createVehicleMutation.isPending || updateVehicleMutation.isPending ? "Saving..." : editingVehicle ? "Update" : "Add"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder="Search vehicles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                {isLoadingVehicles ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No vehicles registered. Add your first vehicle to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles
                        .filter(vehicle => 
                          vehicle.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehicle.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehicle.vehicleType.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((vehicle) => (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium">{vehicle.vehicleNumber}</TableCell>
                            <TableCell className="capitalize">{vehicle.vehicleType}</TableCell>
                            <TableCell>{vehicle.capacity} students</TableCell>
                            <TableCell>{vehicle.driverName}</TableCell>
                            <TableCell>{vehicle.driverContact}</TableCell>
                            <TableCell>
                              <Badge variant={vehicle.isActive ? "default" : "secondary"}>
                                {vehicle.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditVehicle(vehicle)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete vehicle "{vehicle.vehicleNumber}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <DialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </DialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => { 
                setEditingStudentAssignment(null); 
                studentAssignmentForm.reset(); 
                setIsAddStudentAssignmentDialogOpen(true);
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Assign Student
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Transport Assignments</CardTitle>
                  <CardDescription>
                    Assign students to transport routes and manage their pickup/dropoff locations
                  </CardDescription>
                </div>
                <Dialog open={isAddStudentAssignmentDialogOpen} onOpenChange={setIsAddStudentAssignmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingStudentAssignment(null); studentAssignmentForm.reset(); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Assign Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingStudentAssignment ? "Edit Assignment" : "Assign Student to Transport"}</DialogTitle>
                      <DialogDescription>
                        {editingStudentAssignment ? "Update the student transport assignment." : "Assign a student to a transport route with pickup and dropoff locations."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...studentAssignmentForm}>
                      <form onSubmit={studentAssignmentForm.handleSubmit(handleStudentAssignmentSubmit)} className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={studentAssignmentForm.control}
                            name="studentId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Student</FormLabel>
                                <FormControl>
                                  <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select Student</option>
                                    {students.map((student: any) => (
                                      <option key={student.id} value={student.id}>
                                        {student.name} ({student.rollNumber})
                                      </option>
                                    ))}
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={studentAssignmentForm.control}
                            name="routeId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transport Route</FormLabel>
                                <FormControl>
                                  <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select Route</option>
                                    {routes.filter(r => r.isActive).map((route) => (
                                      <option key={route.id} value={route.id}>
                                        {route.name} ({route.startLocation} → {route.endLocation})
                                      </option>
                                    ))}
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={studentAssignmentForm.control}
                            name="pickupLocation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pickup Location</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Main Street Stop" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={studentAssignmentForm.control}
                            name="dropoffLocation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dropoff Location</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., School Gate" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddStudentAssignmentDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={createStudentAssignmentMutation.isPending || updateStudentAssignmentMutation.isPending}
                          >
                            {createStudentAssignmentMutation.isPending || updateStudentAssignmentMutation.isPending ? "Saving..." : editingStudentAssignment ? "Update" : "Assign"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder="Search student assignments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                {studentAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No student assignments found. Assign your first student to a transport route to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Pickup Location</TableHead>
                        <TableHead>Dropoff Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentAssignments
                        .filter(assignment => 
                          assignment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          assignment.routeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          assignment.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          assignment.dropoffLocation.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">{assignment.studentName}</TableCell>
                            <TableCell>{assignment.routeName}</TableCell>
                            <TableCell>{assignment.pickupLocation}</TableCell>
                            <TableCell>{assignment.dropoffLocation}</TableCell>
                            <TableCell>
                              <Badge variant={assignment.isActive ? "default" : "secondary"}>
                                {assignment.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStudentAssignment(assignment)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove the transport assignment for "{assignment.studentName}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <DialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteStudentAssignmentMutation.mutate(assignment.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </DialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}