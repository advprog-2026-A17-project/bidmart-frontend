import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../config/api';
import { CATALOGUE_LISTINGS_SEARCH_PATH, CATALOGUE_CATEGORIES_TREE_PATH } from '../catalogue/api/endpoints';
import { NO_IMAGE_PLACEHOLDER } from '../catalogue/utils/no-image';
import { flattenCategoryTree, type CategoryNode, type CategoryOption } from '../catalogue/utils/categories';

export interface HomeListing {
    id: number | string;
    title: string;
    description: string;
    startingPrice: number;
    currentPrice: number;
    imageUrl: string | null;
    category?: string;
    status: string;
    endTime: string;
    hasBids: boolean;
}

const EMBEDDED_IMAGE_PLACEHOLDER = 'embedded://listing-image';
const PUBLIC_STATUSES = new Set(['ACTIVE', 'EXTENDED', 'AVAILABLE']);

const listingImageFallbacks = [
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
];

const parseListings = (payload: unknown): HomeListing[] => {
    if (Array.isArray(payload)) return payload as HomeListing[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as { content?: unknown }).content)) {
        return (payload as { content: HomeListing[] }).content;
    }
    return [];
};

const listingEndMs = (listing: HomeListing): number => {
    const parsed = new Date(listing.endTime).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

export const resolveHomeListingImage = (listing: HomeListing, index = 0): string => {
    const url = listing.imageUrl?.trim();
    if (url && url !== EMBEDDED_IMAGE_PLACEHOLDER) return url;
    return listingImageFallbacks[index % listingImageFallbacks.length] ?? NO_IMAGE_PLACEHOLDER;
};

export const formatTimeLeft = (endTime: string, nowMs: number): string => {
    const parsed = new Date(endTime).getTime();
    if (!Number.isFinite(parsed)) return 'Live now';
    const diff = parsed - nowMs;
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${Math.max(minutes, 1)}m left`;
};

export function useHomeListings() {
    const [listings, setListings] = useState<HomeListing[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hydrateEmbeddedImages = useCallback(async (items: HomeListing[]) => {
        return Promise.all(items.map(async (item, index) => {
            if (item.imageUrl?.trim() !== EMBEDDED_IMAGE_PLACEHOLDER) {
                return item;
            }
            try {
                const response = await fetch(apiUrl(`/api/v1/catalogue/listings/${encodeURIComponent(String(item.id))}`));
                if (!response.ok) return { ...item, imageUrl: resolveHomeListingImage(item, index) };
                const detail = await response.json() as Partial<HomeListing>;
                return { ...item, imageUrl: detail.imageUrl ?? resolveHomeListingImage(item, index) };
            } catch {
                return { ...item, imageUrl: resolveHomeListingImage(item, index) };
            }
        }));
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(apiUrl(`${CATALOGUE_LISTINGS_SEARCH_PATH}?status=ACTIVE`));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                const parsed = (await hydrateEmbeddedImages(parseListings(payload)))
                    .filter((listing) => PUBLIC_STATUSES.has((listing.status ?? '').toUpperCase()))
                    .sort((left, right) => listingEndMs(left) - listingEndMs(right));
                if (!cancelled) {
                    setListings(parsed);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Could not load listings');
                    setListings([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        const loadCategories = async () => {
            try {
                const response = await fetch(apiUrl(CATALOGUE_CATEGORIES_TREE_PATH));
                if (!response.ok) return;
                const payload = await response.json() as CategoryNode[];
                if (!cancelled) setCategories(flattenCategoryTree(payload).slice(0, 8));
            } catch {
                if (!cancelled) setCategories([]);
            }
        };

        void load();
        void loadCategories();
        return () => {
            cancelled = true;
        };
    }, [hydrateEmbeddedImages]);

    const liveListings = useMemo(() => listings.filter((listing) => listingEndMs(listing) > Date.now()), [listings]);
    const endingSoon = useMemo(() => [...liveListings].sort((left, right) => listingEndMs(left) - listingEndMs(right)).slice(0, 4), [liveListings]);

    return {
        listings,
        liveListings,
        endingSoon,
        categories,
        loading,
        error,
    };
}
