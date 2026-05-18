import type { Auction } from '../contracts/auction-card-ui-contract';

const CLOSED_STATUSES = new Set(['CLOSED', 'ENDED', 'WON', 'UNSOLD', 'CANCELLED']);

const parseAuctionDate = (value: string): Date => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
    }
    return new Date(value);
};

export const buildAuctionCardMeta = (auction: Auction) => {
    const hasBids = auction.currentHighestBid !== null;
    const currentHighest = hasBids ? auction.currentHighestBid! : auction.startingPrice;
    const minNextBid = hasBids ? currentHighest + auction.minimumIncrement : auction.startingPrice;
    const statusLabel = auction.status.charAt(0) + auction.status.slice(1).toLowerCase();
    const endDate = parseAuctionDate(auction.endTime);
    const now = Date.now();
    const remainingMs = endDate.getTime() - now;
    const hasEnded = Number.isFinite(remainingMs) && remainingMs <= 0;
    const isClosed = CLOSED_STATUSES.has(auction.status) || hasEnded;
    const minutesLeft = Math.max(0, Math.floor(remainingMs / 60000));
    const secondsLeft = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
    const timeLeftLabel = isClosed ? 'Ended' : `${minutesLeft}m ${secondsLeft}s left`;

    return {
        currentHighest,
        hasBids,
        minNextBid,
        statusLabel,
        isClosed,
        timeLeftLabel
    };
};

export type { Auction };
