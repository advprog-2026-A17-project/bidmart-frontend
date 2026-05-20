import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { getWalletBaseUrl, loadEnv } from './env';

loadEnv();

export const ensureWalletWithFunds = async (
  request: APIRequestContext,
  userId: string,
  amountCents: number,
  token: string,
  role: 'BUYER' | 'SELLER' = 'BUYER'
) => {
  const baseUrl = getWalletBaseUrl();
  const headers = { Authorization: `Bearer ${token}` };
  const walletResponse = await request.get(`${baseUrl}/api/v1/wallet/${userId}?role=${role}`, { headers });

  if (walletResponse.status() === 404) {
    const createResponse = await request.post(`${baseUrl}/api/v1/wallet/add`, {
      headers,
      data: { userId, role },
    });
    expect(createResponse.ok()).toBeTruthy();
  } else {
    expect(walletResponse.ok()).toBeTruthy();
  }

  if (amountCents > 0) {
    const topUpResponse = await request.post(
      `${baseUrl}/api/v1/wallet/${userId}/top-up?amount=${amountCents}&role=${role}`,
      { headers }
    );
    expect(topUpResponse.ok()).toBeTruthy();
  }
};
