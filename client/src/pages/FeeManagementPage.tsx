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
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sortClasses } from "@shared/classUtils";
import { IndianRupee, FileText, CreditCard, Users, Plus, Search, Filter, Edit, Trash2, Eye, Info, Lightbulb, Loader2, CheckCircle2, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Helper function to format academic session display
function formatAcademicSession(session: AcademicSession): string {
  const startYear = new Date(session.startDate).getFullYear();
  const endYear = new Date(session.endDate).getFullYear();
  return `${startYear}-${endYear}`;
}

// Schema definitions
const feeTypeSchema = z.object({
  name: z.string().min(1, "Fee type name is required"),
  description: z.string().optional(),
  category: z.enum(["tuition", "academic", "transport", "activity", "miscellaneous"]),
  isRecurring: z.boolean().default(false),
});

const feeStructureItemSchema = z.object({
  feeTypeId: z.string().min(1, "Fee type is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
  dueDate: z.string().min(1, "Due date is required"),
  lateFeePenalty: z.number().min(0, "Late fee penalty must be non-negative").optional(),
});

const feeStructureSchema = z.object({
  name: z.string().min(1, "Fee structure name is required"),
  description: z.string().optional(),
  academicSessionId: z.string().min(1, "Academic session is required"),
  classIds: z.array(z.string()).min(1, "At least one class must be selected"),
  isActive: z.boolean().default(true),
  items: z.array(feeStructureItemSchema).min(1, "At least one fee item is required"),
});

type FeeTypeFormData = z.infer<typeof feeTypeSchema>;
type FeeStructureFormData = z.infer<typeof feeStructureSchema>;
type FeeStructureItemFormData = z.infer<typeof feeStructureItemSchema>;

interface FeeType {
  id: string;
  name: string;
  description?: string;
  category: string;
  isRecurring: boolean;
  schoolId: string;
  createdAt: string;
}

interface FeeStructure {
  id: string;
  name: string;
  description?: string;
  academicSessionId: string;
  academicSessionName?: string;
  isActive: boolean;
  schoolId: string;
  createdAt: string;
  assignedClasses?: Array<{ id: string; name: string; }>;
  items?: Array<{
    id: string;
    feeTypeId: string;
    feeTypeName: string;
    amount: number;
    dueDate: string;
    lateFeePenalty?: number;
  }>;
}

interface Class {
  id: string;
  name: string;
  grade: string;
  section: string;
}

interface AcademicSession {
  id: string;
  startDate: string;
  endDate: string;
  schoolId: string;
  createdAt?: string;
}

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  classId: string;
  className?: string;
}

interface FeeInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNumber?: string;
  feeStructureId?: string;
  feeStructureName?: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: 'draft' | 'finalized' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  generatedAt: string;
  items?: Array<{
    id: string;
    feeTypeId: string;
    feeTypeName?: string;
    description: string;
    amount: number;
    quantity: number;
    netAmount: number;
    discountAmount?: number;
  }>;
}

interface FeePayment {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  studentId: string;
  studentName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'online';
  reference?: string;
  remarks?: string;
  receivedBy?: string;
}

