import { createContext } from 'react';
import type { ToastContextValue } from './ToastContext';

export const ToastContext = createContext<ToastContextValue | null>(null);
