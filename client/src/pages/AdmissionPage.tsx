import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { sortClasses } from "@shared/classUtils";
import { 
  FileText, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Upload, 
  Download,
  Filter,
  Plus,
  Calendar,
  ArrowLeft,
  Info,
  Users,
  CheckCircle2,
  Lightbulb,
  Trash2
} from "lucide-react";
import { useLocation, useRoute } from "wouter";

const applicationFormSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  parentName: z.string().min(1, "Parent name is required"),
  parentEmail: z.string().email("Invalid email address"),
  parentPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(1, "Address is required"),
  previousSchool: z.string().optional(),
  classAppliedFor: z.string().min(1, "Please select a class"),
  schoolId: z.string(),
  academicSessionId: z.string(),
});

type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

const statusColors = {
  submitted: "bg-amber-500",
  under_review: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

const statusLabels = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdmissionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    classId: "all",
    sessionId: "all",
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("general");
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  
  // Extract application ID from URL using wouter's useRoute
  const [match, params] = useRoute("/admission/:id");
  const applicationId = match ? params.id : null;

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
    enabled: !!user?.schoolId,
  });

  // Fetch academic sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/academic-sessions"],
    enabled: !!user?.schoolId,
  });

  // Fetch admission applications (admin only)
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["/api/admissions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.classId && filters.classId !== "all") params.append("classId", filters.classId);
      if (filters.sessionId && filters.sessionId !== "all") params.append("sessionId", filters.sessionId);
      
      const res = await apiRequest("GET", `/api/admissions?${params}`);
      return await res.json();
    },
    enabled: isAdmin,
  });

  // Fetch selected application details
  const { data: selectedApplication } = useQuery({
    queryKey: ["/api/admissions", applicationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admissions/${applicationId}`);
      return await res.json();
    },
    enabled: !!applicationId,
  });

  // Fetch documents for selected application
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/admissions", applicationId, "documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admissions/${applicationId}/documents`);
      return await res.json();
    },
    enabled: !!applicationId,
  });

  // Form for new application
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      studentName: "",
      dateOfBirth: "",
      gender: "male",
      parentName: "",
      parentEmail: "",
      parentPhone: "",
      address: "",
      previousSchool: "",
      classAppliedFor: "",
      schoolId: user?.schoolId || "",
      academicSessionId: "",
    },
  });

  // Update form when sessions data loads
  useEffect(() => {
    if (sessions && sessions.length > 0 && sessions[0]?.id) {
      form.setValue("academicSessionId", sessions[0].id);
    }
  }, [sessions, form]);

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async (data: ApplicationFormValues) => {
      const res = await apiRequest("POST", "/api/admissions", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Application submitted successfully!",
      });
      setShowApplicationForm(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  // Review application mutation
  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      const res = await apiRequest("PUT", `/api/admissions/${id}/review`, { status, rejectionReason });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Application reviewed successfully!",
      });
      setShowReviewDialog(false);
      setRejectionReason("");
      setLocation("/admission");
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review application",
        variant: "destructive",
      });
    },
  });

  // Document upload handler
  const handleDocumentUpload = async (applicationId: string, file: File, documentType: string) => {
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);

      await apiRequest("POST", `/api/admissions/${applicationId}/documents`, formData);

      toast({
        title: "Success",
        description: "Document uploaded successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admissions", applicationId, "documents"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Document delete mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/admissions/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully!",
      });
      setDocumentToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admissions", applicationId, "documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApplicationFormValues) => {
    createApplicationMutation.mutate(data);
  };

  const confirmApprove = () => {
    if (selectedApplication) {
      reviewApplicationMutation.mutate({
        id: selectedApplication.id,
        status: "approved",
      });
      setShowApproveDialog(false);
    }
  };

  const confirmReject = () => {
    if (selectedApplication) {
      reviewApplicationMutation.mutate({
        id: selectedApplication.id,
        status: "rejected",
        rejectionReason,
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Student Admission Application
            </CardTitle>
            <CardDescription>
              Submit a new admission application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="studentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter student name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="classAppliedFor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class Applied For *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {classes.map((cls: any) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.grade} {cls.section ? `- ${cls.section}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent/Guardian Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter parent name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="parent@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parentPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Phone *</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="previousSchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous School (if any)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter previous school name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter complete address" 
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createApplicationMutation.isPending || !sessions || sessions.length === 0}
                >
                  {createApplicationMutation.isPending ? "Submitting..." : 
                   (!sessions || sessions.length === 0) ? "Loading sessions..." : 
                   "Submit Application"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If viewing a specific application, render detail view as full page
  if (applicationId && selectedApplication) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admission")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">Application Details</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>
              Review and manage this admission application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Student Name</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.studentName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date of Birth</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedApplication.dateOfBirth), "MMM dd, yyyy")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Gender</label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedApplication.gender}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Class Applied For</label>
                  <p className="text-sm text-muted-foreground">
                    {classes.find((c: any) => c.id === selectedApplication.classAppliedFor)?.grade || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Parent Name</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.parentName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Parent Email</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.parentEmail}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Parent Phone</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.parentPhone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Previous School</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.previousSchool || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Address</label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">
                    <Badge className={statusColors[selectedApplication.applicationStatus as keyof typeof statusColors]}>
                      {statusLabels[selectedApplication.applicationStatus as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </div>
                {selectedApplication.rejectionReason && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Rejection Reason</label>
                    <p className="text-sm text-muted-foreground">{selectedApplication.rejectionReason}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-3">Documents</h4>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/30">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{doc.documentName}</span>
                          <Badge variant="outline" className="capitalize">{doc.documentType.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            asChild
                            title="View document"
                          >
                            <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            asChild
                            title="Download document"
                          >
                            <a href={doc.documentUrl} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDocumentToDelete(doc)}
                            title="Delete document"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <label className="text-sm font-medium">Upload Document</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Document Type</label>
                      <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                          <SelectItem value="photo_id">Photo ID</SelectItem>
                          <SelectItem value="transfer_certificate">Transfer Certificate</SelectItem>
                          <SelectItem value="marksheet">Marksheet/Report Card</SelectItem>
                          <SelectItem value="medical_records">Medical Records</SelectItem>
                          <SelectItem value="address_proof">Address Proof</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Select File</label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleDocumentUpload(selectedApplication.id, file, selectedDocType);
                            // Reset file input after upload
                            e.target.value = "";
                          }
                        }}
                        disabled={uploadingDoc}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {selectedApplication.applicationStatus === "submitted" && (
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => setShowApproveDialog(true)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Approve Confirmation Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Application</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve this application? This will change the status to "Approved".
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmApprove}>
                Approve Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this application
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmReject}
                disabled={!rejectionReason.trim()}
              >
                Reject Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Document Confirmation Dialog */}
        <Dialog open={!!documentToDelete} onOpenChange={() => setDocumentToDelete(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this document? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {documentToDelete && (
              <div className="py-4">
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{documentToDelete.documentName}</span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDocumentToDelete(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteDocumentMutation.mutate(documentToDelete.id)}
                disabled={deleteDocumentMutation.isPending}
              >
                {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Otherwise, render the list view
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
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
              <FileText className="h-6 w-6 text-purple-600" />
              Admission Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Admission Management</DialogTitle>
                  <DialogDescription>
                    Process student admission applications by reviewing documents, uploading required files, and approving or rejecting applications.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Processing Applications</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>New applications appear with "Submitted" status</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Click eye icon to view complete application details</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Upload required documents (Birth certificate, Transfer certificate, etc.)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">4.</span>
                        <span>Change status to "Under Review" while verifying documents</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Approving/Rejecting</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Click "Approve" to accept the application</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>If rejecting, provide clear reason (e.g., "Seats full for Class 6")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Parents receive notification via email about the decision</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Use filters to sort by class, session, or status</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">Rahul's parents submit admission for Class 1. You receive application → Upload birth certificate and previous school TC → Verify all details → Click "Approve" → Parent gets admission confirmation email → Student can now be added to the system!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage student admission applications
          </p>
        </div>
        </div>
        <Button onClick={() => setShowApplicationForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Application
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Applications
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.classId}
              onValueChange={(value) => setFilters({ ...filters, classId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.grade} {cls.section ? `- ${cls.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sessionId}
              onValueChange={(value) => setFilters({ ...filters, sessionId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessions.map((session: any) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.startDate} - {session.endDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            {applications.length} application{applications.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No applications found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Parent Details</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app: any) => (
                    <TableRow 
                      key={app.id}
                      onClick={() => setLocation(`/admission/${app.id}`)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">{app.studentName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{app.parentName}</div>
                          <div className="text-muted-foreground">{app.parentEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {classes.find((c: any) => c.id === app.classAppliedFor)?.grade || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[app.applicationStatus as keyof typeof statusColors]}>
                          {statusLabels[app.applicationStatus as keyof typeof statusLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(app.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Application Form Dialog */}
      <Dialog open={showApplicationForm} onOpenChange={setShowApplicationForm}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Admission Application</DialogTitle>
            <DialogDescription>
              Submit a new admission application
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="studentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter student name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="classAppliedFor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Applied For *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortClasses(classes).map((cls: any) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.grade} {cls.section ? `- ${cls.section}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent/Guardian Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter parent name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="parent@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="previousSchool"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous School (if any)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter previous school name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter complete address" 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowApplicationForm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createApplicationMutation.isPending || !sessions || sessions.length === 0}
                >
                  {createApplicationMutation.isPending ? "Submitting..." : 
                   (!sessions || sessions.length === 0) ? "Loading sessions..." : 
                   "Submit Application"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
