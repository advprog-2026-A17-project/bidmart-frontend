import { expect, test } from '@playwright/test';
import {
  buildTestEmail,
  completeProfile,
  loginViaUi,
  registerUserViaApi,
} from './helpers/auth';
import { ensureWalletWithFunds } from './helpers/wallet';
import { getGatewayBaseUrl } from './helpers/env';

const password = 'Bidmart!12345';

const postWithRetry = async (
  request: import('@playwright/test').APIRequestContext,
  url: string,
  options: Parameters<typeof request.post>[1],
  attempts = 8
) => {
  let lastResponse: Awaited<ReturnType<typeof request.post>> | null = null;
  for (let i = 0; i < attempts; i += 1) {
    lastResponse = await request.post(url, options);
    if (lastResponse.ok()) return lastResponse;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return lastResponse!;
};

const fetchBidsWithRetry = async (
  request: import('@playwright/test').APIRequestContext,
  listingId: string,
  attempts = 20
) => {
  for (let i = 0; i < attempts; i += 1) {
    const bidsResponse = await request.get(`${getGatewayBaseUrl()}/api/v1/listings/${listingId}/bids`);
    if (bidsResponse.ok()) {
      const body = await bidsResponse.json() as Array<{ bidAmount?: number; bid_amount_cents?: number; bidderId?: string; bidder_id?: string }> | { items?: Array<{ bidAmount?: number; bid_amount_cents?: number; bidderId?: string; bidder_id?: string }> };
      const items = Array.isArray(body) ? body : (body.items ?? []);
      if (items.length > 0) return items;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return [] as Array<{ bidAmount?: number; bid_amount_cents?: number; bidderId?: string; bidder_id?: string }>;
};

test('concurrency bidding test - multiple buyers placing bids simultaneously', async ({ page, browser, request }) => {
  // 1. Setup participants
  const sellerEmail = buildTestEmail('seller-cc');
  const buyerEmails = [
    buildTestEmail('buyer-cc-1'),
    buildTestEmail('buyer-cc-2'),
    buildTestEmail('buyer-cc-3'),
  ];

  const seller = await registerUserViaApi(request, sellerEmail, password, 'SELLER');
  const buyers = await Promise.all(
    buyerEmails.map(email => registerUserViaApi(request, email, password, 'BUYER'))
  );

  // 2. Ensure buyers have enough funds
  await Promise.all(
    buyers.map(buyer => ensureWalletWithFunds(request, buyer.id, 5_000_000, buyer.token, buyer.role))
  );

  // 3. Seller completes profile and creates listing+auction via API for test stability
  await loginViaUi(page, sellerEmail, password);
  await completeProfile(page, 'CC Seller', '100 Seller Road, Jakarta');
  const startIso = new Date().toISOString();
  const endIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const listingResponse = await postWithRetry(request, `${getGatewayBaseUrl()}/api/v1/catalogue/listings`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      title: 'Concurrent Bidding Item',
      description: 'Item for stress testing concurrency',
      category: 'Electronics',
      condition: 'new',
      startingPrice: 1000,
      reservePrice: 5000,
      minimumIncrement: 100,
      startTime: startIso,
      endTime: endIso,
      imageUrl: 'https://example.com/e2e.png',
    },
  });
  if (!listingResponse.ok()) {
    throw new Error(`Listing create failed: ${listingResponse.status()} ${await listingResponse.text()}`);
  }
  const listingPayload = await listingResponse.json() as { id?: string };
  const listingId = listingPayload.id;
  if (!listingId) throw new Error('Could not find listing ID for concurrency test.');
  const publishResponse = await postWithRetry(request, `${getGatewayBaseUrl()}/api/v1/catalogue/listings/${listingId}/publish`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  if (!publishResponse.ok()) {
    throw new Error(`Listing publish failed: ${publishResponse.status()} ${await publishResponse.text()}`);
  }
  const now = Math.floor(Date.now() / 1000);
  const auctionResponse = await postWithRetry(request, `${getGatewayBaseUrl()}/api/v1/listings`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      listingId,
      sellerId: seller.id,
      auctionType: 'ENGLISH',
      starting_price_cents: 100_000,
      reserve_price_cents: 500_000,
      minimum_increment_cents: 10_000,
      startTime: now,
      endTime: now + 3600,
    },
  });
  if (!auctionResponse.ok()) {
    throw new Error(`Bidding session create failed: ${auctionResponse.status()} ${await auctionResponse.text()}`);
  }

  // 4. Setup concurrent buyer pages
  const buyerContexts = await Promise.all(buyerEmails.map(() => browser.newContext()));
  const buyerPages = await Promise.all(buyerContexts.map(context => context.newPage()));

  for (let i = 0; i < buyerPages.length; i++) {
    const bPage = buyerPages[i];
    await loginViaUi(bPage, buyerEmails[i], password);
    await completeProfile(bPage, `CC Buyer ${i + 1}`, `${i + 1} Buyer Lane`);
    await bPage.goto(`/listings/${listingId}`);
    await bPage.getByRole('heading', { name: 'Concurrent Bidding Item' }).waitFor();
  }

  // 5. Trigger SIMULTANEOUS bidding with the same valid minimum amount.
  const minBidFromUi = await buyerPages[0].getByLabel(/Your amount/i).inputValue();
  const bidAmount = minBidFromUi;
  
  // Prepare all pages
  for (const bPage of buyerPages) {
    await bPage.getByLabel(/Your amount/i).fill(bidAmount);
  }

  console.log('--- STARTING SIMULTANEOUS BIDS ---');
  
  // Click all buttons at once
  const bidPromises = buyerPages.map(bPage => 
    bPage.getByRole('button', { name: /Place Bid/i }).click()
  );

  await Promise.all(bidPromises);

  // 6. Analyze Results from API: only one equal-amount bid should persist.
  const bidItems = await fetchBidsWithRetry(request, listingId);
  expect(bidItems.length).toBeGreaterThan(0);
  const parsedBidAmount = Number(bidAmount);
  const targetAmount = Number.isFinite(parsedBidAmount) ? parsedBidAmount : 0;
  const acceptedAtTargetAmount = bidItems.filter((bid) => {
    if (typeof bid.bidAmount === 'number') return bid.bidAmount === targetAmount;
    if (typeof bid.bid_amount_cents === 'number') return bid.bid_amount_cents === targetAmount * 100;
    return false;
  }).length;
  expect(acceptedAtTargetAmount).toBe(1);

  // Cleanup
  await Promise.all(buyerContexts.map(ctx => ctx.close()));
});
