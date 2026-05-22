import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { gatewayUrl, readApiError, readApiJson } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useCanManageListings } from '../../../hooks/useHasPermission';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { formatMoney, normalizeRupiahInput, toRupiahAmount } from '../../../utils/money';
import { useAuctionRealtime } from '../../auction/hooks/useAuctionRealtime';
import { buildAuctionCardMeta, type Auction } from '../../auction/utils/auction-card-meta';
import { useNowTick } from '../../../hooks/useNowTick';
import { catalogueListingToAuction, type CatalogueListing } from '../utils/listing-to-auction';
import { NO_IMAGE_PLACEHOLDER } from '../utils/no-image';
import { CATALOGUE_CATEGORIES_TREE_PATH } from '../api/endpoints';
import { flattenCategoryTree, type CategoryNode, type CategoryOption } from '../utils/categories';
import PageToast from '../../../components/PageToast';

type StudioView = 'dashboard' | 'listing-create' | 'listing-manage';

type ListingRecord = {
    id: string;
    title: string;
    description: string;
    category?: string | null;
    condition?: string | null;
    sellerId: string;
    startingPrice?: number | null;
    reservePrice?: number | null;
    currentPrice?: number | null;
    minimumIncrement?: number | null;
    imageUrl?: string | null;
    status?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    hasBids?: boolean;
};

type ListingFormState = {
    title: string;
    description: string;
    category: string;
    condition: string;
    startingBid: string;
    reservePrice: string;
    minimumIncrement: string;
    endTime: string;
    imageUrl: string;
    images: string[];
};

type ListingFormErrors = Partial<Record<keyof ListingFormState, string>>;

type StudioNavItem = {
    id: StudioView;
    label: string;
    icon: string;
};

type StudioNavGroup = {
    title: string;
    items: StudioNavItem[];
};

const CATEGORIES = [
    'Electronics',
    'Elektronik',
    'Fashion',
    'Furniture',
    'Collectibles',
    'Sports',
    'Art & Antiques',
    'Home & Garden',
    'Toys & Games',
    'Vehicles',
    'Other',
];

const CONDITIONS = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'used', label: 'Used' },
];

const MAX_IMAGE_BYTES = 600 * 1024;
const CLOSED_STATUSES = new Set(['CLOSED', 'WON', 'UNSOLD']);
const PUBLISHED_STATUSES = new Set(['ACTIVE', 'EXTENDED']);
const FINAL_AUCTION_STATUSES = new Set<string>(['ENDED', 'WON', 'UNSOLD', 'CLOSED', 'CANCELLED']);

const bidLabel = (meta: ReturnType<typeof buildAuctionCardMeta>): string =>
    meta.hasBids ? formatMoney(meta.currentHighest) : 'No bids';

const toDateTimeLocalValue = (date: Date): string => {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

/** Convert datetime-local input (local wall time) to UTC ISO for the catalogue API. */
const toAuctionEndTimeIso = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const localWall = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const parsed = new Date(localWall);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const toListingAmount = (value: string): number => toRupiahAmount(value);
const fromListingAmount = (value?: number | null): string => normalizeRupiahInput(value);
const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';

const emptyListingForm: ListingFormState = {
    title: '',
    description: '',
    category: '',
    condition: '',
    startingBid: '',
    reservePrice: '',
    minimumIncrement: '1',
    endTime: toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    imageUrl: '',
    images: [],
};
const normalizeCondition = (condition?: string | null): string => {
    const normalized = (condition ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ');
    const compact = normalized.replace(/\s+/g, '');
    return CONDITIONS.find((option) => (
        option.value === compact ||
        option.label.toLowerCase().replace(/\s+/g, '') === compact
    ))?.value ?? '';
};
const isValidImageReference = (imageUrl: string): boolean => {
    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) return true;
    if (/^data:image\/(png|jpe?g|webp);base64,/i.test(trimmedUrl)) return true;
    try {
        const parsed = new URL(trimmedUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};
const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read image file.'));
        reader.readAsDataURL(file);
    });

const parseListingsResponse = (payload: unknown): ListingRecord[] => {
    if (Array.isArray(payload)) return payload as ListingRecord[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as { content?: unknown }).content)) {
        return (payload as { content: ListingRecord[] }).content;
    }
    return [];
};

