import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import ProfileGuard from '../modules/auth/components/ProfileGuard';
import { useAuth } from '../context/useAuth';
import { isSellerUser, primaryRole } from '../context/primaryRole';

const AdminDisputesPage = lazy(() => import('../modules/admin/pages/AdminDisputesPage'));
const AdminListingsPage = lazy(() => import('../modules/admin/pages/AdminListingsPage'));
const AdminStudioLayout = lazy(() => import('../modules/admin/layout/AdminStudioLayout'));
const AdminUsersPage = lazy(() => import('../modules/admin/pages/AdminUsersPage'));
const AuthPage = lazy(() => import('../modules/auth/pages/AuthPage'));
const OnboardingPage = lazy(() => import('../modules/auth/pages/OnboardingPage'));
const ProfilePage = lazy(() => import('../modules/auth/pages/ProfilePage'));
const ResetPasswordPage = lazy(() => import('../modules/auth/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../modules/auth/pages/VerifyEmailPage'));
const CataloguePage = lazy(() => import('../modules/catalogue/pages/CataloguePage'));
const ListingDetailPage = lazy(() => import('../modules/catalogue/pages/ListingDetailPage'));
const SellPage = lazy(() => import('../modules/catalogue/pages/SellPage'));
const HomePage = lazy(() => import('../modules/home/pages/HomePage'));
const OrderDetailPage = lazy(() => import('../modules/orders/pages/OrderDetailPage'));
const OrdersPage = lazy(() => import('../modules/orders/pages/OrdersPage'));
const PaymentDetailPage = lazy(() => import('../modules/wallet/pages/PaymentDetailPage'));
const WalletPage = lazy(() => import('../modules/wallet/pages/WalletPage'));

const PageFallback = () => <div className="page-loading-skeleton" aria-label="Loading page" />;

const RoleHome = () => {
    const { user } = useAuth();
    const role = primaryRole(user);
    if (role === 'ADMIN') {
        return <Navigate to="/admin/studio/users" replace />;
    }
    if (isSellerUser(user)) {
        return <Navigate to="/seller-studio" replace />;
    }
    return <HomePage />;
};

const RedirectToListing = () => {
    const { id } = useParams();
    return <Navigate to={id ? `/listings/${id}` : '/'} replace />;
};

export default function AppRoutes() {
    const { user } = useAuth();
    const role = primaryRole(user);
    const isAdmin = role === 'ADMIN';
    const isSeller = isSellerUser(user);
    const sellerOnly = (element: ReactElement) => isSeller ? element : <Navigate to={user ? '/' : '/login'} replace />;
    const adminOnly = (element: ReactElement) => isAdmin ? element : <Navigate to={user ? '/' : '/login'} replace />;

    return (
        <ProfileGuard>
            <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route path="/" element={<RoleHome />} />
                    <Route path="/marketplace" element={<CataloguePage />} />
                    <Route path="/listings/:id" element={<ListingDetailPage />} />
                    <Route path="/login" element={<AuthPage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/auctions" element={<Navigate to="/marketplace" replace />} />
                    <Route path="/auctions/:id" element={<RedirectToListing />} />
                    <Route path="/active-auctions" element={<Navigate to="/marketplace" replace />} />
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
            </Suspense>
        </ProfileGuard>
    );
}
