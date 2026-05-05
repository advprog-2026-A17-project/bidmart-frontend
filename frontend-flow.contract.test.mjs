import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf-8');

test('frontend auth and marketplace flows use real authenticated context', () => {
  const authContext = read('./src/context/auth-context.ts');
  const authProvider = read('./src/context/AuthContext.tsx');
  const loginPage = read('./src/modules/auth/components/LoginForm.tsx');
  const registerPage = read('./src/modules/auth/components/RegisterForm.tsx');
  const profilePage = read('./src/modules/auth/pages/ProfilePage.tsx');
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
  assert.match(loginPage, /field-footer/);
  assert.match(loginPage, /auth-primary-action/);
  assert.match(appStyles, /auth-primary-action/);
  assert.match(loginPage, /GoogleLoginButton/);
  assert.match(registerPage, /GoogleLoginButton/);
  assert.match(registerPage, /VITE_GOOGLE_CLIENT_ID/);
  assert.match(authApi, /\/api\/v1\/auth\/oauth\/login/);
  assert.match(appStyles, /oauth-divider/);
  assert.match(envExample, /VITE_GOOGLE_CLIENT_ID/);
  assert.match(profilePage, /\/api\/v1\/auth\/password/);
  assert.match(profilePage, /Set Password/);
  assert.match(profilePage, /\/api\/v1\/auth\/oauth\/link/);
  assert.match(profilePage, /Connected Accounts/);
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

test('frontend demo flow uses lifecycle calls, cents wallet amounts, and realtime notifications', () => {
  const sellPage = read('./src/modules/catalogue/pages/SellPage.tsx');
  const walletPage = read('./src/modules/wallet/pages/WalletPage.tsx');
  const notificationCenter = read('./src/modules/notifications/components/NotificationCenter.tsx');
  const app = read('./src/App.tsx');

  assert.match(sellPage, /publishCreatedListing/);
  assert.match(sellPage, /markAuctionCreated/);
  assert.match(sellPage, /rollbackCreatedListing/);
  assert.match(sellPage, /\/publish/);
  assert.match(sellPage, /auction-created/);
  assert.match(sellPage, /auctionType:\s*'ENGLISH'/);

  assert.match(walletPage, /toAmountCents/);
  assert.match(walletPage, /top-up\/intent/);
  assert.match(walletPage, /amountCents/);
  assert.match(walletPage, /pendingPayment/);
  assert.match(walletPage, /midtrans\/payments/);
  assert.match(walletPage, /\/withdrawals/);
  assert.match(walletPage, /bankAccount/);
  assert.match(walletPage, /pendingWithdrawal/);
  assert.match(walletPage, /midtrans\/withdrawals/);

  assert.match(notificationCenter, /useWebSocket/);
  assert.match(notificationCenter, /\/user\/queue\/notifications/);
  assert.match(notificationCenter, /\/api\/v1\/notifications/);
  assert.match(notificationCenter, /notification-item/);
  assert.match(app, /NotificationCenter/);
});
