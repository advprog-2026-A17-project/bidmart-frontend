import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { getWalletBaseUrl, loadEnv } from './env';

loadEnv();

export const ensureWalletWithFunds = async (
  request: APIRequestContext,
  userId: string,
  amountCents: number
) => {
  const baseUrl = getWalletBaseUrl();
  const walletResponse = await request.get(`${baseUrl}/api/v1/wallet/${userId}`);

  if (walletResponse.status() === 404) {
    const createResponse = await request.post(`${baseUrl}/api/v1/wallet/add`, {
      data: { userId },
    });
    expect(createResponse.ok()).toBeTruthy();
  } else {
    expect(walletResponse.ok()).toBeTruthy();
  }

  if (amountCents > 0) {
    const topUpResponse = await request.post(
      `${baseUrl}/api/v1/wallet/${userId}/top-up?amount=${amountCents}`
    );
    expect(topUpResponse.ok()).toBeTruthy();
  }
};
