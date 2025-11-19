import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, IndianRupee, FileText, Users, Calendar, ArrowLeft, Info, Lightbulb, Download, Eye } from "lucide-react";
import { useLocation } from "wouter";

interface PayrollEmployee {
  id: string;
  employeeId: string | null;
  employeeType: "teacher" | "staff";
  staffName: string | null;
  designation: string;
  department: string | null;
  joiningDate: string;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  panNumber: string | null;
}

interface SalaryComponent {
  id: string;
  payrollEmployeeId: string;
  componentType: "basic_salary" | "allowance" | "deduction";
  componentName: string;
  amount: string;
  isRecurring: boolean;
}

interface PayrollCycle {
  id: string;
  cycleMonth: number;
  cycleYear: number;
  status: "draft" | "processing" | "completed" | "paid";
  totalEmployees: number;
  totalAmount: string;
  processedAt: string | null;
}

interface Payslip {
  id: string;
  cycleId: string;
  payrollEmployeeId: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  paymentStatus: "pending" | "paid";
  paymentDate: string | null;
}

export default function PayrollPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("employees");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  
  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [componentDialog, setComponentDialog] = useState(false);
  const [cycleDialog, setCycleDialog] = useState(false);
  const [payslipDialog, setPayslipDialog] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  
  const [employeeForm, setEmployeeForm] = useState({
    employeeId: "",
    employeeType: "teacher" as "teacher" | "staff",
    staffName: "",
    designation: "",
    department: "",
    joiningDate: "",
    bankAccountNumber: "",
    bankName: "",
    ifscCode: "",
    panNumber: ""
  });

  const [componentForm, setComponentForm] = useState({
    componentType: "basic_salary" as "basic_salary" | "allowance" | "deduction",
    componentName: "",
    amount: "",
    isRecurring: true
  });

  const [cycleForm, setCycleForm] = useState({
    cycleMonth: new Date().getMonth() + 1,
    cycleYear: new Date().getFullYear()
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/payroll/employees"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users", user?.schoolId],
  });

  const { data: teachersData } = useQuery({
    queryKey: ["/api/teachers"],
  });
  
  const teachers = teachersData?.teachers || [];

  const { data: components = [] } = useQuery({
    queryKey: ["/api/payroll/employees", selectedEmployee, "components"],
    enabled: !!selectedEmployee,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["/api/payroll/cycles"],
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["/api/payroll/cycles", selectedCycle, "payslips"],
    enabled: !!selectedCycle,
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payroll/employees", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/employees"] });
      setEmployeeDialog(false);
      toast({ title: "Employee created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll/employees/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/employees"] });
      toast({ title: "Employee deleted successfully" });
    },
  });

  const createComponentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/payroll/employees/${selectedEmployee}/components`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/employees", selectedEmployee, "components"] });
      setComponentDialog(false);
      toast({ title: "Component added successfully" });
    },
  });

  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll/components/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/employees", selectedEmployee, "components"] });
      toast({ title: "Component deleted successfully" });
    },
  });

  const createCycleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payroll/cycles", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/cycles"] });
      setCycleDialog(false);
      toast({ title: "Cycle created successfully" });
    },
  });

  const processCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      const res = await fetch(`/api/payroll/cycles/${cycleId}/process`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/cycles"] });
      toast({ title: "Cycle processed successfully" });
    },
  });

  const markCyclePaidMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      const res = await fetch(`/api/payroll/cycles/${cycleId}/mark-paid`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/cycles"] });
      toast({ title: "Cycle marked as paid" });
    },
  });

  const markPayslipPaidMutation = useMutation({
    mutationFn: async (payslipId: string) => {
      const res = await fetch(`/api/payroll/payslips/${payslipId}/mark-paid`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/cycles", selectedCycle, "payslips"] });
      toast({ title: "Payslip marked as paid" });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      processing: "default",
      completed: "outline",
      paid: "default",
      pending: "secondary",
    };
    const colors: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      paid: "bg-purple-100 text-purple-800",
      pending: "bg-orange-100 text-orange-800",
    };
    
    return <Badge className={colors[status]}>{status.toUpperCase()}</Badge>;
  };

  const calculateTotalSalary = () => {
    if (!components.length) return { basic: 0, allowances: 0, deductions: 0, net: 0 };
    
    const basic = components
      .filter((c: SalaryComponent) => c.componentType === "basic_salary")
      .reduce((sum: number, c: SalaryComponent) => sum + parseFloat(c.amount), 0);
    
    const allowances = components
      .filter((c: SalaryComponent) => c.componentType === "allowance")
      .reduce((sum: number, c: SalaryComponent) => sum + parseFloat(c.amount), 0);
    
    const deductions = components
      .filter((c: SalaryComponent) => c.componentType === "deduction")
      .reduce((sum: number, c: SalaryComponent) => sum + parseFloat(c.amount), 0);
    
    const net = basic + allowances - deductions;
    
    return { basic, allowances, deductions, net };
  };

  const downloadPayslip = (payslip: Payslip) => {
    const employeeDetails = getEmployeeDetails(payslip.payrollEmployeeId);
    const cycle = cycles.find((c: PayrollCycle) => c.id === payslip.cycleId);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employeeDetails}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .header p { margin: 5px 0; color: #666; }
          .info-section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .info-label { font-weight: bold; color: #555; }
          .salary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .salary-table th, .salary-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .salary-table th { background: #4F46E5; color: white; }
          .total-row { font-weight: bold; font-size: 1.1em; background: #f9f9f9; }
          .net-salary { font-size: 1.2em; color: #4F46E5; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; font-size: 0.9em; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYSLIP</h1>
          <p>${monthNames[cycle?.cycleMonth - 1]} ${cycle?.cycleYear}</p>
        </div>
        
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Employee Name:</span>
            <span>${employeeDetails}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Status:</span>
            <span style="color: ${payslip.paymentStatus === 'paid' ? 'green' : 'orange'}; font-weight: bold;">${payslip.paymentStatus.toUpperCase()}</span>
          </div>
          ${payslip.paymentDate ? `<div class="info-row"><span class="info-label">Payment Date:</span><span>${new Date(payslip.paymentDate).toLocaleDateString()}</span></div>` : ''}
        </div>
        
        <table class="salary-table">
          <thead>
            <tr>
              <th>Component</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">₹${parseFloat(payslip.basicSalary).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Allowances</td>
              <td style="text-align: right;">₹${parseFloat(payslip.totalAllowances).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Deductions</td>
              <td style="text-align: right; color: red;">-₹${parseFloat(payslip.totalDeductions).toLocaleString()}</td>
            </tr>
            <tr class="total-row">
              <td>NET SALARY</td>
              <td style="text-align: right;" class="net-salary">₹${parseFloat(payslip.netSalary).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>This is a computer-generated payslip and does not require a signature.</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip_${employeeDetails.replace(/\s+/g, '_')}_${monthNames[cycle?.cycleMonth - 1]}_${cycle?.cycleYear}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Payslip downloaded successfully" });
  };

  const getEmployeeName = (emp: PayrollEmployee) => {
    // For staff without user accounts, use staffName
    if (emp.employeeType === "staff" && emp.staffName) {
      return emp.staffName;
    }
    
    // For teachers with user accounts, look up user name
    if (emp.employeeId) {
      const u = users.find((u: any) => u.id === emp.employeeId);
      return u ? `${u.firstName} ${u.lastName}` : "Unknown User";
    }
    
    return emp.staffName || "Unknown";
  };

  const getEmployeeDetails = (employeeId: string) => {
    const emp = employees.find((e: PayrollEmployee) => e.id === employeeId);
    if (!emp) return "Unknown";
    return `${getEmployeeName(emp)} (${emp.designation})`;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
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
            Payroll Management
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-5 w-5" />
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>How to Use Payroll Management</DialogTitle>
                <DialogDescription>
                  Manage employee salaries by setting up salary components, processing monthly payroll cycles, and generating payslips.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IndianRupee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Setting Up Payroll</h4>
                  </div>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                    <li className="flex gap-2">
                      <span className="font-medium text-blue-600">1.</span>
                      <span>Add employees from the Employees tab (teachers and staff)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-blue-600">2.</span>
                      <span>Enter bank details, PAN number, and joining date</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-blue-600">3.</span>
                      <span>Go to Salary Components and add Basic Salary, Allowances (HRA, DA), and Deductions (PF, TDS)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-blue-600">4.</span>
                      <span>System automatically calculates net salary</span>
                    </li>
                  </ol>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Processing Monthly Salary</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                    <li className="flex gap-2">
                      <span className="text-green-600">•</span>
                      <span>Go to Payroll Cycles tab and create a new cycle (select month & year)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-600">•</span>
                      <span>Click "Process Cycle" to generate all payslips automatically</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-600">•</span>
                      <span>Review payslips in the Payslips tab</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-600">•</span>
                      <span>Mark payments as "Paid" after bank transfer</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">It's March month-end. Create a new cycle for "March 2024" → Click "Process Cycle" → System generates payslips for all 25 teachers → Download payslips → Transfer salaries → Mark cycle as "Paid". Done!</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </h1>
        <p className="text-sm text-muted-foreground">Manage employee salaries, payroll cycles, and payslips</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees">
            <Users className="w-4 h-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="components">
            <IndianRupee className="w-4 h-4 mr-2" />
            Salary Components
          </TabsTrigger>
          <TabsTrigger value="cycles">
            <Calendar className="w-4 h-4 mr-2" />
            Payroll Cycles
          </TabsTrigger>
          <TabsTrigger value="payslips">
            <FileText className="w-4 h-4 mr-2" />
            Payslips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Payroll Employees</CardTitle>
                <Dialog open={employeeDialog} onOpenChange={setEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Employee
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Payroll Employee</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Employee Type</Label>
                        <Select value={employeeForm.employeeType} onValueChange={(v: any) => setEmployeeForm({ ...employeeForm, employeeType: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {employeeForm.employeeType === "teacher" ? (
                        <>
                          <div className="col-span-2">
                            <Label>Select Teacher</Label>
                            <Select value={employeeForm.employeeId} onValueChange={(v) => setEmployeeForm({ ...employeeForm, employeeId: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select teacher" />
                              </SelectTrigger>
                              <SelectContent>
                                {teachers.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name} ({t.schoolIdNumber || t.employeeId})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <Label>Staff Name</Label>
                            <Input value={employeeForm.staffName} onChange={(e) => setEmployeeForm({ ...employeeForm, staffName: e.target.value })} placeholder="Enter full name for payroll records" />
                          </div>
                          <div>
                            <Label>Designation</Label>
                            <Input value={employeeForm.designation} onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })} placeholder="e.g., Clerk, Peon, Lab Assistant" />
                          </div>
                          <div className="col-span-2">
                            <Label>Joining Date</Label>
                            <Input type="date" value={employeeForm.joiningDate} onChange={(e) => setEmployeeForm({ ...employeeForm, joiningDate: e.target.value })} />
                          </div>
                        </>
                      )}

                      <div className="col-span-2">
                        <Label>Bank Account Number</Label>
                        <Input value={employeeForm.bankAccountNumber} onChange={(e) => setEmployeeForm({ ...employeeForm, bankAccountNumber: e.target.value })} />
                      </div>
                      <div>
                        <Label>Bank Name</Label>
                        <Input value={employeeForm.bankName} onChange={(e) => setEmployeeForm({ ...employeeForm, bankName: e.target.value })} />
                      </div>
                      <div>
                        <Label>IFSC Code</Label>
                        <Input value={employeeForm.ifscCode} onChange={(e) => setEmployeeForm({ ...employeeForm, ifscCode: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <Label>PAN Number</Label>
                        <Input value={employeeForm.panNumber} onChange={(e) => setEmployeeForm({ ...employeeForm, panNumber: e.target.value })} />
                      </div>
                    </div>
                    <Button onClick={() => createEmployeeMutation.mutate(employeeForm)} className="w-full">Create Employee</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp: PayrollEmployee) => (
                    <TableRow key={emp.id}>
                      <TableCell>{getEmployeeName(emp)}</TableCell>
                      <TableCell><Badge>{emp.employeeType}</Badge></TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell>{emp.department || "-"}</TableCell>
                      <TableCell>{new Date(emp.joiningDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedEmployee(emp.id); setActiveTab("components"); }}>
                            Manage Salary
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteEmployeeMutation.mutate(emp.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Salary Components</CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedEmployee || ""} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp: PayrollEmployee) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {getEmployeeName(emp)} - {emp.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEmployee && (
                    <Dialog open={componentDialog} onOpenChange={setComponentDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Component
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Add Salary Component</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Component Type</Label>
                            <Select value={componentForm.componentType} onValueChange={(v: any) => setComponentForm({ ...componentForm, componentType: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="basic_salary">Basic Salary</SelectItem>
                                <SelectItem value="allowance">Allowance</SelectItem>
                                <SelectItem value="deduction">Deduction</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Component Name</Label>
                            <Input value={componentForm.componentName} onChange={(e) => setComponentForm({ ...componentForm, componentName: e.target.value })} placeholder="e.g., HRA, DA, PF" />
                          </div>
                          <div>
                            <Label>Amount</Label>
                            <Input type="number" value={componentForm.amount} onChange={(e) => setComponentForm({ ...componentForm, amount: e.target.value })} />
                          </div>
                        </div>
                        <Button onClick={() => createComponentMutation.mutate(componentForm)} className="w-full">Add Component</Button>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedEmployee ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Recurring</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((comp: SalaryComponent) => (
                        <TableRow key={comp.id}>
                          <TableCell><Badge variant={comp.componentType === "basic_salary" ? "default" : comp.componentType === "allowance" ? "secondary" : "destructive"}>{comp.componentType.replace("_", " ")}</Badge></TableCell>
                          <TableCell>{comp.componentName}</TableCell>
                          <TableCell>₹{parseFloat(comp.amount).toLocaleString()}</TableCell>
                          <TableCell>{comp.isRecurring ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="destructive" onClick={() => deleteComponentMutation.mutate(comp.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">Salary Breakdown</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>Basic Salary: ₹{calculateTotalSalary().basic.toLocaleString()}</div>
                      <div>Allowances: ₹{calculateTotalSalary().allowances.toLocaleString()}</div>
                      <div>Deductions: ₹{calculateTotalSalary().deductions.toLocaleString()}</div>
                      <div className="text-lg font-bold">Net Salary: ₹{calculateTotalSalary().net.toLocaleString()}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">Select an employee to view salary components</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Payroll Cycles</CardTitle>
                <Dialog open={cycleDialog} onOpenChange={setCycleDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Cycle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Payroll Cycle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Month</Label>
                        <Select value={cycleForm.cycleMonth.toString()} onValueChange={(v) => setCycleForm({ ...cycleForm, cycleMonth: parseInt(v) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((month, idx) => (
                              <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Year</Label>
                        <Input type="number" value={cycleForm.cycleYear} onChange={(e) => setCycleForm({ ...cycleForm, cycleYear: parseInt(e.target.value) })} />
                      </div>
                    </div>
                    <Button onClick={() => createCycleMutation.mutate(cycleForm)} className="w-full">Create Cycle</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Processed At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle: PayrollCycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell>{monthNames[cycle.cycleMonth - 1]} {cycle.cycleYear}</TableCell>
                      <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                      <TableCell>{cycle.totalEmployees}</TableCell>
                      <TableCell>₹{parseFloat(cycle.totalAmount).toLocaleString()}</TableCell>
                      <TableCell>{cycle.processedAt ? new Date(cycle.processedAt).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {cycle.status === "draft" && (
                            <Button size="sm" onClick={() => processCycleMutation.mutate(cycle.id)}>Process</Button>
                          )}
                          {cycle.status === "completed" && (
                            <Button size="sm" onClick={() => markCyclePaidMutation.mutate(cycle.id)}>Mark Paid</Button>
                          )}
                          {(cycle.status === "completed" || cycle.status === "paid") && (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedCycle(cycle.id); setActiveTab("payslips"); }}>
                              View Payslips
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Payslips</CardTitle>
                <Select value={selectedCycle || ""} onValueChange={setSelectedCycle}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.filter((c: PayrollCycle) => c.status === "completed" || c.status === "paid").map((cycle: PayrollCycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {monthNames[cycle.cycleMonth - 1]} {cycle.cycleYear}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCycle ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((payslip: Payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell>{getEmployeeDetails(payslip.payrollEmployeeId)}</TableCell>
                        <TableCell>₹{parseFloat(payslip.basicSalary).toLocaleString()}</TableCell>
                        <TableCell>₹{parseFloat(payslip.totalAllowances).toLocaleString()}</TableCell>
                        <TableCell>₹{parseFloat(payslip.totalDeductions).toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">₹{parseFloat(payslip.netSalary).toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(payslip.paymentStatus)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedPayslip(payslip);
                                setPayslipDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => downloadPayslip(payslip)}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                            {payslip.paymentStatus === "pending" && (
                              <Button size="sm" onClick={() => markPayslipPaidMutation.mutate(payslip.id)}>
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">Select a cycle to view payslips</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Payslip Dialog */}
      <Dialog open={payslipDialog} onOpenChange={setPayslipDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip Details</DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-semibold">{getEmployeeDetails(selectedPayslip.payrollEmployeeId)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="font-semibold">
                    {(() => {
                      const cycle = cycles.find((c: PayrollCycle) => c.id === selectedPayslip.cycleId);
                      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                      return cycle ? `${monthNames[cycle.cycleMonth - 1]} ${cycle.cycleYear}` : "N/A";
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <div>{getStatusBadge(selectedPayslip.paymentStatus)}</div>
                </div>
                {selectedPayslip.paymentDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Date</p>
                    <p className="font-semibold">{new Date(selectedPayslip.paymentDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Salary Breakdown */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Salary</TableCell>
                      <TableCell className="text-right">₹{parseFloat(selectedPayslip.basicSalary).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Allowances</TableCell>
                      <TableCell className="text-right text-green-600">+₹{parseFloat(selectedPayslip.totalAllowances).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Deductions</TableCell>
                      <TableCell className="text-right text-red-600">-₹{parseFloat(selectedPayslip.totalDeductions).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50 dark:bg-blue-950/20 font-semibold">
                      <TableCell className="text-lg">Net Salary</TableCell>
                      <TableCell className="text-right text-lg text-blue-600">₹{parseFloat(selectedPayslip.netSalary).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setPayslipDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  downloadPayslip(selectedPayslip);
                  setPayslipDialog(false);
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Payslip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
