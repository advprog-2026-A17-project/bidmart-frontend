import type { AuctionRealtimeEvent } from '../hooks/useAuctionRealtime';

const centsToAmount = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value / 100;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed / 100 : undefined;
    }
    return undefined;
};

const toIsoFromUnixSeconds = (value: unknown): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return new Date(value * 1000).toISOString();
};

export const eventTargetsListing = (event: AuctionRealtimeEvent, listingId: string): boolean => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const eventListingId = event.listingId ?? payload.listingId;
    return !eventListingId || String(eventListingId) === listingId;
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

    const currentPrice = centsToAmount(payload.amountCents ?? payload.currentPrice ?? payload.finalPrice);
    const endTime = typeof payload.endTime === 'string'
        ? payload.endTime
        : toIsoFromUnixSeconds(payload.end_time ?? payload.endTime);

    const patch: Partial<{
        currentPrice: number;
        endTime: string;
        status: string;
        hasBids: boolean;
    }> = {};

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
