import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';
import { useSessionRevocation } from '../hooks/useSessionRevocation';
import { getPersistentItem, setPersistentItem, removePersistentItem } from '../utils/storage';

const API_PATH_PREFIX = '/api/v1/';
const ACTIVITY_REFRESH_DEBOUNCE_MS = 600;
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
const SESSION_EXPIRY_UPDATE_THRESHOLD_MS = 5000;
const DEFAULT_SESSION_WINDOW_SECONDS = 900;

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

const decodeJwtPayload = (token: string | null): Record<string, unknown> | null => {
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

        return JSON.parse(jsonPayload) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const extractTokenIdFromJwt = (token: string | null): string | null => {
    const payload = decodeJwtPayload(token);
    const tokenId = payload?.tokenId;
    return typeof tokenId === 'string' ? tokenId : null;
};

const getAccessTokenExpiresAtMs = (token: string | null): number | null => {
    const payload = decodeJwtPayload(token);
    const exp = payload?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
};

const isEditableInteractionTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
        return false;
    }
    return !!target.closest(
        'input, textarea, select, option, label, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    );
};

const sessionExpiryChangedMeaningfully = (
    previous: number | null,
    next: number | null,
): boolean => {
    if (previous === next) {
        return false;
    }
    if (next === null) {
        return previous !== null;
    }
    if (previous === null) {
        return true;
    }
    return next - previous >= SESSION_EXPIRY_UPDATE_THRESHOLD_MS;
};

const usersEqual = (left: AuthUser | null, right: AuthUser | null): boolean => {
    if (left === right) return true;
    if (!left || !right) return false;
    return left.id === right.id
        && left.email === right.email
        && left.enabled === right.enabled
        && (left.displayName ?? null) === (right.displayName ?? null)
        && (left.avatarUrl ?? null) === (right.avatarUrl ?? null)
        && (left.shippingAddress ?? null) === (right.shippingAddress ?? null)
        && JSON.stringify(left.roles) === JSON.stringify(right.roles);
};

