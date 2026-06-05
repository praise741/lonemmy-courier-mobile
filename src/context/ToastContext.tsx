import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  currentToast: ToastItem | null;
  isVisible: boolean;
  onHide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;
    if (queue.length === 0) {
      setCurrentToast(null);
      setIsVisible(false);
      return;
    }

    isProcessingRef.current = true;
    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setCurrentToast(next);
    setIsVisible(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        isProcessingRef.current = false;
        processQueue();
      }, 350);
    }, next.duration);
  }, [queue]);

  useEffect(() => {
    if (!isProcessingRef.current && queue.length > 0 && !currentToast) {
      processQueue();
    }
  }, [queue, currentToast, processQueue]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setQueue((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const onHide = useCallback(() => {
    setIsVisible(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setTimeout(() => {
      isProcessingRef.current = false;
      processQueue();
    }, 350);
  }, [processQueue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, currentToast, isVisible, onHide }}>
      {children}
    </ToastContext.Provider>
  );
}
