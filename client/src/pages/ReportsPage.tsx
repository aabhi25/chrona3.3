import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, FileText, Loader2, Table2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getClassName } from '@shared/classUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ReportType = 
  | 'attendance_summary'
  | 'teacher_workload'
  | 'class_list'
  | 'student_list'
  | 'teacher_list'
  | 'absent_today'
  | 'attendance_overview';

interface ReportFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  classId?: string;
  teacherId?: string;
  grade?: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('attendance_summary');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // Fetch classes for filter dropdown
  const { data: classesData } = useQuery({
    queryKey: ['/api/classes'],
    enabled: !!user,
  });

  // Fetch teachers for filter dropdown
  const { data: teachersData } = useQuery({
    queryKey: ['/api/teachers'],
    enabled: !!user,
  });

  const classes = Array.isArray(classesData) ? classesData : [];
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  const generateReportMutation = useMutation({
    mutationFn: async (params: { reportType: ReportType; filters: ReportFilters }) => {
      const response = await fetch('/api/chroney/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedReport(data);
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate({
      reportType,
      filters,
    });
  };

  const handleExportCSV = () => {
    if (!generatedReport?.data) return;

    let csvContent = '';
    const data = Array.isArray(generatedReport.data) 
      ? generatedReport.data 
      : Object.values(generatedReport.data).find(v => Array.isArray(v)) || [];

    if (data.length === 0) {
      alert('No data available to export');
      return;
    }

    const keys = Object.keys(data[0]);
    csvContent += keys.join(',') + '\n';
    
    data.forEach((row: any) => {
      csvContent += keys.map(key => {
        const value = String(row[key] || '');
        return value.includes(',') || value.includes('"') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportJSON = () => {
    if (!generatedReport?.data) return;

    const jsonContent = JSON.stringify(generatedReport.data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportType}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const renderReportFilters = () => {
    const showDateRange = ['attendance_summary', 'attendance_overview'].includes(reportType);
    const showClassFilter = ['attendance_summary', 'class_list', 'student_list'].includes(reportType);
    const showTeacherFilter = ['attendance_summary', 'teacher_workload'].includes(reportType);
    const showGradeFilter = ['student_list', 'teacher_list'].includes(reportType);

    return (
      <div className="space-y-4">
        {showDateRange && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: {
                    start: e.target.value,
                    end: filters.dateRange?.end || getDefaultDateRange().end,
                  }
                })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.dateRange?.end || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: {
                    start: filters.dateRange?.start || getDefaultDateRange().start,
                    end: e.target.value,
                  }
                })}
              />
            </div>
          </div>
        )}

        {showClassFilter && (
          <div>
            <Label>Class (Optional)</Label>
            <Select
              value={filters.classId || 'all'}
              onValueChange={(value) => setFilters({
                ...filters,
                classId: value === 'all' ? undefined : value,
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {getClassName(cls.grade, cls.section)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showTeacherFilter && (
          <div>
            <Label>Teacher (Optional)</Label>
            <Select
              value={filters.teacherId || 'all'}
              onValueChange={(value) => setFilters({
                ...filters,
                teacherId: value === 'all' ? undefined : value,
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map((teacher: any) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showGradeFilter && (
          <div>
            <Label>Grade (Optional)</Label>
            <Select
              value={filters.grade || 'all'}
              onValueChange={(value) => setFilters({
                ...filters,
                grade: value === 'all' ? undefined : value,
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {['Playschool', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 
                  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map(grade => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  const renderReportPreview = () => {
    if (!generatedReport) return null;

    const { data, message, formatted } = generatedReport;

    // Use formatted data if available, otherwise fall back to raw data
    const displayData = formatted?.sections?.[0]?.content || 
                       (Array.isArray(data) ? data : Object.values(data).find(v => Array.isArray(v)) || []);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Report Preview</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}

        {/* Display insights if available */}
        {formatted?.insights && formatted.insights.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Key Insights</h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              {formatted.insights.map((insight: string, i: number) => (
                <li key={i}>• {insight}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Display data as table */}
        {Array.isArray(displayData) && displayData.length > 0 ? (
          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {Object.keys(displayData[0]).map((key) => (
                    <th key={key} className="px-4 py-2 text-left font-medium">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((row: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-muted/50">
                    {Object.values(row).map((value: any, j: number) => (
                      <td key={j} className="px-4 py-2">
                        {typeof value === 'object' && value !== null 
                          ? JSON.stringify(value) 
                          : String(value || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            {typeof data === 'object' && data !== null ? (
              <pre className="text-xs whitespace-pre-wrap text-left">
                {JSON.stringify(data, null, 2)}
              </pre>
            ) : (
              <p>No data available for this report</p>
            )}
          </div>
        )}

        {/* Show record count */}
        {formatted?.metadata && (
          <p className="text-sm text-muted-foreground">
            Total Records: {formatted.metadata.totalRecords}
          </p>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Reports</h1>
          <p className="text-lg text-muted-foreground">Generate and export custom reports</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </TabsTrigger>
          <TabsTrigger value="chroney">
            <Table2 className="h-4 w-4 mr-2" />
            Ask Chroney AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
                <CardDescription>
                  Select report type and apply filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Report Type</Label>
                  <Select
                    value={reportType}
                    onValueChange={(value) => {
                      setReportType(value as ReportType);
                      setFilters({});
                      setGeneratedReport(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attendance_summary">Attendance Summary</SelectItem>
                      <SelectItem value="attendance_overview">Attendance Overview</SelectItem>
                      <SelectItem value="absent_today">Absent Today</SelectItem>
                      <SelectItem value="teacher_workload">Teacher Workload</SelectItem>
                      <SelectItem value="class_list">Class List</SelectItem>
                      <SelectItem value="student_list">Student List</SelectItem>
                      <SelectItem value="teacher_list">Teacher List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {renderReportFilters()}

                <Button
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending}
                  className="w-full"
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Report Types</CardTitle>
                <CardDescription>Available report templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Attendance Summary</p>
                    <p className="text-muted-foreground">Overview of attendance statistics for teachers and students</p>
                  </div>
                  <div>
                    <p className="font-medium">Teacher Workload</p>
                    <p className="text-muted-foreground">Teaching assignments and weekly periods for teachers</p>
                  </div>
                  <div>
                    <p className="font-medium">Class List</p>
                    <p className="text-muted-foreground">Complete list of students in a specific class</p>
                  </div>
                  <div>
                    <p className="font-medium">Student List</p>
                    <p className="text-muted-foreground">All students with their details and class information</p>
                  </div>
                  <div>
                    <p className="font-medium">Absent Today</p>
                    <p className="text-muted-foreground">Students and teachers marked absent today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {generatedReport && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Report</CardTitle>
              </CardHeader>
              <CardContent>
                {renderReportPreview()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chroney">
          <Card>
            <CardHeader>
              <CardTitle>Ask Chroney AI for Custom Reports</CardTitle>
              <CardDescription>
                Use natural language to generate custom reports and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Click the Chroney AI icon in the bottom-right corner and ask questions like:
              </p>
              <ul className="space-y-2 text-sm list-disc list-inside text-muted-foreground">
                <li>"Generate an attendance report for the last 7 days"</li>
                <li>"Show me teacher workload distribution"</li>
                <li>"Who's absent today?"</li>
                <li>"List all students in Class 5"</li>
                <li>"Show attendance overview for this month"</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
