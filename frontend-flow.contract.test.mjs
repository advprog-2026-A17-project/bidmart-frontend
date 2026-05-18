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
  const listingDetail = read('./src/modules/catalogue/pages/ListingDetailPage.tsx');
  const walletPage = read('./src/modules/wallet/pages/WalletPage.tsx');
  const sellPage = read('./src/modules/catalogue/pages/SellPage.tsx');
  const app = read('./src/App.tsx');
  const globalErrorBoundary = read('./src/components/GlobalErrorBoundary.tsx');
  const packageJson = read('./package.json');

  assert.doesNotMatch(listingDetail, /DUMMY_BIDDER_ID/);
  assert.doesNotMatch(walletPage, /DUMMY_USER_ID|user-001/);
  assert.match(authContext, /refreshAccessToken/);
  assert.doesNotMatch(authProvider, /localStorage|sessionStorage/);
  assert.match(authProvider, /trustedApiPath/);
  assert.match(authProvider, /useMemo/);
  assert.match(authProvider, /\/api\/v1\/auth\/refresh/);
  assert.match(listingDetail, /useAuthenticatedFetch/);
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
  assert.match(app, /\/seller-studio/);
  assert.match(authContext, /activeRole/);
  assert.match(app, /RoleHome/);
  assert.match(app, /ProfilePage/);
  assert.match(app, /GlobalErrorBoundary/);
  assert.match(globalErrorBoundary, /role="alert"/);
  assert.match(globalErrorBoundary, /toast-error/);
  assert.match(sellPage, /\/api\/v1\/catalogue\/listings/);
  assert.match(sellPage, /\/api\/v1\/auctions/);
  assert.doesNotMatch(sellPage, /categoryId/);
  assert.match(sellPage, /readImageFile/);
  assert.match(sellPage, /type="file"/);
  assert.match(sellPage, /toggleListingActive/);
  assert.match(sellPage, /\/deactivate/);
  assert.match(listingDetail, /\/close/);
  assert.match(walletPage, /\/detail/);
  assert.match(listingDetail, /useAuctionRealtime/);
  assert.match(listingDetail + walletPage + sellPage, /readApiError/);
  assert.match(packageJson, /"test"/);
});

test('frontend demo flow uses lifecycle calls, cents wallet amounts, and realtime notifications', () => {
  const sellPage = read('./src/modules/catalogue/pages/SellPage.tsx');
  const walletPage = read('./src/modules/wallet/pages/WalletPage.tsx');
  const paymentDetailPage = read('./src/modules/wallet/pages/PaymentDetailPage.tsx');
  const paymentUtils = read('./src/modules/wallet/utils/payment.ts');
  const notificationCenter = read('./src/modules/notifications/components/NotificationCenter.tsx');
  const app = read('./src/App.tsx');

  assert.match(sellPage, /publishCreatedListing/);
  assert.match(sellPage, /createAuctionListingPayload/);
  assert.match(sellPage, /toggleListingActive/);
  assert.match(sellPage, /\/publish/);
  assert.doesNotMatch(sellPage, /auction-created/);
  assert.match(sellPage, /Continue to Auction Setup/);
  assert.match(sellPage, /auctionType:\s*'ENGLISH'/);

  assert.match(walletPage, /toAmountCents/);
  assert.match(walletPage, /Wallet Account/);
  assert.doesNotMatch(walletPage, /User ID/);
  assert.match(walletPage, /top-up\/intent/);
  assert.match(walletPage, /amountCents/);
  assert.match(walletPage, /pendingPayment/);
  assert.match(walletPage, /midtrans\/payments\/return/);
  assert.match(walletPage, /midtrans\/payments\/\$\{pendingPayment\.paymentId\}\/sync/);
  assert.match(walletPage, /paymentMethod/);
  assert.match(walletPage, /unpaidPayments/);
  assert.match(walletPage, /\/wallet\/payments\/\$\{payment\.paymentId\}/);
  assert.match(paymentDetailPage, /Waiting for Payment/);
  assert.match(paymentDetailPage, /Expires in/);
  assert.match(paymentDetailPage, /formatRemainingTime/);
  assert.match(paymentDetailPage, /formatPaymentMethod/);
  assert.match(walletPage, /Continue to Payment/);
  assert.match(paymentUtils, /redirectUrl/);
  assert.match(app, /\/wallet\/payments\/:paymentId/);
  assert.match(walletPage, /\/withdrawals/);
  assert.match(walletPage, /bankCode/);
  assert.match(walletPage, /accountNumber/);
  assert.match(walletPage, /WITHDRAWAL_BANKS/);
  assert.match(walletPage, /pendingWithdrawal/);
  assert.doesNotMatch(walletPage, /simulatePayment|simulateWithdrawal|\/simulate/);
  assert.doesNotMatch(walletPage, /Mark Paid|Mark Failed|Expire|Fail and Reverse/);
  assert.doesNotMatch(walletPage, /Open Midtrans Simulator|Sync Payment Status|Create Sandbox Payment Intent/);

  assert.match(notificationCenter, /useWebSocket/);
  assert.match(notificationCenter, /\/user\/queue\/notifications/);
  assert.match(notificationCenter, /\/api\/v1\/notifications/);
  assert.match(notificationCenter, /notification-bell-button/);
  assert.match(notificationCenter, /notification-popover/);
  assert.doesNotMatch(app, /<Navbar \/>\s*<NotificationCenter \/>/);
  assert.match(app, /NotificationCenter/);
});

test('frontend uses skeleton loading states for core async surfaces', () => {
  const cataloguePage = read('./src/modules/catalogue/pages/CataloguePage.tsx');
  const listingDetail = read('./src/modules/catalogue/pages/ListingDetailPage.tsx');
  const walletPage = read('./src/modules/wallet/pages/WalletPage.tsx');
  const notificationCenter = read('./src/modules/notifications/components/NotificationCenter.tsx');
  const appStyles = read('./src/App.css');

  assert.match(cataloguePage, /aria-label="Loading listings"/);
  assert.match(listingDetail, /aria-label="Loading listing"/);
  assert.match(walletPage, /aria-label="Loading wallet"/);
  assert.match(notificationCenter, /aria-label="Loading notifications"/);
  assert.match(appStyles, /skeleton-pulse/);
  assert.match(appStyles, /skeleton-card/);
});

test('frontend sell flow is gated to seller accounts before any listing request is sent', () => {
  const sellPage = read('./src/modules/catalogue/pages/SellPage.tsx');
  const app = read('./src/App.tsx');

  assert.match(sellPage, /role\.name === 'SELLER'/);
  assert.match(sellPage, /Only seller accounts can publish listings/);
  assert.match(sellPage, /Seller access required/);
  assert.match(app, /const isSeller = activeRole === 'SELLER'/);
  assert.match(app, /sellerOnly/);
  assert.match(app, /activeRole === 'SELLER'/);
  assert.match(app, /Switch to Selling/);
  assert.match(app, /Switch to Buying/);
});
