import { expect, test } from '@playwright/test';
import {
  buildTestEmail,
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

test('proxy bid auto-counters manual competitor', async ({ request }) => {
  const sellerEmail = buildTestEmail('proxy-seller');
  const proxyBuyerEmail = buildTestEmail('proxy-buyer');
  const manualBuyerEmail = buildTestEmail('manual-buyer');

  const seller = await registerUserViaApi(request, sellerEmail, password, 'SELLER');
  const proxyBuyer = await registerUserViaApi(request, proxyBuyerEmail, password, 'BUYER');
  const manualBuyer = await registerUserViaApi(request, manualBuyerEmail, password, 'BUYER');

  await ensureWalletWithFunds(request, proxyBuyer.id, 500_000, proxyBuyer.token, proxyBuyer.role);
  await ensureWalletWithFunds(request, manualBuyer.id, 500_000, manualBuyer.token, manualBuyer.role);

  const now = Date.now();
  const startIso = new Date(now - 1_000).toISOString();
  const endIso = new Date(now + 120_000).toISOString();

  const listingResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/catalogue/listings`,
    {
      headers: { Authorization: `Bearer ${seller.token}` },
      data: {
        title: 'E2E Proxy Bid',
        description: 'Proxy ceiling should counter manual bids',
        category: 'Electronics',
        condition: 'new',
        startingPrice: 100,
        reservePrice: 100,
        minimumIncrement: 10,
        startTime: startIso,
        endTime: endIso,
        imageUrl: 'https://example.com/proxy.png',
      },
    }
  );
  expect(listingResponse.ok()).toBeTruthy();
  const listingPayload = (await listingResponse.json()) as { id?: string };
  const listingId = listingPayload.id;
  expect(listingId).toBeTruthy();

  const publishResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/catalogue/listings/${listingId}/publish`,
    { headers: { Authorization: `Bearer ${seller.token}` } }
  );
  expect(publishResponse.ok()).toBeTruthy();

  const startSec = Math.floor((now - 1_000) / 1000);
  const endSec = Math.floor((now + 120_000) / 1000);
  const auctionResponse = await postWithRetry(request, `${getGatewayBaseUrl()}/api/v1/listings`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      listingId,
      sellerId: seller.id,
      auctionType: 'ENGLISH',
      starting_price_cents: 10_000,
      reserve_price_cents: 10_000,
      minimum_increment_cents: 1_000,
      startTime: startSec,
      endTime: endSec,
    },
  });
  expect(auctionResponse.ok()).toBeTruthy();

  const proxyResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/listings/${listingId}/bids/cursor`,
    {
      headers: { Authorization: `Bearer ${proxyBuyer.token}` },
      data: { maxBidAmount: 200 },
    }
  );
  expect(proxyResponse.ok()).toBeTruthy();

  const manualBidResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/listings/${listingId}/bids`,
    {
      headers: { Authorization: `Bearer ${manualBuyer.token}` },
      data: { bidAmount: 120 },
    }
  );
  expect(manualBidResponse.ok()).toBeTruthy();

  const bidsResponse = await request.get(
    `${getGatewayBaseUrl()}/api/v1/listings/${listingId}/bids`
  );
  expect(bidsResponse.ok()).toBeTruthy();
  const bids = (await bidsResponse.json()) as Array<{ bidder_id?: string; bidderId?: string }>;
  expect(bids.length).toBeGreaterThan(0);
  const topBidder = bids[0].bidder_id ?? bids[0].bidderId;
  expect(topBidder).toBe(proxyBuyer.id);
});
