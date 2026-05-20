import { expect, test } from '@playwright/test';
import { authenticateAdminViaApi, buildTestEmail, registerUserViaApi } from './helpers/auth';
import { getGatewayBaseUrl } from './helpers/env';

test('admin can load roles and assign a role to a user', async ({ page, request }) => {
  const admin = await authenticateAdminViaApi(request);
  const targetEmail = buildTestEmail('role-target');
  const target = await registerUserViaApi(request, targetEmail, 'Bidmart!12345', 'BUYER');

  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    window.localStorage.setItem('access_token', token);
    window.localStorage.setItem('auth_user', JSON.stringify(user));
  }, {
    token: admin.token,
    user: { id: admin.id, email: admin.email, roles: [{ id: 'admin', name: 'ADMIN' }] },
  });

  await page.goto('/admin/auth');
  await page.getByRole('button', { name: 'Refresh Roles' }).click();
  await expect(page.getByText('BUYER')).toBeVisible();

  await page.getByLabel('User ID (UUID)').fill(target.id);
  await page.getByLabel('Role Name').fill('SELLER');
  await page.getByRole('button', { name: 'Assign Role' }).click();
  await expect(page.getByText(/assigned to user/i)).toBeVisible();

  const userResponse = await request.get(
    `${getGatewayBaseUrl()}/api/v1/auth/user?email=${encodeURIComponent(targetEmail)}`,
    { headers: { Authorization: `Bearer ${admin.token}` } }
  );
  expect(userResponse.ok()).toBeTruthy();
  const userPayload = await userResponse.json() as { roles?: Array<{ name: string }> };
  expect(userPayload.roles?.some((role) => role.name === 'SELLER')).toBeTruthy();
});
