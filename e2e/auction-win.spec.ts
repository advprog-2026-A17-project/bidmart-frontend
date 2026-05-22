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

const pollOrdersForListing = async (
  request: import('@playwright/test').APIRequestContext,
  buyerToken: string,
  listingId: string,
  timeoutMs = 120_000
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await request.get(`${getGatewayBaseUrl()}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    if (response.ok()) {
      const orders = (await response.json()) as Array<{
        id?: string;
        auctionId?: string;
        listingId?: string;
        status?: string;
      }>;
      const match = orders.find(
        (order) =>
          String(order.auctionId || order.listingId || '') === listingId
      );
      if (match?.id) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for buyer order for listing ${listingId}`);
};

test('win-to-order path: bid, close, ship, confirm', async ({ request }) => {
  const sellerEmail = buildTestEmail('win-seller');
  const buyerEmail = buildTestEmail('win-buyer');

  const seller = await registerUserViaApi(request, sellerEmail, password, 'SELLER');
  const buyer = await registerUserViaApi(request, buyerEmail, password, 'BUYER');

  await ensureWalletWithFunds(request, buyer.id, 500_000, buyer.token, buyer.role);

  const now = Date.now();
  const startIso = new Date(now - 1_000).toISOString();
  const endIso = new Date(now + 45_000).toISOString();

  const listingResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/catalogue/listings`,
    {
      headers: { Authorization: `Bearer ${seller.token}` },
      data: {
        title: 'E2E Win Path',
        description: 'Short auction for order + payout verification',
        category: 'Electronics',
        condition: 'new',
        startingPrice: 100,
        reservePrice: 100,
        minimumIncrement: 10,
        startTime: startIso,
        endTime: endIso,
        imageUrl: 'https://example.com/win.png',
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
  const endSec = Math.floor((now + 45_000) / 1000);
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

  const bidResponse = await postWithRetry(
    request,
    `${getGatewayBaseUrl()}/api/v1/listings/${listingId}/bids`,
    {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { bidderId: buyer.id, bidAmount: 10_500 },
    }
  );
  expect(bidResponse.ok()).toBeTruthy();

  const closeDeadline = Date.now() + 90_000;
  let closed = false;
  while (Date.now() < closeDeadline && !closed) {
    const closeResponse = await request.post(
      `${getGatewayBaseUrl()}/api/v1/listings/${listingId}/close`,
      { headers: { Authorization: `Bearer ${seller.token}` } }
    );
    if (closeResponse.ok()) {
      closed = true;
      break;
    }
    const body = await closeResponse.text();
    if (!body.includes('end time') && !body.includes('not reached')) {
      throw new Error(`Close failed: ${closeResponse.status()} ${body}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  expect(closed).toBeTruthy();

  const order = await pollOrdersForListing(request, buyer.token, listingId!);
  expect(order.status).toMatch(/CREATED|PACKED|SHIPPED/i);

  const packedResponse = await request.put(
    `${getGatewayBaseUrl()}/api/v1/orders/${order.id}/status`,
    {
      headers: { Authorization: `Bearer ${seller.token}` },
      data: { status: 'PACKED' },
    }
  );
  expect(packedResponse.ok()).toBeTruthy();

  const shippedResponse = await request.put(
    `${getGatewayBaseUrl()}/api/v1/orders/${order.id}/status`,
    {
      headers: { Authorization: `Bearer ${seller.token}` },
      data: { status: 'SHIPPED', carrier: 'JNE' },
    }
  );
  expect(shippedResponse.ok()).toBeTruthy();

  const confirmResponse = await request.post(
    `${getGatewayBaseUrl()}/api/v1/orders/${order.id}/confirm`,
    { headers: { Authorization: `Bearer ${buyer.token}` } }
  );
  expect(confirmResponse.ok()).toBeTruthy();
  const confirmed = (await confirmResponse.json()) as { status?: string };
  expect(confirmed.status).toBe('CONFIRMED');
});

test('buyer wallet page loads after win-path registration', async ({ page, request }) => {
  const email = buildTestEmail('win-wallet-ui');
  const user = await registerUserViaApi(request, email, password, 'BUYER');
  await ensureWalletWithFunds(request, user.id, 50_000, user.token, user.role);
  await loginViaUi(page, email, password);
  await completeProfile(page, 'E2E Win Wallet', '88 Payout Street, Depok');
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByText('Total Balance')).toBeVisible();
});
