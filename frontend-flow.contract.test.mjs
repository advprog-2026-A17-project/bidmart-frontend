import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf-8');

test('frontend auth and marketplace flows use real authenticated context', () => {
  const authContext = read('./src/context/auth-context.ts');
  const authProvider = read('./src/context/AuthContext.tsx');
  const loginPage = read('./src/modules/auth/components/LoginForm.tsx');
  const authApi = read('./src/modules/auth/utils/auth-api.ts');
  const appStyles = read('./src/App.css');
  const envExample = read('./.env.example');
  const auctionDetail = read('./src/modules/auction/pages/AuctionDetailPage.tsx');
  const walletPage = read('./src/modules/wallet/pages/WalletPage.tsx');
  const sellPage = read('./src/modules/catalogue/pages/SellPage.tsx');
  const app = read('./src/App.tsx');
  const packageJson = read('./package.json');

  assert.doesNotMatch(auctionDetail, /DUMMY_BIDDER_ID/);
  assert.doesNotMatch(walletPage, /DUMMY_USER_ID|user-001/);
  assert.match(authContext, /refreshAccessToken/);
  assert.doesNotMatch(authProvider, /localStorage|sessionStorage/);
  assert.match(authProvider, /trustedApiPath/);
  assert.match(authProvider, /useMemo/);
  assert.match(authProvider, /\/api\/v1\/auth\/refresh/);
  assert.match(auctionDetail, /useAuthenticatedFetch/);
  assert.match(walletPage, /useAuthenticatedFetch/);
  assert.match(loginPage, /twoFactorChallenge/);
  assert.match(loginPage, /\/api\/v1\/auth\/2fa\/login-verify/);
  assert.match(loginPage, /GoogleLoginButton/);
  assert.match(authApi, /\/api\/v1\/auth\/oauth\/login/);
  assert.match(appStyles, /oauth-divider/);
  assert.match(envExample, /VITE_GOOGLE_CLIENT_ID/);
  assert.match(app, /\/profile/);
  assert.match(app, /ProfilePage/);
  assert.match(sellPage, /\/api\/v1\/catalogue\/listings/);
  assert.match(sellPage, /\/api\/v1\/auctions/);
  assert.match(sellPage, /categoryId/);
  assert.match(sellPage, /cancelListing/);
  assert.match(auctionDetail, /\/close/);
  assert.match(walletPage, /\/detail/);
  assert.match(auctionDetail, /setInterval/);
  assert.match(auctionDetail + walletPage + sellPage, /readApiError/);
  assert.match(packageJson, /"test"/);
});
