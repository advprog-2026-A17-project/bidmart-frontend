import { apiUrl } from '../../../config/api';

type ProfilePayload = {
    displayName?: string | null;
    shippingAddress?: string | null;
};

const isBlank = (value?: string | null): boolean => !value || value.trim() === '';

export const resolvePostLoginPath = async (accessToken: string): Promise<string> => {
    try {
        const response = await fetch(apiUrl('/api/v1/auth/profile'), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            return '/profile';
        }
        const payload = await response.json() as ProfilePayload;
        const isComplete = !isBlank(payload.displayName) && !isBlank(payload.shippingAddress);
        return isComplete ? '/' : '/profile';
    } catch {
        return '/profile';
    }
};
