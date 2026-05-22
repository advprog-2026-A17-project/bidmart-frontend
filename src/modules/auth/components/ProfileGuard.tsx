import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { primaryRole } from '../../../context/primaryRole';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GuardStatus = 'idle' | 'loading' | 'complete' | 'incomplete' | 'error';

type OnboardingStatus = {
    profileCompleted?: boolean;
    needsPassword?: boolean;
    needsRole?: boolean;
    role?: string | null;
};

/** Routes reachable before onboarding is complete (profile is not included). */
const PRE_ONBOARDING_ROUTES = new Set(['/login', '/verify-email', '/reset-password', '/onboarding']);

const ProfileGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, refreshSession } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<GuardStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [retryTick, setRetryTick] = useState(0);
    const userId = user?.id;
    const isAdmin = user?.roles?.some((role) => role.name === 'ADMIN') ?? false;
    const currentRole = primaryRole(user);

    const shouldGuard = useMemo(() => {
        if (!userId) {
            return false;
        }
        if (isAdmin) {
            return false;
        }
        if (PRE_ONBOARDING_ROUTES.has(location.pathname)) {
            return false;
        }
        return true;
    }, [isAdmin, location.pathname, userId]);

    useEffect(() => {
        if (!shouldGuard || !userId) {
            setStatus('idle');
            setError(null);
            return;
        }

        let active = true;

        const checkProfile = async () => {
            setStatus('loading');
            setError(null);
            try {
                let response: Response | null = null;
                for (let attempt = 0; attempt <= 2; attempt += 1) {
                    response = await authenticatedFetch(gatewayUrl('/api/v1/auth/onboarding'));
                    if (response.ok || ![502, 503, 504].includes(response.status) || attempt === 2) {
                        break;
                    }
                    await sleep(400 * (attempt + 1));
                }

                if (!response || !response.ok) {
                    throw new Error(await readApiError(response ?? new Response(null, { status: 503 }), 'Onboarding lookup failed'));
                }

                const payload = await response.json() as OnboardingStatus;
                const needsOnboarding = payload.profileCompleted === false
                    || payload.needsPassword === true
                    || payload.needsRole === true;

                if (!active) return;

                if (needsOnboarding) {
                    setStatus('incomplete');
                    navigate('/onboarding', { replace: true, state: { from: location.pathname } });
                    return;
                }

                if (
                    (payload.role === 'BUYER' || payload.role === 'SELLER')
                    && payload.role !== currentRole
                ) {
                    await refreshSession();
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
    // Re-run only when the signed-in user changes, not on every profile field update
    // (updateUserProfile mutates `user` and would remount children, dismissing toasts).
    }, [authenticatedFetch, currentRole, location.pathname, navigate, refreshSession, retryTick, shouldGuard, userId]);

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
