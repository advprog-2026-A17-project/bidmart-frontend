import { useEffect, useRef } from 'react';
import { useNotificationsWebSocket } from '../../../context/NotificationsWebSocketContext';

export type AuctionRealtimeEvent = {
    type?: string;
    auctionId?: string;
    listingId?: string;
    sellerId?: string;
    payload?: unknown;
};

const destinationsKey = (destinations: string[]): string =>
    [...destinations].sort().join('|');

export const useAuctionRealtime = (
    destinations: string[],
    onEvent: (event: AuctionRealtimeEvent) => void
) => {
    const { isConnected, subscribe, unsubscribe } = useNotificationsWebSocket();
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    const topicKey = destinationsKey(destinations);

    useEffect(() => {
        if (!isConnected || destinations.length === 0) {
            return;
        }

        const wrappedHandler = (payload: unknown) => {
            onEventRef.current(payload as AuctionRealtimeEvent);
        };

        destinations.forEach((destination) => {
            subscribe(destination, wrappedHandler);
        });

        return () => {
            destinations.forEach((destination) => unsubscribe(destination));
        };
    }, [topicKey, isConnected, subscribe, unsubscribe]);

    return { isConnected };
};
