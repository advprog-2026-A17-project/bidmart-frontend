import { type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { NotificationsWebSocketContext } from './notifications-websocket-context';

export const NotificationsWebSocketProvider = ({ children }: { children: ReactNode }) => {
    const api = useWebSocket('/ws/notifications');
    return (
        <NotificationsWebSocketContext.Provider value={api}>
            {children}
        </NotificationsWebSocketContext.Provider>
    );
};
