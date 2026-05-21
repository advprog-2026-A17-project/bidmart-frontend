import { createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

type NotificationsWebSocketApi = ReturnType<typeof useWebSocket>;

const NotificationsWebSocketContext = createContext<NotificationsWebSocketApi | null>(null);

export const NotificationsWebSocketProvider = ({ children }: { children: ReactNode }) => {
    const api = useWebSocket('/ws/notifications');
    return (
        <NotificationsWebSocketContext.Provider value={api}>
            {children}
        </NotificationsWebSocketContext.Provider>
    );
};

export const useNotificationsWebSocket = (): NotificationsWebSocketApi => {
    const context = useContext(NotificationsWebSocketContext);
    if (!context) {
        throw new Error('useNotificationsWebSocket must be used within NotificationsWebSocketProvider');
    }
    return context;
};
