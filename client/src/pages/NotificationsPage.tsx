import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, AlertTriangle, Calendar, Users, ArrowRight, FileText, BookOpen, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useMemo, useEffect } from "react";

interface UrgentSubstitution {
  id: string;
  originalTeacher: {
    id: string;
    name: string;
    [key: string]: any;
  };
  originalTeacherId: string;
  class: {
    id: string;
    name: string;
  };
  period: number;
  date: string;
  createdAt?: string;
  subject?: {
    id: string;
    name: string;
  };
  isRead?: boolean;
}

interface TimetableChange {
  id: string;
  change_date: string;
  [key: string]: any;
}

interface GroupedSubstitution {
  teacherName: string;
  teacherId: string;
  date: string;
  substitutionIds: string[];
  classes: Array<{
    className: string;
    classId: string;
    period: number;
    subject?: string;
  }>;
}

interface UnifiedNotification {
  id: string;
  schoolId: string;
  recipientId: string;
  recipientRole: 'student' | 'teacher' | 'parent' | 'admin';
  type: string;
  title: string;
  message: string;
  metadata: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isSchoolAdmin = user?.role === "admin";

  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const fromLocation = urlParams.get('from') || '/';

  const { data: pendingTimetableChanges = [], isLoading: loadingChanges } = useQuery<TimetableChange[]>({
    queryKey: ["/api/timetable-changes/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/timetable-changes/active`);
      return response.json() as Promise<TimetableChange[]>;
    },
    enabled: isSchoolAdmin,
    refetchInterval: 30000,
  });

