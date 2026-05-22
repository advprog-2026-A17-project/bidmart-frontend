import { NavLink } from 'react-router-dom';
import type { AuthUser } from '../context/auth-context';

interface RoleAwareNavigationProps {
    user: AuthUser | null;
    isAdmin: boolean;
    isSeller: boolean;
}

const navClass = ({ isActive }: { isActive: boolean }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`;

export default function RoleAwareNavigation({ user, isAdmin, isSeller }: RoleAwareNavigationProps) {
    if (!user) {
        return (
            <>
                <NavLink to="/" className={navClass} end>Home</NavLink>
                <NavLink to="/marketplace" className={navClass}>Marketplace</NavLink>
            </>
        );
    }

    if (isAdmin) {
        return (
            <>
                <NavLink to="/admin/studio/users" className={navClass}>Admin Studio</NavLink>
                <NavLink to="/profile" className={navClass}>Profile</NavLink>
            </>
        );
    }

    if (isSeller) {
        return (
            <>
                <NavLink to="/seller-studio" className={navClass} end>Seller Studio</NavLink>
                <NavLink to="/marketplace" className={navClass}>Marketplace</NavLink>
                <NavLink to="/wallet" className={navClass}>Wallet</NavLink>
                <NavLink to="/orders" className={navClass}>Orders</NavLink>
                <NavLink to="/profile" className={navClass}>Profile</NavLink>
            </>
        );
    }

    return (
        <>
            <NavLink to="/" className={navClass} end>Home</NavLink>
            <NavLink to="/marketplace" className={navClass}>Marketplace</NavLink>
            <NavLink to="/orders" className={navClass}>Orders</NavLink>
            <NavLink to="/wallet" className={navClass}>Wallet</NavLink>
            <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </>
    );
}
