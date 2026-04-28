import type { Auction } from '../contracts/auction-card-ui-contract';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};

const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

const parseAuction = (value: unknown): Auction | null => {
    if (!isRecord(value)) {
        return null;
    }

    const id = toNonEmptyString(value.id);
    const listingId = toNonEmptyString(value.listingId);
    const sellerId = toNonEmptyString(value.sellerId);
    const startingPrice = toNumber(value.startingPrice);
    const reservePrice = toNumber(value.reservePrice);
    const minimumIncrement = toNumber(value.minimumIncrement);
    const status = toNonEmptyString(value.status);
    const startTime = toNonEmptyString(value.startTime);
    const endTime = toNonEmptyString(value.endTime);
    const currentHighestBidRaw = value.currentHighestBid;
    const currentHighestBid = currentHighestBidRaw === null
        ? null
        : toNumber(currentHighestBidRaw);
    const hasValidCurrentHighestBid = currentHighestBidRaw === null || currentHighestBid !== null;

    if (
        id === null ||
        listingId === null ||
        sellerId === null ||
        startingPrice === null ||
        reservePrice === null ||
        minimumIncrement === null ||
        status === null ||
        startTime === null ||
        endTime === null ||
        !hasValidCurrentHighestBid
    ) {
        return null;
    }

    return {
        id,
        listingId,
        sellerId,
        startingPrice,
        reservePrice,
        currentHighestBid,
        minimumIncrement,
        status,
        startTime,
        endTime
    };
};

const extractArrayPayload = (payload: unknown): unknown[] | null => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!isRecord(payload)) {
        return null;
    }

    if (Array.isArray(payload.items)) {
        return payload.items;
    }

    if (Array.isArray(payload.auctions)) {
        return payload.auctions;
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    if (isRecord(payload.data)) {
        if (Array.isArray(payload.data.items)) {
            return payload.data.items;
        }
        if (Array.isArray(payload.data.auctions)) {
            return payload.data.auctions;
        }
    }

    return null;
};

export const parseAuctionsResponse = (payload: unknown): Auction[] => {
    const rawItems = extractArrayPayload(payload);
    if (rawItems === null) {
        throw new Error('Unsupported auctions response shape');
    }

    const auctions = rawItems
        .map(parseAuction)
        .filter((auction): auction is Auction => auction !== null);

    if (rawItems.length > 0 && auctions.length === 0) {
        throw new Error('Auctions data is present but invalid');
    }

    return auctions;
};
