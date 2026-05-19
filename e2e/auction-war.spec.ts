import { expect, test } from '@playwright/test';
import {
  buildTestEmail,
  completeProfile,
  loginViaUi,
  registerUserViaApi,
} from './helpers/auth';
import { ensureWalletWithFunds } from './helpers/wallet';

const password = 'Bidmart!12345';
const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

const parsePrice = (value: string | null) => {
  if (!value) return 0;
  return Number(value.replace(/[^0-9.]/g, '')) || 0;
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

test('auction war between two buyers', async ({ page, browser, request }) => {
  const sellerEmail = buildTestEmail('seller');
  const buyerEmail = buildTestEmail('buyer-a');
  const buyerTwoEmail = buildTestEmail('buyer-b');

  const buyerA = await registerUserViaApi(request, buyerEmail, password, 'BUYER');
  const buyerB = await registerUserViaApi(request, buyerTwoEmail, password, 'BUYER');

  await ensureWalletWithFunds(request, buyerA.id, 2_000_000);
  await ensureWalletWithFunds(request, buyerB.id, 2_000_000);

  await loginViaUi(page, sellerEmail, password);
  await completeProfile(page, 'E2E Seller', '99 Seller Street, Bandung');

  await page.getByRole('link', { name: 'Sell' }).click();
  await page.getByLabel('Title').fill('E2E Guitar');
  await page.getByLabel('Description').fill('Limited edition test listing');
  await page.getByLabel('Category').selectOption('Electronics');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: Buffer.from(tinyPngBase64, 'base64'),
  });
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('Starting Bid').fill('100');
  await page.getByLabel('Reserve Price').fill('200');
  await page.getByLabel('Minimum Increment').fill('10');
  await page.getByRole('button', { name: '1 day' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Publish Listing' }).click();
  await expect(page.getByText('Listing published successfully.')).toBeVisible();

  const listingLine = await page.getByText(/Listing ID:/).textContent();
  const listingMatch = /Listing ID:\s*(.+)/.exec(listingLine ?? '');
  const listingId = listingMatch?.[1]?.trim();
  if (!listingId) {
    throw new Error('Missing listing ID after publish.');
  }

  const buyerAContext = await browser.newContext();
  const buyerAPage = await buyerAContext.newPage();
  await loginViaUi(buyerAPage, buyerEmail, password);
  await completeProfile(buyerAPage, 'E2E Buyer A', '12 Buyer Street, Depok');

  const buyerBContext = await browser.newContext();
  const buyerBPage = await buyerBContext.newPage();
  await loginViaUi(buyerBPage, buyerTwoEmail, password);
  await completeProfile(buyerBPage, 'E2E Buyer B', '34 Buyer Street, Bekasi');

  await buyerAPage.goto(`/listings/${listingId}`);
  await buyerAPage.getByRole('heading', { name: /Auction Detail/i }).waitFor();

  const priceLocatorA = buyerAPage.locator('.auction-price');
  const firstPrice = parsePrice(await priceLocatorA.textContent());
  const bidInputA = buyerAPage.getByLabel('Your amount');
  await fillMinimumBid(bidInputA);
  await buyerAPage.getByRole('button', { name: 'Place Bid' }).click();

  await expect.poll(async () => {
    return parsePrice(await priceLocatorA.textContent());
  }).toBeGreaterThan(firstPrice);

  await buyerBPage.goto(`/listings/${listingId}`);
  await buyerBPage.getByRole('heading', { name: /Auction Detail/i }).waitFor();

  const priceLocatorB = buyerBPage.locator('.auction-price');
  const priceAfterA = parsePrice(await priceLocatorB.textContent());
  const bidInputB = buyerBPage.getByLabel('Your amount');
  await fillMinimumBid(bidInputB);
  await buyerBPage.getByRole('button', { name: 'Place Bid' }).click();

  await expect.poll(async () => {
    return parsePrice(await priceLocatorB.textContent());
  }).toBeGreaterThan(priceAfterA);

  await expect.poll(async () => {
    return parsePrice(await priceLocatorA.textContent());
  }).toBeGreaterThan(priceAfterA);

  const priceAfterB = parsePrice(await priceLocatorA.textContent());
  await fillMinimumBid(bidInputA);
  await buyerAPage.getByRole('button', { name: 'Place Bid' }).click();

  await expect.poll(async () => {
    return parsePrice(await priceLocatorA.textContent());
  }).toBeGreaterThan(priceAfterB);

  await buyerAContext.close();
  await buyerBContext.close();
});
