import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Users, 
  UserCheck, 
  GraduationCap, 
  ClipboardCheck, 
  Calendar as CalendarIcon,
  Download,
  Eye,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  FileSpreadsheet,
  Plus,
  Zap
} from "lucide-react";
import * as XLSX from 'xlsx';
import { CustomReportBuilder } from "@/components/CustomReportBuilder";
import { CustomReportsList } from "@/components/CustomReportsList";

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  endpoint?: string;
  isComingSoon?: boolean;
  requiresDateRange?: boolean;
  category: 'attendance' | 'academic' | 'people' | 'administrative';
}

const reportCards: ReportCard[] = [
  {
    id: "student-attendance",
    title: "Student Attendance",
    description: "View attendance records and statistics for all students",
    icon: ClipboardCheck,
    endpoint: "/api/reports/student-attendance",
    requiresDateRange: true,
    category: 'attendance'
  },
  {
    id: "teacher-attendance",
    title: "Teacher Attendance",
    description: "Track teacher attendance and availability",
    icon: UserCheck,
    endpoint: "/api/reports/teacher-attendance",
    requiresDateRange: true,
    category: 'attendance'
  },
  {
    id: "teacher-schedule",
    title: "Teacher Schedule",
    description: "Weekly timetable schedules for all teachers",
    icon: CalendarIcon,
    endpoint: "/api/reports/teacher-schedule",
    requiresDateRange: false,
    category: 'academic'
  },
  {
    id: "teacher-workload",
    title: "Teacher Workload",
    description: "Analysis of teaching hours and workload distribution",
    icon: BarChart3,
    endpoint: "/api/reports/teacher-workload",
    requiresDateRange: false,
    category: 'academic'
  },
  {
    id: "student-details",
    title: "Student Details",
    description: "Complete information of all enrolled students",
    icon: GraduationCap,
    endpoint: "/api/reports/student-details",
    requiresDateRange: false,
    category: 'people'
  },
  {
    id: "teacher-details",
    title: "Teacher Details",
    description: "Comprehensive teacher information and qualifications",
    icon: Users,
    endpoint: "/api/reports/teacher-details",
    requiresDateRange: false,
    category: 'people'
  },
  {
    id: "fee-collection",
    title: "Fee Collection",
    description: "Track fee payments and outstanding balances",
    icon: TrendingUp,
    isComingSoon: true,
    category: 'administrative'
  },
  {
    id: "transport-usage",
    title: "Transport Usage",
    description: "Transport route utilization and student assignments",
    icon: Activity,
    isComingSoon: true,
    category: 'administrative'
  },
  {
    id: "performance-analytics",
    title: "Performance Analytics",
    description: "Student academic performance trends and insights",
    icon: PieChart,
    isComingSoon: true,
    category: 'administrative'
  }
];

