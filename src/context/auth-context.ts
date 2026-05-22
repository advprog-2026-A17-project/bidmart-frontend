import { createContext } from 'react';

export interface AuthUser {
    id: string;
    email: string;
    enabled: boolean;
    roles: { id: string; name: string }[];
    displayName?: string | null;
    avatarUrl?: string | null;
    shippingAddress?: string | null;
}

export interface AuthLoginResult {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    refreshExpiresAt: number;
    user: AuthUser;
}

export interface AuthContextType {
    user: AuthUser | null;
    tokenId: string | null;
    sessionExpiresAt: number | null;
    login: (payload: AuthLoginResult) => void;
    logout: () => void;
    updateUserProfile: (profile: {
        displayName?: string | null;
        avatarUrl?: string | null;
        shippingAddress?: string | null;
    }) => void;
    refreshSession: () => Promise<AuthLoginResult | null>;
    refreshAccessToken: () => Promise<string | null>;
    maybeRefreshSession: () => void;
    authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    tokenId: null,
    sessionExpiresAt: null,
    login: () => {},
    logout: () => {},
    updateUserProfile: () => {},
    refreshSession: async () => null,
    refreshAccessToken: async () => null,
    maybeRefreshSession: () => {},
    authenticatedFetch: async (input, init) => fetch(input, init),
});
