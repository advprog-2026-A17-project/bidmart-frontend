import type { Auction } from '../contracts/auction-card-ui-contract';

const CLOSED_STATUSES = new Set(['CLOSED', 'ENDED', 'WON', 'UNSOLD']);

const parseAuctionDate = (value: string): Date | null => {
    if (!value || !value.trim()) return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        const parsed = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildAuctionCardMeta = (auction: Auction, nowMs = Date.now()) => {
    const hasBids = auction.currentHighestBid !== null;
    const currentHighest = hasBids ? auction.currentHighestBid! : auction.startingPrice;
    const minNextBid = hasBids ? currentHighest + auction.minimumIncrement : auction.startingPrice;
    const normalizedStatus = (auction.status ?? '').toUpperCase();
    const statusLabel = normalizedStatus.charAt(0) + normalizedStatus.slice(1).toLowerCase();
    const endDate = parseAuctionDate(auction.endTime);
    const remainingMs = endDate ? endDate.getTime() - nowMs : Number.POSITIVE_INFINITY;
    const hasReachedEndTime = endDate ? remainingMs <= 0 : false;

    // isClosed is determined ONLY by the backend status, NOT by time comparison.
    // This prevents active auctions from being falsely marked as "Ended" due to
    // clock skew or timezone differences between client and server.
    const isClosed = CLOSED_STATUSES.has(normalizedStatus);

    const minutesLeft = Math.max(0, Math.floor(remainingMs / 60000));
    const secondsLeft = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

    let timeLeftLabel: string;
    if (isClosed) {
        timeLeftLabel = 'Ended';
    } else if (hasReachedEndTime) {
        timeLeftLabel = 'Awaiting settlement';
    } else {
        timeLeftLabel = `${minutesLeft}m ${secondsLeft}s left`;
    }

    return {
        currentHighest,
        hasBids,
        minNextBid,
        statusLabel,
        isClosed,
        hasReachedEndTime,
        timeLeftLabel
    };
};

export type { Auction };
