import { Link, useNavigate } from 'react-router-dom';
import NotificationCenter from '../modules/notifications/components/NotificationCenter';
import { useAuth } from '../context/useAuth';
import { isSellerUser, primaryRole } from '../context/primaryRole';
import { ProfileAvatarWithFallback } from '../components/ProfileAvatar';
import NavbarWalletBalance from './NavbarWalletBalance';
import RoleAwareNavigation from './RoleAwareNavigation';
import SessionCountdown from './SessionCountdown';
import AppIcon from '../components/AppIcon';

export default function Navbar() {
    const { user, logout, sessionExpiresAt } = useAuth();
    const role = primaryRole(user);
    const isAdmin = role === 'ADMIN';
    const isSeller = isSellerUser(user);
    const navigate = useNavigate();
    const roleLabel = role ?? 'Guest';
    const displayName = user?.displayName?.trim() || user?.email;

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
                        {isAdmin ? 'Admin Studio' : isSeller ? 'Seller Studio' : 'Live Marketplace'}
                    </span>
                </div>
            </div>
            <div className="app-nav-links">
                <RoleAwareNavigation user={user} isAdmin={isAdmin} isSeller={isSeller} />
            </div>
            <div className="app-nav-right">
                {user ? (
                    <>
                        <NavbarWalletBalance user={user} isAdmin={isAdmin} />
                        <SessionCountdown expiresAt={sessionExpiresAt} enabled={Boolean(user)} />
                        <NotificationCenter />
                        <span className="app-user-pill">
                            <ProfileAvatarWithFallback
                                src={user?.avatarUrl}
                                name={displayName}
                                size={28}
                            />
                            <span className="app-user-email">{displayName}</span>
                            {user.roles?.length > 0 && (
                                <span className="app-role-pill">{roleLabel}</span>
                            )}
                        </span>
                        <button onClick={handleLogout} className="app-logout-button">
                            <AppIcon name="logOut" size={18} />
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" className="app-logout-button">
                        <AppIcon name="logIn" size={18} />
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
    );
}
