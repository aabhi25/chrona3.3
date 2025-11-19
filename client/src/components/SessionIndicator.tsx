import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface AcademicSession {
  id: string;
  name: string;
  schoolYear: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  schoolId: string;
}

export default function SessionIndicator() {
  const { user } = useAuth();

  // Fetch academic sessions
  const { data: sessions } = useQuery({
    queryKey: ["/api/academic-sessions", user?.schoolId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/academic-sessions");
      return await response.json();
    },
    enabled: !!user?.schoolId,
  });

  const currentSession = sessions?.find((session: AcademicSession) => session.isCurrent);

  // Show for all users if there's a current session
  if (!user || !currentSession) {
    return null;
  }

  const startYear = new Date(currentSession.startDate).getFullYear();
  const endYear = new Date(currentSession.endDate).getFullYear();

  return (
    <div className="flex items-center">
      <span className="text-[10px] text-muted-foreground/70 font-medium">
        {startYear}-{endYear}
      </span>
    </div>
  );
}