const persistSession = (
    user: AuthUser | null,
    accessToken: string | null,
    refreshToken: string | null,
    sessionExpiresAt: number | null,
) => {
    if (user) {
        setPersistentItem('auth_user', JSON.stringify(user));
        setPersistentItem('access_token', accessToken || '');
        setPersistentItem('refresh_token', refreshToken || '');
        setPersistentItem('session_expires_at', sessionExpiresAt ? String(sessionExpiresAt) : '');
    } else {
        removePersistentItem('auth_user');
        removePersistentItem('access_token');
        removePersistentItem('refresh_token');
        removePersistentItem('session_expires_at');
        removePersistentItem('active_role');
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const saved = getPersistentItem('auth_user');
        return saved ? JSON.parse(saved) : null;
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

    const accessTokenRef = useRef<string | null>(getPersistentItem('access_token'));
    const refreshTokenRef = useRef<string | null>(getPersistentItem('refresh_token'));
    const accessTokenExpiresAtRef = useRef<number | null>(
        getAccessTokenExpiresAtMs(getPersistentItem('access_token')),
    );
    const sessionWindowSecondsRef = useRef(DEFAULT_SESSION_WINDOW_SECONDS);
    const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

    const shouldRefreshAccessToken = useCallback(() => {
        const expiresAt = accessTokenExpiresAtRef.current
            ?? getAccessTokenExpiresAtMs(accessTokenRef.current);
        if (!expiresAt) {
            return false;
        }
        return expiresAt - Date.now() <= REFRESH_BEFORE_EXPIRY_MS;
    }, []);

    const computeSessionExpiresAt = useCallback((payload: AuthLoginResult): number | null => {
        sessionWindowSecondsRef.current = payload.expiresIn > 0 ? payload.expiresIn : DEFAULT_SESSION_WINDOW_SECONDS;
        const accessWindowExpiresAt = Date.now() + (sessionWindowSecondsRef.current * 1000);
        const refreshWindowExpiresAt = payload.refreshExpiresAt || Number.MAX_SAFE_INTEGER;
        const nextSessionExpiresAt = Math.min(accessWindowExpiresAt, refreshWindowExpiresAt);
        return Number.isFinite(nextSessionExpiresAt) ? nextSessionExpiresAt : null;
    }, []);

    const applySessionPayload = useCallback((payload: AuthLoginResult, options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        accessTokenRef.current = payload.accessToken;
        refreshTokenRef.current = payload.refreshToken;
        accessTokenExpiresAtRef.current = getAccessTokenExpiresAtMs(payload.accessToken);

        const nextTokenId = extractTokenIdFromJwt(payload.accessToken);
        const nextSessionExpiresAt = computeSessionExpiresAt(payload);

        if (silent) {
            setUser((previous) => {
                const nextUser = usersEqual(previous, payload.user) ? previous : payload.user;
                persistSession(nextUser, payload.accessToken, payload.refreshToken, nextSessionExpiresAt);
                return nextUser;
            });
            setTokenId((previous) => (previous === nextTokenId ? previous : nextTokenId));
            setSessionExpiresAt((previous) => (
                sessionExpiryChangedMeaningfully(previous, nextSessionExpiresAt)
                    ? nextSessionExpiresAt
                    : previous
            ));
        } else {
            setUser(payload.user);
            setTokenId(nextTokenId);
            setSessionExpiresAt(nextSessionExpiresAt);
            removePersistentItem('active_role');
            persistSession(payload.user, payload.accessToken, payload.refreshToken, nextSessionExpiresAt);
        }
    }, [computeSessionExpiresAt]);

    const login = useCallback((payload: AuthLoginResult) => {
        applySessionPayload(payload, { silent: false });
    }, [applySessionPayload]);

    const logout = useCallback(async () => {
        const refreshToken = refreshTokenRef.current;
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

        accessTokenRef.current = null;
        refreshTokenRef.current = null;
        accessTokenExpiresAtRef.current = null;
        setUser(null);
        setTokenId(null);
        setSessionExpiresAt(null);
        persistSession(null, null, null, null);
    }, []);

    useSessionRevocation(user, tokenId, logout);

    useEffect(() => {
        if (!user || !sessionExpiresAt) {
            return;
        }

        const msRemaining = sessionExpiresAt - Date.now();
        if (msRemaining <= 0) {
            setTimeout(() => logout(), 0);
            return;
        }

        const timerId = window.setTimeout(() => {
            logout();
        }, msRemaining);

        return () => window.clearTimeout(timerId);
    }, [logout, sessionExpiresAt, user]);

    const refreshAccessToken = useCallback(async (): Promise<string | null> => {
        if (refreshInFlightRef.current) {
            return refreshInFlightRef.current;
        }

        const refreshToken = refreshTokenRef.current;
        if (!refreshToken) {
            logout();
            return null;
        }

        const refreshPromise = (async () => {
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
            applySessionPayload(payload, { silent: true });
            return payload.accessToken;
        })();

        refreshInFlightRef.current = refreshPromise;
        try {
            return await refreshPromise;
        } finally {
            refreshInFlightRef.current = null;
        }
    }, [applySessionPayload, logout]);

    useEffect(() => {
        if (!user || !refreshTokenRef.current) {
            return;
        }

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const scheduleRefreshIfNeeded = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                if (!shouldRefreshAccessToken()) {
                    return;
                }
                void refreshAccessToken();
            }, ACTIVITY_REFRESH_DEBOUNCE_MS);
        };

        const onMeaningfulActivity = (event: Event) => {
            if (isEditableInteractionTarget(event.target)) {
                return;
            }
            scheduleRefreshIfNeeded();
        };

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }
            scheduleRefreshIfNeeded();
        };

        document.addEventListener('click', onMeaningfulActivity, true);
        document.addEventListener('visibilitychange', onVisibilityChange);

        const expiryCheckIntervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible' || !shouldRefreshAccessToken()) {
                return;
            }
            void refreshAccessToken();
        }, 60_000);

        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            document.removeEventListener('click', onMeaningfulActivity, true);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearInterval(expiryCheckIntervalId);
        };
    }, [refreshAccessToken, shouldRefreshAccessToken, user]);

    const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const requestPath = trustedApiPath(input);

        const withToken = (token: string | null): RequestInit => {
            const headers = new Headers(init.headers);
            if (token) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            return { ...init, headers };
        };

        let response = await fetch(requestPath, withToken(accessTokenRef.current));
        if (response.status === 401 && refreshTokenRef.current) {
            const refreshedToken = await refreshAccessToken();
            if (refreshedToken) {
                response = await fetch(requestPath, withToken(refreshedToken));
            }
        }
        return response;
    }, [refreshAccessToken]);

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
            const nextUser = {
                ...previous,
                ...profile,
            };
            persistSession(
                nextUser,
                accessTokenRef.current,
                refreshTokenRef.current,
                sessionExpiresAt,
            );
            return nextUser;
        });
    }, [sessionExpiresAt]);

    const contextValue = useMemo(() => ({
        user,
        tokenId,
        sessionExpiresAt,
        login,
        logout,
        updateUserProfile,
        refreshAccessToken,
        authenticatedFetch,
    }), [authenticatedFetch, login, logout, refreshAccessToken, sessionExpiresAt, tokenId, updateUserProfile, user]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
