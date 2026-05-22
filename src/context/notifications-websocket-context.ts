import { createContext } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export type NotificationsWebSocketApi = ReturnType<typeof useWebSocket>;

export const NotificationsWebSocketContext = createContext<NotificationsWebSocketApi | null>(null);
