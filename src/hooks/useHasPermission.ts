import { useEffect, useState } from 'react';
import { apiUrl } from '../config/api';
import { useAuth } from '../context/useAuth';

export const useHasPermission = (permission: string): boolean => {
    const { user } = useAuth();
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        if (!user?.email || !permission) {
            setAllowed(false);
            return;
        }

        let cancelled = false;
        const check = async () => {
            try {
                const params = new URLSearchParams({
                    email: user.email,
                    permission,
                });
                const response = await fetch(apiUrl(`/api/v1/auth/permissions/check?${params.toString()}`));
                if (!response.ok) {
                    if (!cancelled) setAllowed(false);
                    return;
                }
                const payload = (await response.json()) as { allowed?: boolean };
                if (!cancelled) {
                    setAllowed(Boolean(payload.allowed));
                }
            } catch {
                if (!cancelled) {
                    setAllowed(false);
                }
            }
        };

        void check();
        return () => {
            cancelled = true;
        };
    }, [permission, user?.email]);

    return allowed;
};

export const useCanManageListings = (): boolean => {
    const canCreate = useHasPermission('listing:create');
    const canManage = useHasPermission('listing:manage');
    const canAuctionCreate = useHasPermission('auction:create');
    return canCreate || canManage || canAuctionCreate;
};
