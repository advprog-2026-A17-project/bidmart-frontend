import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../bidmart-infrastructure/.env');

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const loadEnv = () => {
  dotenv.config({ path: envPath });
  return envPath;
};

export const getFrontendBaseUrl = () => {
  const override = process.env.E2E_BASE_URL?.trim();
  if (override) {
    return stripTrailingSlash(override);
  }

  const port = process.env.FRONTEND_PORT?.trim();
  if (!port || port === '80') {
    return 'http://localhost';
  }

  return `http://localhost:${port}`;
};

export const getGatewayBaseUrl = () => {
  const override =
    process.env.E2E_GATEWAY_URL?.trim() ||
    process.env.FRONTEND_API_BASE_URL?.trim();

  if (override) {
    return stripTrailingSlash(override);
  }

  const port = process.env.GATEWAY_PORT?.trim() || '8000';
  return `http://localhost:${port}`;
};

export const getWalletBaseUrl = () => {
  const override = process.env.E2E_WALLET_URL?.trim();
  if (override) {
    return stripTrailingSlash(override);
  }

  // Use port 8000 (Gateway) because 8083 is not exposed to host
  return 'http://localhost:8000';
};

export const getAuthDbConfig = () => ({
  host: process.env.AUTH_DB_HOST?.trim() || 'localhost',
  port: Number(process.env.AUTH_DB_PORT || 5434),
  user: process.env.AUTH_DB_USERNAME?.trim() || 'postgres',
  password: process.env.AUTH_DB_PASSWORD ?? 'postgres',
  database: process.env.AUTH_DB_NAME?.trim() || 'bidmart_auth',
});
