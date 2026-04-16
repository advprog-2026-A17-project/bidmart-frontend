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
