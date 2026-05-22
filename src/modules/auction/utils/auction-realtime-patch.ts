import type { AuctionRealtimeEvent } from '../hooks/useAuctionRealtime';
import { centsToAmountFromUnknown, toIsoFromUnixSeconds } from '../../../utils/auction-units';

export const eventTargetsListing = (event: AuctionRealtimeEvent, listingId: string): boolean => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const eventListingId = event.listingId ?? payload.listingId;
    const eventAuctionId = event.auctionId ?? payload.auctionId;
    return !eventListingId || String(eventListingId) === listingId || String(eventAuctionId ?? '') === listingId;
};

export const buildListingPatchFromRealtimeEvent = (
    event: AuctionRealtimeEvent
): Partial<{
    currentPrice: number;
    endTime: string;
    status: string;
    hasBids: boolean;
}> | null => {
    const eventType = (event.type ?? '').toLowerCase();
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (eventType.includes('ended')) {
        const status = typeof payload.status === 'string' ? payload.status : 'CLOSED';
        return { status };
    }

    if (!eventType.includes('bid-placed') && !eventType.includes('outbid') && !eventType.includes('created')) {
        return null;
    }

    const currentPrice = centsToAmountFromUnknown(payload.amountCents ?? payload.currentPrice ?? payload.finalPrice);
    const endTime = typeof payload.endTime === 'string'
        ? payload.endTime
        : toIsoFromUnixSeconds(
            typeof payload.end_time === 'number'
                ? payload.end_time
                : typeof payload.endTime === 'number'
                    ? payload.endTime
                    : null,
        );

    const patch: Partial<{
        currentPrice: number;
        endTime: string;
        status: string;
        hasBids: boolean;
    }> = {};

    if (typeof payload.status === 'string' && payload.status.trim()) {
        patch.status = payload.status;
    }
    if (currentPrice != null) {
        patch.currentPrice = currentPrice;
        patch.hasBids = true;
    }
    if (endTime) {
        patch.endTime = endTime;
    }

    return Object.keys(patch).length > 0 ? patch : null;
};

export const buildCatalogueItemPatchFromRealtimeEvent = (
    event: AuctionRealtimeEvent
): { listingId: string; patch: Partial<{ currentPrice: number; endTime: string; status: string; hasBids: boolean }> } | null => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const listingId = event.listingId ?? payload.listingId;
    if (!listingId) {
        return null;
    }

    const patch = buildListingPatchFromRealtimeEvent(event);
    if (!patch) {
        return null;
    }

    return { listingId: String(listingId), patch };
};
