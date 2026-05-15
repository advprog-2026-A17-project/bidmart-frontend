import { useEffect } from 'react';
import { useWebSocket } from '../../../hooks/useWebSocket';

export type AuctionRealtimeEvent = {
    type?: string;
    auctionId?: string;
    listingId?: string;
    sellerId?: string;
    payload?: unknown;
};

export const useAuctionRealtime = (
    destinations: string[],
    onEvent: (event: AuctionRealtimeEvent) => void
) => {
    const { isConnected, subscribe, unsubscribe } = useWebSocket('/ws/notifications');

    useEffect(() => {
        if (!isConnected || destinations.length === 0) {
            return;
        }

        destinations.forEach((destination) => {
            subscribe(destination, (payload) => onEvent(payload as AuctionRealtimeEvent));
        });

        return () => {
            destinations.forEach((destination) => unsubscribe(destination));
        };
    }, [destinations, isConnected, onEvent, subscribe, unsubscribe]);

    return { isConnected };
};
