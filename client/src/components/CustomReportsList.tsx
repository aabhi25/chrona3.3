import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MoreHorizontal, 
  Play, 
  Edit, 
  Copy, 
  Trash2, 
  Star,
  Download,
  Search,
  Loader2,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface CustomReportsListProps {
  onEdit: (report: any) => void;
  onRefresh: () => void;
}

export function CustomReportsList({ onEdit, onRefresh }: CustomReportsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<any>(null);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executingReport, setExecutingReport] = useState<any>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: reports, isLoading } = useQuery<any[]>({
    queryKey: ['/api/custom-reports', categoryFilter],
    queryFn: async () => {
      const url = categoryFilter !== 'all' 
        ? `/api/custom-reports?category=${categoryFilter}`
        : '/api/custom-reports';
      const response = await apiRequest('GET', url);
      return response.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/custom-reports/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-reports'] });
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/custom-reports/${id}/duplicate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-reports'] });
      toast({
        title: "Success",
        description: "Report duplicated successfully",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate report",
        variant: "destructive",
      });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const response = await apiRequest('PUT', `/api/custom-reports/${id}`, { isFavorite: !isFavorite });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-reports'] });
      onRefresh();
    },
  });

  const handleDelete = (report: any) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (reportToDelete) {
      deleteMutation.mutate(reportToDelete.id);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const handleExecute = async (report: any) => {
    setExecutingReport(report);
    setIsGenerating(true);
    
    try {
      const response = await apiRequest('POST', `/api/custom-reports/${report.id}/generate`, {});
      const data = await response.json();
      setReportData(data);
      setExecuteDialogOpen(true);
      
      toast({
        title: "Success",
        description: `Generated ${data.length} records`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: 'excel' | 'csv') => {
    if (!executingReport) return;

    try {
      const response = await fetch(`/api/custom-reports/${executingReport.id}/export?format=${format}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${executingReport.label}_${format}_${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Report exported as ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const filteredReports = reports?.filter((report: any) => {
    const matchesSearch = report.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) || [];

  const getCategoryBadgeVariant = (category: string) => {
    const variants: Record<string, any> = {
      academic: 'default',
      attendance: 'secondary',
      financial: 'outline',
      operational: 'secondary',
      custom: 'outline',
    };
    return variants[category] || 'default';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Categories</option>
            <option value="academic">Academic</option>
            <option value="attendance">Attendance</option>
            <option value="financial">Financial</option>
            <option value="operational">Operational</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {searchTerm || categoryFilter !== 'all' 
                ? 'No reports found matching your filters'
                : 'No custom reports created yet'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Data Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report: any) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {report.isFavorite && (
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        )}
                        <div>
                          <div className="font-medium">{report.label}</div>
                          {report.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {report.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(report.category)}>
                        {report.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.dataSource}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExecute(report)}
                          disabled={isGenerating}
                        >
                          {isGenerating && executingReport?.id === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(report)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(report.id)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => toggleFavoriteMutation.mutate({ 
                                id: report.id, 
                                isFavorite: report.isFavorite 
                              })}
                            >
                              <Star className="w-4 h-4 mr-2" />
                              {report.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(report)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{reportToDelete?.label}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{executingReport?.label}</DialogTitle>
            <DialogDescription>
              Generated {reportData.length} records
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[500px]">
            {reportData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(reportData[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx}>
                      {Object.values(row).map((value: any, colIdx) => (
                        <TableCell key={colIdx} className="text-sm">
                          {value?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No data to display
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <FileText className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={() => setExecuteDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
