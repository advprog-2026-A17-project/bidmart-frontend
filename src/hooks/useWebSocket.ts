import { useEffect, useRef, useCallback, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import type { IFrame, StompSubscription } from '@stomp/stompjs';
import { apiUrl } from '../config/api';

/**
 * Custom hook for managing WebSocket connections and subscriptions.
 * Provides automatic reconnection with exponential backoff.
 * 
 * Usage:
 * const { isConnected, subscribe, unsubscribe } = useWebSocket();
 */
export const useWebSocket = () => {
    const clientRef = useRef<Client | null>(null);
    const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttemptsRef = useRef(5);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        return new Promise<void>((resolve, reject) => {
            try {
                // Use apiUrl('/ws') to get the correct path via Gateway or Nginx
                const socketUrl = apiUrl('/ws');
                const socket = new SockJS(socketUrl);

                const client = new Client({
                    webSocketFactory: () => socket,
                    reconnectDelay: 5000,
                    heartbeatIncoming: 25000,
                    heartbeatOutgoing: 25000,
                    onConnect: (frame: IFrame) => {
                        console.log('[WebSocket] Connected:', frame);
                        setIsConnected(true);
                        reconnectAttemptsRef.current = 0;
                        resolve();
                    },
                    onStompError: (frame: IFrame) => {
                        console.error('[WebSocket] STOMP Error:', frame);
                        reject(new Error(frame.headers['message']));
                    },
                    onWebSocketClose: () => {
                        console.warn('[WebSocket] WebSocket closed');
                        setIsConnected(false);
                        attemptReconnect();
                    },
                });

                client.activate();
                clientRef.current = client;
            } catch (error) {
                console.error('[WebSocket] Connection failed:', error);
                reject(error);
            }
        });
    }, []);

    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
        reconnectAttemptsRef.current += 1;

        console.log(`[WebSocket] Attempting reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current})`);
        
        setTimeout(() => {
            connect().catch(err => console.error('[WebSocket] Reconnect failed:', err));
        }, delay);
    }, [connect]);

    const subscribe = useCallback((destination: string, callback: (message: any) => void) => {
        if (!clientRef.current?.connected) {
            console.warn('[WebSocket] Not connected, cannot subscribe to:', destination);
            return;
        }

        // Unsubscribe from previous if exists
        if (subscriptionsRef.current.has(destination)) {
            subscriptionsRef.current.get(destination)?.unsubscribe();
        }

        const subscription = clientRef.current.subscribe(destination, (message: any) => {
            try {
                const payload = JSON.parse(message.body);
                callback(payload);
            } catch (e) {
                callback(message.body);
            }
        });

        subscriptionsRef.current.set(destination, subscription);
        console.log('[WebSocket] Subscribed to:', destination);
    }, []);

    const unsubscribe = useCallback((destination: string) => {
        const subscription = subscriptionsRef.current.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            subscriptionsRef.current.delete(destination);
            console.log('[WebSocket] Unsubscribed from:', destination);
        }
    }, []);

    useEffect(() => {
        connect().catch(err => console.error('[WebSocket] Initial connection failed:', err));

        return () => {
            console.log('[WebSocket] Deactivating client...');
            // Clean up subscriptions
            subscriptionsRef.current.forEach(sub => sub.unsubscribe());
            subscriptionsRef.current.clear();
            
            if (clientRef.current?.active) {
                clientRef.current.deactivate();
            }
            setIsConnected(false);
        };
    }, [connect]);

    return { isConnected, subscribe, unsubscribe };
};
