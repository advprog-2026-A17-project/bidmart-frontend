import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useAuctionRealtime } from '../../auction/hooks/useAuctionRealtime';
import { buildAuctionCardMeta, type Auction } from '../../auction/utils/auction-card-meta';
import { parseAuctionsResponse } from '../../auction/utils/parse-auctions-response';

type StudioView = 'dashboard' | 'listing-create' | 'listing-manage' | 'auction-create' | 'auction-manage';

type ListingRecord = {
    id: string | number;
    title: string;
    description: string;
    category?: string | null;
    condition?: string | null;
    sellerId?: string | null;
    startingPrice?: number | null;
    currentPrice?: number | null;
    imageUrl?: string | null;
    status?: string | null;
    endTime?: string | null;
    hasBids?: boolean;
};

type ListingFormState = {
    title: string;
    description: string;
    category: string;
    condition: string;
    startingBid: string;
    imageUrl: string;
    images: string[];
};

type AuctionFormState = {
    listingId: string;
    startingBid: string;
    reservePrice: string;
    minimumIncrement: string;
    duration: number;
};

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
    'Furniture',
    'Collectibles',
    'Fashion',
    'Sports',
    'Art & Antiques',
    'Home & Garden',
    'Toys & Games',
];

const CONDITIONS = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'used', label: 'Used' },
];

const AUCTION_DURATIONS = [1, 3, 5, 7, 10];
const MAX_IMAGE_BYTES = 600 * 1024;
const CLOSED_STATUSES = new Set(['CLOSED', 'WON', 'UNSOLD', 'CANCELLED']);
const LOCKED_AUCTION_STATUSES = new Set(['ACTIVE', 'EXTENDED', 'ENDED', 'WON', 'UNSOLD', 'CANCELLED']);

const emptyListingForm: ListingFormState = {
    title: '',
    description: '',
    category: '',
    condition: '',
    startingBid: '',
    imageUrl: '',
    images: [],
};

const emptyAuctionForm: AuctionFormState = {
    listingId: '',
    startingBid: '',
    reservePrice: '',
    minimumIncrement: '1',
    duration: 7,
};

