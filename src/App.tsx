import type { ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, NavLink, useNavigate } from 'react-router-dom';
import AuctionDetailPage from './modules/auction/pages/AuctionDetailPage';
import BuyerAuctionsPage from './modules/auction/pages/BuyerAuctionsPage';
import CataloguePage from './modules/catalogue/pages/CataloguePage';
import ListingDetailPage from './modules/catalogue/pages/ListingDetailPage';
import SellPage from './modules/catalogue/pages/SellPage';
import WalletPage from './modules/wallet/pages/WalletPage';
import PaymentDetailPage from './modules/wallet/pages/PaymentDetailPage';
import NotificationCenter from './modules/notifications/components/NotificationCenter';
import AuthPage from './modules/auth/pages/AuthPage';
import ProfilePage from './modules/auth/pages/ProfilePage';
import ProfileGuard from './modules/auth/components/ProfileGuard';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import './App.css';
import VerifyEmailPage from './modules/auth/pages/VerifyEmailPage';

const Navbar = () => {
    const { user, activeRole, switchRole, logout } = useAuth();
    const hasBuyer = user?.roles?.some((role) => role.name === 'BUYER') ?? false;
    const hasSeller = user?.roles?.some((role) => role.name === 'SELLER') ?? false;
    const isSeller = activeRole === 'SELLER';
    const navigate = useNavigate();
    const roleLabel = activeRole ?? user?.roles?.[0]?.name ?? 'Guest';

    const handleSwitchRole = (role: 'BUYER' | 'SELLER') => {
        switchRole(role);
        navigate(role === 'SELLER' ? '/seller-studio' : '/');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="app-nav">
            <div className="app-brand-wrap">
                <Link to={isSeller ? '/seller-studio' : '/'} className="app-logo" aria-label="BidMart home">
                    BM
                </Link>
                <div>
                    <strong className="app-brand">BidMart</strong>
                    <span className="app-brand-subtitle">{isSeller ? 'Seller Studio' : 'Marketplace'}</span>
                </div>
            </div>
            <div className="app-nav-links">
                {isSeller ? (
                    <>
                        <NavLink to="/seller-studio" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`} end>
                            Seller Studio
                        </NavLink>
                        <NavLink to="/wallet" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Wallet
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
                        <NavLink to="/active-auctions" className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}>
                            Active Auctions
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
                        {hasBuyer && isSeller && (
                            <button type="button" className="account-switch-button" onClick={() => handleSwitchRole('BUYER')}>
                                <span className="material-symbols-outlined" aria-hidden="true">shopping_bag</span>
                                Switch to Buying
                            </button>
                        )}
                        {hasSeller && !isSeller && (
                            <button type="button" className="account-switch-button" onClick={() => handleSwitchRole('SELLER')}>
                                <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                                Switch to Selling
                            </button>
                        )}
                        {!hasSeller && !isSeller && (
                            <Link to="/login?tab=register&role=SELLER" className="account-switch-button">
                                <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                                Open Seller Account
                            </Link>
                        )}
                        {!hasBuyer && isSeller && (
                            <Link to="/login?tab=register&role=BUYER" className="account-switch-button">
                                <span className="material-symbols-outlined" aria-hidden="true">shopping_bag</span>
                                Open Buying Account
                            </Link>
                        )}
                        <NotificationCenter />
                        <span className="app-user-pill">
                            <span className="material-symbols-outlined app-user-icon" aria-hidden="true">account_circle</span>
                            <span className="app-user-email">{user.email}</span>
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
    const { activeRole } = useAuth();
    return activeRole === 'SELLER' ? <Navigate to="/seller-studio" replace /> : <CataloguePage />;
};

const AppLayout = () => {
    const { user, activeRole } = useAuth();
    const isSeller = activeRole === 'SELLER';
    const sellerOnly = (element: ReactElement) => isSeller ? element : <Navigate to={user ? '/' : '/login'} replace />;

    return (
        <div className="app-body app-body-public">
            <main className="app-main">
                <ProfileGuard>
                    <Routes>
                        <Route path="/" element={<RoleHome />} />
                        <Route path="/marketplace" element={<CataloguePage />} />
                        <Route path="/listings/:id" element={<ListingDetailPage />} />
                        <Route path="/login" element={<AuthPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/auctions" element={<Navigate to="/active-auctions" replace />} />
                        <Route path="/auctions/:id" element={<AuctionDetailPage />} />
                        <Route path="/active-auctions" element={<BuyerAuctionsPage />} />
                        <Route path="/active-auctions/:id" element={<AuctionDetailPage />} />
                        <Route path="/seller-studio" element={sellerOnly(<SellPage />)} />
                        <Route path="/command" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/auctions" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/auctions/:id" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/sell" element={<Navigate to="/seller-studio" replace />} />
                        <Route path="/command/wallet" element={<Navigate to="/wallet" replace />} />
                        <Route path="/command/profile" element={<Navigate to="/profile" replace />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/sell" element={<Navigate to={isSeller ? '/seller-studio' : '/'} replace />} />
                        <Route path="/wallet" element={<WalletPage />} />
                        <Route path="/wallet/payments/:paymentId" element={<PaymentDetailPage />} />
                    </Routes>
                </ProfileGuard>
            </main>
        </div>
    );
};

function App() {
    return (
        <GlobalErrorBoundary>
            <AuthProvider>
                <Router>
                    <div className="app-shell">
                        <Navbar />
                        <AppLayout />
                    </div>
                </Router>
            </AuthProvider>
        </GlobalErrorBoundary>
    );
}

export default App;
