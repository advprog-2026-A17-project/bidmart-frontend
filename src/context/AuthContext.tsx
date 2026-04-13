import React, { useState, useEffect } from 'react';
import { AuthContext, type AuthUser } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const stored = localStorage.getItem('bidmart_user');
            return stored ? (JSON.parse(stored) as AuthUser) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('bidmart_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('bidmart_user');
        }
    }, [user]);

    const login = (u: AuthUser) => setUser(u);
    const logout = () => setUser(null);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};


