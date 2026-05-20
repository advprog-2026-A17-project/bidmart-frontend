import { expect, test } from '@playwright/test';
import { buildTestEmail, generateTotpCode, loginViaUi, registerUserViaApi } from './helpers/auth';
import { getGatewayBaseUrl } from './helpers/env';

const password = 'Bidmart!12345';

test('user with 2FA enabled must verify TOTP at login', async ({ page, request }) => {
  const email = buildTestEmail('2fa');
  const user = await registerUserViaApi(request, email, password, 'BUYER');

  const setupResponse = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/2fa/setup`, {
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    data: { email },
  });
  expect(setupResponse.ok()).toBeTruthy();
  const setupPayload = await setupResponse.json() as { secret?: string };
  if (!setupPayload.secret) {
    throw new Error('2FA setup did not return secret.');
  }

  const code = generateTotpCode(setupPayload.secret);
  const verifyResponse = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/2fa/verify`, {
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    data: { email, code },
  });
  expect(verifyResponse.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByText(/two-factor verification required/i)).toBeVisible();
  await page.getByLabel('Two-factor code').fill(generateTotpCode(setupPayload.secret));
  await page.getByRole('button', { name: 'Verify & Continue' }).click();

  await page.waitForURL((url) => {
    const pathname = new URL(url.toString()).pathname;
    return pathname === '/' || pathname === '/profile';
  });
});
