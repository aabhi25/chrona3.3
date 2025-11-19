import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, CheckCircle, Clock, XCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

interface LeaveApplication {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherSchoolId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  attachmentUrl?: string;
  appliedAt: string;
}

export default function TeacherLeaveApplicationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    leaveType: "sick",
    reason: "",
  });

  const { data: applications = [], isLoading } = useQuery<LeaveApplication[]>({
    queryKey: ["/api/leave-applications"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/leave-applications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-applications"] });
      setIsDialogOpen(false);
      setFormData({
        startDate: "",
        endDate: "",
        leaveType: "sick",
        reason: "",
      });
      toast({
        title: "Success",
        description: "Leave application submitted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    // Check if start date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(formData.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      toast({
        title: "Validation Error",
        description: "Start date cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast({
        title: "Validation Error",
        description: "End date cannot be before start date",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for leave",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sick: "Medical Leave",
      casual: "Casual Leave",
      personal: "Personal Leave",
      maternity: "Maternity Leave",
      paternity: "Paternity Leave",
      emergency: "Emergency Leave",
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Leave Applications</h1>
          <p className="text-muted-foreground mt-1">Manage your leave requests</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select
                  value={formData.leaveType}
                  onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">Medical Leave</SelectItem>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="maternity">Maternity Leave</SelectItem>
                    <SelectItem value="paternity">Paternity Leave</SelectItem>
                    <SelectItem value="emergency">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Please provide a detailed reason for your leave request"
                  rows={4}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Leave Applications</h3>
            <p className="text-muted-foreground mb-4">
              You haven't submitted any leave applications yet
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Apply for Leave
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => (
            <Card key={application.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {getLeaveTypeLabel(application.leaveType)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {format(new Date(application.startDate), "MMM dd, yyyy")} - {format(new Date(application.endDate), "MMM dd, yyyy")}
                    </CardDescription>
                  </div>
                  {getStatusBadge(application.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Reason</Label>
                    <p className="mt-1">{application.reason}</p>
                  </div>

                  {application.attachmentUrl && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Attachment</Label>
                      <p className="mt-1">
                        <a
                          href={application.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    </div>
                  )}

                  {application.status !== 'pending' && application.reviewNotes && (
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        {application.status === 'approved' ? 'Approval' : 'Rejection'} Notes
                      </Label>
                      <p className="mt-1">{application.reviewNotes}</p>
                    </div>
                  )}

                  <div className="flex gap-4 text-sm text-muted-foreground pt-2 border-t">
                    <span>Applied: {format(new Date(application.appliedAt), "MMM dd, yyyy 'at' hh:mm a")}</span>
                    {application.reviewedAt && (
                      <span>Reviewed: {format(new Date(application.reviewedAt), "MMM dd, yyyy 'at' hh:mm a")}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
