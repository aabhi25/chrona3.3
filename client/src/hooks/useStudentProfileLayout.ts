import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ProfileLayout {
  leftColumn: string[];
  rightColumn: string[];
}

interface UseStudentProfileLayoutReturn {
  layout: ProfileLayout;
  updateLayout: (newLayout: ProfileLayout) => void;
  resetToDefault: () => void;
  isLoading: boolean;
}

const DEFAULT_LAYOUT: ProfileLayout = {
  leftColumn: ['personal-info', 'login-credentials'],
  rightColumn: ['parents-guardians', 'attendance-history']
};

export function useStudentProfileLayout(studentId: string): UseStudentProfileLayoutReturn {
  const [layout, setLayout] = useState<ProfileLayout>(DEFAULT_LAYOUT);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getStorageKey = useCallback(() => {
    return `student-profile-layout-${studentId}`;
  }, [studentId]);

  useEffect(() => {
    const storageKey = getStorageKey();
    const storedLayout = localStorage.getItem(storageKey);
    
    if (storedLayout) {
      try {
        const parsedLayout = JSON.parse(storedLayout);
        setLayout(parsedLayout);
      } catch (error) {
        console.warn('Failed to parse stored layout, using default', error);
        setLayout(DEFAULT_LAYOUT);
      }
    }
  }, [studentId, getStorageKey]);

  const saveToLocalStorage = useCallback((newLayout: ProfileLayout) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const storageKey = getStorageKey();
      try {
        localStorage.setItem(storageKey, JSON.stringify(newLayout));
      } catch (error) {
        console.warn('Failed to save layout to localStorage', error);
      }
    }, 300);
  }, [getStorageKey]);

  const mutation = useMutation({
    mutationFn: async (newLayout: ProfileLayout) => {
      const response = await apiRequest(
        "POST",
        "/api/user-preferences/student-profile-layout",
        { studentId, layout: newLayout }
      );
      return response.json();
    },
    onError: (error) => {
      console.warn('Failed to persist layout to server, using localStorage fallback', error);
    }
  });

  const updateLayout = useCallback((newLayout: ProfileLayout) => {
    setLayout(newLayout);
    saveToLocalStorage(newLayout);
    mutation.mutate(newLayout);
  }, [saveToLocalStorage, mutation]);

  const resetToDefault = useCallback(() => {
    const storageKey = getStorageKey();
    
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear localStorage', error);
    }

    setLayout(DEFAULT_LAYOUT);
    
    mutation.mutate(DEFAULT_LAYOUT);
  }, [getStorageKey, mutation]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    layout,
    updateLayout,
    resetToDefault,
    isLoading: mutation.isPending
  };
}
