import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UseNavigationOrderReturn {
  navigationOrder: string[];
  updateNavigationOrder: (newOrder: string[]) => void;
  resetToDefault: () => void;
  isLoading: boolean;
}

export function useNavigationOrder(
  userId: string,
  defaultOrder: string[]
): UseNavigationOrderReturn {
  const [navigationOrder, setNavigationOrder] = useState<string[]>(defaultOrder);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getStorageKey = useCallback(() => {
    return `navigation-order-${userId}`;
  }, [userId]);

  useEffect(() => {
    const storageKey = getStorageKey();
    const storedOrder = localStorage.getItem(storageKey);
    
    if (storedOrder) {
      try {
        const parsedOrder = JSON.parse(storedOrder);
        if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
          setNavigationOrder(parsedOrder);
        }
      } catch (error) {
        console.warn('Failed to parse stored navigation order, using default', error);
        setNavigationOrder(defaultOrder);
      }
    }
  }, [userId, getStorageKey, defaultOrder]);

  const saveToLocalStorage = useCallback((newOrder: string[]) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const storageKey = getStorageKey();
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch (error) {
        console.warn('Failed to save navigation order to localStorage', error);
      }
    }, 300);
  }, [getStorageKey]);

  const mutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      const response = await apiRequest(
        "POST",
        "/api/user-preferences/navigation-order",
        { order: newOrder }
      );
      return response.json();
    },
    onError: (error) => {
      console.warn('Failed to persist navigation order to server, using localStorage fallback', error);
    }
  });

  const updateNavigationOrder = useCallback((newOrder: string[]) => {
    setNavigationOrder(newOrder);
    saveToLocalStorage(newOrder);
    mutation.mutate(newOrder);
  }, [saveToLocalStorage, mutation]);

  const resetToDefault = useCallback(() => {
    setNavigationOrder(defaultOrder);
    saveToLocalStorage(defaultOrder);
    mutation.mutate(defaultOrder);
  }, [defaultOrder, saveToLocalStorage, mutation]);

  return {
    navigationOrder,
    updateNavigationOrder,
    resetToDefault,
    isLoading: mutation.isPending,
  };
}
