import { useEffect, useMemo, useRef } from 'react';
import { useNotificationsWebSocket } from '../../../context/useNotificationsWebSocket';

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
    const { isConnected, subscribe } = useNotificationsWebSocket();
    const onEventRef = useRef(onEvent);

    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    const stableDestinations = useMemo(() => [...destinations], [destinations]);
    const topicKey = destinationsKey(stableDestinations);

    useEffect(() => {
        if (!isConnected || stableDestinations.length === 0) {
            return;
        }

        const wrappedHandler = (payload: unknown) => {
            onEventRef.current(payload as AuctionRealtimeEvent);
        };

        const releases = stableDestinations.map((destination) => subscribe(destination, wrappedHandler));

        return () => {
            releases.forEach((release) => release());
        };
    }, [topicKey, stableDestinations, isConnected, subscribe]);

    return { isConnected };
};
