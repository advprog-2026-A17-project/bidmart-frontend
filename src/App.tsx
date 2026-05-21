import { useState, useEffect, type ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import CataloguePage from './modules/catalogue/pages/CataloguePage';
import ListingDetailPage from './modules/catalogue/pages/ListingDetailPage';
import SellPage from './modules/catalogue/pages/SellPage';
import WalletPage from './modules/wallet/pages/WalletPage';
import PaymentDetailPage from './modules/wallet/pages/PaymentDetailPage';
import OrdersPage from './modules/orders/pages/OrdersPage';
import OrderDetailPage from './modules/orders/pages/OrderDetailPage';
import NotificationCenter from './modules/notifications/components/NotificationCenter';
import AuthPage from './modules/auth/pages/AuthPage';
import ProfilePage from './modules/auth/pages/ProfilePage';
import ProfileGuard from './modules/auth/components/ProfileGuard';
import OnboardingPage from './modules/auth/pages/OnboardingPage';
import AdminStudioLayout from './modules/admin/layout/AdminStudioLayout';
import AdminUsersPage from './modules/admin/pages/AdminUsersPage';
import AdminListingsPage from './modules/admin/pages/AdminListingsPage';
import AdminDisputesPage from './modules/admin/pages/AdminDisputesPage';
import { AuthProvider } from './context/AuthContext';
import SessionSlidingRefresh from './context/SessionSlidingRefresh';
import { useAuth } from './context/useAuth';
import { isSellerUser, primaryRole } from './context/primaryRole';
import { useAuthenticatedFetch } from './context/useAuthenticatedFetch';
import { WalletUIProvider, useWalletUI } from './context/WalletUIContext';
import { NotificationsWebSocketProvider, useNotificationsWebSocket } from './context/NotificationsWebSocketContext';
import { gatewayUrl } from './config/apiClient';
import { formatCents } from './modules/wallet/utils/payment';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { ProfileAvatarWithFallback } from './components/ProfileAvatar';
import './App.css';
import VerifyEmailPage from './modules/auth/pages/VerifyEmailPage';
import ResetPasswordPage from './modules/auth/pages/ResetPasswordPage';

const Navbar = () => {
    const { user, logout, sessionExpiresAt } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const { isConnected, subscribe, unsubscribe } = useNotificationsWebSocket();
    const role = primaryRole(user);
    const isAdmin = role === 'ADMIN';
    const isSeller = isSellerUser(user);
    const navigate = useNavigate();
    const roleLabel = role ?? 'Guest';
    const displayName = user?.displayName?.trim() || user?.email;
    const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);

    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const { showBalance, setShowBalance } = useWalletUI();

    useEffect(() => {
        if (!user) {
            setTimeout(() => setWalletBalance(null), 0);
            return;
        }

        let active = true;

        const fetchWallet = async () => {
            try {
                const response = await authenticatedFetch(gatewayUrl(`/api/v1/wallet/${user.id}/detail?role=${role}`));
                if (response.ok) {
                    const data = await response.json();
                    if (active) {
                        setWalletBalance(data.wallet?.activeBalance ?? data.activeBalance ?? null);
                    }
                } else if (response.status === 404 || response.status === 500) {
                    if (active) setWalletBalance(null);
                }
            } catch (err) {
                console.error('Failed to fetch wallet for navbar:', err);
            }
        };

        void fetchWallet();

        if (isConnected) {
            const destination = '/user/queue/notifications';
            subscribe(destination, (payload) => {
                const event = payload as { type?: string; payload?: { type?: string } };
                const type = String(event.payload?.type ?? event.type ?? '').toUpperCase();
                if (
                    ['BID_PLACED', 'OUTBID', 'AUCTION_WON', 'AUCTION_ENDED', 'ORDER_CREATED'].includes(type) ||
                    type.includes('WALLET') ||
                    type.includes('PAYMENT') ||
                    type.includes('WITHDRAW')
                ) {
                    void fetchWallet();
                }
            });
            return () => {
                active = false;
                unsubscribe(destination);
            };
        }

        return () => {
            active = false;
        };
    }, [user, role, authenticatedFetch, isConnected, subscribe, unsubscribe]);

    useEffect(() => {
        if (!sessionExpiresAt || !user) {
            setTimeout(() => setSessionRemainingSeconds(null), 0);
            return;
        }

        const updateRemaining = () => {
            const remainingMs = sessionExpiresAt - Date.now();
            const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
            setSessionRemainingSeconds(remainingSeconds);
        };

        updateRemaining();
        const intervalId = window.setInterval(updateRemaining, 1000);
        return () => window.clearInterval(intervalId);
    }, [sessionExpiresAt, user]);

    const formatSessionRemaining = (seconds: number | null) => {
        if (seconds === null) return null;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remaining = seconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
        }
        return `${minutes}:${String(remaining).padStart(2, '0')}`;
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="app-nav">
            <div className="app-brand-wrap">
                <Link to={isAdmin ? '/admin/studio/users' : isSeller ? '/seller-studio' : '/'} className="app-logo" aria-label="BidMart home">
                    BM
                </Link>
                <div>
                    <strong className="app-brand">BidMart</strong>
                    <span className="app-brand-subtitle">
                        {isAdmin ? 'Admin Studio' : isSeller ? 'Seller Studio' : 'Marketplace'}
                    </span>
                </div>
            </div>
            <div className="app-nav-links">
                {isAdmin ? (
                    <>
                        <NavLink to="/admin/studio/users" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Admin Studio
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Profile
                        </NavLink>
                    </>
                ) : isSeller ? (
                    <>
                        <NavLink to="/seller-studio" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`} end>
                            Seller Studio
                        </NavLink>
                        <NavLink to="/wallet" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Wallet
                        </NavLink>
                        <NavLink to="/orders" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Orders
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Profile
                        </NavLink>
                    </>
                ) : (
                    <>
                        <NavLink to="/" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`} end>
                            Marketplace
                        </NavLink>
                        <NavLink to="/orders" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Orders
                        </NavLink>
                        <NavLink to="/wallet" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Wallet
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Profile
                        </NavLink>
                    </>
                )}
            </div>
            <div className="app-nav-right">
                {user ? (
                    <>
                        {walletBalance !== null && (
                            <div className="navbar-wallet-balance" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>account_balance_wallet</span>
                                <strong style={{ minWidth: '80px' }}>
                                    {showBalance ? formatCents(walletBalance) : '••••••'}
                                </strong>
                                <button
                                    type="button"
                                    className="icon-button"
                                    style={{ padding: '0.2rem' }}
                                    onClick={() => setShowBalance(prev => !prev)}
                                    aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                                        {showBalance ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        )}
                        {sessionRemainingSeconds !== null && (
                            <div className={`session-timer ${sessionRemainingSeconds <= 300 ? 'session-timer-warning' : ''}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">timer</span>
                                <span>Session ends in {formatSessionRemaining(sessionRemainingSeconds)}</span>
                            </div>
                        )}
                        <NotificationCenter />
                        <span className="app-user-pill">
                            <ProfileAvatarWithFallback
                                src={user?.avatarUrl}
                                name={displayName}
                                size={28}
                            />
                            <span className="app-user-email">{displayName}</span>
                            {user.roles?.length > 0 && (
                                <span className="app-role-pill">
                                    {roleLabel}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="app-logout-button"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" className="app-logout-button">
                        <span className="material-symbols-outlined" aria-hidden="true">login</span>
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
    );
};

const RoleHome = () => {
    const { user } = useAuth();
    const role = primaryRole(user);
    if (role === 'ADMIN') {
        return <Navigate to="/admin/studio/users" replace />;
    }
    return isSellerUser(user) ? <Navigate to="/seller-studio" replace /> : <CataloguePage />;
};

const RedirectToListing = () => {
    const { id } = useParams();
    return <Navigate to={id ? `/listings/${id}` : '/'} replace />;
};

const AppLayout = () => {
    const { user } = useAuth();
    const role = primaryRole(user);
    const isAdmin = role === 'ADMIN';
    const isSeller = isSellerUser(user);
    const sellerOnly = (element: ReactElement) => isSeller ? element : <Navigate to={user ? '/' : '/login'} replace />;
    const adminOnly = (element: ReactElement) => isAdmin ? element : <Navigate to={user ? '/' : '/login'} replace />;

    return (
        <div className="app-body app-body-public">
            <main className="app-main">
                <ProfileGuard>
                    <Routes>
                        <Route path="/" element={<RoleHome />} />
                        <Route path="/marketplace" element={<CataloguePage />} />
                        <Route path="/listings/:id" element={<ListingDetailPage />} />
                        <Route path="/login" element={<AuthPage />} />
                        <Route path="/onboarding" element={<OnboardingPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/auctions" element={<Navigate to="/" replace />} />
                        <Route path="/auctions/:id" element={<RedirectToListing />} />
                        <Route path="/active-auctions" element={<Navigate to="/" replace />} />
                        <Route path="/active-auctions/:id" element={<RedirectToListing />} />
                        <Route path="/seller-studio" element={sellerOnly(<SellPage />)} />
                        <Route path="/command" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/auctions" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/auctions/:id" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/sell" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/wallet" element={<Navigate to="/wallet" replace />} />
                        <Route path="/command/profile" element={<Navigate to="/profile" replace />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/admin/auth" element={<Navigate to="/admin/studio/users" replace />} />
                        <Route path="/admin/studio" element={adminOnly(<AdminStudioLayout />)}>
                            <Route index element={<Navigate to="users" replace />} />
                            <Route path="users" element={<AdminUsersPage />} />
                            <Route path="listings" element={<AdminListingsPage />} />
                            <Route path="disputes" element={<AdminDisputesPage />} />
                        </Route>
                        <Route path="/sell" element={<Navigate to={isSeller ? '/seller-studio' : '/'} replace />} />
                        <Route path="/wallet" element={<WalletPage />} />
                        <Route path="/wallet/payments/:paymentId" element={<PaymentDetailPage />} />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                    </Routes>
                </ProfileGuard>
            </main>
        </div>
    );
};

function App() {
    return (
        <GlobalErrorBoundary>
            <ToastProvider>
            <AuthProvider>
                <WalletUIProvider>
                    <NotificationsWebSocketProvider>
                        <Router>
                            <SessionSlidingRefresh />
                            <div className="app-shell">
                                <Navbar />
                                <AppLayout />
                            </div>
                        </Router>
                    </NotificationsWebSocketProvider>
                </WalletUIProvider>
            </AuthProvider>
            </ToastProvider>
        </GlobalErrorBoundary>
    );
}

export default App;
