import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, CheckCircle, Clock, XCircle, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

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

export default function LeaveApplicationsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedApplication, setSelectedApplication] = useState<LeaveApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  const { data: applications = [], isLoading } = useQuery<LeaveApplication[]>({
    queryKey: ["leave-applications", activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "all") {
        params.append("status", activeTab);
      }
      
      const res = await apiRequest("GET", `/api/leave-applications?${params.toString()}`);
      return res.json();
    },
    enabled: !!user && user.role === 'admin',
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string; action: 'approve' | 'reject'; notes?: string }) => {
      const res = await apiRequest("POST", `/api/leave-applications/${id}/${action}`, { reviewNotes: notes });
      return res.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      setSelectedApplication(null);
      setReviewNotes("");
      setReviewAction(null);
      toast({
        title: "Success",
        description: `Leave application ${action}d successfully`,
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

  const confirmReview = () => {
    if (!selectedApplication || !reviewAction) return;

    reviewMutation.mutate({
      id: selectedApplication.id,
      action: reviewAction,
      notes: reviewNotes.trim() || undefined,
    });
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

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Applications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No Applications Found</p>
                <p className="text-sm text-muted-foreground">
                  There are no {activeTab !== 'all' ? activeTab : ''} leave applications
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((application) => (
                  <Card key={application.id} className="border p-4 pb-2">
                    <CardContent className="p-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {application.teacherName} ({application.teacherSchoolId})
                              </span>
                              <button
                                onClick={() => setLocation(`/teacher/${application.teacherId}`)}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                View Profile
                              </button>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{getLeaveTypeLabel(application.leaveType)}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(application.startDate), "MMM dd, yyyy")} - {format(new Date(application.endDate), "MMM dd, yyyy")} ({calculateDuration(application.startDate, application.endDate)})
                            </p>
                          </div>
                          {getStatusBadge(application.status)}
                        </div>

                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason:</span> {application.reason}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <span>Applied: {format(new Date(application.appliedAt), "MMM dd, yyyy 'at' hh:mm a")}</span>
                          {application.reviewedAt && (
                            <span className="ml-4">Reviewed: {format(new Date(application.reviewedAt), "MMM dd, yyyy 'at' hh:mm a")}</span>
                          )}
                        </div>

                        {application.status === 'pending' && (
                          <div className="flex gap-1.5 pt-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedApplication(application);
                                setConfirmAction('approve');
                                setShowConfirmDialog(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedApplication(application);
                                setConfirmAction('reject');
                                setShowConfirmDialog(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={(open) => {
          if (!open) {
            setShowConfirmDialog(false);
            setConfirmAction(null);
            setSelectedApplication(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-lg">
                Confirm {confirmAction === 'approve' ? 'Approval' : 'Rejection'}
              </DialogTitle>
            </DialogHeader>

            {selectedApplication && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to {confirmAction} the leave application for{" "}
                  <strong>{selectedApplication.teacherName}</strong> from{" "}
                  <strong>{format(new Date(selectedApplication.startDate), "MMM dd, yyyy")}</strong> to{" "}
                  <strong>{format(new Date(selectedApplication.endDate), "MMM dd, yyyy")}</strong>?
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setConfirmAction(null);
                      setSelectedApplication(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant={confirmAction === 'approve' ? 'default' : 'destructive'}
                    className={confirmAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setReviewAction(confirmAction);
                      setReviewNotes("");
                    }}
                  >
                    {confirmAction === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Review Notes Dialog */}
        <Dialog open={reviewAction !== null} onOpenChange={(open) => {
          if (!open) {
            setReviewAction(null);
            setSelectedApplication(null);
            setReviewNotes("");
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-lg">
                {reviewAction === 'approve' ? 'Approve' : 'Reject'} Leave Application
              </DialogTitle>
            </DialogHeader>

            {selectedApplication && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Teacher</Label>
                  <p className="text-sm font-semibold">{selectedApplication.teacherName}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leave Period</Label>
                  <p className="text-sm">
                    {format(new Date(selectedApplication.startDate), "MMM dd, yyyy")} - {format(new Date(selectedApplication.endDate), "MMM dd, yyyy")}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leave Type</Label>
                  <p className="text-sm">{getLeaveTypeLabel(selectedApplication.leaveType)}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reviewNotes" className="text-sm">
                    Review Notes {reviewAction === 'reject' && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    id="reviewNotes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewAction === 'approve'
                        ? "Optional: Add any notes about this approval"
                        : "Required: Please provide a reason for rejection"
                    }
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReviewAction(null);
                      setSelectedApplication(null);
                      setReviewNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewAction === 'approve' ? 'default' : 'destructive'}
                    className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={confirmReview}
                    disabled={reviewMutation.isPending || (reviewAction === 'reject' && !reviewNotes.trim())}
                  >
                    {reviewMutation.isPending
                      ? `${reviewAction === 'approve' ? 'Approving' : 'Rejecting'}...`
                      : `Confirm ${reviewAction === 'approve' ? 'Approval' : 'Rejection'}`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
