import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { formatMoney, normalizeRupiahInput, toRupiahAmount } from '../../../utils/money';
import { useAuctionRealtime } from '../../auction/hooks/useAuctionRealtime';
import PageToast from '../../../components/PageToast';
import type { AuctionRealtimeEvent } from '../../auction/hooks/useAuctionRealtime';
import { buildAuctionCardMeta } from '../../auction/utils/auction-card-meta';
import { buildListingPatchFromRealtimeEvent, eventTargetsListing } from '../../auction/utils/auction-realtime-patch';
import { biddingListingPath } from '../../auction/utils/bidding-paths';
import {
    activeListingStatuses,
    catalogueListingToAuction,
    isEndedListing,
    shouldLoadBidHistory,
    type CatalogueListing,
} from '../utils/listing-to-auction';
import { useNowTick } from '../../../hooks/useNowTick';
import { NO_IMAGE_PLACEHOLDER } from '../utils/no-image';
import { fetchPublicSellerProfile, type PublicSellerProfile } from '../../auth/utils/auth-api';
import { fetchPublicUserProfiles } from '../../auth/utils/public-profiles';
import { ProfileAvatarWithFallback } from '../../../components/ProfileAvatar';
import { centsToAmount, centsToAmountFromUnknown, toIsoFromUnixSeconds } from '../../../utils/auction-units';

type ListingDetail = {
    id: string;
    title: string;
    description?: string | null;
    startingPrice?: number | null;
    reservePrice?: number | null;
    currentPrice?: number | null;
    minimumIncrement?: number | null;
    imageUrl?: string | null;
    category?: string | null;
    condition?: string | null;
    sellerId: string;
    status?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    hasBids?: boolean;
};

type BidHistoryItem = {
    id: string;
    bidderId?: string;
    bidder_id?: string;
    bidAmount?: number;
    bid_amount_cents?: number;
    bidTime?: string;
    bid_time?: number;
};

type AuctionSnapshotResponse = {
    status?: string;
    endTime?: string;
    end_time?: number;
    startTime?: string;
    start_time?: number;
    currentHighestBid?: number | null;
    current_highest_bid_cents?: number | null;
    startingPrice?: number;
    starting_price_cents?: number;
    reservePrice?: number;
    reserve_price_cents?: number;
    minimumIncrement?: number;
    minimum_increment_cents?: number;
};

const PUBLIC_LISTING_STATUSES = new Set(['ACTIVE', 'EXTENDED', 'AVAILABLE', 'CLOSED', 'WON', 'UNSOLD']);

const bidLabel = (meta: ReturnType<typeof buildAuctionCardMeta>): string =>
    meta.hasBids ? formatMoney(meta.currentHighest) : 'No bids';

const bidAmountFromItem = (bid: BidHistoryItem): number =>
    bid.bidAmount ?? (typeof bid.bid_amount_cents === 'number' ? bid.bid_amount_cents / 100 : 0);

const toRealtimeBidTime = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim()) {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return toIsoFromUnixSeconds(value);
    }
    return undefined;
};

