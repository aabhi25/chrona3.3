import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useMemo } from "react";

export default function NotificationBell() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isSchoolAdmin = user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const isParent = user?.role === "parent";

  // Admin-specific notifications
  const { data: pendingTimetableChanges = [] } = useQuery<any[]>({
    queryKey: ["/api/timetable-changes/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/timetable-changes/active`);
      return response.json() as Promise<any[]>;
    },
    enabled: isSchoolAdmin,
    refetchInterval: 30000,
  });

  const { data: urgentSubstitutions = [] } = useQuery<any[]>({
    queryKey: ["/api/substitutions/urgent"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/substitutions/urgent`);
      return response.json() as Promise<any[]>;
    },
    enabled: isSchoolAdmin,
    refetchInterval: 30000,
  });

  // Unread messages count for all users
  const { data: unreadMessagesData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/unread-count");
      return response.json() as Promise<{ unreadCount: number }>;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Unified notifications count for all users
  const { data: unreadNotificationsData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications/unread-count");
      return response.json() as Promise<{ unreadCount: number }>;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Group substitutions by teacher+date (same logic as NotificationsPage)
  const groupedSubstitutions = useMemo(() => {
    const groups = new Map<string, { isRead: boolean }>();

    urgentSubstitutions.forEach((sub: any) => {
      const key = `${sub.originalTeacherId}-${sub.date}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          isRead: sub.isRead || false,
        });
      }

      // If any substitution in the group is unread, mark the whole group as unread
      const group = groups.get(key)!;
      if (!sub.isRead) {
        group.isRead = false;
      }
    });

    return Array.from(groups.values());
  }, [urgentSubstitutions]);

  // Calculate total notifications based on user role
  let totalNotifications = 0;
  
  if (isSchoolAdmin) {
    // School Admin: timetable changes + urgent substitutions + unread messages + unified notifications
    const unreadSubstitutions = groupedSubstitutions.filter(g => !g.isRead).length;
    totalNotifications = pendingTimetableChanges.length + unreadSubstitutions + (unreadMessagesData?.unreadCount || 0) + (unreadNotificationsData?.unreadCount || 0);
  } else if (isSuperAdmin || isTeacher || isStudent || isParent) {
    // Super Admin, Teachers, Students, Parents: unread messages + unified notifications
    totalNotifications = (unreadMessagesData?.unreadCount || 0) + (unreadNotificationsData?.unreadCount || 0);
  }

  const handleNotificationClick = () => {
    // All roles go to unified notifications page
    if (location.startsWith('/notifications')) {
      return;
    }
    setLocation(`/notifications?from=${encodeURIComponent(location)}`);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative group hover:bg-gradient-to-br hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-950/30 dark:hover:to-orange-950/30 transition-all duration-300 rounded-xl h-12 w-12"
      onClick={handleNotificationClick}
    >
      <Bell className="h-7 w-7 text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors duration-300" strokeWidth={2} />
      {totalNotifications > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-red-500 to-orange-600 text-white text-xs flex items-center justify-center font-semibold shadow-lg shadow-red-500/50 animate-pulse">
          {totalNotifications > 99 ? '99+' : totalNotifications}
        </span>
      )}
    </Button>
  );
}
