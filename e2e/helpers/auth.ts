import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ensureAuthUserVerified } from './db';
import { getGatewayBaseUrl, loadEnv } from './env';

loadEnv();

// TODO(admin): add helper to create/seed an admin user and cover admin-only E2E flows.

export const buildTestEmail = (prefix: string) => {
  const stamp = Date.now();
  const nonce = Math.floor(Math.random() * 10_000);
  return `${prefix}-${stamp}-${nonce}@bidmart.local`;
};

export const registerUserViaApi = async (
  request: APIRequestContext,
  email: string,
  password: string,
  role: 'BUYER' | 'SELLER'
) => {
  const response = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/register`, {
    data: { email, password, role },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { id?: string; email?: string } | null;
  if (!payload?.id) {
    throw new Error('Register response missing user id.');
  }
  await ensureAuthUserVerified(email);
  return { id: payload.id, email: payload.email ?? email };
};

export const registerUserViaUi = async (
  page: Page,
  email: string,
  password: string,
  role: 'BUYER' | 'SELLER'
) => {
  await page.goto('/login');
  await page.locator('.auth-tabs').getByRole('button', { name: 'register', exact: true }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Role').selectOption(role);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Account created. Please verify your email before logging in.')).toBeVisible();
  await ensureAuthUserVerified(email);
};

export const authenticateAdminViaApi = async (request: APIRequestContext) => {
  const email = process.env.BIDMART_ADMIN_EMAIL || 'admin@bidmart.com';
  const password = process.env.BIDMART_ADMIN_PASSWORD || 'verySafepw.09';

  const response = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/login`, {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as any;
  if (!payload?.accessToken || !payload?.user?.id) {
    throw new Error('Admin login did not return access token and user id.');
  }

  return {
    id: payload.user.id,
    email: payload.user.email || email,
    token: payload.accessToken,
  };
};

export const loginViaUi = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/profile');
};

export const completeProfile = async (
  page: Page,
  displayName: string,
  shippingAddress: string
) => {
  await page.getByRole('heading', { name: 'Profile', exact: true, level: 1 }).waitFor();
  const displayNameInput = page.getByLabel('Display name');

  if (!(await displayNameInput.isEnabled())) {
    const editButton = page.getByRole('button', { name: 'Edit Profile' });
    await editButton.waitFor();
    await editButton.click();
    await expect(displayNameInput).toBeEnabled();
  }

  await displayNameInput.fill(displayName);
  await page.getByLabel('Shipping address').fill(shippingAddress);
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();
};
