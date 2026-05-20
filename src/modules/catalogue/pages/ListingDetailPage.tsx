import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { formatMoney, normalizeMoneyInput, toMoneyAmount } from '../../../utils/money';
import { useAuctionRealtime } from '../../auction/hooks/useAuctionRealtime';
import { buildAuctionCardMeta } from '../../auction/utils/auction-card-meta';
import { biddingListingPath } from '../../auction/utils/bidding-paths';
import { activeListingStatuses, catalogueListingToAuction } from '../utils/listing-to-auction';
import { useNowTick } from '../../../hooks/useNowTick';
import { NO_IMAGE_PLACEHOLDER } from '../utils/no-image';

type ListingDetail = {
    id: string | number;
    title: string;
    description?: string | null;
    startingPrice?: number | null;
    reservePrice?: number | null;
    currentPrice?: number | null;
    minimumIncrement?: number | null;
    imageUrl?: string | null;
    category?: string | null;
    condition?: string | null;
    sellerId?: string | null;
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

const toIsoFromUnixSeconds = (value?: number): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return new Date(value * 1000).toISOString();
};

const centsToAmount = (value?: number | null): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return value / 100;
};

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
    const [bids, setBids] = useState<BidHistoryItem[]>([]);
    const [bidInput, setBidInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const nowMs = useNowTick();

    const listingId = id ? String(id) : '';

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
                hasBids: currentPrice != null && startingPrice != null ? currentPrice > startingPrice : undefined,
            };
        } catch {
            return null;
        }
    }, [listingId]);

    const fetchListing = useCallback(async () => {
        if (!listingId) {
            setError('Missing listing id.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
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

            const meta = buildAuctionCardMeta(catalogueListingToAuction(mergedListing));
            setBidInput(normalizeMoneyInput(meta.minNextBid));

            if (activeListingStatuses.has((mergedListing.status ?? '').toUpperCase())) {
                try {
                    const bidResponse = await fetch(apiUrl(biddingListingPath(listingId, '/bids')));
                    if (bidResponse.ok) {
                        const bidPayload = await bidResponse.json() as BidHistoryItem[] | { items?: BidHistoryItem[] };
                        setBids(Array.isArray(bidPayload) ? bidPayload : bidPayload.items ?? []);
                    } else {
                        setBids([]);
                    }
                } catch {
                    setBids([]);
                }
            } else {
                setBids([]);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load listing.');
            setListing(null);
            setBids([]);
        } finally {
            setLoading(false);
        }
    }, [ensureAuctionSession, fetchAuctionSnapshotPatch, listingId]);

    useEffect(() => {
        void fetchListing();
    }, [fetchListing]);

    useEffect(() => {
        if (!listingId) return;
        const timer = window.setInterval(() => {
            void fetchListing();
        }, 15000);
        return () => window.clearInterval(timer);
    }, [fetchListing, listingId]);

    useEffect(() => {
        if (!listingId) return;
        const timer = window.setInterval(() => {
            void (async () => {
                const patch = await fetchAuctionSnapshotPatch();
                if (!patch) return;
                setListing((prev) => prev ? { ...prev, ...patch } : prev);
            })();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [fetchAuctionSnapshotPatch, listingId]);

    const realtimeDestinations = useMemo(
        () => (listingId ? [`/topic/listings/${listingId}`, `/topic/auctions/${listingId}`] : []),
        [listingId]
    );
    const handleRealtimeEvent = useCallback(() => {
        void fetchListing();
    }, [fetchListing]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    const imageSrc = useMemo(() => {
        if (!listing) return '';
        return listing.imageUrl?.trim() || NO_IMAGE_PLACEHOLDER;
    }, [listing]);

    const listingMeta = listing ? buildAuctionCardMeta(catalogueListingToAuction(listing), nowMs) : null;
    const isLive = listing ? activeListingStatuses.has((listing.status ?? '').toUpperCase()) : false;
    const isSeller = Boolean(user?.id && listing?.sellerId && user.id === listing.sellerId);
    const canViewListing = Boolean(
        listing && (
            isSeller ||
            PUBLIC_LISTING_STATUSES.has((listing.status ?? '').toUpperCase())
        )
    );
    const placeBid = async () => {
        const amount = toMoneyAmount(bidInput);
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
            await fetchListing();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Bid placement failed.');
        }
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
            {error && <div className="toast-error">{error}</div>}

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
                        <p className="text-muted">{listing.description || 'No description provided by the seller.'}</p>
                        <div className="auction-spec-grid">
                            <div>
                                <span>Starting Price (IDR)</span>
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
                                    <span>Your amount</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={bidInput}
                                        step={listing.minimumIncrement ?? 1}
                                        min={listingMeta.minNextBid}
                                        disabled={listingMeta.isClosed}
                                        onChange={(event) => setBidInput(event.target.value)}
                                        onBlur={() => setBidInput(normalizeMoneyInput(bidInput))}
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
                                            onClick={() => setBidInput(normalizeMoneyInput(option.amount))}
                                        >
                                            <span>{option.increment === 0 ? 'Minimum' : `+ ${formatMoney(option.increment)}`}</span>
                                            <strong>{formatMoney(option.amount)}</strong>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    ) : isLive && isSeller ? (
                        <aside className="panel section-stack">
                            <p className="eyebrow">Seller view</p>
                            <h2>Your auction is live</h2>
                            <p className="text-muted">
                                Sellers cannot bid on their own listings. The auction will close automatically when the timer ends,
                                and the winner/order flow is handled through auction events.
                            </p>
                        </aside>
                    ) : (
                        <aside className="panel section-stack">
                            <p className="eyebrow">Listing status</p>
                            <h2>{listing.status === 'DRAFT' ? 'Not published yet' : 'Not open for bidding'}</h2>
                            <p className="text-muted">
                                {listing.status === 'DRAFT'
                                    ? 'This listing is still a draft.'
                                    : 'Bidding is only available while the listing is live.'}
                            </p>
                        </aside>
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
                        <div className="auction-history-list">
                            {bids.length > 0 ? (
                                bids.map((bid) => {
                                    const amount = bid.bidAmount ?? (typeof bid.bid_amount_cents === 'number' ? bid.bid_amount_cents / 100 : 0);
                                    const bidder = bid.bidderId ?? bid.bidder_id ?? 'Bidder';
                                    const timestamp = bid.bidTime ?? (bid.bid_time ? new Date(bid.bid_time * 1000).toISOString() : '');
                                    return (
                                        <div key={bid.id} className="auction-history-row">
                                            <div>
                                                <strong>{bidder === user?.id ? 'You' : 'Bidder'}</strong>
                                                <span>{timestamp ? new Date(timestamp).toLocaleString() : 'Bid recorded'}</span>
                                            </div>
                                            <strong>{formatMoney(amount)}</strong>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="auction-history-row">
                                    <div>
                                        <strong>No bids yet</strong>
                                        <span>Be the first to bid when the listing is live.</span>
                                    </div>
                                    <strong>{formatMoney(listingMeta.minNextBid)}</strong>
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
