import type { AuthUser } from './auth-context';

export type PrimaryRole = 'BUYER' | 'SELLER' | 'ADMIN';

export const primaryRole = (user: AuthUser | null): PrimaryRole | null => {
    if (!user?.roles?.length) {
        return null;
    }
    const names = user.roles.map((role) => role.name);
    if (names.includes('ADMIN')) return 'ADMIN';
    if (names.includes('SELLER')) return 'SELLER';
    if (names.includes('BUYER')) return 'BUYER';
    return null;
};

export const isSellerUser = (user: AuthUser | null): boolean => primaryRole(user) === 'SELLER';
