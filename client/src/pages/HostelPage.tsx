import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Edit, Building2, DoorOpen, Users, IndianRupee, LogOut, ArrowLeft, Info, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { useLocation } from "wouter";

// Form schemas
const hostelFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  hostelType: z.enum(["boys", "girls", "mixed"]),
  totalRooms: z.string().min(1, "Total rooms required"),
  totalCapacity: z.string().min(1, "Total capacity required"),
  warden: z.string().optional(),
});

const roomFormSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.string().min(0, "Floor is required"),
  capacity: z.string().min(1, "Capacity is required"),
  roomType: z.enum(["single", "double", "triple", "shared"]),
  amenities: z.string().optional(),
  status: z.enum(["available", "occupied", "maintenance"]),
});

const allocationFormSchema = z.object({
  roomId: z.string().min(1, "Room is required"),
  studentId: z.string().min(1, "Student is required"),
  academicSessionId: z.string().min(1, "Academic session is required"),
  allocationDate: z.date(),
});

const feeFormSchema = z.object({
  hostelId: z.string().min(1, "Hostel is required"),
  studentId: z.string().min(1, "Student is required"),
  academicSessionId: z.string().min(1, "Academic session is required"),
  feeAmount: z.string().min(1, "Fee amount is required"),
  feeType: z.enum(["monthly", "quarterly", "yearly", "one_time"]),
  dueDate: z.date(),
});

