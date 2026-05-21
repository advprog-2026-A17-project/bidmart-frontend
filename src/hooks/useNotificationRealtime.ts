import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

const ORDER_NOTIFICATION_TYPES = new Set([
    'ORDER_CREATED',
    'ORDER_DISPUTED',
    'ORDER_DISPUTE_RESPONSE',
    'ORDER_DISPUTE_RESOLVED',
]);

export const isOrderNotificationType = (type: string): boolean =>
    ORDER_NOTIFICATION_TYPES.has(type.toUpperCase());

type NotificationPayload = {
    type?: string;
};

/**
 * Subscribes to user-scoped notification topics and invokes callback for matching events.
 */
export const useNotificationRealtime = (
    userId: string | undefined,
    onNotification: (payload: unknown) => void,
    options?: { orderTypesOnly?: boolean }
) => {
    const { isConnected, subscribe, unsubscribe } = useWebSocket('/ws/notifications');

    useEffect(() => {
        if (!userId || !isConnected) {
            return;
        }

        const handler = (payload: unknown) => {
            if (options?.orderTypesOnly) {
                const type = String((payload as NotificationPayload)?.type ?? '').toUpperCase();
                if (!isOrderNotificationType(type)) {
                    return;
                }
            }
            onNotification(payload);
        };

        const userQueue = '/user/queue/notifications';
        const userTopic = `/topic/notifications/users/${userId}`;
        subscribe(userQueue, handler);
        subscribe(userTopic, handler);
        return () => {
            unsubscribe(userQueue);
            unsubscribe(userTopic);
        };
    }, [isConnected, onNotification, options?.orderTypesOnly, subscribe, unsubscribe, userId]);

    return { isConnected };
};
