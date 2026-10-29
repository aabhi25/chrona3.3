import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  LogOut, 
  Settings, 
  School, 
  Shield, 
  Sparkles,
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  Users,
  UserCheck,
  Building,
  Cog,
  User,
  IndianRupee,
  Truck,
  MessageSquare,
  GripVertical,
  Calculator,
  FileText,
  TrendingUp,
  CalendarClock
} from "lucide-react";
import logoImage from "@assets/chrona-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigationOrder } from "@/hooks/useNavigationOrder";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NavigationItem {
  id: string;
  path: string;
  icon: any;
  label: string;
}

const getNavigationItems = (userRole: string | undefined): NavigationItem[] => {
  // Super Admin: System-wide management and configuration
  if (userRole === "super_admin") {
    return [
      { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
      { id: "admin-dashboard", path: "/admin-dashboard", icon: Building, label: "School Administration" },
    ];
  }

  // School Admin: Manage day-to-day school operations
  if (userRole === "admin") {
    return [
      { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
      { id: "insights", path: "/insights", icon: TrendingUp, label: "Insights" },
      { id: "timetables", path: "/timetable", icon: Calendar, label: "Timetables" },
      { id: "attendance", path: "/attendance", icon: ClipboardCheck, label: "Attendance" },
      { id: "students", path: "/students", icon: GraduationCap, label: "Students" },
      { id: "teachers", path: "/teachers", icon: UserCheck, label: "Teachers" },
      { id: "classes", path: "/classes", icon: Users, label: "Classes" },
      { id: "fees", path: "/fees", icon: IndianRupee, label: "Fees" },
      { id: "smart-reports", path: "/smart-reports", icon: FileText, label: "Smart Reports" },
    ];
  }

  // Teacher: Class management and communication
  if (userRole === "teacher") {
    return [
      { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
      { id: "my-class", path: "/my-class", icon: Users, label: "Class" },
      { id: "my-schedule", path: "/my-schedule", icon: Calendar, label: "Schedule" },
      { id: "attendance", path: "/attendance", icon: ClipboardCheck, label: "Attendance" },
      { id: "leave-application", path: "/leave-application", icon: CalendarClock, label: "Leaves" },
      { id: "my-profile", path: "/my-profile", icon: User, label: "Profile" },
    ];
  }

  // Student: Personal dashboard and profile management
  if (userRole === "student") {
    return [
      { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
      { id: "attendance", path: "/my-attendance", icon: ClipboardCheck, label: "Attendance" },
      { id: "my-class", path: "/my-class", icon: Users, label: "My Class" },
      { id: "my-profile", path: "/my-profile", icon: User, label: "My Profile" },
    ];
  }

  // Parent: Monitor child's progress and communicate with teachers
  if (userRole === "parent") {
    return [
      { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
      { id: "attendance", path: "/my-attendance", icon: ClipboardCheck, label: "Child's Attendance" },
      { id: "my-class", path: "/my-class", icon: Users, label: "Child's Class" },
      { id: "my-profile", path: "/my-profile", icon: User, label: "Child's Profile" },
    ];
  }

  // Default fallback
  return [
    { id: "dashboard", path: "/", icon: LayoutDashboard, label: "Home" },
  ];
};

interface SortableNavItemProps {
  item: NavigationItem;
  isActive: boolean;
}

const SortableNavItem = ({ item, isActive }: SortableNavItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = item.icon;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            {...attributes}
            {...listeners}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Drag to reorder</p>
        </TooltipContent>
      </Tooltip>
      
      <SidebarMenuItem>
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          tooltip={item.label}
          className={cn(isDragging && "cursor-grabbing")}
        >
          <Link href={item.path}>
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
};

export default function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const allNavigationItems = getNavigationItems(user?.role);
  
  const defaultOrder = allNavigationItems.map(item => item.id);
  const { navigationOrder, updateNavigationOrder } = useNavigationOrder(
    user?.id || "",
    defaultOrder
  );

  // Fetch academic sessions
  const { data: sessions } = useQuery({
    queryKey: ["/api/academic-sessions", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/academic-sessions");
      return await response.json();
    },
    enabled: !!user?.schoolId,
  });

  const currentSession = sessions?.find((session: any) => session.isCurrent);
  const sessionDisplay = currentSession 
    ? `${new Date(currentSession.startDate).getFullYear()}-${new Date(currentSession.endDate).getFullYear()}`
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = navigationOrder.indexOf(active.id as string);
      const newIndex = navigationOrder.indexOf(over.id as string);

      const newOrder = arrayMove(navigationOrder, oldIndex, newIndex);
      updateNavigationOrder(newOrder);
    }
  };

  // Reorder navigation items based on saved order
  const orderedNavigationItems = navigationOrder
    .map(id => allNavigationItems.find(item => item.id === id))
    .filter(Boolean) as NavigationItem[];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return Shield;
      case "admin":
        return School;
      default:
        return User;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "School Admin";
      case "teacher":
        return "Teacher";
      case "student":
        return "Student";
      case "parent":
        return "Parent";
      default:
        return "User";
    }
  };

  const RoleIcon = getRoleIcon(user?.role || "");

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" className="gap-1">
                <img 
                  src={logoImage} 
                  alt="Chrona Logo" 
                  className="size-11 object-contain -mr-4"
                />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate font-semibold">AI Chrona</span>
                  {sessionDisplay && (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {sessionDisplay}
                    </span>
                  )}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="flex flex-col">
        {/* Navigation with Drag and Drop - Limited height to leave room for footer */}
        <div className="flex-1 overflow-y-auto pb-[300px]">
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <TooltipProvider>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={navigationOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <SidebarMenu>
                      {orderedNavigationItems.map((item) => (
                        <SortableNavItem
                          key={item.id}
                          item={item}
                          isActive={location === item.path}
                        />
                      ))}
                    </SidebarMenu>
                  </SortableContext>
                </DndContext>
              </TooltipProvider>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
        
        {/* Footer Actions - Fixed spacing from bottom */}
        <div className="mt-auto bg-sidebar pt-3 pb-8">
          <SidebarMenu className="gap-0.5">
            {(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'student') && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="More">
                  <Link href="/more">
                    <Sparkles className="size-4" />
                    <span>More</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings">
                <Link href="/settings">
                  <Settings className="size-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={logout}
                tooltip="Logout"
                className="text-destructive hover:text-destructive dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
              >
                <LogOut className="size-4" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
      
      <SidebarRail />
    </Sidebar>
  );
}
