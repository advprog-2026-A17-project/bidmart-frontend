import { createContext } from 'react';

export interface AuthUser {
    id: string;
    email: string;
    enabled: boolean;
    roles: { id: string; name: string }[];
}

export interface AuthLoginResult {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    user: AuthUser;
}

export interface AuthContextType {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    login: (payload: AuthLoginResult) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    accessToken: null,
    refreshToken: null,
    login: () => {},
    logout: () => {},
});
