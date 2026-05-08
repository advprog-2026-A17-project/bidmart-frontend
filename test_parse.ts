
import { parseAuctionsResponse } from './src/modules/auction/utils/parse-auctions-response.ts';
const payload = {
    items: [{
        id: '993728ab-b280-4f88-8ab5-49e2ed824503',
        listingId: 'bdc13171-fa4c-4ff2-b7b7-14307020b221',
        sellerId: '6f2506df-880a-4d4f-a149-c3b184798a21',
        startingPrice: 20000.0,
        reservePrice: 500000.0,
        currentHighestBid: null,
        minimumIncrement: 1.0,
        status: 'ACTIVE',
        startTime: '2026-05-08T12:14:02+00:00',
        endTime: '2026-05-15T12:14:02+00:00'
    }]
};
console.log(parseAuctionsResponse(payload));

