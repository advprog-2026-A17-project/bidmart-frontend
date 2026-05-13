import type { ClientConfig } from 'pg';
import { Client } from 'pg';
import { getAuthDbConfig } from './env';

const withClient = async <T>(config: ClientConfig, fn: (client: Client) => Promise<T>) => {
  const client = new Client(config);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

export const ensureAuthUserVerified = async (email: string) => {
  const config = getAuthDbConfig();
  return withClient(config, async (client) => {
    await client.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL, two_factor_enabled = FALSE, two_factor_secret = NULL WHERE email = $1',
      [email]
    );
    const result = await client.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      throw new Error(`Auth user not found for ${email}`);
    }
    return result.rows[0];
  });
};
