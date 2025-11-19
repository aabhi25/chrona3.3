import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function MessageIcon() {
  const [location, setLocation] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/unread-count");
      return response.json() as Promise<{ count: number }>;
    },
    refetchInterval: 5000,
  });

  const unreadCount = unreadData?.count || 0;

  const handleMessageClick = () => {
    if (location.startsWith('/messages')) {
      return;
    }
    setLocation(`/messages?from=${encodeURIComponent(location)}`);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative group hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/30 dark:hover:to-indigo-950/30 transition-all duration-300 rounded-xl h-12 w-12"
      onClick={handleMessageClick}
    >
      <MessageSquare className="h-7 w-7 text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300" strokeWidth={2} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs flex items-center justify-center font-semibold shadow-lg shadow-blue-500/50 animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