const bidHistoryItemFromRealtimeEvent = (event: AuctionRealtimeEvent): BidHistoryItem | null => {
    const eventType = (event.type ?? '').toLowerCase();
    if (!eventType.includes('bid-placed')) {
        return null;
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const amount = centsToAmountFromUnknown(payload.amountCents ?? payload.currentPrice ?? payload.finalPrice);
    if (amount == null) {
        return null;
    }

    const bidId = payload.bidId;
    const bidderId = payload.bidderId;
    const bidTime = toRealtimeBidTime(payload.bidTime) ?? toRealtimeBidTime(payload.placedAt);

    return {
        id: typeof bidId === 'string' && bidId.trim()
            ? bidId
            : `${event.auctionId ?? event.listingId ?? 'auction'}-${String(bidderId ?? 'bidder')}-${bidTime ?? Date.now()}`,
        bidderId: typeof bidderId === 'string' ? bidderId : undefined,
        bidAmount: amount,
        bidTime,
    };
};

const mergeRealtimeBidHistory = (
    currentBids: BidHistoryItem[],
    realtimeBid: BidHistoryItem,
): BidHistoryItem[] => [
    realtimeBid,
    ...currentBids.filter((bid) => bid.id !== realtimeBid.id),
];

const toIsoDate = (value?: string | null): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const ListingDetailSkeleton = () => (
    <div className="auction-command-grid skeleton-grid" aria-busy="true" aria-label="Loading listing">
        <section className="auction-asset-panel skeleton-card">
            <div className="listing-detail-media skeleton-block" />
            <span className="skeleton-line skeleton-line-large" />
            <span className="skeleton-line" />
        </section>
        <aside className="bid-console skeleton-card">
            <span className="skeleton-line skeleton-line-medium" />
            <span className="skeleton-line skeleton-line-large" />
            <span className="skeleton-button" />
        </aside>
    </div>
);

const ListingDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [sellerProfile, setSellerProfile] = useState<PublicSellerProfile | null>(null);
    const [bids, setBids] = useState<BidHistoryItem[]>([]);
    const [bidderProfiles, setBidderProfiles] = useState<Record<string, PublicSellerProfile>>({});
    const [bidInput, setBidInput] = useState('');
    const [proxyMaxInput, setProxyMaxInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const nowMs = useNowTick();

    const listingId = id ? String(id) : '';

    const fetchBids = useCallback(async () => {
        if (!listingId) return;
        try {
            const bidResponse = await fetch(apiUrl(biddingListingPath(listingId, '/bids')));
            if (bidResponse.ok) {
                const bidPayload = await bidResponse.json() as BidHistoryItem[] | { items?: BidHistoryItem[] };
                setBids(Array.isArray(bidPayload) ? bidPayload : bidPayload.items ?? []);
            }
        } catch {
            /* keep existing bids on transient failure */
        }
    }, [listingId]);

    useEffect(() => {
        const bidderIds = bids
            .map((bid) => bid.bidderId ?? bid.bidder_id)
            .filter((bidderId): bidderId is string => Boolean(bidderId));

        if (bidderIds.length === 0) {
            setBidderProfiles({});
            return;
        }

        let active = true;
        void fetchPublicUserProfiles(bidderIds).then((profiles) => {
            if (active) {
                setBidderProfiles(profiles);
            }
        });

        return () => {
            active = false;
        };
    }, [bids]);

    const ensureAuctionSession = useCallback(async (listingPayload: ListingDetail): Promise<boolean> => {
        try {
            const response = await authenticatedFetch(apiUrl('/api/v1/listings'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listingId: String(listingPayload.id),
                    sellerId: listingPayload.sellerId,
                    auctionType: 'ENGLISH',
                    startingPrice: listingPayload.startingPrice,
                    reservePrice: listingPayload.reservePrice ?? listingPayload.startingPrice,
                    minimumIncrement: listingPayload.minimumIncrement ?? 1,
                    startTime: new Date().toISOString(),
                    endTime: toIsoDate(listingPayload.endTime),
                }),
            });
            return response.ok;
        } catch {
            return false;
        }
    }, [authenticatedFetch]);

    const fetchAuctionSnapshotPatch = useCallback(async (): Promise<Partial<ListingDetail> | null> => {
        if (!listingId) return null;
        try {
            const response = await fetch(apiUrl(biddingListingPath(listingId, '')));
            if (!response.ok) return null;
            const payload = await response.json() as AuctionSnapshotResponse;

            const endTime = payload.endTime ?? toIsoFromUnixSeconds(payload.end_time);
            const startTime = payload.startTime ?? toIsoFromUnixSeconds(payload.start_time);
            const snapshotHasBid = payload.currentHighestBid != null || payload.current_highest_bid_cents != null;
            const currentPrice = payload.currentHighestBid ?? centsToAmount(payload.current_highest_bid_cents);
            const startingPrice = payload.startingPrice ?? centsToAmount(payload.starting_price_cents);
            const reservePrice = payload.reservePrice ?? centsToAmount(payload.reserve_price_cents);
            const minimumIncrement = payload.minimumIncrement ?? centsToAmount(payload.minimum_increment_cents);

            return {
                status: payload.status,
                startTime,
                endTime,
                currentPrice,
                startingPrice,
                reservePrice,
                minimumIncrement,
                hasBids: snapshotHasBid,
            };
        } catch {
            return null;
        }
    }, [listingId]);

    const fetchListing = useCallback(async (options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        if (!listingId) {
            setError('Missing listing id.');
            setLoading(false);
            return;
        }

        try {
            if (!silent) {
                setLoading(true);
            }
            setError(null);

            const listingResponse = await fetch(apiUrl(`/api/v1/catalogue/listings/${encodeURIComponent(listingId)}`));
            if (!listingResponse.ok) {
                throw new Error(`Listing lookup failed with status ${listingResponse.status}`);
            }

            const listingPayload = await listingResponse.json() as ListingDetail | null;
            if (!listingPayload) {
                throw new Error('Listing was not found.');
            }

            let auctionPatch = await fetchAuctionSnapshotPatch();
            const listingIsLive = activeListingStatuses.has((listingPayload.status ?? '').toUpperCase());
            if (!auctionPatch && listingIsLive) {
                const ensured = await ensureAuctionSession(listingPayload);
                if (ensured) {
                    auctionPatch = await fetchAuctionSnapshotPatch();
                }
            }
            const mergedListing = auctionPatch ? { ...listingPayload, ...auctionPatch } : listingPayload;
            setListing(mergedListing);

            const profile = await fetchPublicSellerProfile(String(mergedListing.sellerId));
            setSellerProfile(profile);

            const meta = buildAuctionCardMeta(catalogueListingToAuction(mergedListing as unknown as CatalogueListing));
            setBidInput(normalizeRupiahInput(meta.minNextBid));

            if (shouldLoadBidHistory((mergedListing.status ?? '').toUpperCase())) {
                await fetchBids();
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load listing.');
            if (!silent) {
                setListing(null);
                setBids([]);
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [ensureAuctionSession, fetchAuctionSnapshotPatch, fetchBids, listingId]);

    useEffect(() => {
        void fetchListing();
    }, [fetchListing]);

    const realtimeDestinations = useMemo(
        () => (listingId ? [`/topic/listings/${listingId}`] : []),
        [listingId]
    );

    const handleRealtimeEvent = useCallback((event: AuctionRealtimeEvent) => {
        if (!eventTargetsListing(event, listingId)) {
            return;
        }
        const patch = buildListingPatchFromRealtimeEvent(event);
        if (patch) {
            setListing((prev) => prev ? { ...prev, ...patch } : prev);
            const meta = buildAuctionCardMeta(
                catalogueListingToAuction({ ...(listing ?? {}), ...patch } as unknown as CatalogueListing),
                nowMs
            );
            setBidInput(normalizeRupiahInput(meta.minNextBid));
        }
        const realtimeBid = bidHistoryItemFromRealtimeEvent(event);
        if (realtimeBid) {
            setBids((previous) => mergeRealtimeBidHistory(previous, realtimeBid));
        }
        void fetchBids();
    }, [fetchBids, listing, listingId, nowMs]);

    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    useEffect(() => {
        if (!listingId || isConnected) return;
        const timer = window.setInterval(() => {
            void (async () => {
                const patch = await fetchAuctionSnapshotPatch();
                if (!patch) return;
                setListing((prev) => prev ? { ...prev, ...patch } : prev);
            })();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [fetchAuctionSnapshotPatch, isConnected, listingId]);

    const imageSrc = useMemo(() => {
        if (!listing) return '';
        return listing.imageUrl?.trim() || NO_IMAGE_PLACEHOLDER;
    }, [listing]);

    const listingMeta = listing ? buildAuctionCardMeta(catalogueListingToAuction(listing as unknown as CatalogueListing), nowMs) : null;
    const listingStatus = (listing?.status ?? '').toUpperCase();
    const isLive = listing && listingMeta ? activeListingStatuses.has(listingStatus) && !listingMeta.isClosed : false;
    const isEnded = listing ? isEndedListing(listingStatus) : false;
    const isDraft = listingStatus === 'DRAFT';
    const isSeller = Boolean(user?.id && listing?.sellerId && user.id === listing.sellerId);

    const inferredWinnerId = useMemo(() => {
        if (!bids.length) return null;
        const sorted = [...bids].sort((a, b) => bidAmountFromItem(b) - bidAmountFromItem(a));
        const top = sorted[0];
        return top?.bidderId ?? top?.bidder_id ?? null;
    }, [bids]);

    const winnerProfile = inferredWinnerId ? bidderProfiles[inferredWinnerId] : undefined;
    const userWon = Boolean(user?.id && inferredWinnerId && user.id === inferredWinnerId && listingStatus === 'WON');
    const userParticipated = Boolean(user?.id && bids.some((b) => (b.bidderId ?? b.bidder_id) === user.id));

    const canViewListing = Boolean(
        listing && (
            isSeller ||
            PUBLIC_LISTING_STATUSES.has(listingStatus)
        )
    );

    const placeBid = async () => {
        const amount = toRupiahAmount(bidInput);
        if (!amount || !listingId) return;
        if (!user) {
            setError('Please sign in before placing a bid.');
            return;
        }
        if (isSeller) {
            setError('Sellers cannot bid on their own listings.');
            return;
        }

        try {
            let response = await authenticatedFetch(apiUrl(biddingListingPath(listingId, '/bids')), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bidderId: user.id, bidAmount: amount }),
            });
            if (response.status === 404 && listing) {
                const ensured = await ensureAuctionSession(listing);
                if (ensured) {
                    response = await authenticatedFetch(apiUrl(biddingListingPath(listingId, '/bids')), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bidderId: user.id, bidAmount: amount }),
                    });
                }
            }
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Bid placement failed'));
            }
            setError(null);
            await fetchListing({ silent: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Bid placement failed.');
        }
    };

    const placeProxyBid = async () => {
        const maxAmount = toRupiahAmount(proxyMaxInput);
        if (!maxAmount || !listingId) return;
        if (!user) {
            setError('Please sign in before setting a proxy bid.');
            return;
        }
        if (isSeller) {
            setError('Sellers cannot bid on their own listings.');
            return;
        }

        try {
            const response = await authenticatedFetch(apiUrl(biddingListingPath(listingId, '/bids/cursor')), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bidderId: user.id, maxBidAmount: maxAmount }),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Proxy bid failed'));
            }
            setError(null);
            setProxyMaxInput('');
            await fetchListing({ silent: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Proxy bid failed.');
        }
    };

    const closeAuction = async () => {
        if (!listingId || !isSeller) {
            return;
        }
        if (!window.confirm('Close this auction now? Bidders will no longer be able to place bids.')) {
            return;
        }

        try {
            const response = await authenticatedFetch(apiUrl(biddingListingPath(listingId, '/close')), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Auction close failed'));
            }
            setError(null);
            await fetchListing({ silent: true });
            await fetchBids();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Auction close failed.');
        }
    };

    const sellerDisplayName = sellerProfile?.displayName?.trim() || 'Seller';

    const endedPanel = () => {
        if (isDraft) {
            return (
                <aside className="panel section-stack">
                    <p className="eyebrow">Listing status</p>
                    <h2>Not published yet</h2>
                    <p className="text-muted">This listing is still a draft.</p>
                </aside>
            );
        }
        if (!isEnded) {
            return null;
        }
        if (listingStatus === 'UNSOLD') {
            return (
                <aside className="panel section-stack ended-auction-panel">
                    <p className="eyebrow">Auction ended</p>
                    <h2>No sale</h2>
                    <p className="text-muted">This auction ended without meeting the reserve or receiving qualifying bids.</p>
                </aside>
            );
        }
        if (listingStatus === 'WON') {
            if (userWon) {
                return (
                    <aside className="panel section-stack ended-auction-panel ended-auction-won">
                        <p className="eyebrow">Auction ended</p>
                        <h2>You won this auction</h2>
                        <p className="text-muted">Complete payment and track fulfillment from your orders.</p>
                        <Link className="primary-button" to="/orders">View your order</Link>
                    </aside>
                );
            }
            const winnerName = winnerProfile?.displayName?.trim()
                || (inferredWinnerId ? `Bidder ${inferredWinnerId.slice(0, 8)}` : 'another bidder');
            return (
                <aside className="panel section-stack ended-auction-panel">
                    <p className="eyebrow">Auction ended</p>
                    <h2>{userParticipated ? 'Auction won by another bidder' : 'Auction sold'}</h2>
                    <p className="text-muted">
                        Won by <strong>{winnerName}</strong>
                        {listingMeta ? ` at ${formatMoney(listingMeta.currentHighest)}` : ''}.
                    </p>
                </aside>
            );
        }
        return (
            <aside className="panel section-stack ended-auction-panel">
                <p className="eyebrow">Auction ended</p>
                <h2>Auction closed</h2>
                <p className="text-muted">This listing is no longer open for bidding.</p>
            </aside>
        );
    };

    if (loading) {
        return (
            <div className="page-wrap">
                <ListingDetailSkeleton />
            </div>
        );
    }

    if (!listing || !listingMeta || !canViewListing) {
        return (
            <div className="page-wrap">
                <section className="panel center-content">
                    <span className="material-symbols-outlined section-title-icon" aria-hidden="true">search_off</span>
                    <h1>Listing not found</h1>
                    <p className="text-muted">{error ?? 'This listing is unavailable.'}</p>
                    <Link className="primary-button" to="/">
                        Back to Marketplace
                    </Link>
                </section>
            </div>
        );
    }

    const quickBidOptions = [0, 1, 4].map((multiplier) => {
        const increment = (listing.minimumIncrement ?? 1) * multiplier;
        return {
            increment,
            amount: listingMeta.minNextBid + increment,
        };
    });

    return (
        <div className="page-wrap">
            <BackButton fallback="/" />
            <PageToast error={error} />

            <section className="auction-command-grid">
                <section className="auction-asset-panel">
                    <div className="listing-detail-media">
                        <img
                            src={imageSrc}
                            alt={listing.title}
                            onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = NO_IMAGE_PLACEHOLDER;
                            }}
                        />
                        <div className="listing-detail-badges">
                            {listing.category && <span className="category-badge">{listing.category}</span>}
                            {listing.status && <span className={`status-badge status-${listing.status}`}>{listing.status}</span>}
                        </div>
                    </div>
                    <div className="auction-detail-copy">
                        <p className="eyebrow">{listing.category || 'Marketplace Listing'}</p>
                        <h1>{listing.title}</h1>
                        <div className="listing-seller-meta">
                            <ProfileAvatarWithFallback
                                src={sellerProfile?.avatarUrl}
                                name={sellerProfile?.displayName}
                                size={44}
                            />
                            <div>
                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Seller</span>
                                <div style={{ fontWeight: 600 }}>{sellerDisplayName}</div>
                            </div>
                        </div>
                        <p className="text-muted">{listing.description || 'No description provided by the seller.'}</p>

                        {listing.condition && (
                            <div className="seller-info-block">
                                <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                                <div>
                                    <span className="metric-label">Condition</span>
                                    <strong style={{ textTransform: 'capitalize' }}>{listing.condition}</strong>
                                </div>
                            </div>
                        )}

                        <div className="auction-spec-grid">
                            <div>
                                <span>Starting Price</span>
                                <strong>{formatMoney(listing.startingPrice)}</strong>
                            </div>
                            <div>
                                <span>Reserve</span>
                                <strong>{formatMoney(listing.reservePrice ?? listing.startingPrice)}</strong>
                            </div>
                            <div>
                                <span>Increment</span>
                                <strong>{formatMoney(listing.minimumIncrement ?? 1)}</strong>
                            </div>
                            <div>
                                <span>Ends</span>
                                <strong>{listingMeta.timeLeftLabel}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="auction-side-stack">
                    {isLive && !isSeller ? (
                        <aside className="bid-console">
                            <div className={`bid-console-status ${listingMeta.isClosed ? 'bid-console-status-closed' : ''}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">
                                    {listingMeta.isClosed ? 'lock' : 'gavel'}
                                </span>
                                {listingMeta.isClosed ? 'Listing closed' : 'Open for bidding'}
                            </div>
                            <div className="bid-console-body">
                                <div className="current-bid-block">
                                    <span>Current bid</span>
                                    <strong>{bidLabel(listingMeta)}</strong>
                                    <small>Minimum next bid: {formatMoney(listingMeta.minNextBid)}</small>
                                </div>
                                <label className="field">
                                    <span>Your bid (IDR)</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={bidInput}
                                        step={1}
                                        min={Math.ceil(listingMeta.minNextBid)}
                                        disabled={listingMeta.isClosed}
                                        onChange={(event) => setBidInput(normalizeRupiahInput(event.target.value))}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={placeBid}
                                    disabled={listingMeta.isClosed || !user}
                                >
                                    {listingMeta.isClosed ? 'Closed' : user ? 'Place Bid' : 'Sign in to Bid'}
                                </button>
                                <div className="quick-bid-grid">
                                    {quickBidOptions.map((option) => (
                                        <button
                                            key={option.amount}
                                            type="button"
                                            className="quick-bid-button"
                                            disabled={listingMeta.isClosed}
                                            onClick={() => setBidInput(normalizeRupiahInput(option.amount))}
                                        >
                                            <span>{option.increment === 0 ? 'Minimum' : `+ ${formatMoney(option.increment)}`}</span>
                                            <strong>{formatMoney(option.amount)}</strong>
                                        </button>
                                    ))}
                                </div>
                                <div className="proxy-bid-section">
                                    <p className="eyebrow">Automatic bid (proxy)</p>
                                    <label className="field">
                                        <span>Maximum amount (IDR)</span>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={proxyMaxInput}
                                            step={1}
                                            min={Math.ceil(listingMeta.minNextBid)}
                                            disabled={listingMeta.isClosed}
                                            onChange={(event) => setProxyMaxInput(normalizeRupiahInput(event.target.value))}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={placeProxyBid}
                                        disabled={listingMeta.isClosed || !user || !proxyMaxInput}
                                    >
                                        Set proxy bid
                                    </button>
                                </div>
                            </div>
                        </aside>
                    ) : isLive && isSeller ? (
                        <aside className="panel section-stack">
                            <p className="eyebrow">Seller view</p>
                            <h2>Your auction is live</h2>
                            <p className="text-muted">
                                Sellers cannot bid on their own listings. You can close the auction early or wait for the timer to end.
                            </p>
                            <button type="button" className="secondary-button" onClick={() => { closeAuction().catch(() => undefined); }}>
                                Close auction now
                            </button>
                        </aside>
                    ) : (
                        endedPanel()
                    )}

                    <section className="auction-history-panel">
                        <div className="section-title-row">
                            <div>
                                <p className="eyebrow">Bid history</p>
                                <h2>Recent bids</h2>
                            </div>
                            <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                                {isConnected ? 'Live' : 'Offline'}
                            </span>
                        </div>
                        <div className="bid-history-card-grid">
                            {bids.length > 0 ? (
                                bids.map((bid) => {
                                    const amount = bidAmountFromItem(bid);
                                    const bidderId = bid.bidderId ?? bid.bidder_id ?? '';
                                    const isOwnBid = Boolean(user?.id && bidderId === user.id);
                                    const profile = bidderId ? bidderProfiles[bidderId] : undefined;
                                    const bidderName = isOwnBid
                                        ? 'You'
                                        : (profile?.displayName?.trim() || `Bidder ${bidderId.slice(0, 8)}`);
                                    const timestamp = bid.bidTime ?? (bid.bid_time ? new Date(bid.bid_time * 1000).toISOString() : '');
                                    return (
                                        <article
                                            key={bid.id}
                                            className={`bid-history-card ${isOwnBid ? 'bid-history-card-own' : ''}`}
                                        >
                                            <ProfileAvatarWithFallback
                                                src={profile?.avatarUrl}
                                                name={bidderName}
                                                size={48}
                                            />
                                            <div className="bid-history-card-body">
                                                <div className="bid-history-card-top">
                                                    <strong>{bidderName}</strong>
                                                    <span className="bid-history-card-amount">{formatMoney(amount)}</span>
                                                </div>
                                                <span className="bid-history-card-time">
                                                    {timestamp ? new Date(timestamp).toLocaleString() : 'Bid recorded'}
                                                </span>
                                            </div>
                                        </article>
                                    );
                                })
                            ) : (
                                <div className="bid-history-card bid-history-card-empty">
                                    <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                                    <div>
                                        <strong>{isEnded ? 'No bids recorded' : 'No bids yet'}</strong>
                                        <span>{isEnded ? 'This auction ended without bid history.' : 'Be the first to bid when the listing is live.'}</span>
                                    </div>
                                    {!isEnded && (
                                        <span className="bid-history-card-amount">{formatMoney(listingMeta.minNextBid)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
};

export default ListingDetailPage;