  const { data: urgentSubstitutions = [], isLoading: loadingSubstitutions } = useQuery<UrgentSubstitution[]>({
    queryKey: ["/api/substitutions/urgent"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/substitutions/urgent`);
      return response.json() as Promise<UrgentSubstitution[]>;
    },
    enabled: isSchoolAdmin,
    refetchInterval: 30000,
  });

  // Unified notifications for all roles
  const { data: unifiedNotifications = [], isLoading: loadingUnified } = useQuery<UnifiedNotification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications?limit=50");
      return response.json() as Promise<UnifiedNotification[]>;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const groupedSubstitutions = useMemo(() => {
    // First, group by teacher and date
    const dailyGroups = new Map<string, GroupedSubstitution & { isRead: boolean; createdAt: string }>();

    urgentSubstitutions.forEach((sub) => {
      const key = `${sub.originalTeacherId}-${sub.date}`;
      
      if (!dailyGroups.has(key)) {
        dailyGroups.set(key, {
          teacherName: sub.originalTeacher.name,
          teacherId: sub.originalTeacherId,
          date: sub.date,
          substitutionIds: [],
          classes: [],
          isRead: sub.isRead || false,
          createdAt: sub.createdAt || sub.date,
        });
      }

      const group = dailyGroups.get(key)!;
      group.substitutionIds.push(sub.id);
      group.classes.push({
        className: sub.class.name,
        classId: sub.class.id,
        period: sub.period,
        subject: sub.subject?.name,
      });
      // If any substitution in the group is unread, mark the whole group as unread
      if (!sub.isRead) {
        group.isRead = false;
      }
      // Use the earliest createdAt for the group
      if (sub.createdAt && sub.createdAt < group.createdAt) {
        group.createdAt = sub.createdAt;
      }
    });

    // Then, consolidate consecutive days for the same teacher into leave periods
    const teacherGroups = new Map<string, Array<typeof dailyGroups extends Map<string, infer T> ? T : never>>();
    
    dailyGroups.forEach((group) => {
      if (!teacherGroups.has(group.teacherId)) {
        teacherGroups.set(group.teacherId, []);
      }
      teacherGroups.get(group.teacherId)!.push(group);
    });

    // For each teacher, check if they have multiple consecutive days
    const consolidatedGroups: Array<GroupedSubstitution & { isRead: boolean; createdAt: string; endDate?: string; isLeave: boolean }> = [];
    
    teacherGroups.forEach((teacherDailyGroups) => {
      // Sort by date
      const sortedGroups = teacherDailyGroups.sort((a, b) => a.date.localeCompare(b.date));
      
      if (sortedGroups.length > 1) {
        // Multiple days - treat as leave period
        const allClasses: any[] = [];
        const allSubIds: string[] = [];
        let hasUnread = false;
        
        sortedGroups.forEach(g => {
          allClasses.push(...g.classes);
          allSubIds.push(...g.substitutionIds);
          if (!g.isRead) hasUnread = true;
        });
        
        consolidatedGroups.push({
          ...sortedGroups[0],
          endDate: sortedGroups[sortedGroups.length - 1].date,
          classes: allClasses,
          substitutionIds: allSubIds,
          isRead: !hasUnread,
          isLeave: true
        });
      } else {
        // Single day - absent
        consolidatedGroups.push({
          ...sortedGroups[0],
          isLeave: false
        });
      }
    });

    // Sort groups by createdAt descending (most recent first)
    return consolidatedGroups.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [urgentSubstitutions]);

  const queryClient = useQueryClient();

  const markAsViewedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/mark-viewed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/substitutions/urgent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable-changes/active"] });
    },
  });

  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PUT", `/api/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/mark-all-read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    if (isSchoolAdmin && (urgentSubstitutions.length > 0 || pendingTimetableChanges.length > 0)) {
      markAsViewedMutation.mutate();
    }
  }, []);

  const handleClose = () => {
    setLocation(fromLocation);
  };

  const handleAssignSubstitution = () => {
    setLocation('/timetable?tab=substitutions');
  };

  // Count only unread notifications
  const unreadSubstitutions = groupedSubstitutions.filter(g => !g.isRead).length;
  const unreadUnified = unifiedNotifications.filter(n => !n.isRead).length;
  
  // Total unread count
  const totalNotifications = (isSchoolAdmin ? (pendingTimetableChanges.length + unreadSubstitutions) : 0) + unreadUnified;
  
  // Total notifications count (including read)
  const totalAllNotifications = (isSchoolAdmin ? (pendingTimetableChanges.length + groupedSubstitutions.length) : 0) + unifiedNotifications.length;
  
  const isLoading = loadingChanges || loadingSubstitutions || loadingUnified;

  // Helper function to get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'circular_posted':
        return <FileText className="h-7 w-7 text-white" />;
      case 'resource_posted':
        return <BookOpen className="h-7 w-7 text-white" />;
      default:
        return <Bell className="h-7 w-7 text-white" />;
    }
  };

  // Helper function to get notification color based on type
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'circular_posted':
        return 'from-blue-400 to-indigo-500';
      case 'resource_posted':
        return 'from-green-400 to-emerald-500';
      default:
        return 'from-purple-400 to-pink-500';
    }
  };

  // Allow all authenticated users (removed admin-only restriction)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              Notifications
            </h1>
            <p className="text-lg text-muted-foreground">
              {isLoading ? (
                "Loading notifications..."
              ) : totalNotifications > 0 ? (
                `You have ${totalNotifications} unread notification${totalNotifications !== 1 ? 's' : ''}`
              ) : totalAllNotifications > 0 ? (
                `Showing ${totalAllNotifications} notification${totalAllNotifications !== 1 ? 's' : ''} (all read)`
              ) : (
                "You're all caught up!"
              )}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all duration-200"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 animate-pulse"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : totalAllNotifications === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-20 animate-pulse" />
              <Bell className="relative h-32 w-32 text-gray-300 dark:text-gray-600 mb-8" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No notifications
            </h2>
            <p className="text-gray-500 dark:text-gray-400">You're all caught up! Check back later.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Mark All As Read Button */}
            {totalNotifications > 0 && (
              <div className="flex justify-end mb-4">
                <Button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  variant="outline"
                  className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform duration-200" />
                  Mark All as Read
                </Button>
              </div>
            )}

            {/* Unified Notifications */}
            {unifiedNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-white/50 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700 transform hover:-translate-y-1 ${
                  notification.isRead ? 'opacity-60' : ''
                }`}
                style={{
                  animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
                }}
                onClick={() => {
                  if (!notification.isRead) {
                    markNotificationAsReadMutation.mutate(notification.id);
                  }
                }}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 bg-gradient-to-br ${getNotificationColor(notification.type)} rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                    notification.isRead ? 'opacity-70' : ''
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-orange-500 text-white shrink-0">
                          New
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {notification.message}
                    </p>

                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(notification.createdAt), 'MMM dd, yyyy')} at{' '}
                        {new Date(notification.createdAt).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Admin-specific notifications (only for admins) */}
            {isSchoolAdmin && groupedSubstitutions.map((group, index) => (
              <div
                key={group.substitutionIds.join('-')}
                className={`group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-white/50 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-700 transform hover:-translate-y-1 ${
                  group.isRead ? 'opacity-60' : ''
                }`}
                style={{
                  animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
                }}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                    group.isRead ? 'opacity-70' : ''
                  }`}>
                    <AlertTriangle className="h-7 w-7 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {(group as any).isLeave ? (
                        <>
                          {group.teacherName} is on leave from{' '}
                          <span className="text-orange-600 dark:text-orange-400">
                            {format(new Date(group.date), 'MMM dd')}
                          </span>
                          {' to '}
                          <span className="text-orange-600 dark:text-orange-400">
                            {format(new Date((group as any).endDate), 'MMM dd, yyyy')}
                          </span>
                        </>
                      ) : (
                        <>
                          {group.teacherName} is absent on{' '}
                          <span className="text-orange-600 dark:text-orange-400">
                            {format(new Date(group.date), 'MMM dd, yyyy')}
                          </span>
                        </>
                      )}
                    </h3>
                    
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3 space-x-4">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Notified on {format(new Date(group.createdAt), 'MMM dd, yyyy')} at{' '}
                          {new Date(group.createdAt).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>
                          {group.classes.length} class{group.classes.length !== 1 ? 'es' : ''} affected
                        </span>
                      </div>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-300 mb-2">
                        Classes affected:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.classes.map((cls, idx) => (
                          <span
                            key={`${cls.classId}-${cls.period}`}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-800 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700"
                          >
                            {cls.className} (Period {cls.period})
                          </span>
                        ))}
                      </div>
                    </div>

                    {!group.isRead && (
                      <Button
                        onClick={handleAssignSubstitution}
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md hover:shadow-lg transition-all duration-300 group/btn"
                      >
                        Assign Substitution
                        <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {pendingTimetableChanges.map((change, index) => (
              <div
                key={change.id}
                className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-white/50 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-700 transform hover:-translate-y-1"
                style={{
                  animation: `slideIn 0.5s ease-out ${(groupedSubstitutions.length + index) * 0.1}s both`,
                }}
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-gradient-to-br from-red-400 to-pink-500 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <AlertTriangle className="h-7 w-7 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Pending Timetable Change
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Review and assign substitute teachers for this change
                    </p>

                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4 space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {change.change_date
                          ? format(new Date(change.change_date), 'MMM dd, yyyy')
                          : 'Today'}
                      </span>
                    </div>

                    <Button
                      onClick={handleAssignSubstitution}
                      className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-300 group/btn"
                    >
                      Review Changes
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
