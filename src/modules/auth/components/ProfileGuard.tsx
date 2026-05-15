import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';

type GuardStatus = 'idle' | 'loading' | 'complete' | 'incomplete' | 'error';

type UserProfileResponse = {
    displayName?: string | null;
    shippingAddress?: string | null;
};

const UNGUARDED_ROUTES = new Set(['/login', '/verify-email', '/profile', '/command/profile']);

const isPublicMarketplaceRoute = (pathname: string): boolean =>
    pathname === '/'
    || pathname === '/marketplace'
    || pathname === '/auctions'
    || pathname.startsWith('/auctions/')
    || pathname === '/active-auctions'
    || pathname.startsWith('/active-auctions/')
    || pathname.startsWith('/listings/');

const isGuardedRoute = (pathname: string): boolean =>
    !UNGUARDED_ROUTES.has(pathname) && !isPublicMarketplaceRoute(pathname);

const isBlank = (value?: string | null): boolean => !value || value.trim() === '';

const ProfileGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<GuardStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [retryTick, setRetryTick] = useState(0);

    const shouldGuard = useMemo(
        () => Boolean(user) && isGuardedRoute(location.pathname),
        [user, location.pathname]
    );

    useEffect(() => {
        if (!shouldGuard || !user) {
            setStatus('idle');
            setError(null);
            return;
        }

        let active = true;

        const checkProfile = async () => {
            setStatus('loading');
            setError(null);
            try {
                const response = await authenticatedFetch(
                    gatewayUrl(`/api/v1/auth/profile?email=${encodeURIComponent(user.email)}`)
                );

                if (!response.ok) {
                    throw new Error(await readApiError(response, 'Profile lookup failed'));
                }

                const payload = await response.json() as UserProfileResponse;
                const isComplete = !isBlank(payload.displayName) && !isBlank(payload.shippingAddress);

                if (!active) return;

                if (!isComplete) {
                    setStatus('incomplete');
                    navigate('/profile', { replace: true, state: { from: location.pathname } });
                    return;
                }

                setStatus('complete');
            } catch (err: unknown) {
                if (!active) return;
                setStatus('error');
                setError(err instanceof Error ? err.message : 'Failed to check profile.');
            }
        };

        checkProfile();

        return () => {
            active = false;
        };
    }, [authenticatedFetch, location.pathname, navigate, retryTick, shouldGuard, user]);

    if (!shouldGuard) {
        return <>{children}</>;
    }

    if (status === 'loading') {
        return <div className="loading-state">Checking your profile...</div>;
    }

    if (status === 'error') {
        return (
            <div className="panel center-content">
                <p className="text-muted">{error ?? 'Unable to verify profile completeness.'}</p>
                <button className="primary-button" type="button" onClick={() => setRetryTick((value) => value + 1)}>
                    Retry Profile Check
                </button>
            </div>
        );
    }

    if (status === 'incomplete') {
        return <div className="loading-state">Redirecting to profile completion...</div>;
    }

    return <>{children}</>;
};

export default ProfileGuard;
