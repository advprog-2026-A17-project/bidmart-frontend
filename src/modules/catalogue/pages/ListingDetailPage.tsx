import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { apiUrl } from '../../../config/api';
import { useAuctionRealtime } from '../../auction/hooks/useAuctionRealtime';
import { buildAuctionCardMeta, type Auction } from '../../auction/utils/auction-card-meta';
import { parseAuctionsResponse } from '../../auction/utils/parse-auctions-response';

type ListingDetail = {
    id: string | number;
    title: string;
    description?: string | null;
    startingPrice?: number | null;
    currentPrice?: number | null;
    imageUrl?: string | null;
    category?: string | null;
    condition?: string | null;
    sellerId?: string | null;
    status?: string | null;
    endTime?: string | null;
    hasBids?: boolean;
};

const formatMoney = (value?: number | null): string =>
    `$${(value ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const fallbackImage = (id: string | number): string =>
    `https://picsum.photos/seed/${encodeURIComponent(String(id))}/960/720`;

const ListingDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [auction, setAuction] = useState<Auction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchListing = useCallback(async () => {
        if (!id) {
            setError('Missing listing id.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const [listingResponse, auctionsResponse] = await Promise.all([
                fetch(apiUrl(`/api/v1/catalogue/listings/${encodeURIComponent(id)}`)),
                fetch(apiUrl('/api/v1/auctions')),
            ]);

            if (!listingResponse.ok) {
                throw new Error(`Listing lookup failed with status ${listingResponse.status}`);
            }

            const listingPayload = await listingResponse.json() as ListingDetail | null;
            if (!listingPayload) {
                throw new Error('Listing was not found.');
            }

            let matchingAuction: Auction | null = null;
            if (auctionsResponse.ok) {
                const auctionsPayload: unknown = await auctionsResponse.json();
                matchingAuction = parseAuctionsResponse(auctionsPayload)
                    .find((item) => String(item.listingId) === String(listingPayload.id)) ?? null;
            }

            setListing(listingPayload);
            setAuction(matchingAuction);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load listing.');
            setListing(null);
            setAuction(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchListing();
    }, [fetchListing]);

    const realtimeDestinations = useMemo(() => {
        if (!id) return [];
        return auction ? [`/topic/listings/${id}`, `/topic/auctions/${auction.id}`] : [`/topic/listings/${id}`];
    }, [auction, id]);
    const handleRealtimeEvent = useCallback(() => {
        void fetchListing();
    }, [fetchListing]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    const imageSrc = useMemo(() => {
        if (!listing) return '';
        return listing.imageUrl?.trim() || fallbackImage(listing.id);
    }, [listing]);

    const auctionMeta = auction ? buildAuctionCardMeta(auction) : null;

    if (loading) {
        return (
            <div className="page-wrap">
                <div className="listing-detail-layout skeleton-grid" aria-busy="true" aria-label="Loading listing">
                    <div className="listing-detail-media skeleton-block" />
                    <div className="panel section-stack skeleton-card">
                        <span className="skeleton-line skeleton-line-short" />
                        <span className="skeleton-line skeleton-line-large" />
                        <span className="skeleton-line" />
                        <span className="skeleton-button" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !listing) {
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

    return (
        <div className="page-wrap">
            <BackButton fallback="/" />
            <section className="listing-detail-layout">
                <div className="listing-detail-media">
                    <img
                        src={imageSrc}
                        alt={listing.title}
                        onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = fallbackImage(listing.id);
                        }}
                    />
                    <div className="listing-detail-badges">
                        {listing.category && <span className="category-badge">{listing.category}</span>}
                        {listing.status && <span className={`status-badge status-${listing.status}`}>{listing.status}</span>}
                    </div>
                </div>

                <aside className="listing-detail-summary panel">
                    <p className="eyebrow">Marketplace Listing</p>
                    <h1>{listing.title}</h1>
                    <p className="text-muted">{listing.description || 'No description provided by the seller.'}</p>

                    <div className="listing-price-grid">
                        <div>
                            <span>Starting Price</span>
                            <strong>{formatMoney(listing.startingPrice)}</strong>
                        </div>
                        <div>
                            <span>Current Price</span>
                            <strong>{formatMoney(listing.currentPrice ?? listing.startingPrice)}</strong>
                        </div>
                        <div>
                            <span>Seller</span>
                            <strong>{listing.sellerId ?? 'Unknown'}</strong>
                        </div>
                        <div>
                            <span>Condition</span>
                            <strong>{listing.condition ?? 'Not specified'}</strong>
                        </div>
                    </div>

                    {auction && auctionMeta ? (
                        <div className="linked-auction-panel">
                            <div>
                                <span className="metric-label">Live Auction</span>
                                <strong>{formatMoney(auctionMeta.currentHighest)}</strong>
                                <small>{auctionMeta.timeLeftLabel} · Minimum next bid {formatMoney(auctionMeta.minNextBid)}</small>
                            </div>
                            <Link className="primary-button" to={`/active-auctions/${auction.id}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                                Open Auction Room
                            </Link>
                        </div>
                    ) : (
                        <div className="linked-auction-panel inactive">
                            <div>
                                <span className="metric-label">Auction Status</span>
                                <strong>No auction room yet</strong>
                                <small>The seller has a listing, but no active auction has been created for it.</small>
                            </div>
                            <Link className="secondary-button" to="/active-auctions">
                                View Active Auctions
                            </Link>
                        </div>
                    )}
                    <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                        {isConnected ? 'Live updates' : 'Realtime offline'}
                    </span>
                </aside>
            </section>
        </div>
    );
};

export default ListingDetailPage;