export default function FeeManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Helper function to format currency (convert paise to rupees)
  const formatCurrency = (amountInPaise: number) => {
    return (amountInPaise / 100).toLocaleString('en-IN');
  };
  
  // Fee Types state
  const [isAddFeeTypeDialogOpen, setIsAddFeeTypeDialogOpen] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Fee Structures state
  const [showFeeStructureForm, setShowFeeStructureForm] = useState(false);
  const [editingFeeStructure, setEditingFeeStructure] = useState<FeeStructure | null>(null);
  const [structureSearchTerm, setStructureSearchTerm] = useState("");
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>("all");
  
  // Fee Invoices state
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("all");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  
  // Fee Payments state
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  
  // Invoice generation state
  const [isGenerateInvoicesDialogOpen, setIsGenerateInvoicesDialogOpen] = useState(false);
  const [selectedFeeStructureId, setSelectedFeeStructureId] = useState("");
  const [generateForAllClasses, setGenerateForAllClasses] = useState(true);
  
  // Payment recording state  
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  
  // Invoice view state
  const [isViewInvoiceDialogOpen, setIsViewInvoiceDialogOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<FeeInvoice | null>(null);
  
  // Payment view state
  const [isViewPaymentDialogOpen, setIsViewPaymentDialogOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  
  // Invoice bulk selection and finalization state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  
  // Invoice delete confirmation state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  // Queries for supporting data
  const { data: schoolInfo } = useQuery({
    queryKey: ["/api/school-info"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/school-info");
      return await response.json();
    },
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["/api/academic-sessions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/academic-sessions");
      return await response.json() as AcademicSession[];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/classes");
      return await response.json() as Class[];
    },
  });

  const { data: studentsResponse } = useQuery<{ students: Student[], totalCount: number }>({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/students?limit=10000");
      return await response.json();
    },
  });
  
  const students = studentsResponse?.students || [];

  // Fee Types queries and mutations
  const { data: feeTypes = [], isLoading: isLoadingFeeTypes, refetch: refetchFeeTypes } = useQuery({
    queryKey: ["/api/fee-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/fee-types");
      return await response.json() as FeeType[];
    },
  });

  // Fee Structures queries and mutations
  const { data: feeStructures = [], isLoading: isLoadingFeeStructures, refetch: refetchFeeStructures } = useQuery({
    queryKey: ["/api/fee-structures"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/fee-structures");
      return await response.json() as FeeStructure[];
    },
  });

  // Fee Invoices queries
  const { data: feeInvoices = [], isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["/api/fee-invoices"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/fee-invoices");
      return await response.json() as FeeInvoice[];
    },
  });

  // Fee Payments queries
  const { data: feePayments = [], isLoading: isLoadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["/api/fee-payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/fee-payments");
      return await response.json() as FeePayment[];
    },
  });

  const createFeeTypeMutation = useMutation({
    mutationFn: async (data: FeeTypeFormData) => {
      const response = await apiRequest("POST", "/api/fee-types", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee type created successfully" });
      refetchFeeTypes();
      setIsAddFeeTypeDialogOpen(false);
      feeTypeForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create fee type",
        variant: "destructive" 
      });
    },
  });

  const updateFeeTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FeeTypeFormData }) => {
      const response = await apiRequest("PUT", `/api/fee-types/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee type updated successfully" });
      refetchFeeTypes();
      setEditingFeeType(null);
      feeTypeForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update fee type",
        variant: "destructive" 
      });
    },
  });

  const deleteFeeTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fee-types/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee type deleted successfully" });
      refetchFeeTypes();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete fee type",
        variant: "destructive" 
      });
    },
  });

  const createFeeStructureMutation = useMutation({
    mutationFn: async (data: FeeStructureFormData) => {
      const response = await apiRequest("POST", "/api/fee-structures", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee structure created successfully" });
      refetchFeeStructures();
      setShowFeeStructureForm(false);
      feeStructureForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create fee structure",
        variant: "destructive" 
      });
    },
  });

  const updateFeeStructureMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FeeStructureFormData }) => {
      const response = await apiRequest("PUT", `/api/fee-structures/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee structure updated successfully" });
      refetchFeeStructures();
      setEditingFeeStructure(null);
      setShowFeeStructureForm(false);
      feeStructureForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update fee structure",
        variant: "destructive" 
      });
    },
  });

  const deleteFeeStructureMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fee-structures/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fee structure deleted successfully" });
      refetchFeeStructures();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete fee structure",
        variant: "destructive" 
      });
    },
  });

  // Invoice generation mutations
  const generateInvoicesMutation = useMutation({
    mutationFn: async (data: { feeStructureId: string; classIds?: string[]; studentIds?: string[] }) => {
      const response = await apiRequest("POST", "/api/fee-invoices/generate", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      const { generated = 0, total = 0, failed = 0 } = data;
      toast({ 
        title: "Success", 
        description: `Generated ${generated} of ${total} invoice(s) successfully${failed > 0 ? ` (${failed} failed)` : ''}` 
      });
      refetchInvoices();
      setIsGenerateInvoicesDialogOpen(false);
      setSelectedFeeStructureId(""); // Reset selection after successful generation
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to generate invoices",
        variant: "destructive" 
      });
    },
  });

  // Finalize invoices mutation
  const finalizeInvoicesMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const response = await apiRequest("PATCH", "/api/fee-invoices/finalize", { invoiceIds });
      return await response.json();
    },
    onSuccess: (data: any) => {
      const { finalized = 0, total = 0, failed = 0 } = data;
      toast({ 
        title: "Success", 
        description: `Finalized ${finalized} of ${total} invoice(s) successfully${failed > 0 ? ` (${failed} failed)` : ''}` 
      });
      refetchInvoices();
      setSelectedInvoiceIds([]); // Clear selection after finalizing
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to finalize invoices",
        variant: "destructive" 
      });
    },
  });

  // Delete invoice mutation (draft only)
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("DELETE", `/api/fee-invoices/${invoiceId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Invoice deleted successfully" 
      });
      refetchInvoices();
      setIsDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete invoice",
        variant: "destructive" 
      });
    },
  });

  // Payment processing mutations
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { 
      invoiceId: string; 
      amount: number; 
      paymentMethod: string; 
      reference?: string; 
      remarks?: string; 
    }) => {
      const response = await apiRequest("POST", "/api/fee-payments", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Payment recorded successfully" });
      refetchPayments();
      refetchInvoices(); // Refresh invoices to update payment status
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to record payment",
        variant: "destructive" 
      });
    },
  });

  // Form setup
  const feeTypeForm = useForm<FeeTypeFormData>({
    resolver: zodResolver(feeTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "tuition",
      isRecurring: false,
    },
  });

  const feeStructureForm = useForm<FeeStructureFormData>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: {
      name: "",
      description: "",
      academicSessionId: "",
      classIds: [],
      isActive: true,
      items: [],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: feeStructureForm.control,
    name: "items",
  });

  // Form handlers
  const handleSubmitFeeType = async (data: FeeTypeFormData) => {
    if (editingFeeType) {
      updateFeeTypeMutation.mutate({ id: editingFeeType.id, data });
    } else {
      createFeeTypeMutation.mutate(data);
    }
  };

  const handleEditFeeType = (feeType: FeeType) => {
    setEditingFeeType(feeType);
    feeTypeForm.reset({
      name: feeType.name,
      description: feeType.description || "",
      category: feeType.category as any,
      isRecurring: feeType.isRecurring,
    });
    setIsAddFeeTypeDialogOpen(true);
  };

  const handleDeleteFeeType = (id: string) => {
    deleteFeeTypeMutation.mutate(id);
  };

  // Fee Structure handlers
  const handleSubmitFeeStructure = async (data: FeeStructureFormData) => {
    if (editingFeeStructure) {
      updateFeeStructureMutation.mutate({ id: editingFeeStructure.id, data });
    } else {
      createFeeStructureMutation.mutate(data);
    }
  };

  const handleEditFeeStructure = (feeStructure: FeeStructure) => {
    setEditingFeeStructure(feeStructure);
    setShowFeeStructureForm(true);
    feeStructureForm.reset({
      name: feeStructure.name,
      description: feeStructure.description || "",
      academicSessionId: feeStructure.academicSessionId,
      classIds: feeStructure.assignedClasses?.map(c => c.id) || [],
      isActive: feeStructure.isActive,
      items: feeStructure.items?.map(item => ({
        feeTypeId: item.feeTypeId,
        amount: item.amount,
        dueDate: item.dueDate,
        lateFeePenalty: item.lateFeePenalty || 0,
      })) || [],
    });
    setShowFeeStructureForm(true);
  };

  const handleDeleteFeeStructure = (id: string) => {
    deleteFeeStructureMutation.mutate(id);
  };

  // Filtering
  const filteredFeeTypes = feeTypes.filter((feeType) => {
    const matchesSearch = feeType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (feeType.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || feeType.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredFeeStructures = feeStructures.filter((structure) => {
    const matchesSearch = structure.name.toLowerCase().includes(structureSearchTerm.toLowerCase()) ||
                         (structure.description || "").toLowerCase().includes(structureSearchTerm.toLowerCase());
    const matchesSession = selectedSessionFilter === "all" || structure.academicSessionId === selectedSessionFilter;
    return matchesSearch && matchesSession;
  });

  const filteredInvoices = feeInvoices.filter((invoice) => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                         (invoice.studentName || "").toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                         (invoice.studentAdmissionNumber || "").toLowerCase().includes(invoiceSearchTerm.toLowerCase());
    const matchesStatus = invoiceStatusFilter === "all" || invoice.status === invoiceStatusFilter;
    const matchesStudent = selectedStudentFilter === "all" || invoice.studentId === selectedStudentFilter;
    
    // Class filtering - find the student and check their class
    let matchesClass = selectedClassFilter === "all";
    if (!matchesClass && students.length > 0) {
      const student = students.find(s => s.id === invoice.studentId);
      matchesClass = student?.classId === selectedClassFilter;
    }
    
    return matchesSearch && matchesStatus && matchesStudent && matchesClass;
  });

  const filteredPayments = feePayments.filter((payment) => {
    const matchesSearch = (payment.invoiceNumber || "").toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                         (payment.studentName || "").toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                         (payment.reference || "").toLowerCase().includes(paymentSearchTerm.toLowerCase());
    const matchesMethod = paymentMethodFilter === "all" || payment.paymentMethod === paymentMethodFilter;
    return matchesSearch && matchesMethod;
  });

  // Form handlers for invoice generation
  const handleGenerateInvoices = async () => {
    if (!selectedFeeStructureId) {
      toast({
        title: "Error",
        description: "Please select a fee structure",
        variant: "destructive"
      });
      return;
    }

    const selectedStructure = feeStructures.find(s => s.id === selectedFeeStructureId);
    if (!selectedStructure) {
      toast({
        title: "Error", 
        description: "Selected fee structure not found",
        variant: "destructive"
      });
      return;
    }

    const data = {
      feeStructureId: selectedFeeStructureId,
      generateFor: generateForAllClasses ? 'all' : 'specific',
      studentIds: !generateForAllClasses ? [] : undefined, // TODO: Add student selection UI
    };

    generateInvoicesMutation.mutate(data);
    // Dialog will close automatically in onSuccess callback after generation completes
  };

  // Handler for finalizing invoices
  const handleFinalizeInvoices = () => {
    if (selectedInvoiceIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one draft invoice to finalize",
        variant: "destructive"
      });
      return;
    }

    // Check if all selected invoices are in draft status
    const selectedInvoices = feeInvoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    const nonDraftInvoices = selectedInvoices.filter(inv => inv.status !== 'draft');
    
    if (nonDraftInvoices.length > 0) {
      toast({
        title: "Error",
        description: `${nonDraftInvoices.length} selected invoice(s) are not in draft status`,
        variant: "destructive"
      });
      return;
    }

    finalizeInvoicesMutation.mutate(selectedInvoiceIds);
  };

  // Handler for selecting/deselecting invoices (only draft invoices can be selected)
  const toggleInvoiceSelection = (invoiceId: string) => {
    const invoice = feeInvoices.find(inv => inv.id === invoiceId);
    // Only allow selection of draft invoices
    if (invoice && invoice.status !== 'draft') {
      return;
    }
    
    setSelectedInvoiceIds(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  // Handler for select/deselect all (only draft invoices)
  const toggleSelectAll = () => {
    const draftInvoices = filteredInvoices.filter(inv => inv.status === 'draft');
    if (selectedInvoiceIds.length === draftInvoices.length && draftInvoices.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(draftInvoices.map(inv => inv.id));
    }
  };

  // Form handlers for payment recording
  const handleRecordPayment = async () => {
    if (!selectedInvoiceId || !paymentAmount) {
      toast({
        title: "Error",
        description: "Please select an invoice and enter payment amount",
        variant: "destructive"
      });
      return;
    }

    const amountInRupees = parseFloat(paymentAmount);
    if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    // Convert rupees to paise (multiply by 100)
    const amountInPaise = Math.round(amountInRupees * 100);

    const selectedInvoice = feeInvoices.find(i => i.id === selectedInvoiceId);
    if (selectedInvoice && amountInPaise > selectedInvoice.balanceAmount) {
      toast({
        title: "Error",
        description: "Payment amount cannot exceed balance amount",
        variant: "destructive"
      });
      return;
    }

    const data = {
      invoiceId: selectedInvoiceId,
      amount: amountInPaise,
      paymentMethod,
      reference: paymentReference || undefined,
      remarks: paymentRemarks || undefined,
    };

    recordPaymentMutation.mutate(data);
    setIsRecordPaymentDialogOpen(false);
    setSelectedInvoiceId("");
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentRemarks("");
  };

  // Download receipt handler
  const handleDownloadReceipt = (payment: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to download receipt",
        variant: "destructive"
      });
      return;
    }

    // Format amount in rupees
    const amountInRupees = formatCurrency(payment.amount);

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${payment.paymentNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #333;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .receipt-details {
              margin: 30px 0;
            }
            .detail-row {
              display: flex;
              padding: 12px 0;
              border-bottom: 1px solid #eee;
            }
            .detail-label {
              font-weight: bold;
              width: 200px;
              color: #555;
            }
            .detail-value {
              flex: 1;
              color: #333;
            }
            .amount-section {
              background: #f5f5f5;
              padding: 20px;
              margin: 30px 0;
              border-radius: 8px;
            }
            .amount {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              text-align: center;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body {
                margin: 0;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>${schoolInfo?.name || 'School'}</p>
            <p>Fee Payment Receipt</p>
          </div>
          
          <div class="receipt-details">
            <div class="detail-row">
              <div class="detail-label">Payment Number:</div>
              <div class="detail-value">${payment.paymentNumber}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Payment Date:</div>
              <div class="detail-value">${new Date(payment.paymentDate).toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Invoice Number:</div>
              <div class="detail-value">${payment.invoiceNumber || 'N/A'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Student Name:</div>
              <div class="detail-value">${payment.studentName || 'N/A'}</div>
            </div>
            ${payment.studentAdmissionNumber ? `
            <div class="detail-row">
              <div class="detail-label">Admission Number:</div>
              <div class="detail-value">${payment.studentAdmissionNumber}</div>
            </div>
            ` : ''}
            <div class="detail-row">
              <div class="detail-label">Payment Method:</div>
              <div class="detail-value">${payment.paymentMethod.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Payment Mode:</div>
              <div class="detail-value">${payment.paymentMode.charAt(0).toUpperCase() + payment.paymentMode.slice(1)}</div>
            </div>
            ${payment.transactionId ? `
            <div class="detail-row">
              <div class="detail-label">Transaction ID:</div>
              <div class="detail-value">${payment.transactionId}</div>
            </div>
            ` : ''}
            ${payment.referenceNumber ? `
            <div class="detail-row">
              <div class="detail-label">Reference Number:</div>
              <div class="detail-value">${payment.referenceNumber}</div>
            </div>
            ` : ''}
            ${payment.bankName ? `
            <div class="detail-row">
              <div class="detail-label">Bank Name:</div>
              <div class="detail-value">${payment.bankName}</div>
            </div>
            ` : ''}
          </div>

          <div class="amount-section">
            <div class="amount">Amount Paid: ₹${amountInRupees}</div>
          </div>

          ${payment.notes ? `
          <div class="detail-row">
            <div class="detail-label">Notes:</div>
            <div class="detail-value">${payment.notes}</div>
          </div>
          ` : ''}

          <div class="footer">
            <p>This is a computer-generated receipt and does not require a signature.</p>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile Header */}
      <div className="md:hidden border-b bg-background px-4 py-3">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <IndianRupee className="h-6 w-6 text-purple-600" />
                Fee Management
              </h1>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>How to Use Fee Management</DialogTitle>
                    <DialogDescription>
                      Comprehensive fee management system for managing fee types, structures, invoices, and payments for your school.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Setting Up Fees</h4>
                      </div>
                      <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">1.</span>
                          <span>Create fee types (e.g., Tuition Fee, Lab Fee, Activity Fee)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">2.</span>
                          <span>Build fee structures by combining fee types for different classes</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">3.</span>
                          <span>Link fee structures to academic sessions and classes</span>
                        </li>
                      </ol>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Generating Invoices</h4>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Generate invoices for students based on fee structures</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Track payment status - pending, partial, paid, or overdue</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Monitor outstanding balances for each student</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Recording Payments</h4>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>Record payments via cash, bank transfer, cheque, or online</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>System automatically updates invoice status and balance</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>Generate payment receipts with transaction references</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                      </div>
                      <p className="text-sm text-muted-foreground ml-7">You need to collect quarterly fees from Class 10-A. Go to Types → Create "Quarterly Tuition" fee → Structures → Build structure with all fee types → Invoices → Generate for Class 10-A → Payments → Record as students pay!</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Button 
              size="sm"
              onClick={() => {
                setActiveTab("types");
                setEditingFeeType(null);
                feeTypeForm.reset();
                setIsAddFeeTypeDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage fee structures, invoices, and payments
          </p>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block p-4 lg:p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <IndianRupee className="h-6 w-6 text-purple-600" />
              Fee Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>How to Use Fee Management</DialogTitle>
                    <DialogDescription>
                      Comprehensive fee management system for managing fee types, structures, invoices, and payments for your school.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Setting Up Fees</h4>
                      </div>
                      <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">1.</span>
                          <span>Create fee types (e.g., Tuition Fee, Lab Fee, Activity Fee)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">2.</span>
                          <span>Build fee structures by combining fee types for different classes</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-medium text-blue-600">3.</span>
                          <span>Link fee structures to academic sessions and classes</span>
                        </li>
                      </ol>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Generating Invoices</h4>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Generate invoices for students based on fee structures</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Track payment status - pending, partial, paid, or overdue</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600">•</span>
                          <span>Monitor outstanding balances for each student</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Recording Payments</h4>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>Record payments via cash, bank transfer, cheque, or online</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>System automatically updates invoice status and balance</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>Generate payment receipts with transaction references</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                      </div>
                      <p className="text-sm text-muted-foreground ml-7">You need to collect quarterly fees from Class 10-A. Go to Types → Create "Quarterly Tuition" fee → Structures → Build structure with all fee types → Invoices → Generate for Class 10-A → Payments → Record as students pay!</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage fee structures, invoices, and payments for your school
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-4 lg:p-6">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
          <div className="border-b">
            <TabsList className="flex flex-wrap justify-start bg-transparent p-0 h-auto w-full">
              <TabsTrigger value="overview" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Overview</TabsTrigger>
              <TabsTrigger value="types" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Types</TabsTrigger>
              <TabsTrigger value="structures" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Structures</TabsTrigger>
              <TabsTrigger value="invoices" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Invoices</TabsTrigger>
              <TabsTrigger value="payments" className="px-3 py-3 text-sm border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent">Payments</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue Card - Green */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
                    <IndianRupee className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{formatCurrency(feePayments.reduce((sum, payment) => sum + payment.amount, 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Total collected</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Pending Invoices Card - Orange */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pending Invoices</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {feeInvoices.filter(invoice => invoice.status === 'pending' || invoice.status === 'partial').length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    ₹{formatCurrency(feeInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0))} unpaid fees
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Paid This Month Card - Blue */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Paid This Month</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{formatCurrency(feePayments.filter(payment => {
                      const paymentDate = new Date(payment.paymentDate);
                      const currentDate = new Date();
                      return paymentDate.getMonth() === currentDate.getMonth() && 
                             paymentDate.getFullYear() === currentDate.getFullYear();
                    }).reduce((sum, payment) => sum + payment.amount, 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {feePayments.filter(payment => {
                      const paymentDate = new Date(payment.paymentDate);
                      const currentDate = new Date();
                      return paymentDate.getMonth() === currentDate.getMonth() && 
                             paymentDate.getFullYear() === currentDate.getFullYear();
                    }).length} payments this month
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Students with Dues Card - Purple */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Students with Dues</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(() => {
                      const studentsWithDues = new Set(
                        feeInvoices
                          .filter(invoice => invoice.status === 'pending' || invoice.status === 'partial')
                          .map(invoice => invoice.studentId)
                      );
                    return studentsWithDues.size;
                  })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {(() => {
                      const studentsWithDues = new Set(
                        feeInvoices
                          .filter(invoice => invoice.status === 'pending' || invoice.status === 'partial')
                          .map(invoice => invoice.studentId)
                      );
                      return students.length > 0 ? Math.round((studentsWithDues.size / students.length) * 100) : 0;
                    })()}% of total students
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => {
                setEditingFeeType(null);
                feeTypeForm.reset();
                setIsAddFeeTypeDialogOpen(true);
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Fee Type
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Types</CardTitle>
                  <CardDescription>
                    Manage different types of fees like tuition, library, transport, etc.
                  </CardDescription>
                </div>
                <Dialog open={isAddFeeTypeDialogOpen} onOpenChange={setIsAddFeeTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingFeeType(null); feeTypeForm.reset(); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Fee Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingFeeType ? "Edit Fee Type" : "Add New Fee Type"}</DialogTitle>
                      <DialogDescription>
                        {editingFeeType ? "Update the fee type details below." : "Create a new fee type for your school."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...feeTypeForm}>
                      <form onSubmit={feeTypeForm.handleSubmit(handleSubmitFeeType)} className="space-y-2">
                        <FormField
                          control={feeTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Tuition Fee" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeTypeForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeTypeForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <FormControl>
                                <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                  <option value="tuition">Tuition</option>
                                  <option value="academic">Academic</option>
                                  <option value="transport">Transport</option>
                                  <option value="activity">Activity</option>
                                  <option value="miscellaneous">Miscellaneous</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeTypeForm.control}
                          name="isRecurring"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 rounded border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Is Recurring (charged regularly)
                              </FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddFeeTypeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createFeeTypeMutation.isPending || updateFeeTypeMutation.isPending}
                          >
                            {(createFeeTypeMutation.isPending || updateFeeTypeMutation.isPending) ? "Saving..." : (editingFeeType ? "Update" : "Create")}
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
                {/* Search and Filter */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search fee types..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Categories</option>
                    <option value="tuition">Tuition</option>
                    <option value="academic">Academic</option>
                    <option value="transport">Transport</option>
                    <option value="activity">Activity</option>
                    <option value="miscellaneous">Miscellaneous</option>
                  </select>
                </div>

                {/* Fee Types Table */}
                {isLoadingFeeTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFeeTypes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              {feeTypes.length === 0 ? "No fee types found. Create your first fee type to get started." : "No fee types match your search criteria."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredFeeTypes.map((feeType) => (
                            <TableRow key={feeType.id}>
                              <TableCell className="font-medium">{feeType.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {feeType.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={feeType.isRecurring ? "default" : "secondary"}>
                                  {feeType.isRecurring ? "Recurring" : "One-time"}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {feeType.description || "No description"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditFeeType(feeType)}
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
                                        <AlertDialogTitle>Delete Fee Type</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{feeType.name}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <div className="flex justify-end space-x-2">
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteFeeType(feeType.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </div>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures" className="space-y-2">
          {/* Add/Edit Form - Inline */}
          {showFeeStructureForm && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{editingFeeStructure ? "Edit Fee Structure" : "Add New Fee Structure"}</CardTitle>
                    <CardDescription>
                      {editingFeeStructure ? "Update the fee structure details below." : "Create a new fee structure for your school."}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setShowFeeStructureForm(false);
                      setEditingFeeStructure(null);
                      feeStructureForm.reset();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Form {...feeStructureForm}>
                  <form onSubmit={feeStructureForm.handleSubmit(handleSubmitFeeStructure)} className="space-y-4">
                        <FormField
                          control={feeStructureForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Structure Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Annual Fee Structure" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeStructureForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeStructureForm.control}
                          name="academicSessionId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Academic Session</FormLabel>
                              <FormControl>
                                <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                  <option value="">Select Academic Session</option>
                                  {academicSessions.map((session) => (
                                    <option key={session.id} value={session.id}>
                                      {formatAcademicSession(session)}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={feeStructureForm.control}
                          name="classIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Applicable Classes</FormLabel>
                              <FormControl>
                                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                                  {sortClasses(classes).map((classItem) => {
                                    // Check if this is a pre-primary grade
                                    const prePrimaryGrades = ['Playschool', 'LKG', 'UKG', 'Nursery', 'Prenursery', 'Pre-Nursery'];
                                    const isPrePrimary = prePrimaryGrades.some(grade => 
                                      classItem.grade.toLowerCase() === grade.toLowerCase()
                                    );
                                    
                                    return (
                                      <div key={classItem.id} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`class-${classItem.id}`}
                                          checked={field.value.includes(classItem.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              field.onChange([...field.value, classItem.id]);
                                            } else {
                                              field.onChange(field.value.filter(id => id !== classItem.id));
                                            }
                                          }}
                                          className="h-4 w-4 rounded border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        />
                                        <label htmlFor={`class-${classItem.id}`} className="text-sm font-normal">
                                          {isPrePrimary ? `${classItem.grade}-${classItem.section}` : `Class ${classItem.grade}-${classItem.section}`}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* Fee Structure Items Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Fee Items</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => appendItem({
                                feeTypeId: "",
                                amount: 0,
                                dueDate: "",
                                lateFeePenalty: 0,
                              })}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Fee Item
                            </Button>
                          </div>
                          
                          <div className="space-y-4 max-h-96 overflow-y-auto border rounded-md p-4 bg-muted/30">
                            {itemFields.map((field, index) => (
                              <div key={field.id} className="bg-background border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-muted-foreground">Item #{index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <FormField
                                    control={feeStructureForm.control}
                                    name={`items.${index}.feeTypeId`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Fee Type</FormLabel>
                                        <FormControl>
                                          <select
                                            {...field}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                          >
                                            <option value="">Select Fee Type</option>
                                            {feeTypes.map((feeType) => (
                                              <option key={feeType.id} value={feeType.id}>
                                                {feeType.name}
                                              </option>
                                            ))}
                                          </select>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={feeStructureForm.control}
                                    name={`items.${index}.amount`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Amount (₹)</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="number"
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={feeStructureForm.control}
                                    name={`items.${index}.dueDate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Due Date</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="date"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={feeStructureForm.control}
                                    name={`items.${index}.lateFeePenalty`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Late Fee Penalty (₹)</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="number"
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            ))}
                            {itemFields.length === 0 && (
                              <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground">No fee items added yet.</p>
                                <p className="text-xs text-muted-foreground mt-1">Click "Add Fee Item" above to get started.</p>
                              </div>
                            )}
                          </div>
                          {feeStructureForm.formState.errors.items && (
                            <p className="text-sm font-medium text-destructive">
                              {feeStructureForm.formState.errors.items.message}
                            </p>
                          )}
                        </div>

                        <FormField
                          control={feeStructureForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 rounded border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Active (currently in use)
                              </FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setShowFeeStructureForm(false);
                              setEditingFeeStructure(null);
                              feeStructureForm.reset();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createFeeStructureMutation.isPending || updateFeeStructureMutation.isPending}
                          >
                            {(createFeeStructureMutation.isPending || updateFeeStructureMutation.isPending) ? "Saving..." : (editingFeeStructure ? "Update" : "Create")}
                          </Button>
                        </div>
                      </form>
                    </Form>
              </CardContent>
            </Card>
          )}

          {/* Mobile Add Button */}
          {!showFeeStructureForm && (
            <div className="md:hidden">
              <Button 
                onClick={() => {
                  setEditingFeeStructure(null);
                  feeStructureForm.reset();
                  setShowFeeStructureForm(true);
                }}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Fee Structure
              </Button>
            </div>
          )}

          {/* Fee Structures List Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Structures</CardTitle>
                  <CardDescription>
                    Create and manage fee structures for different classes and academic sessions
                  </CardDescription>
                </div>
                {!showFeeStructureForm && (
                  <Button 
                    onClick={() => {
                      setEditingFeeStructure(null);
                      feeStructureForm.reset();
                      setShowFeeStructureForm(true);
                    }}
                    className="hidden md:flex"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Fee Structure
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Search and Filter */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search fee structures..."
                      value={structureSearchTerm}
                      onChange={(e) => setStructureSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <select
                    value={selectedSessionFilter}
                    onChange={(e) => setSelectedSessionFilter(e.target.value)}
                    className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Sessions</option>
                    {academicSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {formatAcademicSession(session)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fee Structures Table */}
                {isLoadingFeeStructures ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Academic Session</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFeeStructures.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              {feeStructures.length === 0 ? "No fee structures found. Create your first fee structure to get started." : "No fee structures match your search criteria."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredFeeStructures.map((structure) => {
                            // Remove "Class " prefix for pre-primary grades
                            const prePrimaryGrades = ['Playschool', 'LKG', 'UKG', 'Nursery', 'Prenursery', 'Pre-Nursery'];
                            let displayName = structure.name;
                            
                            prePrimaryGrades.forEach(grade => {
                              const pattern = new RegExp(`\\bClass ${grade}\\b`, 'gi');
                              displayName = displayName.replace(pattern, grade);
                            });
                            
                            return (
                              <TableRow key={structure.id}>
                                <TableCell className="font-medium">{displayName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {structure.academicSessionName || 'Unknown Session'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={structure.isActive ? "default" : "secondary"}>
                                  {structure.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {structure.items?.length || 0} items
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditFeeStructure(structure)}
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
                                        <AlertDialogTitle>Delete Fee Structure</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{structure.name}"? This action cannot be undone and will remove all associated fee items.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <div className="flex justify-end space-x-2">
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteFeeStructure(structure.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </div>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => setIsGenerateInvoicesDialogOpen(true)}
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate Invoice
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Invoices</CardTitle>
                  <CardDescription>
                    Generate and manage fee invoices for students
                  </CardDescription>
                </div>
                <Dialog open={isGenerateInvoicesDialogOpen} onOpenChange={setIsGenerateInvoicesDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Generate Invoices
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Generate Fee Invoices</DialogTitle>
                      <DialogDescription>
                        Generate invoices for students based on fee structures
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <div>
                        <Label>Fee Structure</Label>
                        <select 
                          value={selectedFeeStructureId}
                          onChange={(e) => setSelectedFeeStructureId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select Fee Structure</option>
                          {feeStructures.filter(s => s.isActive).map((structure) => (
                            <option key={structure.id} value={structure.id}>
                              {structure.name} ({structure.academicSessionName})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Generate For</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button 
                            variant={generateForAllClasses ? "default" : "outline"}
                            onClick={() => setGenerateForAllClasses(true)}
                            type="button"
                          >
                            All Classes
                          </Button>
                          <Button 
                            variant={!generateForAllClasses ? "default" : "outline"}
                            onClick={() => setGenerateForAllClasses(false)}
                            type="button"
                          >
                            Specific Students
                          </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => setIsGenerateInvoicesDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="button"
                        onClick={handleGenerateInvoices}
                        disabled={generateInvoicesMutation.isPending || !selectedFeeStructureId}
                      >
                        {generateInvoicesMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Search and Filters */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search invoices..."
                      value={invoiceSearchTerm}
                      onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                    className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="finalized">Finalized</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Classes</option>
                    {sortClasses(classes).map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name || `${cls.grade} ${cls.section}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Actions - Finalize Button */}
                {selectedInvoiceIds.length > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-3">
                    <span className="text-sm text-blue-700 font-medium">
                      {selectedInvoiceIds.length} invoice(s) selected
                    </span>
                    <Button 
                      onClick={handleFinalizeInvoices}
                      disabled={finalizeInvoicesMutation.isPending}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {finalizeInvoicesMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Finalize Selected
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Invoices Table */}
                {isLoadingInvoices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-10 p-2">
                            <Checkbox
                              checked={
                                filteredInvoices.filter(inv => inv.status === 'draft').length > 0 && 
                                selectedInvoiceIds.length === filteredInvoices.filter(inv => inv.status === 'draft').length
                              }
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="min-w-[140px] p-2">Student</TableHead>
                          <TableHead className="w-24 p-2">Class</TableHead>
                          <TableHead className="w-24 p-2 text-right">Amount</TableHead>
                          <TableHead className="w-20 p-2 text-right">Paid</TableHead>
                          <TableHead className="w-24 p-2 text-right">Balance</TableHead>
                          <TableHead className="w-24 p-2">Due Date</TableHead>
                          <TableHead className="w-20 p-2">Status</TableHead>
                          <TableHead className="w-20 p-2 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                              {feeInvoices.length === 0 ? "No invoices found. Generate invoices to get started." : "No invoices match your search criteria."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredInvoices.map((invoice, index) => {
                            // Find student and their class
                            const student = students.find(s => s.id === invoice.studentId);
                            const studentClass = student ? classes.find(c => c.id === student.classId) : null;
                            
                            // Pre-primary grades that don't need "Class" prefix
                            const prePrimaryGrades = ['Playschool', 'LKG', 'UKG', 'Nursery', 'Prenursery', 'Pre-Nursery'];
                            const isPrePrimary = studentClass && prePrimaryGrades.some(grade => 
                              studentClass.grade.toLowerCase() === grade.toLowerCase()
                            );
                            
                            const classDisplay = studentClass 
                              ? isPrePrimary 
                                ? `${studentClass.grade}-${studentClass.section}`
                                : `Class ${studentClass.grade}-${studentClass.section}` 
                              : '-';
                            
                            return (
                              <TableRow 
                                key={invoice.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  setViewingInvoice(invoice);
                                  setIsViewInvoiceDialogOpen(true);
                                }}
                              >
                                <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedInvoiceIds.includes(invoice.id)}
                                    onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                                    disabled={invoice.status !== 'draft'}
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <div className="space-y-0.5">
                                    <p className="font-medium text-xs leading-tight">{invoice.studentName}</p>
                                    <p className="text-[10px] text-muted-foreground leading-tight">{invoice.studentAdmissionNumber}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="p-2 text-xs">{classDisplay}</TableCell>
                                <TableCell className="p-2 text-right font-medium">₹{formatCurrency(invoice.totalAmount)}</TableCell>
                                <TableCell className="p-2 text-right">₹{formatCurrency(invoice.paidAmount)}</TableCell>
                                <TableCell className="p-2 text-right font-medium">₹{formatCurrency(invoice.balanceAmount)}</TableCell>
                                <TableCell className="p-2 whitespace-nowrap">{new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                                <TableCell className="p-2">
                                  <Badge 
                                    variant={
                                      invoice.status === 'draft' ? 'outline' :
                                      invoice.status === 'finalized' ? 'secondary' :
                                      invoice.status === 'paid' ? 'default' :
                                      invoice.status === 'partial' ? 'secondary' :
                                      invoice.status === 'overdue' ? 'destructive' : 'outline'
                                    }
                                    className={`text-[10px] px-1.5 py-0.5 ${
                                      invoice.status === 'draft' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                                      invoice.status === 'finalized' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                      ''
                                    }`}
                                  >
                                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="p-2 text-right">
                                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    {invoice.balanceAmount > 0 && invoice.status !== 'draft' && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        className="h-7 w-7 hover:bg-green-50 hover:text-green-600"
                                        onClick={() => {
                                          setSelectedInvoiceId(invoice.id);
                                          setIsRecordPaymentDialogOpen(true);
                                        }}
                                        title="Record Payment"
                                      >
                                        <CreditCard className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {invoice.status === 'draft' && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setInvoiceToDelete(invoice.id);
                                          setIsDeleteConfirmOpen(true);
                                        }}
                                        title="Delete Draft Invoice"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-2">
          {/* Mobile Action Button */}
          <div className="md:hidden">
            <Button 
              onClick={() => setIsRecordPaymentDialogOpen(true)}
              className="w-full"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Payments</CardTitle>
                  <CardDescription>
                    Track and record fee payments from students
                  </CardDescription>
                </div>
                <Button onClick={() => setIsRecordPaymentDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Search and Filters */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search payments..."
                      value={paymentSearchTerm}
                      onChange={(e) => setPaymentSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Methods</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                {/* Payments Table */}
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[90px] p-2 text-xs">Date</TableHead>
                          <TableHead className="w-[140px] p-2 text-xs">Invoice</TableHead>
                          <TableHead className="w-[120px] p-2 text-xs">Student</TableHead>
                          <TableHead className="w-[80px] p-2 text-xs">Amount</TableHead>
                          <TableHead className="w-[80px] p-2 text-xs">Method</TableHead>
                          <TableHead className="w-[90px] p-2 text-xs">Ref</TableHead>
                          <TableHead className="w-[80px] p-2 text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-xs">
                              {feePayments.length === 0 ? "No payments found. Record payments to get started." : "No payments match your search criteria."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredPayments.map((payment) => (
                            <TableRow key={payment.id} className="text-xs">
                              <TableCell className="p-2">
                                {new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </TableCell>
                              <TableCell className="p-2 font-medium truncate max-w-[140px]" title={payment.invoiceNumber}>
                                {payment.invoiceNumber}
                              </TableCell>
                              <TableCell className="p-2 truncate max-w-[120px]" title={payment.studentName}>
                                {payment.studentName}
                              </TableCell>
                              <TableCell className="p-2 whitespace-nowrap">₹{formatCurrency(payment.amount)}</TableCell>
                              <TableCell className="p-2">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {payment.paymentMethod === 'cash' ? 'Cash' : 
                                   payment.paymentMethod === 'bank_transfer' ? 'Bank' :
                                   payment.paymentMethod === 'cheque' ? 'Cheque' :
                                   payment.paymentMethod === 'online' ? 'Online' :
                                   payment.paymentMethod === 'upi' ? 'UPI' :
                                   payment.paymentMethod === 'dd' ? 'DD' : 
                                   payment.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell className="p-2 truncate max-w-[90px]" title={(payment as any).referenceNumber || (payment as any).transactionId || '-'}>
                                {(payment as any).referenceNumber || (payment as any).transactionId || '-'}
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
                                      setViewingPayment(payment);
                                      setIsViewPaymentDialogOpen(true);
                                    }}
                                    title="View Payment Details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleDownloadReceipt(payment)}
                                    title="Download Receipt"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
        
        {/* Record Payment Dialog */}
        <Dialog open={isRecordPaymentDialogOpen} onOpenChange={(open) => {
          setIsRecordPaymentDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setSelectedInvoiceId("");
            setPaymentAmount("");
            setPaymentReference("");
            setPaymentRemarks("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Fee Payment</DialogTitle>
              <DialogDescription>
                Record a payment received from a student
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div>
                <Label>Invoice</Label>
                {selectedInvoiceId ? (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                    {(() => {
                      const invoice = feeInvoices.find(i => i.id === selectedInvoiceId);
                      return invoice ? `${invoice.invoiceNumber} - ${invoice.studentName} (₹${formatCurrency(invoice.balanceAmount)})` : 'Invoice not found';
                    })()}
                  </div>
                ) : (
                  <select 
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Invoice</option>
                    {feeInvoices.filter(i => i.balanceAmount > 0).map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} - {invoice.studentName} (₹{formatCurrency(invoice.balanceAmount)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Reference</Label>
                <Input 
                  placeholder="Transaction ID, Cheque number, etc."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea 
                  placeholder="Additional notes..."
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsRecordPaymentDialogOpen(false);
                setSelectedInvoiceId("");
                setPaymentAmount("");
                setPaymentReference("");
                setPaymentRemarks("");
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isPending || !selectedInvoiceId || !paymentAmount}
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* View Invoice Dialog */}
        <Dialog open={isViewInvoiceDialogOpen} onOpenChange={setIsViewInvoiceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
              <DialogDescription>
                View complete invoice information and line items
              </DialogDescription>
            </DialogHeader>
            
            {viewingInvoice && (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-semibold">{viewingInvoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={
                      viewingInvoice.status === 'paid' ? 'default' :
                      viewingInvoice.status === 'partial' ? 'secondary' :
                      viewingInvoice.status === 'overdue' ? 'destructive' : 'outline'
                    }>
                      {viewingInvoice.status.charAt(0).toUpperCase() + viewingInvoice.status.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Student Name</p>
                    <p className="font-semibold">{viewingInvoice.studentName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admission Number</p>
                    <p className="font-semibold">{viewingInvoice.studentAdmissionNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Generated Date</p>
                    <p className="font-semibold">{new Date(viewingInvoice.generatedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-semibold">{new Date(viewingInvoice.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {/* Invoice Items */}
                {viewingInvoice.items && viewingInvoice.items.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Fee Items</h3>
                    <div className="space-y-2">
                      {viewingInvoice.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                          </div>
                          <p className="font-semibold">₹{formatCurrency(item.netAmount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Amount Summary */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-semibold">₹{formatCurrency(viewingInvoice.totalAmount)}</p>
                  </div>
                  {viewingInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <p>Discount</p>
                      <p className="font-semibold">-₹{formatCurrency(viewingInvoice.discountAmount)}</p>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <p className="text-muted-foreground">Net Amount</p>
                    <p className="font-semibold">₹{formatCurrency(viewingInvoice.netAmount)}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-muted-foreground">Paid Amount</p>
                    <p className="font-semibold">₹{formatCurrency(viewingInvoice.paidAmount)}</p>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <p className="font-bold">Balance Amount</p>
                    <p className="font-bold text-lg">₹{formatCurrency(viewingInvoice.balanceAmount)}</p>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewInvoiceDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Payment Details Dialog */}
        <Dialog open={isViewPaymentDialogOpen} onOpenChange={setIsViewPaymentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription>
                View complete payment information
              </DialogDescription>
            </DialogHeader>
            
            {viewingPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Number</p>
                    <p className="font-semibold">{viewingPayment.paymentNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Date</p>
                    <p className="font-semibold">{new Date(viewingPayment.paymentDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-semibold">{viewingPayment.invoiceNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Student Name</p>
                    <p className="font-semibold">{viewingPayment.studentName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-bold text-lg">₹{formatCurrency(viewingPayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <Badge variant="outline">
                      {viewingPayment.paymentMethod.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Mode</p>
                    <Badge variant={viewingPayment.paymentMode === 'online' ? 'default' : 'secondary'}>
                      {viewingPayment.paymentMode.charAt(0).toUpperCase() + viewingPayment.paymentMode.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={viewingPayment.status === 'completed' ? 'default' : 'secondary'}>
                      {viewingPayment.status.charAt(0).toUpperCase() + viewingPayment.status.slice(1)}
                    </Badge>
                  </div>
                </div>

                {(viewingPayment.transactionId || viewingPayment.referenceNumber) && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Reference Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {viewingPayment.transactionId && (
                        <div>
                          <p className="text-sm text-muted-foreground">Transaction ID</p>
                          <p className="font-mono text-sm">{viewingPayment.transactionId}</p>
                        </div>
                      )}
                      {viewingPayment.referenceNumber && (
                        <div>
                          <p className="text-sm text-muted-foreground">Reference Number</p>
                          <p className="font-mono text-sm">{viewingPayment.referenceNumber}</p>
                        </div>
                      )}
                      {viewingPayment.bankName && (
                        <div>
                          <p className="text-sm text-muted-foreground">Bank Name</p>
                          <p className="font-semibold">{viewingPayment.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewingPayment.notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{viewingPayment.notes}</p>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewPaymentDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Invoice Confirmation Dialog */}
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Draft Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this draft invoice? This action cannot be undone.
                Only draft invoices can be deleted. Finalized invoices are permanent for audit purposes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel onClick={() => {
                setIsDeleteConfirmOpen(false);
                setInvoiceToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (invoiceToDelete) {
                    deleteInvoiceMutation.mutate(invoiceToDelete);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete Invoice"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}