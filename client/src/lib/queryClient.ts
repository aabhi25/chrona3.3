import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      let errorData;
      try {
        errorData = await res.json();
      } catch (parseError) {
        // If we can't parse JSON, fall back to status text
        throw new Error(res.statusText);
      }
      // Create a proper Error object with the message from errorData
      const error = new Error(errorData.message || JSON.stringify(errorData));
      // Preserve additional error properties
      Object.assign(error, errorData);
      throw error;
    } else {
      try {
        const text = await res.text();
        throw new Error(text || res.statusText);
      } catch {
        throw new Error(res.statusText);
      }
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {};
  
  // Check if data is FormData (for file uploads)
  const isFormData = data instanceof FormData;
  
  // Only set Content-Type for non-FormData requests
  // FormData automatically sets the correct Content-Type with boundary
  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("authToken");
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
