import type { Auction } from '../../auction/contracts/auction-card-ui-contract';

export const activeListingStatuses = new Set(['ACTIVE', 'EXTENDED']);

export const catalogueListingToAuction = (listing: any): Auction => {
    return {
        id: String(listing.id),
        listingId: String(listing.id),
        sellerId: listing.sellerId || '',
        startingPrice: listing.startingPrice || 0,
        reservePrice: listing.reservePrice || listing.startingPrice || 0,
        currentHighestBid: listing.currentPrice || null,
        minimumIncrement: listing.minimumIncrement || 1,
        status: listing.status || 'UNKNOWN',
        startTime: listing.startTime || new Date().toISOString(),
        endTime: listing.endTime || new Date().toISOString(),
    };
};
