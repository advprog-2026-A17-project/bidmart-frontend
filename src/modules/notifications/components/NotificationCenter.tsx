import { useCallback, useEffect, useState } from 'react';
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
    const [notifications, setNotifications] = useState<BidmartNotification[]>([]);
    const [error, setError] = useState<string | null>(null);

    const prependNotification = useCallback((payload: unknown) => {
        const next = notificationFromPayload(payload);
        setNotifications((current) => {
            if (current.some((item) => item.id === next.id)) {
                return current;
            }
            return [next, ...current].slice(0, 5);
        });
    }, []);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
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
                setNotifications(Array.isArray(payload) ? payload.slice(0, 5) : (payload.notifications ?? []).slice(0, 5));
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

    if (!user) {
        return null;
    }

    return (
        <section className="notification-center" aria-label="Notifications">
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
    );
};

export default NotificationCenter;
