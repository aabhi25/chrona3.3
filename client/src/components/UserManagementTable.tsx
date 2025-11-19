import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CredentialStatusBadge } from "./CredentialStatusBadge";
import { ViewCredentialsModal } from "./ViewCredentialsModal";
import { BulkGenerateDialog } from "./BulkGenerateDialog";
import { Search, Eye, RefreshCw, Mail, MessageSquare, Users, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type CredentialStatus = 'active' | 'expires_soon' | 'expired' | 'not_generated';

interface ParentData {
  id: string;
  userId: string | null;
  name: string;
  loginId: string | null;
  email: string | null;
  phone: string | null;
  credentialStatus: CredentialStatus;
  expiresAt: string | Date | null;
}

interface User {
  id: string;
  userId: string | null;
  name: string;
  admissionNumber?: string;
  className?: string | null;
  employeeId?: string;
  schoolId?: string;
  loginId: string | null;
  email: string | null;
  phone: string | null;
  credentialStatus: CredentialStatus;
  expiresAt: string | Date | null;
  parent?: ParentData | null;
}

interface UserManagementTableProps {
  role: 'student' | 'teacher' | 'parent';
}

export function UserManagementTable({ role }: UserManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [viewCredentialsUser, setViewCredentialsUser] = useState<User | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [viewCredentials, setViewCredentials] = useState<{
    loginId: string;
    temporaryPassword: string;
    expiresAt: string | Date;
  } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [refreshingUserId, setRefreshingUserId] = useState<string | null>(null);
  const [confirmRefresh, setConfirmRefresh] = useState<{
    user: User;
    isParent: boolean;
  } | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressData, setProgressData] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);

  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: [`/api/user-management/users?role=${role}&page=${page}&limit=50`],
    refetchInterval: 30000,
  });
  
  const users = data?.users || [];
  const pagination = data?.pagination;

  const refreshCredentialsMutation = useMutation({
    mutationFn: async ({ userId, isParent }: { userId: string; isParent?: boolean }) => {
      let endpoint: string;
      if (isParent) {
        endpoint = `/api/parents/${userId}/credentials/refresh`;
      } else {
        endpoint = role === 'student' 
          ? `/api/students/${userId}/credentials/refresh`
          : `/api/teachers/${userId}/credentials/refresh`;
      }
      
      const response = await apiRequest('POST', endpoint);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to refresh credentials');
      }
      
      const data = await response.json();
      return { isParent, ...data };
    },
    onSuccess: async (data) => {
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith(`/api/user-management/users?role=${role}`)
      });
      
      setViewCredentials({
        loginId: data.loginId,
        temporaryPassword: data.temporaryPassword,
        expiresAt: data.expiresAt
      });
      if (data.isParent) {
        const user = users.find(u => u.parent?.userId === data.userId);
        if (user?.parent) {
          setViewCredentialsUser({ ...user.parent, admissionNumber: user.admissionNumber } as User);
        }
      } else {
        setViewCredentialsUser(users.find(u => u.userId === data.userId) || null);
      }
      toast({
        title: "Credentials Refreshed",
        description: "New login credentials have been generated successfully."
      });
      setRefreshingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh credentials",
        variant: "destructive"
      });
      setRefreshingUserId(null);
    }
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user-management/bulk-generate-credentials', { role });
      return await response.json();
    },
    onMutate: () => {
      setShowProgressDialog(true);
      setProgressData({ current: 0, total: 0 });
    },
    onSuccess: async (data) => {
      if (data.progressId) {
        setProgressId(data.progressId);
      }
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith(`/api/user-management/users?role=${role}`)
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate credentials",
        variant: "destructive"
      });
      setShowProgressDialog(false);
      setProgressData(null);
      setProgressId(null);
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', '/api/user-management/send-credentials', { userId });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Provider Not Configured",
        description: "Email notification provider is not configured. Credentials were logged to console.",
        variant: "default"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive"
      });
    }
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', '/api/user-management/send-credentials-sms', { userId });
      
      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Provider Not Configured",
        description: "SMS notification provider is not configured. Credentials were logged to console.",
        variant: "default"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send SMS",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (!progressId || !showProgressDialog) return;

    let intervalId: NodeJS.Timeout;
    let hasCompleted = false;

    const pollProgress = async () => {
      try {
        const response = await apiRequest('GET', `/api/user-management/bulk-progress/${progressId}`);
        if (response.ok) {
          const data = await response.json();
          setProgressData({ current: data.current, total: data.total });
          
          if (data.completed && !hasCompleted) {
            hasCompleted = true;
            clearInterval(intervalId);
            
            setTimeout(() => {
              setShowProgressDialog(false);
              setProgressData(null);
              setProgressId(null);
              toast({
                title: "Bulk Generation Complete",
                description: `Generated credentials for ${data.current} out of ${data.total} ${role}s.`
              });
            }, 500);
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    };

    intervalId = setInterval(pollProgress, 200);

    return () => clearInterval(intervalId);
  }, [progressId, showProgressDialog, role, toast]);

  const uniqueClasses = useMemo(() => {
    if (role !== 'student') return [];
    
    const classes = new Set<string>();
    users.forEach(user => {
      if (user.className) {
        classes.add(user.className);
      }
    });
    
    // Sort classes naturally (1, 2, 10, 1 A, 2 A, etc.)
    return Array.from(classes).sort((a, b) => {
      const aMatch = a.match(/^(\d+)\s*(.*)$/);
      const bMatch = b.match(/^(\d+)\s*(.*)$/);
      
      if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1]);
        const bNum = parseInt(bMatch[1]);
        if (aNum !== bNum) return aNum - bNum;
        return aMatch[2].localeCompare(bMatch[2]);
      }
      
      return a.localeCompare(b);
    });
  }, [users, role]);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.loginId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.schoolId?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || user.credentialStatus === statusFilter;
      
      const matchesClass = role !== 'student' || classFilter === 'all' || user.className === classFilter;

      return matchesSearch && matchesStatus && matchesClass;
    });

    // Sort students by name
    if (role === 'student') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return filtered;
  }, [users, searchQuery, statusFilter, classFilter, role]);

  const toggleRow = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleRefresh = (user: User, isParent = false) => {
    setConfirmRefresh({ user, isParent });
  };

  const confirmRegenerateCredentials = () => {
    if (!confirmRefresh) return;
    
    const { user, isParent } = confirmRefresh;
    
    // For parent: use parent entity ID for the API, but parent userId for tracking
    const targetEntityId = isParent ? (user.parent?.id || '') : (user.id || '');
    const trackingId = isParent ? (user.parent?.userId || user.parent?.id || '') : (user.id || '');
    
    if (!targetEntityId) {
      toast({
        title: "Error",
        description: "User account not found",
        variant: "destructive"
      });
      setConfirmRefresh(null);
      return;
    }
    
    setRefreshingUserId(trackingId);
    refreshCredentialsMutation.mutate({ userId: targetEntityId, isParent });
    setConfirmRefresh(null);
  };

  const handleSendEmail = (user: User, isParent = false) => {
    const targetUserId = isParent ? user.parent?.userId : user.userId;
    if (!targetUserId) {
      toast({
        title: "Error",
        description: "User account not found",
        variant: "destructive"
      });
      return;
    }
    sendEmailMutation.mutate(targetUserId);
  };

  const handleSendSms = (user: User, isParent = false) => {
    const targetUserId = isParent ? user.parent?.userId : user.userId;
    if (!targetUserId) {
      toast({
        title: "Error",
        description: "User account not found",
        variant: "destructive"
      });
      return;
    }
    sendSmsMutation.mutate(targetUserId);
  };

  const handleBulkGenerate = async () => {
    await bulkGenerateMutation.mutateAsync();
  };

  const getParentStatusBadge = (parent: ParentData | null | undefined) => {
    if (!parent) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-xs">
          Parent Not Registered
        </Badge>
      );
    }

    const statusColors: Record<CredentialStatus, string> = {
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      expires_soon: "bg-orange-100 text-orange-700 hover:bg-orange-100",
      expired: "bg-red-100 text-red-700 hover:bg-red-100",
      not_generated: "bg-gray-100 text-gray-700 hover:bg-gray-100"
    };

    const statusLabels: Record<CredentialStatus, string> = {
      active: "Parent: Active",
      expires_soon: "Parent: Expires Soon",
      expired: "Parent: Expired",
      not_generated: "Login credentials not generated"
    };

    return (
      <Badge 
        variant="secondary" 
        className={`${statusColors[parent.credentialStatus]} text-xs`}
      >
        {statusLabels[parent.credentialStatus]}
      </Badge>
    );
  };

  const idColumnLabel = role === 'teacher' ? 'Emp ID/School ID' : 'Admission Number';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full md:w-auto">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {role === 'student' && (
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map((className) => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expires_soon">Expires Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="not_generated">No Credentials</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setShowBulkDialog(true)}
          disabled={users.length === 0}
          className="w-full md:w-auto"
        >
          <Users className="h-4 w-4 mr-2" />
          Generate for All
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No {role}s found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {role === 'student' && <TableHead className="w-10"></TableHead>}
                <TableHead>Name</TableHead>
                {role === 'student' && <TableHead>Class</TableHead>}
                {role !== 'student' && <TableHead>{idColumnLabel}</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.flatMap((user) => {
                const isExpanded = expandedRows.has(user.id);
                const rows = [
                  <TableRow key={user.id} className={isExpanded ? "border-b-0" : ""}>
                    {role === 'student' && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(user.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{user.name}</span>
                        {role === 'student' && (
                          <div>
                            {getParentStatusBadge(user.parent)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {role === 'student' && (
                      <TableCell className="text-sm">
                        {user.className || '-'}
                      </TableCell>
                    )}
                    {role !== 'student' && (
                      <TableCell className="font-mono text-sm">
                        {user.admissionNumber || user.schoolId || '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <CredentialStatusBadge status={user.credentialStatus} />
                    </TableCell>
                    <TableCell>
                      {user.expiresAt
                        ? format(new Date(user.expiresAt), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          {user.credentialStatus !== 'not_generated' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (!user.id) return;
                                    
                                    try {
                                      const endpoint = role === 'student' 
                                        ? `/api/students/${user.id}/credentials`
                                        : `/api/teachers/${user.id}/credentials`;
                                      
                                      const response = await apiRequest('GET', endpoint);
                                      
                                      if (response.ok) {
                                        const data = await response.json();
                                        setViewCredentials({
                                          loginId: data.loginId || data.studentLogin?.loginId,
                                          temporaryPassword: data.temporaryPassword || data.studentLogin?.temporaryPassword,
                                          expiresAt: data.expiresAt || data.studentLogin?.expiresAt
                                        });
                                        setViewCredentialsUser(user);
                                      } else {
                                        const errorData = await response.json().catch(() => ({}));
                                        toast({
                                          title: "Cannot View Credentials",
                                          description: errorData.message || "Please generate credentials first using the refresh button.",
                                          variant: "destructive"
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Failed to fetch credentials:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to fetch credentials. Please try again.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  disabled={false}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Credentials</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRefresh(user)}
                                disabled={refreshingUserId === user.id}
                              >
                                <RefreshCw className={`h-4 w-4 ${refreshingUserId === user.id ? 'animate-spin' : ''}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Regenerate Credentials</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendEmail(user)}
                                disabled={sendEmailMutation.isPending || !user.userId || !user.email}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Send Mail</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendSms(user)}
                                disabled={sendSmsMutation.isPending || !user.userId || !user.phone}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Send SMS</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ];

                if (role === 'student' && isExpanded && user.parent) {
                  rows.push(
                    <TableRow key={`${user.id}-parent`} className="bg-slate-50/30">
                      <TableCell colSpan={6} className="p-4">
                        <div className="bg-white rounded-lg border-l-4 border-l-blue-500 shadow-sm">
                          {/* Header */}
                          <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-transparent">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-blue-600" />
                                <div>
                                  <h4 className="font-semibold text-gray-900">{user.parent.name}</h4>
                                  <p className="text-xs text-muted-foreground">Parent/Guardian</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <CredentialStatusBadge status={user.parent.credentialStatus} />
                                {user.parent.expiresAt && (
                                  <span className="text-xs text-muted-foreground">
                                    Expires {format(new Date(user.parent.expiresAt), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Body */}
                          <div className="px-4 py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Login ID:</span>
                                <span className="font-mono text-sm font-medium">{user.parent.loginId || '-'}</span>
                              </div>
                              
                              <TooltipProvider>
                                <div className="flex gap-2">
                                  {user.parent.credentialStatus !== 'not_generated' && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={async () => {
                                            if (!user.parent?.id) return;
                                            
                                            try {
                                              const response = await apiRequest('GET', `/api/parents/${user.parent.id}/credentials`);
                                              
                                              if (response.ok) {
                                                const data = await response.json();
                                                setViewCredentials({
                                                  loginId: data.loginId,
                                                  temporaryPassword: data.temporaryPassword,
                                                  expiresAt: data.expiresAt
                                                });
                                                setViewCredentialsUser({ 
                                                  ...user.parent, 
                                                  name: user.parent.name,
                                                  admissionNumber: user.admissionNumber 
                                                } as User);
                                              }
                                            } catch (error) {
                                              console.error('Failed to fetch parent credentials:', error);
                                            }
                                          }}
                                          disabled={!user.parent.userId}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>View Credentials</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRefresh(user, true)}
                                        disabled={refreshingUserId === user.parent?.id}
                                      >
                                        <RefreshCw className={`h-4 w-4 ${refreshingUserId === user.parent?.id ? 'animate-spin' : ''}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Regenerate Credentials</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSendEmail(user, true)}
                                        disabled={sendEmailMutation.isPending || !user.parent?.userId || !user.parent?.email}
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Send Mail</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return rows;
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} {role}s
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <div className="text-sm font-medium">
              Page {page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {viewCredentials && viewCredentialsUser && (
        <ViewCredentialsModal
          open={!!viewCredentials}
          onOpenChange={(open) => {
            if (!open) {
              setViewCredentials(null);
              setViewCredentialsUser(null);
            }
          }}
          credentials={viewCredentials}
          userName={viewCredentialsUser.name}
        />
      )}

      <BulkGenerateDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        onConfirm={handleBulkGenerate}
        userCount={users.length}
        role={role}
      />

      <AlertDialog open={!!confirmRefresh} onOpenChange={(open) => !open && setConfirmRefresh(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Credential Regeneration</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRefresh?.isParent ? (
                <>
                  This will regenerate login credentials for the <strong>parent account</strong> of {confirmRefresh.user.name}.
                  The current password will be invalidated and a new temporary password will be generated.
                </>
              ) : (
                <>
                  This will regenerate login credentials for the <strong>{role} account</strong> of {confirmRefresh?.user.name}.
                  The current password will be invalidated and a new temporary password will be generated.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerateCredentials}>
              Regenerate Credentials
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generating Credentials</DialogTitle>
            <DialogDescription>
              Please wait while we generate login credentials for all {role}s.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {progressData?.current || 0}/{progressData?.total || 0} {role}s
                </span>
              </div>
              <Progress 
                value={progressData?.total ? (progressData.current / progressData.total) * 100 : 0} 
                className="h-2"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {progressData?.current === progressData?.total && progressData?.total > 0
                ? "✓ Credential generation complete!"
                : "Generating credentials..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
