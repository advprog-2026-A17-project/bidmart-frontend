import React, { useState, useEffect } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';
import { apiUrl } from '../config/api';

const USER_STORAGE_KEY = 'bidmart_user';
const ACCESS_TOKEN_STORAGE_KEY = 'bidmart_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'bidmart_refresh_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const stored = localStorage.getItem(USER_STORAGE_KEY);
            return stored ? (JSON.parse(stored) as AuthUser) : null;
        } catch {
            return null;
        }
    });
    const [accessToken, setAccessToken] = useState<string | null>(() =>
        sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    );
    const [refreshToken, setRefreshToken] = useState<string | null>(() =>
        localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    );

    useEffect(() => {
        if (user) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    }, [user]);

    useEffect(() => {
        if (accessToken) {
            sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
        } else {
            sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        }
    }, [accessToken]);

    useEffect(() => {
        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
        } else {
            localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        }
    }, [refreshToken]);

    const login = (payload: AuthLoginResult) => {
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
    };

    const logout = () => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
    };

    const refreshAccessToken = async (): Promise<string | null> => {
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
    };

    const authenticatedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const withToken = (token: string | null): RequestInit => ({
            ...init,
            headers: {
                ...(init.headers ?? {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        let response = await fetch(input, withToken(accessToken));
        if (response.status === 401 && refreshToken) {
            const refreshedToken = await refreshAccessToken();
            if (refreshedToken) {
                response = await fetch(input, withToken(refreshedToken));
            }
        }
        return response;
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, refreshToken, login, logout, refreshAccessToken, authenticatedFetch }}>
            {children}
        </AuthContext.Provider>
    );
};
