import type { Auction } from '../../auction/contracts/auction-card-ui-contract';

export const activeListingStatuses = new Set(['ACTIVE', 'EXTENDED']);

export const catalogueListingToAuction = (listing: any): Auction => {
    const startingPrice = Number(listing.startingPrice ?? 0);
    const currentPrice = listing.currentPrice == null ? null : Number(listing.currentPrice);
    const hasBids = listing.hasBids === true
        || (currentPrice != null && Number.isFinite(currentPrice) && currentPrice > startingPrice);

    return {
        id: String(listing.id),
        listingId: String(listing.id),
        sellerId: listing.sellerId || '',
        startingPrice,
        reservePrice: Number(listing.reservePrice ?? listing.startingPrice ?? 0),
        currentHighestBid: hasBids ? (currentPrice ?? startingPrice) : null,
        minimumIncrement: Number(listing.minimumIncrement ?? 1),
        status: listing.status || 'UNKNOWN',
        startTime: listing.startTime || new Date().toISOString(),
        endTime: listing.endTime || new Date().toISOString(),
    };
};
