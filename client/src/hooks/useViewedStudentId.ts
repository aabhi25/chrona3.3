import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

// The student whose pages are being shown: the student themselves, or a parent's (first) child
export function useViewedStudentId(): string | undefined {
  const { user } = useAuth();
  const isParent = user?.role === "parent" && !!user?.parentId;

  const { data: children } = useQuery<{ id: string }[]>({
    queryKey: ["/api/parents", user?.parentId, "children"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/parents/${user?.parentId}/children`);
      return response.json();
    },
    enabled: isParent,
  });

  if (user?.role === "student") return user.studentId ?? undefined;
  if (isParent) return children?.[0]?.id;
  return undefined;
}
