import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '../components/common/Toast';

type ToastVariant = 'success' | 'error' | 'info';
interface ToastState { message: string; variant: ToastVariant; visible: boolean; }

const ToastContext = createContext<{ showToast: (message: string, variant?: ToastVariant) => void }>({
  showToast: () => {},
});

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', variant: 'success', visible: false });

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ message, variant, visible: true });
  }, []);

  const handleDismiss = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={handleDismiss} />
    </ToastContext.Provider>
  );
}
