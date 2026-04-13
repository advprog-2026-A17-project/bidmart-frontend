import { buildAuctionCardMeta } from '../pages/AuctionDetailPage';

const sampleAuction = {
    id: 'auction-1',
    listingId: 'listing-1',
    sellerId: 'seller-1',
    startingPrice: 100,
    reservePrice: 200,
    currentHighestBid: 150,
    minimumIncrement: 10,
    status: 'ACTIVE',
    startTime: '2026-04-13T10:00:00.000Z',
    endTime: '2026-04-13T11:00:00.000Z'
};

const meta = buildAuctionCardMeta(sampleAuction);

if (meta.statusLabel !== 'Active') {
    throw new Error('Auction card should normalize status label');
}
