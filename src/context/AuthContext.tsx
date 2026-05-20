import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';
import { useSessionRevocation } from '../hooks/useSessionRevocation';
import { getPersistentItem, setPersistentItem, removePersistentItem } from '../utils/storage';

const API_PATH_PREFIX = '/api/v1/';
type AccountRole = 'BUYER' | 'SELLER';
const SESSION_REFRESH_MIN_INTERVAL_MS = 60000;

const trustedApiPath = (input: RequestInfo | URL): string => {
    const rawUrl = input instanceof Request ? input.url : input.toString();
    const parsedUrl = new URL(rawUrl, globalThis.location.origin);
    
    const expectedBackendOrigin = new URL(apiUrl('/'), globalThis.location.origin).origin;

    const isSameOrigin = parsedUrl.origin === globalThis.location.origin;
    const isBackendOrigin = parsedUrl.origin === expectedBackendOrigin;

    if (!(isSameOrigin || isBackendOrigin) || !parsedUrl.pathname.startsWith(API_PATH_PREFIX)) {
        throw new Error('Only trusted API Gateway requests are allowed');
    }

    if (isSameOrigin && parsedUrl.pathname.startsWith(API_PATH_PREFIX)) {
        return new URL(parsedUrl.pathname + parsedUrl.search, expectedBackendOrigin).toString();
    }
    
    return parsedUrl.toString();
};

const extractTokenIdFromJwt = (token: string | null): string | null => {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const base64Url = parts[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        while (base64.length % 4 !== 0) {
            base64 += '=';
        }

        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        return payload.tokenId || null;
    } catch {
        return null;
    }
};

const hasRole = (user: AuthUser | null, role: AccountRole): boolean =>
    user?.roles?.some((item) => item.name === role) ?? false;

