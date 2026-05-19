import { expect, test } from '@playwright/test';
import {
  buildTestEmail,
  completeProfile,
  loginViaUi,
  registerUserViaApi,
} from './helpers/auth';
import { ensureWalletWithFunds } from './helpers/wallet';

const password = 'Bidmart!12345';

test('buyer can view wallet balance and start top-up', async ({ page, request }) => {
  const email = buildTestEmail('wallet-buyer');

  const user = await registerUserViaApi(request, email, password, 'BUYER');
  await ensureWalletWithFunds(request, user.id, 50_000, user.token, user.role);
  await loginViaUi(page, email, password);
  await completeProfile(page, 'E2E Wallet', '77 Wallet Road, Bogor');

  await page.getByRole('link', { name: 'Wallet' }).click();

  await expect(page.getByText('Total Balance')).toBeVisible();
  await page.getByRole('button', { name: 'Add Funds' }).click();
  await expect(page.getByRole('heading', { name: 'Add Funds' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to Payment' })).toBeVisible();
});
