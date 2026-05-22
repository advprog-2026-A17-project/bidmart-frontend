import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { createHmac } from 'crypto';
import { ensureAuthUserVerified } from './db';
import { getGatewayBaseUrl, loadEnv } from './env';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const decodeBase32 = (value: string): Buffer => {
  let buffer = 0;
  let bitsLeft = 0;
  const bytes: number[] = [];
  for (const char of value.toUpperCase().replace(/=+$/, '')) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error('Invalid base32 secret');
    }
    buffer = (buffer << 5) | index;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(bytes);
};

export const generateTotpCode = (secret: string, counter?: number): string => {
  const epoch = Math.floor(Date.now() / 1000);
  const step = counter ?? Math.floor(epoch / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(step));
  const key = decodeBase32(secret);
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

loadEnv();

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
  let response = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/register`, {
    data: { email, password, role },
  });
  // Dockerized auth service can still be warming up when the first E2E starts.
  for (let attempt = 0; attempt < 5 && !response.ok(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/register`, {
      data: { email, password, role },
    });
  }

  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { id?: string; email?: string } | null;
  if (!payload?.id) {
    throw new Error('Register response missing user id.');
  }
  await ensureAuthUserVerified(email);
  const loginResponse = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginPayload = await loginResponse.json() as { accessToken?: string } | null;
  if (!loginPayload?.accessToken) {
    throw new Error('Login response missing access token.');
  }
  return { id: payload.id, email: payload.email ?? email, role, token: loginPayload.accessToken };
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
  if (role === 'SELLER') {
    await page.getByRole('radio', { name: /penjual/i }).click();
  } else {
    await page.getByRole('radio', { name: /pembeli/i }).click();
  }
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText(/akun (pembeli|penjual) dibuat/i)).toBeVisible();
  await ensureAuthUserVerified(email);
};

export const authenticateAdminViaApi = async (request: APIRequestContext) => {
  const email = process.env.BIDMART_ADMIN_EMAIL || 'admin@bidmart.com';
  const password = process.env.BIDMART_ADMIN_PASSWORD || 'veryStrongadmin.09';

  const response = await request.post(`${getGatewayBaseUrl()}/api/v1/auth/login`, {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { 
    accessToken?: string; 
    user?: { 
      id: string; 
      email?: string; 
    } 
  } | null;

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
  await page.waitForURL((url) => {
    const pathname = new URL(url.toString()).pathname;
    return pathname === '/' || pathname === '/profile';
  });
};

export const completeProfile = async (
  page: Page,
  displayName: string,
  shippingAddress: string
) => {
  const authState = await page.evaluate(() => ({
    accessToken: window.localStorage.getItem('access_token'),
    authUser: window.localStorage.getItem('auth_user'),
  }));

  const parsedUser = authState.authUser ? JSON.parse(authState.authUser) as { email?: string } : null;
  if (!authState.accessToken || !parsedUser?.email) {
    throw new Error('Missing authenticated user state for profile completion.');
  }

  const response = await page.request.put(`${getGatewayBaseUrl()}/api/v1/auth/profile`, {
    headers: {
      Authorization: `Bearer ${authState.accessToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      email: parsedUser.email,
      displayName,
      shippingAddress,
      avatarUrl: null,
    },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto('/profile');
  await page.getByRole('heading', { name: 'Profile', exact: true, level: 1 }).waitFor();
  await expect(page.getByText('Loading profile details...')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByLabel('Display name')).toHaveValue(displayName);
  await expect(page.getByLabel('Shipping address')).toHaveValue(shippingAddress);
};
