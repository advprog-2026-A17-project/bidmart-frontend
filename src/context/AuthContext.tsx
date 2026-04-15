import React, { useState, useEffect } from 'react';
import { AuthContext, type AuthLoginResult, type AuthUser } from './auth-context';

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
        localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
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
            localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
        } else {
            localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
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

    return (
        <AuthContext.Provider value={{ user, accessToken, refreshToken, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

