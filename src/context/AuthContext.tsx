import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        const saved = localStorage.getItem('auth_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [accessToken, setAccessToken] = useState<string | null>(() => {
        return localStorage.getItem('access_token');
    });
    const [refreshToken, setRefreshToken] = useState<string | null>(() => {
        return localStorage.getItem('refresh_token');
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('auth_user', JSON.stringify(user));
            localStorage.setItem('access_token', accessToken || '');
            localStorage.setItem('refresh_token', refreshToken || '');
        } else {
            localStorage.removeItem('auth_user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }, [user, accessToken, refreshToken]);

    const login = useCallback((payload: AuthLoginResult) => {
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
    }, []);

    const logout = useCallback(async () => {
        if (refreshToken) {
            try {
                // Invalidate session on the backend before clearing local state
                await fetch(apiUrl('/api/v1/auth/logout'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
            } catch (error) {
                console.error('Failed to invalidate session on the backend', error);
            }
        }
        
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
    }, [refreshToken]);

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
        login,
        logout,
        refreshAccessToken,
        authenticatedFetch,
    }), [accessToken, authenticatedFetch, login, logout, refreshAccessToken, refreshToken, user]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};