const resolveActiveRole = (user: AuthUser | null, preferred: string | null): AccountRole | null => {
    if (!user) return null;
    if ((preferred === 'BUYER' || preferred === 'SELLER') && hasRole(user, preferred)) {
        return preferred;
    }
    if (hasRole(user, 'BUYER')) return 'BUYER';
    if (hasRole(user, 'SELLER')) return 'SELLER';
    return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const saved = getPersistentItem('auth_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [accessToken, setAccessToken] = useState<string | null>(() => {
        return getPersistentItem('access_token');
    });
    const [refreshToken, setRefreshToken] = useState<string | null>(() => {
        return getPersistentItem('refresh_token');
    });
    const [tokenId, setTokenId] = useState<string | null>(() => {
        const token = getPersistentItem('access_token');
        return extractTokenIdFromJwt(token);
    });
    const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(() => {
        const saved = getPersistentItem('session_expires_at');
        if (!saved) return null;
        const parsed = Number(saved);
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [activeRole, setActiveRole] = useState<AccountRole | null>(() => {
        const savedRole = getPersistentItem('active_role');
        const savedUser = getPersistentItem('auth_user');
        return resolveActiveRole(savedUser ? JSON.parse(savedUser) as AuthUser : null, savedRole);
    });

    useEffect(() => {
        if (user) {
            setPersistentItem('auth_user', JSON.stringify(user));
            setPersistentItem('access_token', accessToken || '');
            setPersistentItem('refresh_token', refreshToken || '');
            setPersistentItem('session_expires_at', sessionExpiresAt ? String(sessionExpiresAt) : '');
            const nextRole = resolveActiveRole(user, activeRole);
            if (nextRole) {
                setPersistentItem('active_role', nextRole);
            }
        } else {
            removePersistentItem('auth_user');
            removePersistentItem('access_token');
            removePersistentItem('refresh_token');
            removePersistentItem('session_expires_at');
            removePersistentItem('active_role');
        }
    }, [user, accessToken, refreshToken, sessionExpiresAt, activeRole]);

    const login = useCallback((payload: AuthLoginResult) => {
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
        setTokenId(extractTokenIdFromJwt(payload.accessToken));
        setSessionExpiresAt(payload.refreshExpiresAt || null);
        setActiveRole(resolveActiveRole(payload.user, getPersistentItem('active_role')));
    }, []);

    const logout = useCallback(async () => {
        if (refreshToken) {
            try {
                await fetch(apiUrl('/api/v1/auth/logout'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
            } catch (error) {
                console.error('Failed to invalidate session on the backend', error);
            }
        }
        
        removePersistentItem('auth_user');
        removePersistentItem('access_token');
        removePersistentItem('refresh_token');
        removePersistentItem('session_expires_at');
        removePersistentItem('active_role');

        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setTokenId(null);
        setSessionExpiresAt(null);
        setActiveRole(null);
    }, [refreshToken]);

    useSessionRevocation(user, tokenId, logout);

    useEffect(() => {
        if (!user || !sessionExpiresAt) {
            return;
        }

        const msRemaining = sessionExpiresAt - Date.now();
        if (msRemaining <= 0) {
            logout();
            return;
        }

        const timerId = window.setTimeout(() => {
            logout();
        }, msRemaining);

        return () => window.clearTimeout(timerId);
    }, [logout, sessionExpiresAt, user]);

    const refreshAccessToken = useCallback(async (): Promise<string | null> => {
        if (!refreshToken) {
            logout();
            return null;
        }

        const response = await fetch(apiUrl('/api/v1/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            logout();
            return null;
        }

        const payload = await response.json() as AuthLoginResult;
        login(payload);
        return payload.accessToken;
    }, [login, logout, refreshToken]);

    const lastRefreshAtRef = useRef(0);

    useEffect(() => {
        if (!user || !refreshToken) {
            return;
        }

        const refreshOnActivity = () => {
            const now = Date.now();
            if (now - lastRefreshAtRef.current < SESSION_REFRESH_MIN_INTERVAL_MS) {
                return;
            }
            lastRefreshAtRef.current = now;
            void refreshAccessToken();
        };

        const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
        events.forEach((eventName) => {
            window.addEventListener(eventName, refreshOnActivity, { passive: true });
        });

        return () => {
            events.forEach((eventName) => {
                window.removeEventListener(eventName, refreshOnActivity);
            });
        };
    }, [refreshAccessToken, refreshToken, user]);

    const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const requestPath = trustedApiPath(input);

        const withToken = (token: string | null): RequestInit => {
            const headers = new Headers(init.headers);
            if (token) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            return { ...init, headers };
        };

        let response = await fetch(requestPath, withToken(accessToken));
        if (response.status === 401 && refreshToken) {
            const refreshedToken = await refreshAccessToken();
            if (refreshedToken) {
                response = await fetch(requestPath, withToken(refreshedToken));
            }
        }
        return response;
    }, [accessToken, refreshAccessToken, refreshToken]);

    const switchRole = useCallback((role: AccountRole) => {
        if (!hasRole(user, role)) {
            return;
        }
        setActiveRole(role);
        setPersistentItem('active_role', role);
    }, [user]);

    const updateUserProfile = useCallback((profile: {
        displayName?: string | null;
        avatarUrl?: string | null;
        shippingAddress?: string | null;
    }) => {
        setUser((previous) => {
            if (!previous) return previous;
            const nextDisplayName = profile.displayName ?? previous.displayName ?? null;
            const nextAvatarUrl = profile.avatarUrl ?? previous.avatarUrl ?? null;
            const nextShippingAddress = profile.shippingAddress ?? previous.shippingAddress ?? null;
            const unchanged =
                (previous.displayName ?? null) === nextDisplayName
                && (previous.avatarUrl ?? null) === nextAvatarUrl
                && (previous.shippingAddress ?? null) === nextShippingAddress;
            if (unchanged) {
                return previous;
            }
            return {
                ...previous,
                ...profile,
            };
        });
    }, []);

    const contextValue = useMemo(() => ({
        user,
        accessToken,
        refreshToken,
        tokenId,
        sessionExpiresAt,
        activeRole,
        login,
        logout,
        switchRole,
        updateUserProfile,
        refreshAccessToken,
        authenticatedFetch,
    }), [accessToken, activeRole, authenticatedFetch, login, logout, refreshAccessToken, refreshToken, sessionExpiresAt, switchRole, tokenId, updateUserProfile, user]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
