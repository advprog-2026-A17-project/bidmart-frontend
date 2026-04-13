import { createContext } from 'react';

export interface AuthUser {
    id: string;
    email: string;
    enabled: boolean;
    roles: { id: string; name: string }[];
}

export interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => {},
    logout: () => {},
});