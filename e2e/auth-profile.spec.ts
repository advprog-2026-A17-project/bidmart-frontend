import { expect, test } from '@playwright/test';
import { buildTestEmail, completeProfile, loginViaUi, registerUserViaUi } from './helpers/auth';

const password = 'Bidmart!12345';

test('buyer can register, verify, login, and complete profile', async ({ page }) => {
  const email = buildTestEmail('buyer');

  await registerUserViaUi(page, email, password, 'BUYER');
  await loginViaUi(page, email, password);
  await completeProfile(page, 'E2E Buyer', '123 Test Street, Jakarta');

  await page.getByRole('link', { name: 'Marketplace' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: 'Open notifications' }).click();
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});
