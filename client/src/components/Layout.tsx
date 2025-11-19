import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import MessageIcon from "@/components/MessageIcon";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile header with hamburger menu */}
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          
          {/* Personalized Greeting for Teachers, Students, and Parents */}
          {user && ['teacher', 'student', 'parent'].includes(user.role) && (
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Hi {(user as any).name || (user as any).firstName || 'there'}!
            </span>
          )}
          
          <div className="ml-auto flex items-center gap-1">
            <MessageIcon />
            <NotificationBell />
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
