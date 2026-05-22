import { useCallback, useEffect, useRef, useState } from 'react';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useNotificationsWebSocket } from '../../../context/useNotificationsWebSocket';

interface BidmartNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    status: 'READ' | 'UNREAD';
    read: boolean;
    sourceEventId?: string;
    readAt?: string | null;
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
        status: source.read ? 'READ' : 'UNREAD',
        read: Boolean(source.read ?? false),
        sourceEventId: source.sourceEventId ? String(source.sourceEventId) : undefined,
        readAt: source.readAt ? String(source.readAt) : null,
        createdAt: String(source.createdAt ?? new Date().toISOString()),
    };
};

const NotificationCenter = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const { isConnected, subscribe } = useNotificationsWebSocket();
    const [storedNotifications, setStoredNotifications] = useState<BidmartNotification[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<BidmartNotification | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const notifications = user ? storedNotifications : [];
    const unreadCount = notifications.filter((item) => !item.read).length;

    const prependNotification = useCallback((payload: unknown) => {
        const next = notificationFromPayload(payload);
        setStoredNotifications((current) => {
            if (current.some((item) => item.id === next.id)) {
                return current;
            }
            return [next, ...current].slice(0, 20);
        });
    }, []);

    const replaceNotification = useCallback((updated: BidmartNotification) => {
        setStoredNotifications((current) => {
            const next = current.map((item) => item.id === updated.id ? updated : item);
            return next.some((item) => item.id === updated.id) ? next : [updated, ...next];
        });
        setSelectedNotification((current) => current?.id === updated.id ? updated : current);
    }, []);

    useEffect(() => {
        if (!user) {
            return;
        }

        const fetchNotifications = async () => {
            setIsLoading(true);
            try {
                const response = await authenticatedFetch(gatewayUrl('/api/v1/notifications'));
                if (!response.ok) {
                    setError(await readApiError(response, 'Notification lookup failed'));
                    return;
                }
                const payload = await response.json() as BidmartNotification[] | { notifications?: BidmartNotification[] };
                setStoredNotifications(Array.isArray(payload) ? payload.slice(0, 20) : (payload.notifications ?? []).slice(0, 20));
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Notification lookup failed');
            } finally {
                setIsLoading(false);
            }
        };

        void fetchNotifications();
    }, [authenticatedFetch, user]);

    useEffect(() => {
        if (!user || !isConnected) {
            return;
        }

        const release = subscribe('/user/queue/notifications', prependNotification);
        return release;
    }, [isConnected, prependNotification, subscribe, user]);

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

    const loadNotificationDetail = useCallback(async (notificationId: string) => {
        setIsDetailLoading(true);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/notifications/${notificationId}`));
            if (!response.ok) {
                setError(await readApiError(response, 'Notification detail lookup failed'));
                return;
            }
            const payload = await response.json();
            const detail = notificationFromPayload(payload);
            replaceNotification(detail);
            setSelectedNotification(detail);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Notification detail lookup failed');
        } finally {
            setIsDetailLoading(false);
        }
    }, [authenticatedFetch, replaceNotification]);

    const updateReadStatus = useCallback(async (notificationId: string, read: boolean) => {
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/notifications/${notificationId}/read-status`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read }),
            });
            if (!response.ok) {
                setError(await readApiError(response, 'Notification status update failed'));
                return;
            }
            const payload = await response.json();
            replaceNotification(notificationFromPayload(payload));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Notification status update failed');
        }
    }, [authenticatedFetch, replaceNotification]);

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
                {unreadCount > 0 && (
                    <span className="notification-badge">{Math.min(unreadCount, 9)}</span>
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
                        {isLoading ? (
                            <div className="notification-skeleton" aria-busy="true" aria-label="Loading notifications">
                                <span className="skeleton-line" />
                                <span className="skeleton-line skeleton-line-medium" />
                                <span className="skeleton-line" />
                            </div>
                        ) : notifications.length > 0 ? (
                            notifications.map((item) => (
                                <article
                                    key={item.id}
                                    className={`notification-item notification-${item.type.toLowerCase()} ${item.read ? 'notification-read' : 'notification-unread'}`}
                                >
                                    <div className="notification-item-header">
                                        <strong>{item.title}</strong>
                                        <span className={`notification-status ${item.read ? 'notification-status-read' : 'notification-status-unread'}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    <span>{item.message}</span>
                                    <div className="notification-actions">
                                        <button
                                            type="button"
                                            className="notification-action-button"
                                            onClick={() => void loadNotificationDetail(item.id)}
                                        >
                                            View details
                                        </button>
                                        <button
                                            type="button"
                                            className="notification-action-button"
                                            onClick={() => void updateReadStatus(item.id, !item.read)}
                                        >
                                            Mark as {item.read ? 'unread' : 'read'}
                                        </button>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="notification-empty">No notifications yet.</div>
                        )}
                    </div>
                    {selectedNotification && (
                        <section className="notification-detail" aria-label="Notification detail">
                            <div className="notification-detail-header">
                                <strong>Detail</strong>
                                <button
                                    type="button"
                                    className="notification-action-button"
                                    onClick={() => setSelectedNotification(null)}
                                >
                                    Close
                                </button>
                            </div>
                            {isDetailLoading ? (
                                <div className="notification-skeleton" aria-busy="true" aria-label="Loading notification detail">
                                    <span className="skeleton-line" />
                                    <span className="skeleton-line skeleton-line-medium" />
                                </div>
                            ) : (
                                <div className="notification-detail-content">
                                    <p><strong>{selectedNotification.title}</strong></p>
                                    <p>{selectedNotification.message}</p>
                                    <p>Status: {selectedNotification.read ? 'READ' : 'UNREAD'}</p>
                                    <p>Type: {selectedNotification.type}</p>
                                    <p>Created: {new Date(selectedNotification.createdAt).toLocaleString()}</p>
                                    {selectedNotification.readAt && <p>Read at: {new Date(selectedNotification.readAt).toLocaleString()}</p>}
                                    {selectedNotification.sourceEventId && <p>Source event: {selectedNotification.sourceEventId}</p>}
                                </div>
                            )}
                        </section>
                    )}
                </section>
            )}
        </div>
    );
};

export default NotificationCenter;
