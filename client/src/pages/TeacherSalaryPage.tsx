import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Download,
  AlertCircle,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SalaryComponent {
  id: string;
  componentType: "basic_salary" | "allowance" | "deduction";
  componentName: string;
  amount: string;
  isRecurring: boolean;
}

interface PayrollEmployee {
  id: string;
  designation: string;
  department: string | null;
  joiningDate: string;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
}

interface SalaryInfo {
  employee: PayrollEmployee;
  components: SalaryComponent[];
}

interface Payslip {
  id: string;
  cycleId: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  paymentDate: string | null;
  paymentStatus: "pending" | "paid";
  createdAt: string;
}

export default function TeacherSalaryPage() {
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Fetch salary information
  const { data: salaryInfo, isLoading: salaryLoading, error: salaryError } = useQuery<SalaryInfo>({
    queryKey: ["/api/teacher/my-salary"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teacher/my-salary");
      if (!response.ok) {
        throw new Error("Salary information not configured");
      }
      return await response.json();
    },
  });

  // Fetch payslips
  const { data: payslips = [], isLoading: payslipsLoading } = useQuery<Payslip[]>({
    queryKey: ["/api/teacher/my-payslips"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teacher/my-payslips");
      if (!response.ok) {
        throw new Error("Failed to fetch payslips");
      }
      return await response.json();
    },
    enabled: !salaryError,
  });

  if (salaryLoading || payslipsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading salary information...</p>
        </div>
      </div>
    );
  }

  if (salaryError) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">Salary Information Not Available</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              Your salary information has not been configured yet. Please contact your school administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const basicSalaryComponents = salaryInfo?.components.filter(c => c.componentType === "basic_salary") || [];
  const allowances = salaryInfo?.components.filter(c => c.componentType === "allowance") || [];
  const deductions = salaryInfo?.components.filter(c => c.componentType === "deduction") || [];

  const basicSalary = basicSalaryComponents.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const totalAllowances = allowances.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const totalDeductions = deductions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const grossSalary = basicSalary + totalAllowances;
  const netSalary = grossSalary - totalDeductions;

  return (
    <div>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <DollarSign className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-3xl font-bold mb-1">My Salary</h2>
            <p className="text-lg text-muted-foreground">View your salary structure and payment history</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        
        {/* Salary Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Basic Salary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{basicSalary.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Allowances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+₹{totalAllowances.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Deductions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">-₹{totalDeductions.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription>Net Salary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{netSalary.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Salary Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Salary Breakdown</CardTitle>
            <CardDescription>Monthly salary structure and components</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Salary */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Basic Salary
              </h4>
              <div className="space-y-2">
                {basicSalaryComponents.map((component) => (
                  <div key={component.id} className="flex justify-between items-center p-2 bg-muted rounded-md">
                    <span className="text-sm">{component.componentName}</span>
                    <span className="font-medium">₹{parseFloat(component.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Allowances */}
            {allowances.length > 0 && (
              <>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    Allowances
                  </h4>
                  <div className="space-y-2">
                    {allowances.map((component) => (
                      <div key={component.id} className="flex justify-between items-center p-2 bg-green-50 rounded-md">
                        <span className="text-sm">{component.componentName}</span>
                        <span className="font-medium text-green-600">+₹{parseFloat(component.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Deductions */}
            {deductions.length > 0 && (
              <>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    Deductions
                  </h4>
                  <div className="space-y-2">
                    {deductions.map((component) => (
                      <div key={component.id} className="flex justify-between items-center p-2 bg-red-50 rounded-md">
                        <span className="text-sm">{component.componentName}</span>
                        <span className="font-medium text-red-600">-₹{parseFloat(component.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Net Salary Summary */}
            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-md">
              <span className="font-semibold">Net Monthly Salary</span>
              <span className="text-xl font-bold text-primary">₹{netSalary.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your salary payment records</CardDescription>
          </CardHeader>
          <CardContent>
            {!Array.isArray(payslips) || payslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No payment records yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payslips.map((payslip) => (
                  <div
                    key={payslip.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {format(new Date(payslip.createdAt), "MMMM yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Net: ₹{parseFloat(payslip.netSalary).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={payslip.paymentStatus === "paid" ? "default" : "secondary"}>
                        {payslip.paymentStatus === "paid" ? "Paid" : "Pending"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPayslip(payslip)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Payslip Detail Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Receipt</DialogTitle>
            <DialogDescription>
              {selectedPayslip && format(new Date(selectedPayslip.createdAt), "MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayslip && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Basic Salary</p>
                  <p className="font-medium">₹{parseFloat(selectedPayslip.basicSalary).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Allowances</p>
                  <p className="font-medium text-green-600">+₹{parseFloat(selectedPayslip.totalAllowances).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deductions</p>
                  <p className="font-medium text-red-600">-₹{parseFloat(selectedPayslip.totalDeductions).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Salary</p>
                  <p className="font-bold text-primary text-lg">₹{parseFloat(selectedPayslip.netSalary).toLocaleString()}</p>
                </div>
              </div>

              {selectedPayslip.paymentStatus === "paid" && selectedPayslip.paymentDate && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    Paid on {format(new Date(selectedPayslip.paymentDate), "dd MMM yyyy")}
                  </p>
                </div>
              )}

              <Button className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Receipt (PDF)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
