import { expect, test } from '@playwright/test';
import { buildTestEmail, loginViaUi, registerUserViaUi } from './helpers/auth';
import { getAuthDbConfig } from './helpers/env';
import { Client } from 'pg';
import { createHash, randomBytes } from 'crypto';

const password = 'Bidmart!12345';
const newPassword = 'Bidmart!99999';

const hashToken = (raw: string) =>
  createHash('sha256').update(raw, 'utf8').digest('hex');

const seedPasswordResetToken = async (email: string, rawToken: string) => {
  const config = getAuthDbConfig();
  const client = new Client(config);
  await client.connect();
  try {
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      throw new Error(`User not found: ${email}`);
    }
    const userId = userResult.rows[0].id;
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, last_sent_at)
       VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [userId, hashToken(rawToken)]
    );
  } finally {
    await client.end();
  }
};

test('user can reset password and login with the new password', async ({ page }) => {
  const email = buildTestEmail('reset');
  const rawToken = randomBytes(24).toString('hex');

  await registerUserViaUi(page, email, password, 'BUYER');
  await seedPasswordResetToken(email, rawToken);

  await page.goto(`/reset-password?token=${rawToken}`);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Confirm password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();

  await expect(page.getByText(/password updated/i)).toBeVisible();
  await page.waitForURL('**/login');

  await loginViaUi(page, email, newPassword);
  await expect(page.getByRole('link', { name: 'Marketplace' })).toBeVisible();
});

test('forgot password form accepts request', async ({ page }) => {
  const email = buildTestEmail('forgot');

  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();

  await expect(page.getByText(/if an account exists/i)).toBeVisible();
});
