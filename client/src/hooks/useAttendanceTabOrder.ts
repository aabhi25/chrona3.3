import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';

export type AttendanceTabId = 'overview' | 'teachers' | 'students' | 'leave';

const DEFAULT_TAB_ORDER: AttendanceTabId[] = ['overview', 'teachers', 'students', 'leave'];
const STORAGE_KEY = 'attendance-tab-order';

interface TabOrderState {
  tabs: AttendanceTabId[];
}

export function useAttendanceTabOrder() {
  const [tabs, setTabs] = useState<AttendanceTabId[]>(DEFAULT_TAB_ORDER);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage and server
  useEffect(() => {
    const loadTabOrder = async () => {
      try {
        // First try localStorage for instant load
        const savedOrder = localStorage.getItem(STORAGE_KEY);
        if (savedOrder) {
          const parsed = JSON.parse(savedOrder) as AttendanceTabId[];
          // Validate that all default tabs are present
          const isValid = DEFAULT_TAB_ORDER.every(tab => parsed.includes(tab)) && 
                          parsed.every(tab => DEFAULT_TAB_ORDER.includes(tab));
          if (isValid) {
            setTabs(parsed);
          }
        }

        // Then fetch from server
        const response = await fetch('/api/user-preferences/attendance-tab-order', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.value) {
            const serverOrder = JSON.parse(data.value) as AttendanceTabId[];
            const isValid = DEFAULT_TAB_ORDER.every(tab => serverOrder.includes(tab)) && 
                            serverOrder.every(tab => DEFAULT_TAB_ORDER.includes(tab));
            if (isValid) {
              setTabs(serverOrder);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(serverOrder));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load tab order:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTabOrder();
  }, []);

  // Debounced server sync
  const syncMutation = useMutation({
    mutationFn: async (newOrder: AttendanceTabId[]) => {
      const response = await fetch('/api/user-preferences/attendance-tab-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(newOrder) }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to sync tab order');
      }

      return response.json();
    },
  });

  // Update tab order
  const updateTabOrder = useCallback((newOrder: AttendanceTabId[]) => {
    setTabs(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    
    // Debounced server sync
    setTimeout(() => {
      syncMutation.mutate(newOrder);
    }, 500);
  }, [syncMutation]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setTabs(DEFAULT_TAB_ORDER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TAB_ORDER));
    syncMutation.mutate(DEFAULT_TAB_ORDER);
  }, [syncMutation]);

  return {
    tabs,
    updateTabOrder,
    resetToDefault,
    isLoading,
  };
}