const asIsoDate = (input?: string | null): string | null => {
    if (!input) return null;
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const delay = (durationMs: number): Promise<void> =>
    new Promise((resolve) => window.setTimeout(resolve, durationMs));

const isPublishedListing = (listing: ListingRecord): boolean =>
    PUBLISHED_STATUSES.has((listing.status ?? '').toUpperCase());

const SELLER_STUDIO_VIEW_STORAGE_KEY = 'seller_studio_active_view';

const isStudioView = (value: string | null): value is StudioView =>
    value === 'dashboard' || value === 'listing-create' || value === 'listing-manage';

const SellPage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const canManageListings = useCanManageListings();
    const isSeller = canManageListings || (user?.roles?.some((role) => role.name === 'SELLER') ?? false);
    const roleSummary = user?.roles?.map((role) => role.name).join(', ') ?? 'No active role';
    const [activeView, setActiveView] = useState<StudioView>(() => {
        try {
            const saved = window.localStorage.getItem(SELLER_STUDIO_VIEW_STORAGE_KEY);
            return isStudioView(saved) ? saved : 'dashboard';
        } catch {
            return 'dashboard';
        }
    });
    const [listingForm, setListingForm] = useState<ListingFormState>(emptyListingForm);

    const [listings, setListings] = useState<ListingRecord[]>([]);
    const [sellerAuctions, setSellerAuctions] = useState<Auction[]>([]);
    const [editingListingId, setEditingListingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [listingFormErrors, setListingFormErrors] = useState<ListingFormErrors>({});
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
    const [editingListingStatus, setEditingListingStatus] = useState<string | null>(null);
    const nowMs = useNowTick();

    const fetchSellerListings = useCallback(async (): Promise<ListingRecord[]> => {
        if (!user || !isSeller) {
            setListings([]);
            setLoading(false);
            return [];
        }

        try {
            setLoading(true);
            const response = await authenticatedFetch(gatewayUrl('/api/v1/catalogue/listings/seller'));
            if (!response.ok) {
                throw new Error(`Listing lookup failed with status ${response.status}`);
            }
            const payload: unknown = await response.json();
            const parsed = parseListingsResponse(payload);
            setListings(parsed);
            return parsed;
        } catch (err: unknown) {
            setError(toErrorMessage(err));
            setListings([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch, isSeller, user]);

    const fetchSellerAuctions = useCallback(async (sourceListings: ListingRecord[]) => {
        if (!user || !isSeller) {
            setSellerAuctions([]);
            setAnalyticsLoading(false);
            return;
        }

        try {
            setAnalyticsLoading(true);
            setAnalyticsError(null);
            setSellerAuctions(
                sourceListings
                    .filter((listing) => String(listing.sellerId) === user.id)
                    .map((listing) => catalogueListingToAuction(listing as unknown as CatalogueListing))
            );
        } catch (err: unknown) {
            setAnalyticsError(toErrorMessage(err));
            setSellerAuctions([]);
        } finally {
            setAnalyticsLoading(false);
        }
    }, [isSeller, user]);

    const refreshStudio = useCallback(async () => {
        const refreshedListings = await fetchSellerListings();
        await fetchSellerAuctions(refreshedListings);
    }, [fetchSellerAuctions, fetchSellerListings]);

    useEffect(() => {
        refreshStudio();
    }, [refreshStudio]);

    useEffect(() => {
        let cancelled = false;
        const fetchCategories = async () => {
            try {
                const response = await fetch(gatewayUrl(CATALOGUE_CATEGORIES_TREE_PATH));
                if (!response.ok) return;
                const payload = await response.json() as CategoryNode[];
                if (!cancelled) {
                    setCategoryOptions(flattenCategoryTree(payload));
                }
            } catch {
                if (!cancelled) {
                    setCategoryOptions([]);
                }
            }
        };
        void fetchCategories();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(SELLER_STUDIO_VIEW_STORAGE_KEY, activeView);
        } catch {
            // Ignore storage failures and keep view in-memory.
        }
    }, [activeView]);

    const realtimeDestinations = useMemo(
        () => (user?.id ? [`/topic/sellers/${user.id}/auctions`] : []),
        [user?.id]
    );
    const handleRealtimeEvent = useCallback(() => {
        void refreshStudio();
    }, [refreshStudio]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    useEffect(() => {
        void fetchSellerAuctions(listings);
    }, [fetchSellerAuctions, listings]);

    const existingListingIds = useMemo(
        () => new Set(listings.map((listing) => String(listing.id))),
        [listings]
    );
    const visibleSellerAuctions = useMemo(
        () => sellerAuctions.filter((auction) => existingListingIds.has(String(auction.listingId))),
        [existingListingIds, sellerAuctions]
    );
    const activeSellerAuctions = useMemo(
        () => visibleSellerAuctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)),
        [visibleSellerAuctions]
    );
    const topSellerAuction = useMemo(
        () => [...visibleSellerAuctions].sort((a, b) => {
            const aBid = a.currentHighestBid ?? 0;
            const bBid = b.currentHighestBid ?? 0;
            return bBid - aBid;
        })[0],
        [visibleSellerAuctions]
    );
    const totalTopBidValue = useMemo(
        () => activeSellerAuctions.reduce((sum, auction) => sum + (auction.currentHighestBid ?? 0), 0),
        [activeSellerAuctions]
    );
    const reserveMetCount = useMemo(
        () => activeSellerAuctions.filter((auction) => (auction.currentHighestBid ?? 0) >= auction.reservePrice).length,
        [activeSellerAuctions]
    );
    const listingTitleById = useCallback(
        (listingId: string) => listings.find((listing) => String(listing.id) === listingId)?.title || 'Auction Listing',
        [listings]
    );

    const handleImageUpload = async (files: FileList | null) => {
        if (!files?.length) return;
        setError(null);
        try {
            const selectedFiles = Array.from(files).slice(0, 3);
            const images = await Promise.all(
                selectedFiles.map((file) => {
                    if (!file.type.startsWith('image/')) {
                        throw new Error('Please upload image files only.');
                    }
                    if (file.size > MAX_IMAGE_BYTES) {
                        throw new Error('Each image must be 600KB or smaller for this demo.');
                    }
                    return readImageFile(file);
                })
            );
            setListingForm((previous) => ({ ...previous, images, imageUrl: images[0] ?? previous.imageUrl }));
            setListingFormErrors((previous) => {
                if (!previous.imageUrl) return previous;
                const next = { ...previous };
                delete next.imageUrl;
                return next;
            });
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const rollbackPublishedListing = async (listingId: string) => {
        try {
            await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/cancel`), {
                method: 'POST',
            });
        } catch {
            try {
                await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}`), { method: 'DELETE' });
            } catch { /* best-effort cleanup */ }
        }
    };

    const ensureBiddingSessionForListing = async (listing: ListingRecord) => {
        const response = await authenticatedFetch(gatewayUrl('/api/v1/listings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listingId: String(listing.id),
                sellerId: listing.sellerId ?? user?.id,
                auctionType: 'ENGLISH',
                startingPrice: listing.startingPrice,
                reservePrice: listing.reservePrice ?? listing.startingPrice,
                minimumIncrement: listing.minimumIncrement ?? 1,
                startTime: new Date().toISOString(),
                endTime: asIsoDate(listing.endTime),
            }),
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Bidding session sync failed'));
        }
    };

    const publishCreatedListing = async (listingId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/publish`), {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing publish failed'));
        }

        const publishedListing = await readApiJson<ListingRecord>(response);
        let listing = publishedListing ?? ({ id: listingId } as ListingRecord);
        for (let attempt = 0; attempt < 3 && !isPublishedListing(listing); attempt += 1) {
            await delay(250);
            const listingResponse = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}`));
            if (!listingResponse.ok) {
                throw new Error(await readApiError(listingResponse, 'Published listing fetch failed'));
            }
            listing = await listingResponse.json() as ListingRecord;
        }
        if (!isPublishedListing(listing)) {
            throw new Error('Listing publish did not activate the listing.');
        }

        try {
            try {
                await ensureBiddingSessionForListing(listing);
            } catch (err: unknown) {
                if (!toErrorMessage(err).toLowerCase().includes('listing is not active')) {
                    throw err;
                }

                await delay(500);
                const retryResponse = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}`));
                if (!retryResponse.ok) {
                    throw new Error(await readApiError(retryResponse, 'Published listing fetch failed'));
                }
                const retryListing = await retryResponse.json() as ListingRecord;
                if (!isPublishedListing(retryListing)) {
                    throw err;
                }
                await ensureBiddingSessionForListing(retryListing);
            }
        } catch (err: unknown) {
            await rollbackPublishedListing(listingId);
            throw err;
        }
    };

    const resetListingForm = () => {
        setEditingListingId(null);
        setEditingListingStatus(null);
        setListingForm(emptyListingForm);
        setListingFormErrors({});
    };

    const updateListingField = <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => {
        setListingForm((previous) => ({ ...previous, [field]: value }));
        setListingFormErrors((previous) => {
            if (!previous[field as keyof ListingFormErrors]) return previous;
            const next = { ...previous };
            delete next[field as keyof ListingFormErrors];
            return next;
        });
    };

    const createListingPayload = (form: ListingFormState) => {
        const options = categoryOptions.length > 0
            ? categoryOptions
            : CATEGORIES.map((category, index) => ({ id: index, name: category, label: category }));
        const selectedCategory = options.find(
            (option) => option.name === form.category || String(option.id) === form.category
        );
        return {
            title: form.title.trim(),
            description: form.description.trim(),
            category: selectedCategory?.name ?? form.category,
            ...(selectedCategory ? { categoryEntity: { id: selectedCategory.id } } : {}),
            condition: form.condition,
            status: 'DRAFT',
            sellerId: user?.id,
            startingPrice: toListingAmount(form.startingBid),
            reservePrice: toListingAmount(form.reservePrice || form.startingBid),
            minimumIncrement: toListingAmount(form.minimumIncrement || '1'),
            endTime: toAuctionEndTimeIso(form.endTime),
            imageUrl: form.imageUrl.trim() || form.images[0] || null,
        };
    };

    const createPublishedListingUpdatePayload = (form: ListingFormState) => ({
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim() || form.images[0] || null,
    });

    const validatePublishedListingEdit = (): ListingFormErrors => {
        const errors: ListingFormErrors = {};
        if (!listingForm.description.trim()) {
            errors.description = 'Description is required.';
        }
        if (!isValidImageReference(listingForm.imageUrl)) {
            errors.imageUrl = 'Use a valid http(s) image URL or upload an image file.';
        }
        return errors;
    };

    const validateListingForm = (): ListingFormErrors => {
        const errors: ListingFormErrors = {};
        const startingBid = Number(listingForm.startingBid);
        const reservePrice = Number(listingForm.reservePrice);
        const minimumIncrement = Number(listingForm.minimumIncrement);

        if (!listingForm.title.trim()) {
            errors.title = 'Title is required.';
        }
        if (!listingForm.description.trim()) {
            errors.description = 'Description is required.';
        }
        if (!listingForm.category) {
            errors.category = 'Choose a category.';
        }
        if (!listingForm.condition) {
            errors.condition = 'Select the item condition.';
        }
        if (!listingForm.startingBid.trim()) {
            errors.startingBid = 'Starting price is required.';
        } else if (!Number.isFinite(startingBid) || startingBid <= 0) {
            errors.startingBid = 'Starting price must be greater than 0.';
        }

        if (listingForm.reservePrice.trim()) {
            if (!Number.isFinite(reservePrice) || reservePrice < startingBid) {
                errors.reservePrice = 'Reserve price must be greater than or equal to starting price.';
            }
        }

        if (!listingForm.minimumIncrement.trim()) {
            errors.minimumIncrement = 'Minimum increment is required.';
        } else if (!Number.isFinite(minimumIncrement) || minimumIncrement <= 0) {
            errors.minimumIncrement = 'Minimum increment must be greater than 0.';
        }

        const now = new Date();
        now.setSeconds(0, 0);
        if (!listingForm.endTime) {
            errors.endTime = 'End time is required.';
        } else if (new Date(listingForm.endTime) <= now) {
            errors.endTime = 'End time must be in the future.';
        }

        if (!isValidImageReference(listingForm.imageUrl)) {
            errors.imageUrl = 'Use a valid http(s) image URL or upload an image file.';
        }

        return errors;
    };

    const saveListing = async (publishImmediate = false) => {
        if (submitting) return;
        if (!user || !isSeller) {
            setError('Listing permissions are required to publish. Sign in with an account that can manage listings.');
            return;
        }

        const isPublishedEdit = Boolean(editingListingId)
            && (editingListingStatus === 'ACTIVE' || editingListingStatus === 'EXTENDED');
        const validationErrors = isPublishedEdit
            ? validatePublishedListingEdit()
            : validateListingForm();
        if (Object.keys(validationErrors).length > 0) {
            setListingFormErrors(validationErrors);
            setError('Resolve the highlighted listing fields before saving.');
            setNotice(null);
            return;
        }

        setListingFormErrors({});
        setError(null);
        setNotice(null);
        setSubmitting(true);

        try {
            const isEditing = Boolean(editingListingId);
            const requestBody = isEditing && isPublishedEdit
                ? createPublishedListingUpdatePayload(listingForm)
                : createListingPayload(listingForm);
            const response = await authenticatedFetch(
                gatewayUrl(isEditing ? `/api/v1/catalogue/listings/${editingListingId}` : '/api/v1/catalogue/listings'),
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                }
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing save failed'));
            }

            const saved = await response.json() as ListingRecord;
            const listingId = String(saved.id);

            if (publishImmediate) {
                try {
                    await publishCreatedListing(listingId);
                } catch (publishErr: unknown) {
                    await rollbackPublishedListing(listingId);
                    throw publishErr;
                }
            }

            setNotice(
                publishImmediate
                    ? 'Listing published.'
                    : editingListingStatus === 'ACTIVE' || editingListingStatus === 'EXTENDED'
                        ? 'Listing description and images updated.'
                    : isEditing
                        ? 'Listing draft updated.'
                        : 'Listing draft created.'
            );
            resetListingForm();
            await fetchSellerListings();
            setActiveView('listing-manage');
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const editListing = (listing: ListingRecord) => {
        setEditingListingId(String(listing.id));
        setEditingListingStatus((listing.status ?? '').toUpperCase());
        const condition = normalizeCondition(listing.condition);
        setListingForm({
            title: listing.title ?? '',
            description: listing.description ?? '',
            category: listing.category ?? '',
            condition,
            startingBid: fromListingAmount(listing.startingPrice),
            reservePrice: fromListingAmount(listing.reservePrice || listing.startingPrice),
            minimumIncrement: fromListingAmount(listing.minimumIncrement || 1),
            endTime: listing.endTime ? toDateTimeLocalValue(new Date(listing.endTime)) : toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            imageUrl: listing.imageUrl ?? '',
            images: listing.imageUrl ? [listing.imageUrl] : [],
        });
        setListingFormErrors(condition ? {} : { condition: 'Select the item condition before updating this listing.' });
        setActiveView('listing-create');
    };

    const deleteListing = async (listingId: string | number) => {
        setError(null);
        setNotice(null);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}`), {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing delete failed'));
            }
            setNotice('Listing deleted.');
            await refreshStudio();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const cancelListing = async (listingId: string | number) => {
        setError(null);
        setNotice(null);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/cancel`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing cancel failed'));
            }
            setNotice('Listing cancelled.');
            await refreshStudio();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const deactivateListing = async (listingId: string | number) => {
        setError(null);
        setNotice(null);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/deactivate`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing deactivate failed'));
            }
            setNotice('Listing deactivated.');
            await refreshStudio();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const publishDraftListing = async (listing: ListingRecord) => {
        const listingId = String(listing.id);
        const startingPrice = listing.startingPrice ?? 0;
        const reservePrice = listing.reservePrice ?? listing.startingPrice ?? 0;
        if (startingPrice <= 0) {
            setError('Starting price must be greater than 0 before publishing.');
            setNotice(null);
            return;
        }
        if (reservePrice < startingPrice) {
            setError('Reserve price must be greater than or equal to starting price before publishing.');
            setNotice(null);
            return;
        }
        if (!listing.endTime) {
            setError('Auction end time is required before publishing.');
            setNotice(null);
            return;
        }
        if (new Date(listing.endTime) <= new Date()) {
            setError('Auction end time has already passed. Edit the listing to update it before publishing.');
            setNotice(null);
            return;
        }

        setError(null);
        setNotice(null);
        try {
            await publishCreatedListing(listingId);
            setNotice('Listing published.');
            await refreshStudio();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    if (!user || !isSeller) {
        const isSignedOut = !user;
        return (
            <div className="page-wrap">
                <section className="page-head">
                    <h1>{isSignedOut ? 'Seller Studio' : 'Listing access required'}</h1>
                    <p>{isSignedOut ? 'Sign in to manage listings and publish auctions on BidMart.' : 'Your account does not include listing permissions yet.'}</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">{isSignedOut ? 'Public Preview' : 'Marketplace Account'}</span>
                    <h2>{isSignedOut ? 'Sign in to continue' : 'Seller Studio is restricted'}</h2>
                    <p className="text-muted">
                        {isSignedOut
                            ? 'Seller Studio lets you create listings, attach product photos, configure auction rules, and publish to the marketplace.'
                            : 'Complete onboarding with seller permissions or contact support if you need to publish items.'}
                    </p>
                    {user && <p className="access-role-summary">Current role: {roleSummary}</p>}
                    <div className="access-actions">
                        <Link className="primary-button" to={isSignedOut ? '/login' : '/'}>
                            {isSignedOut ? 'Sign In or Register' : 'Back to Explore'}
                        </Link>
                        <Link className="secondary-button" to="/wallet">
                            {isSignedOut ? 'View Wallet Preview' : 'Go to Wallet'}
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

    const navGroups: StudioNavGroup[] = [
        {
            title: 'Dashboard',
            items: [{ id: 'dashboard' as const, label: 'Dashboard Analytics', icon: 'monitoring' }],
        },
        {
            title: 'Inventory',
            items: [
                { id: 'listing-create' as const, label: 'Create Listing', icon: 'add_box' },
                { id: 'listing-manage' as const, label: 'Manage Listings', icon: 'inventory_2' },
            ],
        },
    ];
    const displayCategoryOptions = categoryOptions.length > 0
        ? categoryOptions
        : CATEGORIES.map((category, index) => ({ id: index, name: category, label: category }));
    const isEditingPublishedListing = editingListingStatus === 'ACTIVE' || editingListingStatus === 'EXTENDED';

    return (
        <div className="seller-studio-shell">
            <aside className="seller-studio-sidebar" aria-label="Seller Studio navigation">
                <div className="seller-studio-sidebar-head">
                    <span className="material-symbols-outlined sidebar-header-icon" aria-hidden="true">storefront</span>
                    <div>
                        <strong>Seller Studio</strong>
                        <span>Listings and auctions</span>
                    </div>
                </div>

                {navGroups.map((group) => (
                    <div key={group.title} className="seller-studio-nav-group">
                        <span>{group.title}</span>
                        {group.items.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`seller-studio-nav-item ${activeView === item.id ? 'seller-studio-nav-item-active' : ''}`}
                                onClick={() => setActiveView(item.id)}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </aside>

            <main className="seller-studio-content">
                <section className="page-head studio-head">
                    <div>
                        <BackButton fallback="/" />
                        <p className="eyebrow">Seller Studio</p>
                        <h1>{navGroups.flatMap((group) => group.items).find((item) => item.id === activeView)?.label}</h1>
                        <p>Manage listing-auctions in a single workflow aligned with the platform specification.</p>
                    </div>
                    <button type="button" className="secondary-button" disabled={loading || analyticsLoading} onClick={() => void refreshStudio()}>
                        <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                        Refresh
                    </button>
                    <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                        {isConnected ? 'Live updates' : 'Realtime offline'}
                    </span>
                </section>

                <PageToast
                    error={error ?? (activeView === 'dashboard' ? analyticsError : null)}
                    success={notice}
                />

                {activeView === 'dashboard' && (
                    <>
                        <section className="seller-studio-overview" aria-label="Seller Studio overview">
                            <div className="studio-kpi-card">
                                <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                                <div>
                                    <strong>{loading ? '--' : listings.length}</strong>
                                    <small>Current listings</small>
                                </div>
                            </div>
                            <div className="studio-kpi-card">
                                <span className="material-symbols-outlined" aria-hidden="true">sensors</span>
                                <div>
                                    <strong>{analyticsLoading ? '--' : activeSellerAuctions.length}</strong>
                                    <small>Active auctions</small>
                                </div>
                            </div>
                            <div className="studio-kpi-card">
                                <span className="material-symbols-outlined" aria-hidden="true">leaderboard</span>
                                <div>
                                    <strong>{analyticsLoading ? '--' : formatMoney(totalTopBidValue)}</strong>
                                    <small>Current top-bid value</small>
                                </div>
                            </div>
                            <div className="studio-kpi-card">
                                <span className="material-symbols-outlined" aria-hidden="true">price_change</span>
                                <div>
                                    <strong>{analyticsLoading ? '--' : `${reserveMetCount}/${activeSellerAuctions.length}`}</strong>
                                    <small>Reserve met</small>
                                </div>
                            </div>
                        </section>

                        <section className="panel seller-analytics-panel" aria-label="Auction analytics">
                            <div className="section-title-row">
                                <div>
                                    <p className="eyebrow">Auction Analytics</p>
                                    <h2>Performance Snapshot</h2>
                                </div>
                            </div>

                            {analyticsLoading ? (
                                <div className="analytics-table skeleton-grid" aria-busy="true" aria-label="Loading auction analytics">
                                    <span className="skeleton-line" />
                                    <span className="skeleton-line" />
                                    <span className="skeleton-line skeleton-line-medium" />
                                </div>
                            ) : visibleSellerAuctions.length > 0 ? (
                                <div className="analytics-table">
                                    <div className="analytics-row analytics-row-head">
                                        <span>Lot</span>
                                        <span>Top Bid</span>
                                        <span>Next Bid</span>
                                        <span>Status</span>
                                        <span>Ends</span>
                                    </div>
                                    {visibleSellerAuctions.map((auction) => {
                                        const meta = buildAuctionCardMeta(auction, nowMs);
                                        return (
                                            <Link key={auction.id} className="analytics-row" to={`/listings/${auction.id}`}>
                                                <span>{listingTitleById(auction.listingId)}</span>
                                                <strong>{bidLabel(meta)}</strong>
                                                <span>{formatMoney(meta.minNextBid)}</span>
                                                <span>{meta.statusLabel}</span>
                                                <span>{meta.timeLeftLabel}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state compact-empty">
                                    <strong>No seller auctions yet.</strong>
                                    <span className="text-muted">Create a listing, configure auction rules, and publish from one place.</span>
                                </div>
                            )}

                            {topSellerAuction && (
                                <div className="top-auction-callout">
                                    <span className="metric-label">Best performing auction</span>
                                    <strong>{listingTitleById(topSellerAuction.listingId)}</strong>
                                    <span>{bidLabel(buildAuctionCardMeta(topSellerAuction, nowMs))} top bid</span>
                                </div>
                            )}
                        </section>
                    </>
                )}

                {activeView === 'listing-create' && (
                    <section className="seller-studio-grid">
                        <div className="panel seller-form-panel section-stack">
                            <div className="section-title-row">
                                <div>
                                    <p className="eyebrow">{editingListingId ? 'Edit Listing' : 'Create Listing'}</p>
                                    <h2>{editingListingId ? 'Update Product Record' : 'Product Details'}</h2>
                                </div>
                                {editingListingId && (
                                    <button type="button" className="secondary-button" onClick={resetListingForm}>
                                        Clear Edit
                                    </button>
                                )}
                            </div>
                            <label className="field">
                                Title
                                <input
                                    className={`form-input ${listingFormErrors.title ? 'form-input-error' : ''}`}
                                    value={listingForm.title}
                                    disabled={isEditingPublishedListing}
                                    onChange={(event) => updateListingField('title', event.target.value)}
                                    placeholder="Be specific and descriptive"
                                    aria-invalid={Boolean(listingFormErrors.title)}
                                    aria-describedby={listingFormErrors.title ? 'listing-title-error' : undefined}
                                />
                                {listingFormErrors.title && <span id="listing-title-error" className="field-error">{listingFormErrors.title}</span>}
                            </label>
                            <label className="field">
                                Description
                                <textarea
                                    className={`form-input form-textarea ${listingFormErrors.description ? 'form-input-error' : ''}`}
                                    value={listingForm.description}
                                    onChange={(event) => updateListingField('description', event.target.value)}
                                    placeholder="Include condition, features, provenance, defects, and handling notes"
                                    aria-invalid={Boolean(listingFormErrors.description)}
                                    aria-describedby={listingFormErrors.description ? 'listing-description-error' : undefined}
                                />
                                {listingFormErrors.description && <span id="listing-description-error" className="field-error">{listingFormErrors.description}</span>}
                            </label>
                            <div className="seller-form-two-col">
                                <label className="field">
                                    Category
                                    <select
                                        className={`form-input ${listingFormErrors.category ? 'form-input-error' : ''}`}
                                        value={listingForm.category}
                                        disabled={isEditingPublishedListing}
                                        onChange={(event) => updateListingField('category', event.target.value)}
                                        aria-invalid={Boolean(listingFormErrors.category)}
                                        aria-describedby={listingFormErrors.category ? 'listing-category-error' : undefined}
                                    >
                                        <option value="">Select a category</option>
                                        {displayCategoryOptions.map((category) => (
                                            <option key={`${category.id}-${category.label}`} value={category.name}>{category.label}</option>
                                        ))}
                                    </select>
                                    {listingFormErrors.category && <span id="listing-category-error" className="field-error">{listingFormErrors.category}</span>}
                                </label>
                                <label className="field">
                                    Starting Price
                                    <input
                                        className={`form-input ${listingFormErrors.startingBid ? 'form-input-error' : ''}`}
                                        type="number"
                                        min={1}
                                        step="1"
                                        value={listingForm.startingBid}
                                        disabled={isEditingPublishedListing}
                                        onChange={(event) => updateListingField('startingBid', event.target.value)}
                                        onBlur={() => updateListingField('startingBid', normalizeRupiahInput(listingForm.startingBid))}
                                        placeholder="0.00"
                                        aria-invalid={Boolean(listingFormErrors.startingBid)}
                                        aria-describedby={listingFormErrors.startingBid ? 'listing-starting-price-error' : undefined}
                                    />
                                    {listingFormErrors.startingBid && <span id="listing-starting-price-error" className="field-error">{listingFormErrors.startingBid}</span>}
                                </label>
                            </div>
                            <div>
                                <div className="field-label">Condition</div>
                                <div
                                    className={`chip-grid ${listingFormErrors.condition ? 'chip-grid-error' : ''}`}
                                    aria-invalid={Boolean(listingFormErrors.condition)}
                                    aria-describedby={listingFormErrors.condition ? 'listing-condition-error' : undefined}
                                >
                                    {CONDITIONS.map((condition) => (
                                        <button
                                            key={condition.value}
                                            type="button"
                                            className={`chip ${listingForm.condition === condition.value ? 'chip-active' : ''}`}
                                            disabled={isEditingPublishedListing}
                                            onClick={() => updateListingField('condition', condition.value)}
                                        >
                                            {condition.label}
                                        </button>
                                    ))}
                                </div>
                                {listingFormErrors.condition && <span id="listing-condition-error" className="field-error">{listingFormErrors.condition}</span>}
                            </div>
                            <div className="seller-form-two-col">
                                <label className="field">
                                    Reserve Price (IDR)
                                    <input
                                        className={`form-input ${listingFormErrors.reservePrice ? 'form-input-error' : ''}`}
                                        type="number"
                                        min={1}
                                        step="1"
                                        value={listingForm.reservePrice}
                                        disabled={isEditingPublishedListing}
                                        onChange={(event) => updateListingField('reservePrice', event.target.value)}
                                        onBlur={() => updateListingField('reservePrice', normalizeRupiahInput(listingForm.reservePrice))}
                                        placeholder="Minimum price to sell"
                                    />
                                    {listingFormErrors.reservePrice && <span className="field-error">{listingFormErrors.reservePrice}</span>}
                                </label>
                                <label className="field">
                                    Min Increment (IDR)
                                    <input
                                        className={`form-input ${listingFormErrors.minimumIncrement ? 'form-input-error' : ''}`}
                                        type="number"
                                        min={1}
                                        step="1"
                                        value={listingForm.minimumIncrement}
                                        disabled={isEditingPublishedListing}
                                        onChange={(event) => updateListingField('minimumIncrement', event.target.value)}
                                        onBlur={() => updateListingField('minimumIncrement', normalizeRupiahInput(listingForm.minimumIncrement))}
                                    />
                                    {listingFormErrors.minimumIncrement && <span className="field-error">{listingFormErrors.minimumIncrement}</span>}
                                </label>
                            </div>

                            <label className="field">
                                Auction End
                                <input
                                    className={`form-input ${listingFormErrors.endTime ? 'form-input-error' : ''}`}
                                    type="datetime-local"
                                    min={toDateTimeLocalValue(new Date())}
                                    value={listingForm.endTime}
                                    disabled={isEditingPublishedListing}
                                    onChange={(event) => updateListingField('endTime', event.target.value)}
                                />
                                <span className="field-hint">
                                    {isEditingPublishedListing
                                        ? 'Published auction timing is locked. Only description and images can be updated before bids arrive.'
                                        : 'Auction starts automatically at publish time.'}
                                </span>
                                {listingFormErrors.endTime && <span className="field-error">{listingFormErrors.endTime}</span>}
                            </label>

                            <label className="upload-zone">
                                <strong>Upload product images</strong>
                                <span>JPG, PNG, or WebP up to 600KB each. Add up to 3 images.</span>
                                <input
                                    className="file-input"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    multiple
                                    onChange={(event) => handleImageUpload(event.target.files)}
                                />
                            </label>
                            <label className="field">
                                Image URL
                                <input
                                    className={`form-input ${listingFormErrors.imageUrl ? 'form-input-error' : ''}`}
                                    value={listingForm.imageUrl}
                                    onChange={(event) => updateListingField('imageUrl', event.target.value)}
                                    placeholder="Optional external image URL"
                                    aria-invalid={Boolean(listingFormErrors.imageUrl)}
                                    aria-describedby={listingFormErrors.imageUrl ? 'listing-image-url-error' : undefined}
                                />
                                {listingFormErrors.imageUrl && <span id="listing-image-url-error" className="field-error">{listingFormErrors.imageUrl}</span>}
                            </label>
                            <div className="panel-footer">
                                {!isEditingPublishedListing && (
                                    <button type="button" className="secondary-button" disabled={submitting} onClick={() => saveListing(false)}>
                                        {submitting ? 'Saving…' : 'Save Draft'}
                                    </button>
                                )}
                                {!editingListingId && (
                                    <button type="button" className="primary-button" disabled={submitting} onClick={() => saveListing(true)}>
                                        {submitting ? 'Publishing…' : 'Create & Publish Listing'}
                                    </button>
                                )}
                                {editingListingId && !isEditingPublishedListing && (
                                    <button type="button" className="primary-button" disabled={submitting} onClick={() => saveListing(true)}>
                                        {submitting ? 'Publishing…' : 'Update & Publish Listing'}
                                    </button>
                                )}
                                {editingListingId && isEditingPublishedListing && (
                                    <button type="button" className="primary-button" disabled={submitting} onClick={() => saveListing(false)}>
                                        {submitting ? 'Updating…' : 'Update Listing'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <aside className="seller-preview-panel">
                            <div className="section-title-row">
                                <div>
                                    <p className="eyebrow">Preview</p>
                                    <h2>Listing Snapshot</h2>
                                </div>
                                <span className="material-symbols-outlined section-title-icon" aria-hidden="true">inventory_2</span>
                            </div>
                            <div className="seller-preview-image">
                                {listingForm.imageUrl ? (
                                    <img src={listingForm.imageUrl} alt="Listing preview" />
                                ) : (
                                    <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                                )}
                            </div>
                            <div className="seller-preview-copy">
                                <strong>{listingForm.title || 'Untitled asset'}</strong>
                                <span>{listingForm.category || 'Category pending'} - {listingForm.condition || 'Condition pending'}</span>
                            </div>
                            <div className="seller-preview-metrics">
                                <div>
                                    <span>Starting Price</span>
                                    <strong>{formatMoney(toRupiahAmount(listingForm.startingBid))}</strong>
                                </div>
                            </div>
                        </aside>
                    </section>
                )}

                {activeView === 'listing-manage' && (
                    <section className="panel seller-management-panel">
                        <div className="section-title-row">
                            <div>
                                <p className="eyebrow">Listing Management</p>
                                <h2>Manage Your Inventory</h2>
                            </div>
                            <button type="button" className="primary-button" onClick={() => setActiveView('listing-create')}>
                                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                                New Listing
                            </button>
                        </div>
                        {loading ? (
                            <div className="analytics-table skeleton-grid" aria-busy="true" aria-label="Loading listings">
                                <span className="skeleton-line" />
                                <span className="skeleton-line" />
                                <span className="skeleton-line skeleton-line-medium" />
                            </div>
                        ) : listings.length > 0 ? (
                            <div className="management-list">
                                {listings.map((listing) => {
                                    const status = (listing.status ?? 'UNKNOWN').toUpperCase();
                                    const finalized = FINAL_AUCTION_STATUSES.has(status);
                                    const locked = listing.hasBids || finalized;
                                    const canEdit = !listing.hasBids && !finalized;
                                    const canCancel = !listing.hasBids && status !== 'WON' && status !== 'UNSOLD' && status !== 'CLOSED' && status !== 'CANCELLED';
                                    const canDeactivate = !listing.hasBids && status === 'ACTIVE';
                                    const canDelete = !listing.hasBids && status === 'DRAFT';
                                    const canPublishDraft = status === 'DRAFT';
                                    
                                    return (
                                        <article key={listing.id} className="management-card">
                                            <div className="management-card-image">
                                                <img
                                                    src={listing.imageUrl?.trim() || NO_IMAGE_PLACEHOLDER}
                                                    alt={listing.title}
                                                    loading="lazy"
                                                    onError={(event) => {
                                                        event.currentTarget.onerror = null;
                                                        event.currentTarget.src = NO_IMAGE_PLACEHOLDER;
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <span className={`status-badge status-${status}`}>{status}</span>
                                                <h3>{listing.title}</h3>
                                                <p className="text-muted">{listing.description || 'No description provided.'}</p>
                                            </div>
                                            <div className="listing-price-grid compact-price-grid">
                                                <div>
                                                    <span>Starting</span>
                                                    <strong>{formatMoney(listing.startingPrice ?? 0)}</strong>
                                                </div>
                                                <div>
                                                    <span>Current</span>
                                                    <strong>{formatMoney(listing.currentPrice ?? listing.startingPrice ?? 0)}</strong>
                                                </div>
                                                {listing.endTime && (
                                                    <div>
                                                        <span>Ends</span>
                                                        <strong>{new Date(listing.endTime).toLocaleString()}</strong>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="management-actions">
                                                <Link className="secondary-button" to={`/listings/${listing.id}`}>View Room</Link>
                                                <button type="button" className="secondary-button" disabled={!canEdit} onClick={() => editListing(listing)}>
                                                    Edit
                                                </button>
                                                {canPublishDraft && (
                                                    <button type="button" className="primary-button" onClick={() => publishDraftListing(listing)}>
                                                        Publish
                                                    </button>
                                                )}
                                                {canDeactivate && (
                                                    <button type="button" className="secondary-button" onClick={() => deactivateListing(listing.id)}>
                                                        Deactivate
                                                    </button>
                                                )}
                                                {canCancel && (
                                                    <button type="button" className="secondary-button" onClick={() => cancelListing(listing.id)}>
                                                        Cancel
                                                    </button>
                                                )}
                                                <button type="button" className="secondary-button" disabled={!canDelete} onClick={() => deleteListing(listing.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                            {locked && <p className="text-muted">Editing is locked once bids are attached or the auction is finalized.</p>}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state compact-empty">
                                <strong>No listings yet.</strong>
                                <span className="text-muted">Create a listing to start selling.</span>
                            </div>
                        )}
                    </section>
                )}

            </main>
        </div>
    );
};

export default SellPage;
