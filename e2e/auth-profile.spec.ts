import { expect, test } from '@playwright/test';
import { buildTestEmail, completeProfile, loginViaUi, registerUserViaUi } from './helpers/auth';
import { createHash, randomBytes } from 'crypto';
import { getAuthDbConfig } from './helpers/env';
import { Client } from 'pg';

const password = 'Bidmart!12345';

const hashVerificationToken = (raw: string) =>
  createHash('sha256').update(raw, 'utf8').digest('hex');

const seedVerificationToken = async (email: string, rawToken: string) => {
  const config = getAuthDbConfig();
  const client = new Client(config);
  await client.connect();
  try {
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error(`User not found: ${email}`);
    await client.query('UPDATE users SET email_verified = FALSE WHERE email = $1', [email]);
    await client.query(
      'UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await client.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at, last_sent_at)
       VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '1 day', NOW(), NOW())`,
      [userId, hashVerificationToken(rawToken)]
    );
  } finally {
    await client.end();
  }
};

test('buyer can verify email via link then login and complete profile', async ({ page }) => {
  const email = buildTestEmail('verify');
  const rawToken = randomBytes(24).toString('hex');

  await registerUserViaUi(page, email, password, 'BUYER');
  await seedVerificationToken(email, rawToken);

  await page.goto(`/verify-email?token=${rawToken}`);
  await expect(page.getByText(/email has been verified/i)).toBeVisible({ timeout: 15_000 });

  await loginViaUi(page, email, password);
  await completeProfile(page, 'E2E Buyer', '123 Test Street, Jakarta');

  await page.getByRole('link', { name: 'Marketplace' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: 'Open notifications' }).click();
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});
