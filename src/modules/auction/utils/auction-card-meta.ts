import type { Auction } from '../contracts/auction-card-ui-contract';

const CLOSED_STATUSES = new Set(['CLOSED', 'ENDED', 'WON', 'UNSOLD']);

import { parseAuctionEndTime } from '../../../utils/auction-units';

const parseAuctionDate = (value: string): Date | null => parseAuctionEndTime(value);

export const buildAuctionCardMeta = (auction: Auction, nowMs = Date.now()) => {
    const hasBids = auction.currentHighestBid !== null;
    const currentHighest = hasBids ? auction.currentHighestBid! : auction.startingPrice;
    const minNextBid = hasBids ? currentHighest + auction.minimumIncrement : auction.startingPrice;
    const normalizedStatus = (auction.status ?? '').toUpperCase();
    const endDate = parseAuctionDate(auction.endTime);
    const remainingMs = endDate ? endDate.getTime() - nowMs : Number.POSITIVE_INFINITY;
    const hasReachedEndTime = endDate ? remainingMs <= 0 : false;
    const isClosed = CLOSED_STATUSES.has(normalizedStatus) || hasReachedEndTime;
    const statusLabel = isClosed && !CLOSED_STATUSES.has(normalizedStatus)
        ? 'Ended'
        : normalizedStatus.charAt(0) + normalizedStatus.slice(1).toLowerCase();

    const minutesLeft = Math.max(0, Math.floor(remainingMs / 60000));
    const secondsLeft = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

    let timeLeftLabel: string;
    if (isClosed) {
        timeLeftLabel = 'Ended';
    } else if (hasReachedEndTime) {
        timeLeftLabel = 'Closing automatically';
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
