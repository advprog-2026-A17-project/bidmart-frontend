import { useContext } from 'react';
import { ToastContext } from './toast-context';
import type { ToastContextValue } from './ToastContext';

export type { ToastVariant } from './ToastContext';

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
