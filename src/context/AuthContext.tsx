import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';
import { useSessionRevocation } from '../hooks/useSessionRevocation';
import { getPersistentItem, setPersistentItem, removePersistentItem } from '../utils/storage';

const API_PATH_PREFIX = '/api/v1/';

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

    useEffect(() => {
        if (user) {
            setPersistentItem('auth_user', JSON.stringify(user));
            setPersistentItem('access_token', accessToken || '');
            setPersistentItem('refresh_token', refreshToken || '');
        } else {
            removePersistentItem('auth_user');
            removePersistentItem('access_token');
            removePersistentItem('refresh_token');
        }
    }, [user, accessToken, refreshToken]);

    const login = useCallback((payload: AuthLoginResult) => {
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
        setTokenId(extractTokenIdFromJwt(payload.accessToken));
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

        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setTokenId(null);
    }, [refreshToken]);

    useSessionRevocation(user, tokenId, logout);

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

    const contextValue = useMemo(() => ({
        user,
        accessToken,
        refreshToken,
        tokenId,
        login,
        logout,
        refreshAccessToken,
        authenticatedFetch,
    }), [accessToken, authenticatedFetch, login, logout, refreshAccessToken, refreshToken, tokenId, user]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};