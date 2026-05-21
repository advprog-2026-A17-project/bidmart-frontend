import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';

export type ToastVariant = 'error' | 'success';

export type ToastItem = {
    id: string;
    message: string;
    variant: ToastVariant;
    sourceId?: string;
};

type PublishOptions = {
    sourceId?: string;
    durationMs?: number;
};

type ToastContextValue = {
    publish: (message: string, variant: ToastVariant, options?: PublishOptions) => void;
    dismiss: (id: string) => void;
    dismissBySource: (sourceId: string) => void;
    toasts: ToastItem[];
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5200;

const createToastId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timersRef = useRef<Map<string, number>>(new Map());

    const dismiss = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        const timer = timersRef.current.get(id);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const dismissBySource = useCallback((sourceId: string) => {
        setToasts((current) => {
            const removed = current.filter((toast) => toast.sourceId === sourceId);
            removed.forEach((toast) => {
                const timer = timersRef.current.get(toast.id);
                if (timer !== undefined) {
                    window.clearTimeout(timer);
                    timersRef.current.delete(toast.id);
                }
            });
            return current.filter((toast) => toast.sourceId !== sourceId);
        });
    }, []);

    const publish = useCallback((
        message: string,
        variant: ToastVariant,
        options?: PublishOptions,
    ) => {
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }

        const sourceId = options?.sourceId;
        if (sourceId) {
            dismissBySource(sourceId);
        }

        const id = createToastId();
        const item: ToastItem = { id, message: trimmed, variant, sourceId };

        setToasts((current) => {
            const withoutSource = sourceId
                ? current.filter((toast) => toast.sourceId !== sourceId)
                : current;
            return [...withoutSource, item].slice(-5);
        });

        const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
        const timer = window.setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
    }, [dismiss, dismissBySource]);

    useEffect(() => () => {
        timersRef.current.forEach((timer) => window.clearTimeout(timer));
        timersRef.current.clear();
    }, []);

    const value = useMemo(
        () => ({ publish, dismiss, dismissBySource, toasts }),
        [publish, dismiss, dismissBySource, toasts],
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

const ToastViewport: React.FC<{
    toasts: ToastItem[];
    onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => createPortal(
        <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast-popup toast-popup-${toast.variant}`}
                    role={toast.variant === 'error' ? 'alert' : 'status'}
                >
                    <span className="toast-popup-icon material-symbols-outlined" aria-hidden="true">
                        {toast.variant === 'error' ? 'error' : 'check_circle'}
                    </span>
                    <p className="toast-popup-message">{toast.message}</p>
                    <button
                        type="button"
                        className="toast-popup-close"
                        aria-label="Dismiss notification"
                        onClick={() => onDismiss(toast.id)}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
            ))}
        </div>,
        document.body,
);

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
