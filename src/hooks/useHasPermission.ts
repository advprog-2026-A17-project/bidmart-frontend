import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../config/api';
import { useAuth } from '../context/useAuth';

export const useHasPermission = (permission: string): boolean => {
    const { user, authenticatedFetch } = useAuth();
    const [allowed, setAllowed] = useState(false);
    const userEmail = user?.email;
    const canCheckPermission = Boolean(userEmail && permission);

    const requestUrl = useMemo(() => {
        if (!userEmail || !permission) {
            return null;
        }
        const params = new URLSearchParams({
            email: userEmail,
            permission,
        });
        return apiUrl(`/api/v1/auth/permissions/check?${params.toString()}`);
    }, [permission, userEmail]);

    useEffect(() => {
        if (!requestUrl) {
            return;
        }

        let cancelled = false;
        const check = async () => {
            try {
                const response = await authenticatedFetch(requestUrl);
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
    }, [authenticatedFetch, requestUrl]);

    return canCheckPermission && allowed;
};

export const useCanManageListings = (): boolean => {
    const canCreate = useHasPermission('listing:create');
    const canManage = useHasPermission('listing:manage');
    const canAuctionCreate = useHasPermission('auction:create');
    return canCreate || canManage || canAuctionCreate;
};
