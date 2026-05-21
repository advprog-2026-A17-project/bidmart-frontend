import { fetchPublicSellerProfile, type PublicSellerProfile } from './auth-api';

export type PublicUserProfile = PublicSellerProfile;

export const fetchPublicUserProfiles = async (
    userIds: string[],
): Promise<Record<string, PublicUserProfile>> => {
    const uniqueIds = [...new Set(userIds.filter((id) => id.trim().length > 0))];
    if (uniqueIds.length === 0) {
        return {};
    }

    const entries = await Promise.all(
        uniqueIds.map(async (userId) => {
            const profile = await fetchPublicSellerProfile(userId);
            return profile ? ([userId, profile] as const) : null;
        }),
    );

    return Object.fromEntries(
        entries.filter((entry): entry is readonly [string, PublicUserProfile] => entry !== null),
    );
};
