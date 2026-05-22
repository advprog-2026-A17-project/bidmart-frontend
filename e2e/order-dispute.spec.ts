import { expect, test } from '@playwright/test';
import { buildTestEmail, registerUserViaApi } from './helpers/auth';
import { getGatewayBaseUrl } from './helpers/env';

const password = 'Bidmart!12345';

test('buyer can open dispute on shipped order', async ({ request }) => {
  const seller = await registerUserViaApi(request, buildTestEmail('dispute-seller'), password, 'SELLER');
  const buyer = await registerUserViaApi(request, buildTestEmail('dispute-buyer'), password, 'BUYER');

  const createResponse = await request.post(`${getGatewayBaseUrl()}/api/v1/orders`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      auctionId: `auction-dispute-${Date.now()}`,
      listingId: `listing-dispute-${Date.now()}`,
      sellerId: seller.id,
      buyerId: buyer.id,
      finalPrice: 150,
      shippingAddress: 'Jl. Dispute Test 1',
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const order = (await createResponse.json()) as { id: string };
  expect(order.id).toBeTruthy();

  const packed = await request.put(`${getGatewayBaseUrl()}/api/v1/orders/${order.id}/status`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: { status: 'PACKED' },
  });
  expect(packed.ok()).toBeTruthy();

  const shipped = await request.put(`${getGatewayBaseUrl()}/api/v1/orders/${order.id}/status`, {
    headers: { Authorization: `Bearer ${seller.token}` },
    data: { status: 'SHIPPED', carrier: 'JNE', trackingNumber: 'DISPUTE-TRK-1' },
  });
  expect(shipped.ok()).toBeTruthy();

  const dispute = await request.post(`${getGatewayBaseUrl()}/api/v1/orders/${order.id}/dispute`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
    data: { reason: 'Never received', details: 'No delivery after 14 days' },
  });
  expect(dispute.ok()).toBeTruthy();
  const disputed = (await dispute.json()) as { status?: string; disputeReason?: string };
  expect(disputed.status).toBe('DISPUTED');
  expect(disputed.disputeReason).toBe('Never received');
});
