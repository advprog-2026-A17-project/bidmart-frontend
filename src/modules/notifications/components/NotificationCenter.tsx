import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useWebSocket } from '../../../hooks/useWebSocket';

interface BidmartNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    createdAt: string;
}

const notificationFromPayload = (payload: unknown): BidmartNotification => {
    const value = payload as Partial<BidmartNotification> & {
        payload?: Partial<BidmartNotification>;
    };
    const source = value.payload ?? value;
    return {
        id: String(source.id ?? crypto.randomUUID()),
        title: String(source.title ?? source.type ?? 'Notification'),
        message: String(source.message ?? ''),
        type: String(source.type ?? 'INFO'),
        read: Boolean(source.read ?? false),
        createdAt: String(source.createdAt ?? new Date().toISOString()),
    };
};

const NotificationCenter = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const { isConnected, subscribe, unsubscribe } = useWebSocket('/ws/notifications');
    const [storedNotifications, setStoredNotifications] = useState<BidmartNotification[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const notifications = user ? storedNotifications : [];

    const prependNotification = useCallback((payload: unknown) => {
        const next = notificationFromPayload(payload);
        setStoredNotifications((current) => {
            if (current.some((item) => item.id === next.id)) {
                return current;
            }
            return [next, ...current].slice(0, 5);
        });
    }, []);

    useEffect(() => {
        if (!user) {
            return;
        }

        const fetchNotifications = async () => {
            try {
                const response = await authenticatedFetch(gatewayUrl('/api/v1/notifications'));
                if (!response.ok) {
                    setError(await readApiError(response, 'Notification lookup failed'));
                    return;
                }
                const payload = await response.json() as BidmartNotification[] | { notifications?: BidmartNotification[] };
                setStoredNotifications(Array.isArray(payload) ? payload.slice(0, 5) : (payload.notifications ?? []).slice(0, 5));
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Notification lookup failed');
            }
        };

        void fetchNotifications();
    }, [authenticatedFetch, user]);

    useEffect(() => {
        if (!user || !isConnected) {
            return;
        }

        const destination = '/user/queue/notifications';
        subscribe(destination, prependNotification);
        return () => unsubscribe(destination);
    }, [isConnected, prependNotification, subscribe, unsubscribe, user]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen]);

    if (!user) {
        return null;
    }

    return (
        <div className="notification-center" ref={popoverRef}>
            <button
                type="button"
                className="notification-bell-button"
                aria-label="Open notifications"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((current) => !current)}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="notification-bell-icon">
                    <path
                        d="M12 3.5a4 4 0 0 0-4 4v1.1c0 1.2-.4 2.3-1.2 3.3L5.6 13.5a1.5 1.5 0 0 0 1.2 2.5h10.4a1.5 1.5 0 0 0 1.2-2.5l-1.2-1.6A5.3 5.3 0 0 1 16 8.6V7.5a4 4 0 0 0-4-4Z"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                    <path
                        d="M10 18a2 2 0 0 0 4 0"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
                {notifications.length > 0 && (
                    <span className="notification-badge">{Math.min(notifications.length, 9)}</span>
                )}
            </button>

            {isOpen && (
                <section className="notification-popover" aria-label="Notifications">
                    <div className="notification-center-header">
                        <strong>Notifications</strong>
                        <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                            {isConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    {error && <div className="notification-error">{error}</div>}
                    <div className="notification-list">
                        {notifications.length > 0 ? (
                            notifications.map((item) => (
                                <article key={item.id} className={`notification-item notification-${item.type.toLowerCase()}`}>
                                    <strong>{item.title}</strong>
                                    <span>{item.message}</span>
                                </article>
                            ))
                        ) : (
                            <div className="notification-empty">No notifications yet.</div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
};

export default NotificationCenter;