const toAmountCents = (value: string): number => Math.round(Number(value || 0) * 100);
const fromAmountCents = (value?: number | null): string => String(((value ?? 0) / 100).toFixed(2));
const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';
const formatMoney = (value: number): string =>
    `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
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

const isListingAuctionReady = (listing: ListingRecord): boolean =>
    (listing.status ?? '').toUpperCase() === 'ACTIVE';

const isAuctionLocked = (auction: Auction): boolean =>
    LOCKED_AUCTION_STATUSES.has(auction.status);

const hasReachedEndTime = (auction: Auction): boolean =>
    new Date(auction.endTime).getTime() <= Date.now();

const SellPage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const isSeller = user?.roles?.some((role) => role.name === 'SELLER') ?? false;
    const roleSummary = user?.roles?.map((role) => role.name).join(', ') ?? 'No active role';
    const [activeView, setActiveView] = useState<StudioView>('dashboard');
    const [listingForm, setListingForm] = useState<ListingFormState>(emptyListingForm);
    const [auctionForm, setAuctionForm] = useState<AuctionFormState>(emptyAuctionForm);
    const [listings, setListings] = useState<ListingRecord[]>([]);
    const [sellerAuctions, setSellerAuctions] = useState<Auction[]>([]);
    const [editingListingId, setEditingListingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [createdListingId, setCreatedListingId] = useState<string | null>(null);
    const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);

    const fetchSellerListings = useCallback(async () => {
        if (!user || !isSeller) {
            setListings([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(gatewayUrl('/api/v1/catalogue/listings'));
            if (!response.ok) {
                throw new Error(`Listing lookup failed with status ${response.status}`);
            }
            const payload: unknown = await response.json();
            setListings(
                parseListingsResponse(payload).filter((listing) => String(listing.sellerId) === user.id)
            );
        } catch (err: unknown) {
            setError(toErrorMessage(err));
            setListings([]);
        } finally {
            setLoading(false);
        }
    }, [isSeller, user]);

    const fetchSellerAuctions = useCallback(async () => {
        if (!user || !isSeller) {
            setSellerAuctions([]);
            setAnalyticsLoading(false);
            return;
        }

        try {
            setAnalyticsLoading(true);
            setAnalyticsError(null);
            const response = await fetch(gatewayUrl('/api/v1/auctions'));
            if (!response.ok) {
                throw new Error(`Auction analytics failed with status ${response.status}`);
            }
            const payload: unknown = await response.json();
            setSellerAuctions(
                parseAuctionsResponse(payload).filter((auction) => auction.sellerId === user.id)
            );
        } catch (err: unknown) {
            setAnalyticsError(toErrorMessage(err));
            setSellerAuctions([]);
        } finally {
            setAnalyticsLoading(false);
        }
    }, [isSeller, user]);

    const refreshStudio = useCallback(async () => {
        await Promise.all([fetchSellerListings(), fetchSellerAuctions()]);
    }, [fetchSellerAuctions, fetchSellerListings]);

    useEffect(() => {
        refreshStudio();
    }, [refreshStudio]);

    const realtimeDestinations = useMemo(
        () => user ? ['/topic/auctions', `/topic/sellers/${user.id}/auctions`] : [],
        [user]
    );
    const handleRealtimeEvent = useCallback(() => {
        void refreshStudio();
    }, [refreshStudio]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    const activeSellerAuctions = useMemo(
        () => sellerAuctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)),
        [sellerAuctions]
    );
    const topSellerAuction = useMemo(
        () => [...sellerAuctions].sort((a, b) => {
            const aBid = a.currentHighestBid ?? a.startingPrice;
            const bBid = b.currentHighestBid ?? b.startingPrice;
            return bBid - aBid;
        })[0],
        [sellerAuctions]
    );
    const totalTopBidValue = useMemo(
        () => activeSellerAuctions.reduce((sum, auction) => sum + (auction.currentHighestBid ?? auction.startingPrice), 0),
        [activeSellerAuctions]
    );
    const reserveMetCount = useMemo(
        () => activeSellerAuctions.filter((auction) => (auction.currentHighestBid ?? 0) >= auction.reservePrice).length,
        [activeSellerAuctions]
    );
    const auctionedListingIds = useMemo(
        () => new Set(sellerAuctions.map((auction) => String(auction.listingId))),
        [sellerAuctions]
    );
    const auctionReadyListings = useMemo(
        () => listings.filter((listing) => isListingAuctionReady(listing) && !auctionedListingIds.has(String(listing.id))),
        [auctionedListingIds, listings]
    );
    const selectedListing = useMemo(
        () => listings.find((listing) => String(listing.id) === auctionForm.listingId),
        [auctionForm.listingId, listings]
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
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const publishCreatedListing = async (listingId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/publish`), {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing publish failed'));
        }
    };

    const rollbackCreatedListing = async (listingId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/cancel`), {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing rollback failed'));
        }
    };

    const markAuctionCreated = async (listingId: string, auctionId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/auction-created`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionId }),
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing auction marker failed'));
        }
    };

    const resetListingForm = () => {
        setEditingListingId(null);
        setListingForm(emptyListingForm);
    };

    const createListingPayload = (form: ListingFormState) => ({
        title: form.title,
        description: form.description,
        category: form.category,
        condition: form.condition,
        sellerId: user?.id,
        startingPrice: toAmountCents(form.startingBid),
        currentPrice: toAmountCents(form.startingBid),
        imageUrl: form.imageUrl || form.images[0] || null,
    });

    const saveListing = async (publishAfterCreate = false) => {
        if (!user || !isSeller) {
            setError('Only seller accounts can publish listings. Sign in with a SELLER role to continue.');
            return;
        }
        if (!listingForm.title || !listingForm.description || !listingForm.category || !listingForm.condition || !listingForm.startingBid) {
            setError('Complete title, description, category, condition, and starting price before saving.');
            return;
        }

        setError(null);
        setNotice(null);

        try {
            const isEditing = Boolean(editingListingId);
            const response = await authenticatedFetch(
                gatewayUrl(isEditing ? `/api/v1/catalogue/listings/${editingListingId}` : '/api/v1/catalogue/listings'),
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createListingPayload(listingForm)),
                }
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing save failed'));
            }

            const saved = await response.json() as ListingRecord;
            const listingId = String(saved.id);
            setCreatedListingId(listingId);

            if (publishAfterCreate && !isEditing) {
                await publishCreatedListing(listingId);
            }

            setNotice(isEditing ? 'Listing updated.' : publishAfterCreate ? 'Listing created and published.' : 'Listing draft created.');
            resetListingForm();
            await fetchSellerListings();
            setActiveView('listing-manage');
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const editListing = (listing: ListingRecord) => {
        setEditingListingId(String(listing.id));
        setListingForm({
            title: listing.title,
            description: listing.description,
            category: listing.category ?? '',
            condition: listing.condition ?? '',
            startingBid: fromAmountCents(listing.startingPrice),
            imageUrl: listing.imageUrl ?? '',
            images: listing.imageUrl ? [listing.imageUrl] : [],
        });
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
            await fetchSellerListings();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const cancelListing = async (listingId = createdListingId) => {
        if (!listingId) return;
        setError(null);
        setNotice(null);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/cancel`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Listing cancellation failed'));
            }
            setCreatedListingId(null);
            setNotice('Listing cancelled.');
            await fetchSellerListings();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const publishListing = async (listingId = createdListingId) => {
        if (!listingId) return;
        setError(null);
        setNotice(null);
        try {
            await publishCreatedListing(listingId);
            setNotice('Listing published.');
            await fetchSellerListings();
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const createAuction = async () => {
        if (!user || !isSeller) {
            setError('Only seller accounts can create auctions.');
            return;
        }
        if (!auctionForm.listingId || !auctionForm.startingBid || !auctionForm.reservePrice || !auctionForm.minimumIncrement) {
            setError('Select a published listing and complete auction pricing before creating an auction.');
            return;
        }

        setError(null);
        setNotice(null);
        const now = Math.floor(Date.now() / 1000);
        const listingId: string = auctionForm.listingId;

        try {
            const auctionResponse = await authenticatedFetch(gatewayUrl('/api/v1/auctions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listingId,
                    sellerId: user.id,
                    auctionType: 'ENGLISH',
                    starting_price_cents: toAmountCents(auctionForm.startingBid),
                    reserve_price_cents: toAmountCents(auctionForm.reservePrice || auctionForm.startingBid),
                    minimum_increment_cents: toAmountCents(auctionForm.minimumIncrement || '1'),
                    startTime: now,
                    endTime: now + auctionForm.duration * 24 * 60 * 60,
                }),
            });
            if (!auctionResponse.ok) {
                throw new Error(await readApiError(auctionResponse, 'Auction creation failed'));
            }
            const auction = await auctionResponse.json() as { id: string | number };
            const auctionId = String(auction.id);
            await markAuctionCreated(listingId, auctionId);
            setCreatedAuctionId(auctionId);
            setAuctionForm(emptyAuctionForm);
            setNotice('Auction created.');
            await refreshStudio();
            setActiveView('auction-manage');
        } catch (err: unknown) {
            if (listingId && err instanceof Error && err.message.includes('Listing auction marker failed')) {
                try {
                    await rollbackCreatedListing(listingId);
                } catch {
                    // The auction was created; keep the primary error visible.
                }
            }
            setError(toErrorMessage(err));
        }
    };

    const closeAuction = async (auctionId: string) => {
        setError(null);
        setNotice(null);
        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/auctions/${auctionId}/close`), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Auction close failed'));
            }
            setNotice('Auction close requested.');
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
                    <h1>{isSignedOut ? 'Sell on BidMart' : 'Seller access required'}</h1>
                    <p>{isSignedOut ? 'Create an account as a seller to publish auction listings.' : 'Buyer accounts can browse, bid, and manage wallet funds.'}</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">{isSignedOut ? 'Public Preview' : 'Buyer Account'}</span>
                    <h2>{isSignedOut ? 'Start with a seller account' : 'This page is for sellers'}</h2>
                    <p className="text-muted">
                        {isSignedOut
                            ? 'Seller accounts can create listings, attach product photos, configure auction rules, and publish to the marketplace.'
                            : 'Your current role does not allow listing creation. Use a seller account when you need to publish items.'}
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
            title: 'Listing',
            items: [
                { id: 'listing-create' as const, label: 'Create Listing', icon: 'add_box' },
                { id: 'listing-manage' as const, label: 'View Current Listing', icon: 'inventory_2' },
            ],
        },
        {
            title: 'Auction',
            items: [
                { id: 'auction-create' as const, label: 'Create Auction', icon: 'gavel' },
                { id: 'auction-manage' as const, label: 'View Current Auction', icon: 'fact_check' },
            ],
        },
    ];

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
                        <p>Manage product records separately from bidding sessions so each workflow stays clear.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={refreshStudio}>
                        <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                        Refresh
                    </button>
                    <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                        {isConnected ? 'Live updates' : 'Realtime offline'}
                    </span>
                </section>

                {notice && <div className="toast-success">{notice}</div>}
                {error && <div className="toast-error">{error}</div>}
                {analyticsError && activeView === 'dashboard' && <div className="toast-error">{analyticsError}</div>}

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
                            ) : sellerAuctions.length > 0 ? (
                                <div className="analytics-table">
                                    <div className="analytics-row analytics-row-head">
                                        <span>Lot</span>
                                        <span>Top Bid</span>
                                        <span>Next Bid</span>
                                        <span>Status</span>
                                        <span>Ends</span>
                                    </div>
                                    {sellerAuctions.map((auction) => {
                                        const meta = buildAuctionCardMeta(auction);
                                        return (
                                            <Link key={auction.id} className="analytics-row" to={`/active-auctions/${auction.id}`}>
                                                <span>#{auction.listingId}</span>
                                                <strong>{formatMoney(meta.currentHighest)}</strong>
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
                                    <span className="text-muted">Create an auction from a published listing to start collecting bid data.</span>
                                </div>
                            )}

                            {topSellerAuction && (
                                <div className="top-auction-callout">
                                    <span className="metric-label">Best performing lot</span>
                                    <strong>Lot #{topSellerAuction.listingId}</strong>
                                    <span>{formatMoney(topSellerAuction.currentHighestBid ?? topSellerAuction.startingPrice)} top bid</span>
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
                                    className="form-input"
                                    value={listingForm.title}
                                    onChange={(event) => setListingForm((previous) => ({ ...previous, title: event.target.value }))}
                                    placeholder="Be specific and descriptive"
                                />
                            </label>
                            <label className="field">
                                Description
                                <textarea
                                    className="form-input form-textarea"
                                    value={listingForm.description}
                                    onChange={(event) => setListingForm((previous) => ({ ...previous, description: event.target.value }))}
                                    placeholder="Include condition, features, provenance, defects, and handling notes"
                                />
                            </label>
                            <div className="seller-form-two-col">
                                <label className="field">
                                    Category
                                    <select
                                        className="form-input"
                                        value={listingForm.category}
                                        onChange={(event) => setListingForm((previous) => ({ ...previous, category: event.target.value }))}
                                    >
                                        <option value="">Select a category</option>
                                        {CATEGORIES.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field">
                                    Starting Price
                                    <input
                                        className="form-input"
                                        type="number"
                                        min={1}
                                        value={listingForm.startingBid}
                                        onChange={(event) => setListingForm((previous) => ({ ...previous, startingBid: event.target.value }))}
                                        placeholder="0.00"
                                    />
                                </label>
                            </div>
                            <div>
                                <div className="field-label">Condition</div>
                                <div className="chip-grid">
                                    {CONDITIONS.map((condition) => (
                                        <button
                                            key={condition.value}
                                            type="button"
                                            className={`chip ${listingForm.condition === condition.value ? 'chip-active' : ''}`}
                                            onClick={() => setListingForm((previous) => ({ ...previous, condition: condition.value }))}
                                        >
                                            {condition.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
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
                                    className="form-input"
                                    value={listingForm.imageUrl}
                                    onChange={(event) => setListingForm((previous) => ({ ...previous, imageUrl: event.target.value }))}
                                    placeholder="Optional external image URL"
                                />
                            </label>
                            <div className="panel-footer">
                                <button type="button" className="secondary-button" onClick={() => saveListing(false)}>
                                    Save Draft
                                </button>
                                {!editingListingId && (
                                    <button type="button" className="primary-button" onClick={() => saveListing(true)}>
                                        Publish Listing
                                    </button>
                                )}
                                {editingListingId && (
                                    <button type="button" className="primary-button" onClick={() => saveListing(false)}>
                                        Update Listing
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
                                    <strong>${listingForm.startingBid || '0.00'}</strong>
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
                                <h2>View Current Listing</h2>
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
                                    const locked = listing.hasBids || status === 'AUCTION_CREATED' || status === 'SOLD' || status === 'UNSOLD';
                                    return (
                                        <article key={listing.id} className="management-card">
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
                                            </div>
                                            <div className="management-actions">
                                                <Link className="secondary-button" to={`/listings/${listing.id}`}>View</Link>
                                                <button type="button" className="secondary-button" disabled={Boolean(locked)} onClick={() => editListing(listing)}>
                                                    Edit
                                                </button>
                                                {status === 'DRAFT' && (
                                                    <button type="button" className="primary-button" onClick={() => publishListing(String(listing.id))}>
                                                        Publish
                                                    </button>
                                                )}
                                                {(status === 'DRAFT' || status === 'ACTIVE') && (
                                                    <button type="button" className="secondary-button" onClick={() => cancelListing(String(listing.id))}>
                                                        Cancel
                                                    </button>
                                                )}
                                                <button type="button" className="secondary-button" disabled={Boolean(locked)} onClick={() => deleteListing(listing.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                            {locked && <p className="text-muted">Editing is locked once bids or an auction lifecycle are attached.</p>}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state compact-empty">
                                <strong>No listings yet.</strong>
                                <span className="text-muted">Create a listing before opening an auction.</span>
                            </div>
                        )}
                    </section>
                )}

                {activeView === 'auction-create' && (
                    <section className="panel seller-form-panel section-stack">
                        <div className="section-title-row">
                            <div>
                                <p className="eyebrow">Create Auction</p>
                                <h2>Open Bidding Session</h2>
                            </div>
                        </div>
                        <label className="field">
                            Published Listing
                            <select
                                className="form-input"
                                value={auctionForm.listingId}
                                onChange={(event) => {
                                    const listing = listings.find((item) => String(item.id) === event.target.value);
                                    setAuctionForm((previous) => ({
                                        ...previous,
                                        listingId: event.target.value,
                                        startingBid: listing ? fromAmountCents(listing.startingPrice) : previous.startingBid,
                                        reservePrice: listing ? fromAmountCents(listing.startingPrice) : previous.reservePrice,
                                    }));
                                }}
                            >
                                <option value="">Select an ACTIVE listing without an auction</option>
                                {auctionReadyListings.map((listing) => (
                                    <option key={listing.id} value={String(listing.id)}>
                                        {listing.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {selectedListing && (
                            <div className="summary-box">
                                <div>Listing: {selectedListing.title}</div>
                                <div>Status: {selectedListing.status}</div>
                                <div>Seller: {selectedListing.sellerId}</div>
                            </div>
                        )}
                        <div className="seller-form-two-col">
                            <label className="field">
                                Starting Bid
                                <input
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    value={auctionForm.startingBid}
                                    onChange={(event) => setAuctionForm((previous) => ({ ...previous, startingBid: event.target.value }))}
                                />
                            </label>
                            <label className="field">
                                Reserve Price
                                <input
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    value={auctionForm.reservePrice}
                                    onChange={(event) => setAuctionForm((previous) => ({ ...previous, reservePrice: event.target.value }))}
                                />
                            </label>
                        </div>
                        <label className="field">
                            Minimum Increment
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                value={auctionForm.minimumIncrement}
                                onChange={(event) => setAuctionForm((previous) => ({ ...previous, minimumIncrement: event.target.value }))}
                            />
                        </label>
                        <div>
                            <div className="field-label">Auction Duration</div>
                            <div className="chip-grid">
                                {AUCTION_DURATIONS.map((duration) => (
                                    <button
                                        key={duration}
                                        type="button"
                                        className={`chip ${auctionForm.duration === duration ? 'chip-active' : ''}`}
                                        onClick={() => setAuctionForm((previous) => ({ ...previous, duration }))}
                                    >
                                        {duration} day{duration > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="summary-box">
                            <div>Critical pricing fields are locked once the auction is live.</div>
                            <div>Estimated end: {new Date(Date.now() + auctionForm.duration * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                        </div>
                        <div className="panel-footer">
                            <button type="button" className="primary-button" onClick={createAuction}>
                                Create Auction
                            </button>
                        </div>
                    </section>
                )}

                {activeView === 'auction-manage' && (
                    <section className="panel seller-management-panel">
                        <div className="section-title-row">
                            <div>
                                <p className="eyebrow">Auction Management</p>
                                <h2>View Current Auction</h2>
                            </div>
                            <button type="button" className="primary-button" onClick={() => setActiveView('auction-create')}>
                                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                                New Auction
                            </button>
                        </div>

                        {analyticsLoading ? (
                            <div className="analytics-table skeleton-grid" aria-busy="true" aria-label="Loading auction analytics">
                                <span className="skeleton-line" />
                                <span className="skeleton-line" />
                                <span className="skeleton-line skeleton-line-medium" />
                            </div>
                        ) : sellerAuctions.length > 0 ? (
                            <div className="management-list">
                                {sellerAuctions.map((auction) => {
                                    const meta = buildAuctionCardMeta(auction);
                                    const locked = isAuctionLocked(auction);
                                    const canClose = hasReachedEndTime(auction) && !meta.isClosed;
                                    return (
                                        <article key={auction.id} className="management-card">
                                            <div>
                                                <span className={`status-badge status-${auction.status}`}>{meta.statusLabel}</span>
                                                <h3>Lot #{auction.listingId}</h3>
                                                <p className="text-muted">Auction ID: {auction.id}</p>
                                            </div>
                                            <div className="listing-price-grid">
                                                <div>
                                                    <span>Top Bid</span>
                                                    <strong>{formatMoney(meta.currentHighest)}</strong>
                                                </div>
                                                <div>
                                                    <span>Reserve</span>
                                                    <strong>{formatMoney(auction.reservePrice)}</strong>
                                                </div>
                                                <div>
                                                    <span>Increment</span>
                                                    <strong>{formatMoney(auction.minimumIncrement)}</strong>
                                                </div>
                                                <div>
                                                    <span>Ends</span>
                                                    <strong>{meta.timeLeftLabel}</strong>
                                                </div>
                                            </div>
                                            <div className="management-actions">
                                                <Link className="secondary-button" to={`/active-auctions/${auction.id}`}>Open Room</Link>
                                                <button type="button" className="secondary-button" disabled={locked}>
                                                    Edit Draft
                                                </button>
                                                <button type="button" className="secondary-button" disabled={!canClose} onClick={() => closeAuction(auction.id)}>
                                                    Settle
                                                </button>
                                            </div>
                                            <p className="text-muted">
                                                {locked
                                                    ? 'Critical fields such as listing, starting bid, reserve, increment, and timing are locked once the auction is live.'
                                                    : 'Draft auction details can be edited before the room goes live when the backend exposes update support.'}
                                            </p>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state compact-empty">
                                <strong>No auctions yet.</strong>
                                <span className="text-muted">Create an auction from an active listing.</span>
                            </div>
                        )}
                    </section>
                )}

                {createdAuctionId && <span className="visually-hidden">Last auction ID: {createdAuctionId}</span>}
            </main>
        </div>
    );
};

export default SellPage;
