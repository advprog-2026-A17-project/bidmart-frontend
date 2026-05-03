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
    const reconnectDelayRef = useRef(1000); // Start with 1 second
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        return new Promise<void>((resolve, reject) => {
            try {
                const socketUrl = apiUrl('/ws');
                const socket = new SockJS(socketUrl);

                const client = new Client({
                    webSocketFactory: () => socket,
                    reconnectDelay: 5000, // Built-in reconnect delay
                    heartbeatIncoming: 25000,
                    heartbeatOutgoing: 25000,
                    onConnect: () => {
                        console.log('[WebSocket] Connected');
                        setIsConnected(true);
                        reconnectAttemptsRef.current = 0;
                        reconnectDelayRef.current = 1000;
                        resolve();
                    },
                    onDisconnect: () => {
                        console.log('[WebSocket] Disconnected');
                        setIsConnected(false);
                    },
                    onStompError: (frame: IFrame) => {
                        console.error('[WebSocket] STOMP error:', frame);
                        reject(new Error(`STOMP error: ${frame.body}`));
                    },
                    onWebSocketError: (event: Event) => {
                        console.error('[WebSocket] WebSocket error:', event);
                        reject(new Error('WebSocket connection failed'));
                    },
                    onWebSocketClose: () => {
                        console.warn('[WebSocket] WebSocket closed');
                        setIsConnected(false);
                        attemptReconnect();
                    },
                });

                clientRef.current = client;
                client.activate();
            } catch (error) {
                console.error('[WebSocket] Connection error:', error);
                reject(error);
            }
        });
    }, []);

    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        reconnectAttemptsRef.current++;
        const delay = Math.min(reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
        console.warn(`[WebSocket] Attempting reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current})`);

        setTimeout(() => {
            connect().catch((error) => {
                console.error('[WebSocket] Reconnection failed:', error);
            });
        }, delay);
    }, [connect]);

    const subscribe = useCallback((destination: string, callback: (message: any) => void) => {
        if (!clientRef.current?.connected) {
            console.warn('[WebSocket] Not connected, cannot subscribe to', destination);
            return;
        }

        try {
            const subscription = clientRef.current.subscribe(destination, (message) => {
                try {
                    const body = JSON.parse(message.body);
                    callback(body);
                } catch (error) {
                    console.error('[WebSocket] Failed to parse message:', error);
                }
            });

            subscriptionsRef.current.set(destination, subscription);
            console.log('[WebSocket] Subscribed to', destination);
        } catch (error) {
            console.error('[WebSocket] Subscription error:', error);
        }
    }, []);

    const unsubscribe = useCallback((destination: string) => {
        const subscription = subscriptionsRef.current.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            subscriptionsRef.current.delete(destination);
            console.log('[WebSocket] Unsubscribed from', destination);
        }
    }, []);

    useEffect(() => {
        connect().catch((error) => {
            console.error('[WebSocket] Initial connection failed:', error);
            attemptReconnect();
        });

        return () => {
            // Cleanup subscriptions on unmount
            subscriptionsRef.current.forEach((subscription) => {
                subscription.unsubscribe();
            });
            subscriptionsRef.current.clear();

            // Disconnect on unmount
            if (clientRef.current?.connected) {
                clientRef.current.deactivate();
            }
            setIsConnected(false);
        };
    }, [connect, attemptReconnect]);

    return { isConnected, subscribe, unsubscribe };
};
