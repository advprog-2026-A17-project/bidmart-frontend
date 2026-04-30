import React, { useCallback, useMemo, useState } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';

const API_PATH_PREFIX = '/api/v1/';

const trustedApiPath = (input: RequestInfo | URL): string => {
    const rawUrl = input instanceof Request ? input.url : input.toString();
    const parsedUrl = new URL(rawUrl, globalThis.location.origin);
    const sameOrigin = parsedUrl.origin === globalThis.location.origin;
    if (!sameOrigin || !parsedUrl.pathname.startsWith(API_PATH_PREFIX)) {
        throw new Error('Only same-origin API Gateway requests are allowed');
    }
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);

    const login = useCallback((payload: AuthLoginResult) => {
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
    }, []);

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
