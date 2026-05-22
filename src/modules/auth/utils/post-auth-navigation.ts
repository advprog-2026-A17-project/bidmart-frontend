import { apiUrl } from '../../../config/api';

type OnboardingPayload = {
    profileCompleted?: boolean;
    needsPassword?: boolean;
    needsRole?: boolean;
};

export const resolvePostLoginPath = async (accessToken: string): Promise<string> => {
    try {
        const response = await fetch(apiUrl('/api/v1/auth/onboarding'), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            return '/onboarding';
        }
        const payload = await response.json() as OnboardingPayload;
        const needsOnboarding = payload.profileCompleted === false
            || payload.needsPassword === true
            || payload.needsRole === true;
        return needsOnboarding ? '/onboarding' : '/';
    } catch {
        return '/onboarding';
    }
};