export default function SmartReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportColumns, setReportColumns] = useState<string[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customReportBuilderOpen, setCustomReportBuilderOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    handleQuickFilter('today');
  }, []);

  const handleQuickFilter = (filter: 'today' | 'week' | 'month' | 'custom') => {
    setQuickFilter(filter);
    const today = startOfToday();
    
    switch (filter) {
      case 'today':
        setFromDate(today);
        setToDate(today);
        break;
      case 'week':
        setFromDate(startOfWeek(today));
        setToDate(endOfWeek(today));
        break;
      case 'month':
        setFromDate(startOfMonth(today));
        setToDate(endOfMonth(today));
        break;
      case 'custom':
        break;
    }
  };

  const handleViewReport = async (report: ReportCard) => {
    if (!report.endpoint) {
      toast({
        title: "Coming Soon",
        description: "This report will be available in a future update.",
      });
      return;
    }

    setIsLoading(true);
    setSelectedReport(report);

    try {
      let endpoint = report.endpoint;

      if (report.requiresDateRange && fromDate && toDate) {
        const params = new URLSearchParams({
          startDate: format(fromDate, 'yyyy-MM-dd'),
          endDate: format(toDate, 'yyyy-MM-dd')
        });
        endpoint = `${endpoint}?${params}`;
      }

      const response = await apiRequest('GET', endpoint);
      const data = await response.json();

      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        setReportColumns(columns);
        setReportData(data);
      } else {
        setReportColumns([]);
        setReportData([]);
      }

      setDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportToExcel = async (report: ReportCard) => {
    if (!report.endpoint) {
      toast({
        title: "Coming Soon",
        description: "This report will be available in a future update.",
      });
      return;
    }

    setIsLoading(true);

    try {
      let endpoint = report.endpoint;

      if (report.requiresDateRange && fromDate && toDate) {
        const params = new URLSearchParams({
          startDate: format(fromDate, 'yyyy-MM-dd'),
          endDate: format(toDate, 'yyyy-MM-dd')
        });
        endpoint = `${endpoint}?${params}`;
      }

      const response = await apiRequest('GET', endpoint);
      const data = await response.json();

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No data available for the selected report.",
        });
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, report.title);

      const fileName = `${report.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: "Report exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export report",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderReportTable = () => {
    if (!reportData.length) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No data available</p>
        </div>
      );
    }

    const columns = reportColumns;

    return (
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead key={column} className="font-semibold">
                  {column.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column} className="whitespace-nowrap">
                    {typeof row[column] === 'object' 
                      ? JSON.stringify(row[column])
                      : row[column]?.toString() || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const handleEditReport = (report: any) => {
    setEditingReport(report);
    setCustomReportBuilderOpen(true);
  };

  const handleReportBuilderClose = () => {
    setCustomReportBuilderOpen(false);
    setEditingReport(null);
  };

  const handleReportBuilderSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const filteredPreBuiltReports = categoryFilter === 'all' 
    ? reportCards 
    : reportCards.filter(r => r.category === categoryFilter);

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-purple-600" />
          Smart Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate comprehensive reports and analytics for your school
        </p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-6">
        {/* Date Range Filter */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Date Range Filter</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Select date range for attendance and time-based reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={quickFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter('today')}
              >
                Today
              </Button>
              <Button
                variant={quickFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter('week')}
              >
                This Week
              </Button>
              <Button
                variant={quickFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter('month')}
              >
                This Month
              </Button>
              <Button
                variant={quickFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter('custom')}
              >
                Custom Range
              </Button>
            </div>

            {quickFilter === 'custom' && (
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-sm font-medium">From Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !fromDate && "text-muted-foreground"
                        )}
                        size="sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-sm font-medium">To Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !toDate && "text-muted-foreground"
                        )}
                        size="sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={setToDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Reports Section */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">Custom Reports</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">
                  Create and manage custom reports with flexible configurations
                </CardDescription>
              </div>
              <Button 
                onClick={() => setCustomReportBuilderOpen(true)}
                className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CustomReportsList 
              key={refreshKey}
              onEdit={handleEditReport}
              onRefresh={handleReportBuilderSuccess}
            />
          </CardContent>
        </Card>

        {/* Quick Reports Section */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-lg">Quick Reports</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">
                  Generate instant reports with pre-configured templates
                </CardDescription>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="people">People</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPreBuiltReports.map((report) => {
                const Icon = report.icon;
                return (
                  <Card key={report.id} className={cn("hover:shadow-md transition-shadow", report.isComingSoon && "opacity-60")}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-semibold mb-1">
                            {report.title}
                          </CardTitle>
                          {report.isComingSoon && (
                            <Badge variant="secondary" className="text-xs">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {report.description}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleViewReport(report)}
                          disabled={isLoading || report.isComingSoon}
                          className="flex-1 bg-gradient-to-br from-green-50 to-white hover:from-green-100 hover:to-green-50 text-green-700 font-semibold border border-green-200 shadow-md hover:shadow-lg transition-all duration-200"
                          size="sm"
                        >
                          <Eye className="mr-2 h-3 w-3" />
                          View
                        </Button>
                        <Button
                          onClick={() => handleExportToExcel(report)}
                          disabled={isLoading || report.isComingSoon}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <CustomReportBuilder
        open={customReportBuilderOpen}
        onClose={handleReportBuilderClose}
        onSuccess={handleReportBuilderSuccess}
        editReport={editingReport}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {selectedReport?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.description}
            </DialogDescription>
          </DialogHeader>
          {renderReportTable()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
