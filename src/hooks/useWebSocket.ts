import { useEffect, useRef, useCallback, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import type { IFrame, StompSubscription } from '@stomp/stompjs';
import { apiUrl } from '../config/api';

type MessageListener = (message: unknown) => void;

/**
 * WebSocket hook with multicast listeners per STOMP destination.
 * Each subscribe() returns an unsubscribe function so multiple components can share one destination.
 */
export const useWebSocket = (socketPath = '/ws') => {
    const clientRef = useRef<Client | null>(null);
    const stompSubscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
    const listenersRef = useRef<Map<string, Set<MessageListener>>>(new Map());
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttemptsRef = useRef(5);
    const [isConnected, setIsConnected] = useState(false);

    const attemptReconnectRef = useRef<() => void>(() => {});

    const dispatchMessage = useCallback((destination: string, rawBody: string) => {
        const listeners = listenersRef.current.get(destination);
        if (!listeners || listeners.size === 0) {
            return;
        }

        let payload: unknown = rawBody;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            // keep raw string payload
        }

        listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                console.error('[WebSocket] Listener error for', destination, error);
            }
        });
    }, []);

    const ensureStompSubscription = useCallback((destination: string) => {
        if (!clientRef.current?.connected || stompSubscriptionsRef.current.has(destination)) {
            return;
        }

        const subscription = clientRef.current.subscribe(destination, (message: { body: string }) => {
            dispatchMessage(destination, message.body);
        });
        stompSubscriptionsRef.current.set(destination, subscription);
        console.log('[WebSocket] Subscribed to:', destination);
    }, [dispatchMessage]);

    const removeStompSubscription = useCallback((destination: string) => {
        const subscription = stompSubscriptionsRef.current.get(destination);
        if (!subscription) {
            return;
        }
        subscription.unsubscribe();
        stompSubscriptionsRef.current.delete(destination);
        console.log('[WebSocket] Unsubscribed from:', destination);
    }, []);

    const connect = useCallback(() => {
        return new Promise<void>((resolve, reject) => {
            try {
                const socketUrl = apiUrl(socketPath);
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
                        listenersRef.current.forEach((_listeners, destination) => {
                            ensureStompSubscription(destination);
                        });
                        resolve();
                    },
                    onStompError: (frame: IFrame) => {
                        console.error('[WebSocket] STOMP Error:', frame);
                        reject(new Error(frame.headers['message']));
                    },
                    onWebSocketClose: () => {
                        console.warn('[WebSocket] WebSocket closed');
                        setIsConnected(false);
                        stompSubscriptionsRef.current.clear();
                        attemptReconnectRef.current();
                    },
                });

                client.activate();
                clientRef.current = client;
            } catch (error) {
                console.error('[WebSocket] Connection failed:', error);
                reject(error);
            }
        });
    }, [ensureStompSubscription, socketPath]);

    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
        reconnectAttemptsRef.current += 1;

        console.log(`[WebSocket] Attempting reconnect in ${delay}ms`);

        setTimeout(() => {
            connect().catch((err) => console.error('[WebSocket] Reconnect failed:', err));
        }, delay);
    }, [connect]);

    useEffect(() => {
        attemptReconnectRef.current = attemptReconnect;
    }, [attemptReconnect]);

    const subscribe = useCallback((destination: string, callback: MessageListener): (() => void) => {
        if (!listenersRef.current.has(destination)) {
            listenersRef.current.set(destination, new Set());
        }
        listenersRef.current.get(destination)?.add(callback);

        if (clientRef.current?.connected) {
            ensureStompSubscription(destination);
        } else {
            console.warn('[WebSocket] Not connected, queued subscription for:', destination);
        }

        return () => {
            const listeners = listenersRef.current.get(destination);
            if (!listeners) {
                return;
            }
            listeners.delete(callback);
            if (listeners.size === 0) {
                listenersRef.current.delete(destination);
                removeStompSubscription(destination);
            }
        };
    }, [ensureStompSubscription, removeStompSubscription]);

    /** Removes all listeners and the STOMP subscription for a destination. */
    const unsubscribe = useCallback((destination: string) => {
        listenersRef.current.delete(destination);
        removeStompSubscription(destination);
    }, [removeStompSubscription]);

    useEffect(() => {
        connect().catch((err) => console.error('[WebSocket] Initial connection failed:', err));

        const stompSubscriptions = stompSubscriptionsRef.current;
        const listeners = listenersRef.current;

        return () => {
            console.log('[WebSocket] Deactivating client...');
            stompSubscriptions.forEach((sub) => sub.unsubscribe());
            stompSubscriptions.clear();
            listeners.clear();

            if (clientRef.current?.active) {
                clientRef.current.deactivate();
            }
            setIsConnected(false);
        };
    }, [connect]);

    return { isConnected, subscribe, unsubscribe };
};
