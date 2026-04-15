import type { AuthLoginResult } from '../../../context/auth-context';

// Compile-time contract for login payload shape returned by auth-service via gateway.
const sampleLoginResult: AuthLoginResult = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'user-id',
    email: 'user@example.com',
    enabled: true,
    roles: [{ id: 'role-id', name: 'BUYER' }],
  },
};

void sampleLoginResult;
