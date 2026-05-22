import { useContext } from 'react';
import { NotificationsWebSocketContext } from './notifications-websocket-context';

export const useNotificationsWebSocket = () => {
    const context = useContext(NotificationsWebSocketContext);
    if (!context) {
        throw new Error('useNotificationsWebSocket must be used within NotificationsWebSocketProvider');
    }
    return context;
};
