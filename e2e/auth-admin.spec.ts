import { expect, test } from '@playwright/test';
import { authenticateAdminViaApi, buildTestEmail, registerUserViaApi } from './helpers/auth';
import { getGatewayBaseUrl } from './helpers/env';

test('admin console loads users and roles without manual refresh', async ({ page, request }) => {
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
  await expect(page.getByText('BUYER')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(targetEmail)).toBeVisible();

  await page.getByLabel('Search users').fill(targetEmail.split('@')[0]);
  await expect(page.getByText(targetEmail)).toBeVisible();

  const roleSelect = page.locator('.admin-user-card').filter({ hasText: targetEmail }).getByLabel('Role');
  await roleSelect.selectOption('SELLER');
  await page.getByRole('button', { name: 'Terapkan Role' }).click();
  await expect(page.getByText(/assigned/i)).toBeVisible();

  const userResponse = await request.get(
    `${getGatewayBaseUrl()}/api/v1/auth/user?email=${encodeURIComponent(targetEmail)}`,
    { headers: { Authorization: `Bearer ${admin.token}` } }
  );
  expect(userResponse.ok()).toBeTruthy();
  const userPayload = await userResponse.json() as { roles?: Array<{ name: string }> };
  expect(userPayload.roles?.some((role) => role.name === 'SELLER')).toBeTruthy();
});
