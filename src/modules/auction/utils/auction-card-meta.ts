export interface Auction {
    id: string;
    listingId: string;
    sellerId: string;
    startingPrice: number;
    reservePrice: number;
    currentHighestBid: number | null;
    minimumIncrement: number;
    status: string;
    startTime: string;
    endTime: string;
}

const CLOSED_STATUSES = new Set(['CLOSED', 'WON', 'UNSOLD']);

export const buildAuctionCardMeta = (auction: Auction) => {
    const currentHighest = auction.currentHighestBid !== null ? auction.currentHighestBid : auction.startingPrice;
    const minNextBid = currentHighest + auction.minimumIncrement;
    const statusLabel = auction.status.charAt(0) + auction.status.slice(1).toLowerCase();
    const isClosed = CLOSED_STATUSES.has(auction.status);
    const endDate = new Date(auction.endTime);
    const now = Date.now();
    const remainingMs = endDate.getTime() - now;
    const minutesLeft = Math.max(0, Math.floor(remainingMs / 60000));
    const secondsLeft = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
    const timeLeftLabel = isClosed ? 'Closed' : `${minutesLeft}m ${secondsLeft}s left`;

    return {
        currentHighest,
        minNextBid,
        statusLabel,
        isClosed,
        timeLeftLabel
    };
};
