import { expect, test } from '@playwright/test';
import {
  buildTestEmail,
  loginViaUi,
  registerUserViaApi,
} from './helpers/auth';
import { ensureWalletWithFunds } from './helpers/wallet';
import { getGatewayBaseUrl } from './helpers/env';

const password = 'Bidmart!12345';

const parsePrice = (value: string | null) => {
  if (!value) return 0;
  return Number(value.replace(/[^0-9]/g, '')) || 0;
};

const fillMinimumBid = async (bidInput: import('@playwright/test').Locator) => {
  const minAttr = Number(await bidInput.getAttribute('min'));
  const currentValue = Number(await bidInput.inputValue());
  const target = Number.isFinite(minAttr) && minAttr > 0 ? minAttr : currentValue;
  if (!target) {
    throw new Error('Expected a valid minimum bid amount.');
  }
  await bidInput.fill(String(target));
  return target;
};

const placeBidUntilPriceIncreases = async (
  bidPage: import('@playwright/test').Page,
  bidInput: import('@playwright/test').Locator,
  pricePage: import('@playwright/test').Page,
  baseline: number,
  maxAttempts = 3
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await fillMinimumBid(bidInput);
    await bidPage.getByRole('button', { name: 'Place Bid' }).click();
    try {
      await expect.poll(async () => {
        const current = await pricePage.locator('.current-bid-block strong').textContent();
        return parsePrice(current);
      }, { timeout: 7000 }).toBeGreaterThan(baseline);
      return;
    } catch {
      await bidPage.reload();
      await bidPage.getByRole('heading', { name: 'E2E Guitar' }).waitFor();
    }
  }

  throw new Error(`Bid price did not increase beyond baseline ${baseline} after ${maxAttempts} attempts.`);
};

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

test('auction war between two buyers', async ({ page, browser, request }) => {
  const sellerEmail = buildTestEmail('seller');
  const buyerEmail = buildTestEmail('buyer-a');
  const buyerTwoEmail = buildTestEmail('buyer-b');

  const seller = await registerUserViaApi(request, sellerEmail, password, 'SELLER');
  const buyerA = await registerUserViaApi(request, buyerEmail, password, 'BUYER');
  const buyerB = await registerUserViaApi(request, buyerTwoEmail, password, 'BUYER');

  await ensureWalletWithFunds(request, buyerA.id, 2_000_000, buyerA.token, buyerA.role);
  await ensureWalletWithFunds(request, buyerB.id, 2_000_000, buyerB.token, buyerB.role);

  await loginViaUi(page, sellerEmail, password);
  const startIso = new Date().toISOString();
  const endIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const listingResponse = await postWithRetry(request, `${getGatewayBaseUrl()}/api/v1/catalogue/listings`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      title: 'E2E Guitar',
      description: 'Limited edition test listing',
      category: 'Electronics',
      condition: 'new',
      startingPrice: 100,
      reservePrice: 200,
      minimumIncrement: 10,
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
  if (!listingId) throw new Error('Missing listing id after create');
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
      starting_price_cents: 10_000,
      reserve_price_cents: 20_000,
      minimum_increment_cents: 1_000,
      startTime: now,
      endTime: now + 3600,
    },
  });
  if (!auctionResponse.ok()) {
    throw new Error(`Bidding session create failed: ${auctionResponse.status()} ${await auctionResponse.text()}`);
  }

  const buyerAContext = await browser.newContext();
  const buyerAPage = await buyerAContext.newPage();
  await loginViaUi(buyerAPage, buyerEmail, password);

  const buyerBContext = await browser.newContext();
  const buyerBPage = await buyerBContext.newPage();
  await loginViaUi(buyerBPage, buyerTwoEmail, password);

  await buyerAPage.goto(`/listings/${listingId}`);
  await buyerAPage.getByRole('heading', { name: 'E2E Guitar' }).waitFor();

  const priceLocatorA = buyerAPage.locator('.current-bid-block strong');
  const firstPrice = parsePrice(await priceLocatorA.textContent());
  const bidInputA = buyerAPage.getByLabel('Your amount');
  await placeBidUntilPriceIncreases(buyerAPage, bidInputA, buyerAPage, firstPrice);

  await buyerBPage.goto(`/listings/${listingId}`);
  await buyerBPage.getByRole('heading', { name: 'E2E Guitar' }).waitFor();

  const priceLocatorB = buyerBPage.locator('.current-bid-block strong');
  const priceAfterA = parsePrice(await priceLocatorB.textContent());
  await buyerBPage.reload();
  await buyerBPage.getByRole('heading', { name: 'E2E Guitar' }).waitFor();
  const bidInputB = buyerBPage.getByLabel('Your amount');
  await placeBidUntilPriceIncreases(buyerBPage, bidInputB, buyerAPage, priceAfterA);

  await expect.poll(async () => {
    return parsePrice(await priceLocatorA.textContent());
  }).toBeGreaterThan(priceAfterA);

  const priceAfterB = parsePrice(await priceLocatorA.textContent());
  await placeBidUntilPriceIncreases(buyerAPage, bidInputA, buyerAPage, priceAfterB);

  await buyerAContext.close();
  await buyerBContext.close();
});
