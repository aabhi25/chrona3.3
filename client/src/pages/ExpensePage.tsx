import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, IndianRupee, CheckCircle, XCircle, TrendingUp, Calendar, Filter, ArrowLeft, Info, Receipt, FileText, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface ExpenseCategory {
  id: string;
  categoryName: string;
  description: string | null;
  budgetAllocated: string | null;
}

interface Expense {
  id: string;
  categoryId: string;
  expenseTitle: string;
  description: string | null;
  amount: string;
  expenseDate: string;
  paymentMethod: string;
  paymentStatus: string;
  vendor: string | null;
  billNumber: string | null;
  academicSessionId: string;
  approvedBy: string | null;
  recordedBy: string;
}

interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  academicSessionId: string;
  allocatedAmount: string;
  spentAmount: string;
  remainingAmount: string;
  status: string;
}

export default function ExpensePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("expenses");
  
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [approvingExpenseId, setApprovingExpenseId] = useState<string | null>(null);
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  
  const [categoryForm, setCategoryForm] = useState({
    categoryName: "",
    description: "",
    budgetAllocated: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    categoryId: "",
    expenseTitle: "",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash" as "cash" | "bank_transfer" | "cheque" | "online" | "other",
    paymentStatus: "pending" as "pending" | "paid" | "approved" | "rejected",
    vendor: "",
    billNumber: "",
    academicSessionId: ""
  });

  const [budgetForm, setBudgetForm] = useState({
    categoryId: "",
    academicSessionId: "",
    allocatedAmount: "",
    spentAmount: "0",
    remainingAmount: ""
  });

  const [filters, setFilters] = useState({
    categoryId: "all",
    sessionId: "all",
    status: "all",
    startDate: "",
    endDate: ""
  });

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expenses/categories"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.categoryId && filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      if (filters.sessionId && filters.sessionId !== 'all') params.append('sessionId', filters.sessionId);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const res = await fetch(`/api/expenses?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["/api/budgets", filters.sessionId],
    queryFn: async () => {
      const sessionId = filters.sessionId !== 'all' ? filters.sessionId : '';
      const res = await fetch(`/api/budgets${sessionId ? `?sessionId=${sessionId}` : ''}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(await res.text());
      }
      return res.json();
    }
  });

  const { data: budgetSummary = [] } = useQuery<Budget[]>({
    queryKey: ["/api/budgets/summary", filters.sessionId],
    queryFn: async () => {
      const sessionId = filters.sessionId !== 'all' ? filters.sessionId : '';
      const res = await fetch(`/api/budgets/summary${sessionId ? `?sessionId=${sessionId}` : ''}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(await res.text());
      }
      return res.json();
    }
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/academic-sessions"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/categories"] });
      setCategoryDialog(false);
      setCategoryForm({ categoryName: "", description: "", budgetAllocated: "" });
      toast({ title: "Category created successfully" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/expenses/categories/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/categories"] });
      setCategoryDialog(false);
      setEditingCategory(null);
      toast({ title: "Category updated successfully" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/categories/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/categories"] });
      toast({ title: "Category deleted successfully" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/summary"] });
      setExpenseDialog(false);
      setExpenseForm({
        categoryId: "",
        expenseTitle: "",
        description: "",
        amount: "",
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMethod: "cash",
        paymentStatus: "pending",
        vendor: "",
        billNumber: "",
        academicSessionId: ""
      });
      toast({ title: "Expense created successfully" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setExpenseDialog(false);
      setEditingExpense(null);
      toast({ title: "Expense updated successfully" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Expense deleted successfully" });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}/approve`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/summary"] });
      toast({ title: "Expense approved successfully" });
    },
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}/reject`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense rejected successfully" });
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/summary"] });
      setBudgetDialog(false);
      setBudgetForm({ categoryId: "", academicSessionId: "", allocatedAmount: "", spentAmount: "0", remainingAmount: "" });
      toast({ title: "Budget created successfully" });
    },
  });

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data: expenseForm });
    } else {
      createExpenseMutation.mutate(expenseForm);
    }
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allocated = parseFloat(budgetForm.allocatedAmount);
    const spent = parseFloat(budgetForm.spentAmount);
    const remaining = allocated - spent;
    
    createBudgetMutation.mutate({
      ...budgetForm,
      remainingAmount: remaining.toString(),
      status: spent > allocated ? "exceeded" : "active"
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved: { variant: "default", label: "Approved" },
      paid: { variant: "default", label: "Paid" },
      rejected: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "exceeded": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const calculateBudgetProgress = (spent: string, allocated: string) => {
    const s = parseFloat(spent);
    const a = parseFloat(allocated);
    return Math.min((s / a) * 100, 100);
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="p-6 space-y-6">
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
              <IndianRupee className="h-6 w-6 text-purple-600" />
              Expense Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Expense Management</DialogTitle>
                  <DialogDescription>
                    Track school expenses by creating categories, recording transactions, setting budgets, and monitoring spending patterns.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Setting Up Categories</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>Go to Categories tab and create expense categories</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Examples: "Salaries", "Maintenance", "Utilities", "Stationery", "Transport"</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Set budget allocation for each category (optional)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">4.</span>
                        <span>Categories help organize and track spending patterns</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Recording Expenses</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Click "Add Expense" → Enter title, amount, and date</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Select category and payment method (Cash/Bank/Cheque/Online)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Add vendor name and bill number for reference</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Status starts as "Pending" - admin can approve/reject</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-base text-amber-900 dark:text-amber-100">Managing Budgets</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Go to Budgets tab to set yearly/session-wise budgets</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>System tracks spending against allocated budget</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Get alerts when expenses exceed budget limits</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>View Reports tab for expense analysis and charts</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">School pays ₹15,000 electricity bill. Click "Add Expense" → Title: "September Electricity" → Amount: ₹15,000 → Category: "Utilities" → Payment: "Bank Transfer" → Vendor: "State Electricity Board" → Bill #: "EB/SEP/2024/1234" → Submit for approval!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">Manage expenses, categories, and budgets</p>
        </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>Track and manage all school expenses</CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingExpense(null); setExpenseForm({
                        categoryId: "",
                        expenseTitle: "",
                        description: "",
                        amount: "",
                        expenseDate: new Date().toISOString().split('T')[0],
                        paymentMethod: "cash",
                        paymentStatus: "pending",
                        vendor: "",
                        billNumber: "",
                        academicSessionId: sessions[0]?.id || ""
                      }); }}>
                        <Plus className="h-4 w-4 mr-2" /> Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingExpense ? "Edit" : "Add"} Expense</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleExpenseSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Expense Title *</Label>
                            <Input
                              placeholder="e.g., September Electricity Bill"
                              value={expenseForm.expenseTitle}
                              onChange={(e) => setExpenseForm({ ...expenseForm, expenseTitle: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={expenseForm.categoryId} onValueChange={(value) => setExpenseForm({ ...expenseForm, categoryId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.categoryName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Amount *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g., 15000"
                              value={expenseForm.amount}
                              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Expense Date *</Label>
                            <Input
                              type="date"
                              value={expenseForm.expenseDate}
                              onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Payment Method *</Label>
                            <Select value={expenseForm.paymentMethod} onValueChange={(value: any) => setExpenseForm({ ...expenseForm, paymentMethod: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Academic Session *</Label>
                            <Select value={expenseForm.academicSessionId} onValueChange={(value) => setExpenseForm({ ...expenseForm, academicSessionId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select session" />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.map((session: any) => (
                                  <SelectItem key={session.id} value={session.id}>
                                    {format(new Date(session.startDate), 'MMM yyyy')} - {format(new Date(session.endDate), 'MMM yyyy')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Vendor</Label>
                            <Input
                              placeholder="e.g., State Electricity Board"
                              value={expenseForm.vendor}
                              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Bill Number</Label>
                            <Input
                              placeholder="e.g., EB/SEP/2024/1234"
                              value={expenseForm.billNumber}
                              onChange={(e) => setExpenseForm({ ...expenseForm, billNumber: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            placeholder="e.g., Monthly electricity charges for September 2024"
                            value={expenseForm.description}
                            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit">
                            {editingExpense ? "Update" : "Create"} Expense
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-5 gap-2">
                <Select value={filters.categoryId} onValueChange={(value) => setFilters({ ...filters, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.categoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.sessionId} onValueChange={(value) => setFilters({ ...filters, sessionId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {format(new Date(session.startDate), 'MMM yyyy')} - {format(new Date(session.endDate), 'MMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.expenseTitle}</TableCell>
                      <TableCell>{categories.find((c) => c.id === expense.categoryId)?.categoryName}</TableCell>
                      <TableCell>₹{parseFloat(expense.amount).toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(expense.expenseDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{expense.vendor || '-'}</TableCell>
                      <TableCell className="capitalize">{expense.paymentMethod.replace('_', ' ')}</TableCell>
                      <TableCell>{getStatusBadge(expense.paymentStatus)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            {expense.paymentStatus === "pending" && (
                              <>
                                <AlertDialog open={approveDialog && approvingExpenseId === expense.id} onOpenChange={(open) => {
                                  setApproveDialog(open);
                                  if (!open) setApprovingExpenseId(null);
                                }}>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-600 hover:bg-green-50"
                                      onClick={() => {
                                        setApprovingExpenseId(expense.id);
                                        setApproveDialog(true);
                                      }}
                                    >
                                      Approve
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Expense</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to approve this expense?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-green-600 text-white hover:bg-green-700"
                                        onClick={() => {
                                          approveExpenseMutation.mutate(expense.id);
                                          setApproveDialog(false);
                                          setApprovingExpenseId(null);
                                        }}
                                      >
                                        Approve
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog open={rejectDialog && rejectingExpenseId === expense.id} onOpenChange={(open) => {
                                  setRejectDialog(open);
                                  if (!open) setRejectingExpenseId(null);
                                }}>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-500 border-red-500 hover:bg-red-50"
                                      onClick={() => {
                                        setRejectingExpenseId(expense.id);
                                        setRejectDialog(true);
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reject Expense</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to reject this expense?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-500 text-white hover:bg-red-600"
                                        onClick={() => {
                                          rejectExpenseMutation.mutate(expense.id);
                                          setRejectDialog(false);
                                          setRejectingExpenseId(null);
                                        }}
                                      >
                                        Reject
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingExpense(expense);
                                setExpenseForm({
                                  categoryId: expense.categoryId,
                                  expenseTitle: expense.expenseTitle,
                                  description: expense.description || "",
                                  amount: expense.amount,
                                  expenseDate: expense.expenseDate.split('T')[0],
                                  paymentMethod: expense.paymentMethod as any,
                                  paymentStatus: expense.paymentStatus as any,
                                  vendor: expense.vendor || "",
                                  billNumber: expense.billNumber || "",
                                  academicSessionId: expense.academicSessionId
                                });
                                setExpenseDialog(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog open={deleteDialog && deletingExpenseId === expense.id} onOpenChange={(open) => {
                              setDeleteDialog(open);
                              if (!open) setDeletingExpenseId(null);
                            }}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setDeletingExpenseId(expense.id);
                                    setDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this expense? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      deleteExpenseMutation.mutate(expense.id);
                                      setDeleteDialog(false);
                                      setDeletingExpenseId(null);
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Manage expense categories</CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingCategory(null); setCategoryForm({ categoryName: "", description: "", budgetAllocated: "" }); }}>
                        <Plus className="h-4 w-4 mr-2" /> Add Category
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingCategory ? "Edit" : "Add"} Category</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCategorySubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Category Name *</Label>
                          <Input
                            value={categoryForm.categoryName}
                            onChange={(e) => setCategoryForm({ ...categoryForm, categoryName: e.target.value })}
                            placeholder="e.g., Salaries, Utilities, Supplies, Transportation"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            placeholder="e.g., Monthly salary payments for teaching and non-teaching staff"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Budget Allocated</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={categoryForm.budgetAllocated}
                            onChange={(e) => setCategoryForm({ ...categoryForm, budgetAllocated: e.target.value })}
                            placeholder="e.g., 50000"
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit">
                            {editingCategory ? "Update" : "Create"} Category
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Budget Allocated</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.categoryName}</TableCell>
                      <TableCell>{category.description || '-'}</TableCell>
                      <TableCell>
                        {category.budgetAllocated ? `₹${parseFloat(category.budgetAllocated).toLocaleString()}` : '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCategory(category);
                                setCategoryForm({
                                  categoryName: category.categoryName,
                                  description: category.description || "",
                                  budgetAllocated: category.budgetAllocated || ""
                                });
                                setCategoryDialog(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the category "{category.categoryName}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCategoryMutation.mutate(category.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Budget Management</CardTitle>
                  <CardDescription>Track budget allocation and spending</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filters.sessionId} onValueChange={(value) => setFilters({ ...filters, sessionId: value })}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select Academic Session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {sessions.map((session: any) => (
                        <SelectItem key={session.id} value={session.id}>
                          {format(new Date(session.startDate), 'MMM yyyy')} - {format(new Date(session.endDate), 'MMM yyyy')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setBudgetForm({ categoryId: "", academicSessionId: filters.sessionId || sessions[0]?.id || "", allocatedAmount: "", spentAmount: "0", remainingAmount: "" })}>
                          <Plus className="h-4 w-4 mr-2" /> Add Budget
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Create Budget</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleBudgetSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={budgetForm.categoryId} onValueChange={(value) => setBudgetForm({ ...budgetForm, categoryId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.categoryName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Academic Session *</Label>
                            <Select value={budgetForm.academicSessionId} onValueChange={(value) => setBudgetForm({ ...budgetForm, academicSessionId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select session" />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.map((session: any) => (
                                  <SelectItem key={session.id} value={session.id}>
                                    {format(new Date(session.startDate), 'MMM yyyy')} - {format(new Date(session.endDate), 'MMM yyyy')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Allocated Amount *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={budgetForm.allocatedAmount}
                              onChange={(e) => {
                                const allocated = parseFloat(e.target.value) || 0;
                                const spent = parseFloat(budgetForm.spentAmount) || 0;
                                setBudgetForm({
                                  ...budgetForm,
                                  allocatedAmount: e.target.value,
                                  remainingAmount: (allocated - spent).toString()
                                });
                              }}
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit">Create Budget</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {budgetSummary.map((budget) => {
                  const progress = calculateBudgetProgress(budget.spentAmount, budget.allocatedAmount);
                  const isExceeded = parseFloat(budget.spentAmount) > parseFloat(budget.allocatedAmount);
                  
                  return (
                    <Card key={budget.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{budget.categoryName}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Allocated</span>
                          <span className="font-medium">₹{parseFloat(budget.allocatedAmount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spent</span>
                          <span className={`font-medium ${isExceeded ? 'text-red-600' : ''}`}>
                            ₹{parseFloat(budget.spentAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Remaining</span>
                          <span className={`font-medium ${isExceeded ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{parseFloat(budget.remainingAmount).toLocaleString()}
                          </span>
                        </div>
                        <Progress 
                          value={progress} 
                          className={`h-2 ${isExceeded ? '[&>div]:bg-red-500' : progress > 80 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{progress.toFixed(1)}% utilized</span>
                          <Badge variant={budget.status === "exceeded" ? "destructive" : "default"} className="capitalize">
                            {budget.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {expenses.length} total expenses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {expenses.filter((e) => e.paymentStatus === "pending").length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting approval
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {budgetSummary.length > 0 ? 
                    ((budgetSummary.reduce((sum, b) => sum + parseFloat(b.spentAmount), 0) / 
                      budgetSummary.reduce((sum, b) => sum + parseFloat(b.allocatedAmount), 0)) * 100).toFixed(1)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Overall budget usage
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{categories.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active categories
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>Breakdown of expenses across categories</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Total Expenses</TableHead>
                    <TableHead>Number of Expenses</TableHead>
                    <TableHead>Budget Allocated</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => {
                    const categoryExpenses = expenses.filter((e) => e.categoryId === category.id);
                    const totalAmount = categoryExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                    const budget = budgetSummary.find((b) => b.categoryId === category.id);
                    
                    return (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.categoryName}</TableCell>
                        <TableCell>₹{totalAmount.toLocaleString()}</TableCell>
                        <TableCell>{categoryExpenses.length}</TableCell>
                        <TableCell>
                          {budget ? `₹${parseFloat(budget.allocatedAmount).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          {budget && (
                            <Badge variant={budget.status === "exceeded" ? "destructive" : "default"} className="capitalize">
                              {budget.status}
                            </Badge>
                          )}
                        </TableCell>
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
