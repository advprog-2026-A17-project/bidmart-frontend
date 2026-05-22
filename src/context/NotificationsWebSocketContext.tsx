import { type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { NotificationsWebSocketContext } from './notifications-websocket-context';
import { useAuth } from './useAuth';

export const NotificationsWebSocketProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const api = useWebSocket('/ws/notifications', user?.id ?? null);
    return (
        <NotificationsWebSocketContext.Provider value={api}>
            {children}
        </NotificationsWebSocketContext.Provider>
    );
};