export default function HostelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [isHostelDialogOpen, setIsHostelDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  
  const [editingHostel, setEditingHostel] = useState<any>(null);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [selectedHostelForRooms, setSelectedHostelForRooms] = useState<string>("");
  const [selectedHostelForAllocation, setSelectedHostelForAllocation] = useState<string>("all");
  
  const [allocationFilter, setAllocationFilter] = useState<string>("active");
  const [feeStatusFilter, setFeeStatusFilter] = useState<string>("all");
  const [feeSessionFilter, setFeeSessionFilter] = useState<string>("all");

  // Fetch hostels
  const { data: hostels = [], isLoading: hostelsLoading } = useQuery({
    queryKey: ["/api/hostels"],
    queryFn: async () => {
      const response = await fetch("/api/hostels", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch hostels");
      return response.json();
    },
  });

  // Fetch users (for warden selection)
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch students
  const { data: studentsData } = useQuery<any>({
    queryKey: ["/api/students"],
  });
  const students = (studentsData as any)?.students || [];

  // Fetch academic sessions
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["/api/academic-sessions"],
  });

  // Fetch rooms for selected hostel
  const { data: rooms = [] } = useQuery({
    queryKey: ["/api/hostels", selectedHostelForRooms, "rooms"],
    queryFn: async () => {
      if (!selectedHostelForRooms) return [];
      const response = await fetch(`/api/hostels/${selectedHostelForRooms}/rooms`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch rooms");
      return response.json();
    },
    enabled: !!selectedHostelForRooms,
  });

  // Fetch allocations
  const { data: allocations = [] } = useQuery({
    queryKey: ["/api/hostel-allocations", allocationFilter, selectedHostelForAllocation],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (allocationFilter === "active") params.append("isActive", "true");
      if (allocationFilter === "inactive") params.append("isActive", "false");
      if (selectedHostelForAllocation) params.append("hostelId", selectedHostelForAllocation);
      
      const response = await fetch(`/api/hostel-allocations?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch allocations");
      return response.json();
    },
  });

  // Fetch fees
  const { data: fees = [] } = useQuery({
    queryKey: ["/api/hostel-fees", feeStatusFilter, feeSessionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feeStatusFilter) params.append("paymentStatus", feeStatusFilter);
      if (feeSessionFilter) params.append("sessionId", feeSessionFilter);
      
      const response = await fetch(`/api/hostel-fees?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch fees");
      return response.json();
    },
  });

  // Hostel form
  const hostelForm = useForm<z.infer<typeof hostelFormSchema>>({
    resolver: zodResolver(hostelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      hostelType: "boys",
      totalRooms: "",
      totalCapacity: "",
      warden: "",
    },
  });

  // Room form
  const roomForm = useForm<z.infer<typeof roomFormSchema>>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      roomNumber: "",
      floor: "0",
      capacity: "",
      roomType: "single",
      amenities: "",
      status: "available",
    },
  });

  // Allocation form
  const allocationForm = useForm<z.infer<typeof allocationFormSchema>>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      roomId: "",
      studentId: "",
      academicSessionId: "",
      allocationDate: new Date(),
    },
  });

  // Fee form
  const feeForm = useForm<z.infer<typeof feeFormSchema>>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: {
      hostelId: "",
      studentId: "",
      academicSessionId: "",
      feeAmount: "",
      feeType: "monthly",
      dueDate: new Date(),
    },
  });

  // Create/Update Hostel
  const hostelMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingHostel ? `/api/hostels/${editingHostel.id}` : "/api/hostels";
      const method = editingHostel ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          totalRooms: parseInt(data.totalRooms),
          totalCapacity: parseInt(data.totalCapacity),
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save hostel");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostels"] });
      setIsHostelDialogOpen(false);
      setEditingHostel(null);
      hostelForm.reset();
      toast({ title: `Hostel ${editingHostel ? "updated" : "created"} successfully` });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Delete Hostel
  const deleteHostelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hostels/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete hostel");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostels"] });
      toast({ title: "Hostel deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete hostel", variant: "destructive" });
    },
  });

  // Create/Update Room
  const roomMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingRoom 
        ? `/api/hostel-rooms/${editingRoom.id}` 
        : `/api/hostels/${selectedHostelForRooms}/rooms`;
      const method = editingRoom ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          floor: parseInt(data.floor),
          capacity: parseInt(data.capacity),
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save room");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostels", selectedHostelForRooms, "rooms"] });
      setIsRoomDialogOpen(false);
      setEditingRoom(null);
      roomForm.reset();
      toast({ title: `Room ${editingRoom ? "updated" : "created"} successfully` });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Delete Room
  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hostel-rooms/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete room");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostels", selectedHostelForRooms, "rooms"] });
      toast({ title: "Room deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete room", variant: "destructive" });
    },
  });

  // Create Allocation
  const allocationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/hostel-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          allocationDate: data.allocationDate.toISOString(),
          isActive: true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create allocation");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostel-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hostels"] });
      setIsAllocationDialogOpen(false);
      allocationForm.reset();
      toast({ title: "Student allocated successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Check out student
  const checkoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hostel-allocations/${id}/checkout`, {
        method: "PUT",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to check out student");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostel-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hostels"] });
      toast({ title: "Student checked out successfully" });
    },
    onError: () => {
      toast({ title: "Failed to check out student", variant: "destructive" });
    },
  });

  // Create Fee
  const feeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/hostel-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          feeAmount: parseFloat(data.feeAmount),
          dueDate: data.dueDate.toISOString(),
          paymentStatus: "pending",
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create fee");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostel-fees"] });
      setIsFeeDialogOpen(false);
      feeForm.reset();
      toast({ title: "Fee created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Mark fee as paid
  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hostel-fees/${id}/pay`, {
        method: "PUT",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark fee as paid");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hostel-fees"] });
      toast({ title: "Fee marked as paid" });
    },
    onError: () => {
      toast({ title: "Failed to mark fee as paid", variant: "destructive" });
    },
  });

  // Calculate occupancy
  const calculateOccupancy = (hostel: any) => {
    const hostelAllocations = allocations.filter(
      (a: any) => a.hostelId === hostel.id && a.isActive
    );
    if (hostel.totalCapacity === 0) return 0;
    return Math.round((hostelAllocations.length / hostel.totalCapacity) * 100);
  };

  // Get room status badge
  const getRoomStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      available: { variant: "default", label: "Available" },
      occupied: { variant: "secondary", label: "Occupied" },
      maintenance: { variant: "destructive", label: "Maintenance" },
    };
    const config = variants[status] || variants.available;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      paid: { variant: "default", label: "Paid" },
      overdue: { variant: "destructive", label: "Overdue" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/more")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-purple-600" />
              Hostel Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Hostel Management</DialogTitle>
                  <DialogDescription>
                    Manage hostels by creating facilities, adding rooms, allocating students, and tracking hostel fees.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Setting Up Hostels</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>Create hostel from Hostels tab (Boys/Girls/Mixed type)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Add total rooms and capacity</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Assign a warden from staff members</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">4.</span>
                        <span>Go to Rooms tab and add individual rooms with capacity and amenities</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Allocating Students</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Go to Allocations tab → Click "Allocate Student"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Select hostel, available room, student, and academic session</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Room status automatically changes to "Occupied"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Use "Check Out" button when student leaves hostel</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IndianRupee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Managing Fees</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Set hostel fees (Monthly/Quarterly/Yearly)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Generate fee receipts from Fees tab</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Mark as "Paid" after collecting payment</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">New student Priya needs hostel accommodation. Go to Allocations → Select "Girls Hostel A" → Choose "Room 201" (capacity 2, 1 vacant) → Select "Priya Kumar" → Set monthly fee ₹5,000 → Allocation done! She gets Room 201.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">Manage hostels, rooms, allocations, and fees</p>
        </div>
        </div>
      </div>

      <Tabs defaultValue="hostels" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hostels">
            <Building2 className="mr-2 h-4 w-4" />
            Hostels
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <DoorOpen className="mr-2 h-4 w-4" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="allocations">
            <Users className="mr-2 h-4 w-4" />
            Allocations
          </TabsTrigger>
          <TabsTrigger value="fees">
            <IndianRupee className="mr-2 h-4 w-4" />
            Fees
          </TabsTrigger>
        </TabsList>

        {/* Hostels Tab */}
        <TabsContent value="hostels" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Hostels</h2>
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <Dialog open={isHostelDialogOpen} onOpenChange={(open) => {
                setIsHostelDialogOpen(open);
                if (!open) {
                  setEditingHostel(null);
                  hostelForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Hostel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingHostel ? "Edit Hostel" : "Create New Hostel"}</DialogTitle>
                  </DialogHeader>
                  <Form {...hostelForm}>
                    <form onSubmit={hostelForm.handleSubmit((data) => hostelMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={hostelForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hostel Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Boys Hostel A" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hostelForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Hostel description..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hostelForm.control}
                        name="hostelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hostel Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="boys">Boys</SelectItem>
                                <SelectItem value="girls">Girls</SelectItem>
                                <SelectItem value="mixed">Mixed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={hostelForm.control}
                          name="totalRooms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Rooms</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="10" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={hostelForm.control}
                          name="totalCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="50" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={hostelForm.control}
                        name="warden"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Warden (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select warden" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name || u.username}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={hostelMutation.isPending}>
                          {hostelMutation.isPending ? "Saving..." : editingHostel ? "Update" : "Create"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hostels.map((hostel: any) => (
              <Card key={hostel.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{hostel.name}</CardTitle>
                      <CardDescription>
                        {hostel.hostelType.charAt(0).toUpperCase() + hostel.hostelType.slice(1)} Hostel
                      </CardDescription>
                    </div>
                    {(user?.role === "admin" || user?.role === "super_admin") && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingHostel(hostel);
                            hostelForm.reset({
                              name: hostel.name,
                              description: hostel.description || "",
                              hostelType: hostel.hostelType,
                              totalRooms: hostel.totalRooms.toString(),
                              totalCapacity: hostel.totalCapacity.toString(),
                              warden: hostel.warden || "",
                            });
                            setIsHostelDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this hostel?")) {
                              deleteHostelMutation.mutate(hostel.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Rooms:</span>
                      <span className="font-medium">{hostel.totalRooms}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Capacity:</span>
                      <span className="font-medium">{hostel.totalCapacity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Occupancy:</span>
                      <span className="font-medium">{calculateOccupancy(hostel)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold">Rooms</h2>
              <Select value={selectedHostelForRooms} onValueChange={setSelectedHostelForRooms}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(user?.role === "admin" || user?.role === "super_admin") && selectedHostelForRooms && (
              <Dialog open={isRoomDialogOpen} onOpenChange={(open) => {
                setIsRoomDialogOpen(open);
                if (!open) {
                  setEditingRoom(null);
                  roomForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Room
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingRoom ? "Edit Room" : "Create New Room"}</DialogTitle>
                  </DialogHeader>
                  <Form {...roomForm}>
                    <form onSubmit={roomForm.handleSubmit((data) => roomMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={roomForm.control}
                          name="roomNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Number</FormLabel>
                              <FormControl>
                                <Input placeholder="101" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roomForm.control}
                          name="floor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Floor</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={roomForm.control}
                          name="capacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="2" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roomForm.control}
                          name="roomType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="single">Single</SelectItem>
                                  <SelectItem value="double">Double</SelectItem>
                                  <SelectItem value="triple">Triple</SelectItem>
                                  <SelectItem value="shared">Shared</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={roomForm.control}
                        name="amenities"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amenities (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="AC, WiFi, Attached Bath" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={roomForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="occupied">Occupied</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={roomMutation.isPending}>
                          {roomMutation.isPending ? "Saving..." : editingRoom ? "Update" : "Create"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {selectedHostelForRooms ? (
            <Card>
              <CardHeader>
                <CardTitle>Rooms</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Number</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Amenities</TableHead>
                      <TableHead>Status</TableHead>
                      {(user?.role === "admin" || user?.role === "super_admin") && (
                        <TableHead>Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room: any) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.roomNumber}</TableCell>
                        <TableCell>{room.floor}</TableCell>
                        <TableCell className="capitalize">{room.roomType}</TableCell>
                        <TableCell>{room.capacity}</TableCell>
                        <TableCell>{room.amenities || "-"}</TableCell>
                        <TableCell>{getRoomStatusBadge(room.status)}</TableCell>
                        {(user?.role === "admin" || user?.role === "super_admin") && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingRoom(room);
                                  roomForm.reset({
                                    roomNumber: room.roomNumber,
                                    floor: room.floor.toString(),
                                    capacity: room.capacity.toString(),
                                    roomType: room.roomType,
                                    amenities: room.amenities || "",
                                    status: room.status,
                                  });
                                  setIsRoomDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this room?")) {
                                    deleteRoomMutation.mutate(room.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Please select a hostel to view rooms
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Allocations Tab */}
        <TabsContent value="allocations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold">Student Allocations</h2>
              <Select value={allocationFilter} onValueChange={setAllocationFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedHostelForAllocation} onValueChange={setSelectedHostelForAllocation}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All hostels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hostels</SelectItem>
                  {hostels.map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Allocate Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Allocate Student to Room</DialogTitle>
                  </DialogHeader>
                  <Form {...allocationForm}>
                    <form onSubmit={allocationForm.handleSubmit((data) => allocationMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={allocationForm.control}
                        name="studentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {students.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.firstName} {s.lastName} ({s.admissionNumber})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={allocationForm.control}
                        name="roomId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Room</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select room" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {hostels.flatMap((h: any) => 
                                  rooms.filter((r: any) => r.hostelId === h.id && r.status === 'available').map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {h.name} - Room {r.roomNumber}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={allocationForm.control}
                        name="academicSessionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Academic Session</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select session" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sessions.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {`${s.startDate.slice(0, 4)}-${s.endDate.slice(2, 4)}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={allocationForm.control}
                        name="allocationDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Allocation Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={allocationMutation.isPending}>
                          {allocationMutation.isPending ? "Allocating..." : "Allocate"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Allocation Date</TableHead>
                    <TableHead>Check-out Date</TableHead>
                    <TableHead>Status</TableHead>
                    {(user?.role === "admin" || user?.role === "super_admin") && (
                      <TableHead>Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation: any) => {
                    const student = students.find((s: any) => s.id === allocation.studentId);
                    const hostel = hostels.find((h: any) => h.id === allocation.hostelId);
                    return (
                      <TableRow key={allocation.id}>
                        <TableCell className="font-medium">
                          {student ? `${student.firstName} ${student.lastName}` : "Unknown"}
                        </TableCell>
                        <TableCell>{hostel?.name || "Unknown"}</TableCell>
                        <TableCell>{allocation.roomNumber || "-"}</TableCell>
                        <TableCell>
                          {allocation.allocationDate ? format(new Date(allocation.allocationDate), "PP") : "-"}
                        </TableCell>
                        <TableCell>
                          {allocation.checkOutDate ? format(new Date(allocation.checkOutDate), "PP") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={allocation.isActive ? "default" : "secondary"}>
                            {allocation.isActive ? "Active" : "Checked Out"}
                          </Badge>
                        </TableCell>
                        {(user?.role === "admin" || user?.role === "super_admin") && (
                          <TableCell>
                            {allocation.isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to check out this student?")) {
                                    checkoutMutation.mutate(allocation.id);
                                  }
                                }}
                              >
                                <LogOut className="mr-2 h-4 w-4" />
                                Check Out
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold">Hostel Fees</h2>
              <Select value={feeStatusFilter} onValueChange={setFeeStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={feeSessionFilter} onValueChange={setFeeSessionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {`${s.startDate.slice(0, 4)}-${s.endDate.slice(2, 4)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Fee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Hostel Fee</DialogTitle>
                  </DialogHeader>
                  <Form {...feeForm}>
                    <form onSubmit={feeForm.handleSubmit((data) => feeMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={feeForm.control}
                        name="hostelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hostel</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select hostel" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {hostels.map((h: any) => (
                                  <SelectItem key={h.id} value={h.id}>
                                    {h.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={feeForm.control}
                        name="studentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {students.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.firstName} {s.lastName} ({s.admissionNumber})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={feeForm.control}
                        name="academicSessionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Academic Session</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select session" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sessions.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {`${s.startDate.slice(0, 4)}-${s.endDate.slice(2, 4)}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={feeForm.control}
                          name="feeAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fee Amount</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="5000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeForm.control}
                          name="feeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fee Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                  <SelectItem value="one_time">One Time</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={feeForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={feeMutation.isPending}>
                          {feeMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fee Records</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Status</TableHead>
                    {(user?.role === "admin" || user?.role === "super_admin") && (
                      <TableHead>Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee: any) => {
                    const student = students.find((s: any) => s.id === fee.studentId);
                    const hostel = hostels.find((h: any) => h.id === fee.hostelId);
                    return (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">
                          {student ? `${student.firstName} ${student.lastName}` : "Unknown"}
                        </TableCell>
                        <TableCell>{hostel?.name || "Unknown"}</TableCell>
                        <TableCell>₹{Number(fee.feeAmount).toFixed(2)}</TableCell>
                        <TableCell className="capitalize">{fee.feeType.replace("_", " ")}</TableCell>
                        <TableCell>
                          {fee.dueDate ? format(new Date(fee.dueDate), "PP") : "-"}
                        </TableCell>
                        <TableCell>
                          {fee.paidDate ? format(new Date(fee.paidDate), "PP") : "-"}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(fee.paymentStatus)}</TableCell>
                        {(user?.role === "admin" || user?.role === "super_admin") && (
                          <TableCell>
                            {fee.paymentStatus === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Mark this fee as paid?")) {
                                    markPaidMutation.mutate(fee.id);
                                  }
                                }}
                              >
                                Mark as Paid
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
