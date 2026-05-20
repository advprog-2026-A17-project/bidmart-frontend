import type { Auction } from '../../auction/contracts/auction-card-ui-contract';

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'EXTENDED' | 'CLOSED' | 'WON' | 'UNSOLD' | 'CANCELLED';

export interface CategoryEntity {
    id: number;
    name: string;
    parent?: CategoryEntity;
}

export interface CatalogueListing {
    id: string;
    sellerId: string;
    title?: string;
    description?: string;
    category?: string;
    condition?: string;
    imageUrl?: string;
    categoryEntity?: CategoryEntity;
    startingPrice?: number | string;
    reservePrice?: number | string;
    currentPrice?: number | string | null;
    minimumIncrement?: number | string;
    startTime?: string;
    endTime?: string;
    status?: ListingStatus;
    hasBids?: boolean;
}

export const activeListingStatuses = new Set(['ACTIVE', 'EXTENDED']);

export const catalogueListingToAuction = (listing: CatalogueListing): Auction => {
    const startingPrice = Number(listing.startingPrice ?? 0);
    const currentPrice = listing.currentPrice == null ? null : Number(listing.currentPrice);
    const hasBids = listing.hasBids === true
        || (currentPrice != null && Number.isFinite(currentPrice) && currentPrice > startingPrice);

    return {
        id: listing.id,
        listingId: listing.id,
        sellerId: listing.sellerId || '',
        startingPrice,
        reservePrice: Number(listing.reservePrice ?? listing.startingPrice ?? 0),
        currentHighestBid: hasBids ? (currentPrice ?? startingPrice) : null,
        minimumIncrement: Number(listing.minimumIncrement ?? 1),
        status: listing.status || 'UNKNOWN',
        startTime: listing.startTime || '',
        endTime: listing.endTime || '',
    };
};