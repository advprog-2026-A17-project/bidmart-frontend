import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { apiUrl } from '../../../config/api';
import { formatMoney } from '../../../utils/money';
import { useAuctionRealtime } from '../hooks/useAuctionRealtime';
import { buildAuctionCardMeta, type Auction } from '../utils/auction-card-meta';
import { parseAuctionsResponse } from '../utils/parse-auctions-response';
import { useNowTick } from '../../../hooks/useNowTick';

const CLOSED_STATUSES = new Set(['CLOSED', 'ENDED', 'WON', 'UNSOLD', 'CANCELLED']);

const bidLabel = (meta: ReturnType<typeof buildAuctionCardMeta>): string =>
    meta.hasBids ? formatMoney(meta.currentHighest) : 'No bids';

const BuyerAuctionsPage: React.FC = () => {
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const nowMs = useNowTick();

    const fetchAuctions = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(apiUrl('/api/v1/auctions'));
            if (!response.ok) {
                throw new Error(`Auction lookup failed with status ${response.status}`);
            }
            const payload: unknown = await response.json();
            setAuctions(parseAuctionsResponse(payload));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load active auctions.');
            setAuctions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAuctions();
    }, [fetchAuctions]);

    const realtimeDestinations = useMemo(() => ['/topic/auctions'], []);
    const handleRealtimeEvent = useCallback(() => {
        void fetchAuctions();
    }, [fetchAuctions]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    const activeAuctions = useMemo(
        () => auctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)),
        [auctions]
    );
    const topAuction = useMemo(
        () => [...activeAuctions].sort((a, b) => {
            const aBid = a.currentHighestBid ?? 0;
            const bBid = b.currentHighestBid ?? 0;
            return bBid - aBid;
        })[0],
        [activeAuctions]
    );

    return (
        <div className="page-wrap">
            <section className="page-head studio-head">
                <div>
                    <BackButton fallback="/" />
                    <p className="eyebrow">Buyer Workspace</p>
                    <h1>Active Auctions</h1>
                    <p>Follow live auction rooms from one place, then open a room when you are ready to bid.</p>
                </div>
                <Link className="secondary-button" to="/">
                    <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                    Browse Listings
                </Link>
                <span className={isConnected ? 'connection-live' : 'connection-idle'}>
                    {isConnected ? 'Live updates' : 'Realtime offline'}
                </span>
            </section>

            {error && <div className="toast-error">{error}</div>}

            <section className="seller-studio-overview" aria-label="Buyer auction summary">
                <div className="studio-kpi-card">
                    <span className="material-symbols-outlined" aria-hidden="true">sensors</span>
                    <div>
                        <strong>{loading ? '--' : activeAuctions.length}</strong>
                        <small>Live auction rooms</small>
                    </div>
                </div>
                <div className="studio-kpi-card">
                    <span className="material-symbols-outlined" aria-hidden="true">leaderboard</span>
                    <div>
                        <strong>{topAuction ? bidLabel(buildAuctionCardMeta(topAuction, nowMs)) : formatMoney(0)}</strong>
                        <small>Highest active top bid</small>
                    </div>
                </div>
                <div className="studio-kpi-card">
                    <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                    <div>
                        <strong>{topAuction ? buildAuctionCardMeta(topAuction, nowMs).timeLeftLabel : '--'}</strong>
                        <small>Closest high-value room</small>
                    </div>
                </div>
            </section>

            {loading ? (
                <ul className="auction-room-grid skeleton-grid" aria-busy="true" aria-label="Loading auctions">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <li key={index} className="panel skeleton-card">
                            <span className="skeleton-line skeleton-line-short" />
                            <span className="skeleton-line" />
                            <span className="skeleton-button" />
                        </li>
                    ))}
                </ul>
            ) : activeAuctions.length > 0 ? (
                <ul className="auction-room-grid">
                    {activeAuctions.map((auction) => {
                        const meta = buildAuctionCardMeta(auction, nowMs);
                        return (
                            <li key={auction.id} className="auction-room-card panel">
                                <div className="auction-room-card-head">
                                    <span className={`status-badge status-${auction.status}`}>{meta.statusLabel}</span>
                                    <span className="time-badge compact">
                                        <span className="material-symbols-outlined" aria-hidden="true">timer</span>
                                        {meta.timeLeftLabel}
                                    </span>
                                </div>
                                <div>
                                    <p className="eyebrow">Live Auction</p>
                                    <h2>Auction Room</h2>
                                    <p className="text-muted">Open the room for listing details, timing, and bid controls.</p>
                                </div>
                                <div className="listing-price-grid compact-price-grid">
                                    <div>
                                        <span>Top Bid</span>
                                        <strong>{bidLabel(meta)}</strong>
                                    </div>
                                    <div>
                                        <span>Next Bid</span>
                                        <strong>{formatMoney(meta.minNextBid)}</strong>
                                    </div>
                                </div>
                                <div className="auction-room-actions">
                                    <Link className="secondary-button" to={`/listings/${auction.listingId}`}>
                                        Listing
                                    </Link>
                                    <Link className="primary-button" to={`/active-auctions/${auction.id}`}>
                                        Enter Room
                                    </Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <section className="panel center-content">
                    <span className="material-symbols-outlined section-title-icon" aria-hidden="true">event_busy</span>
                    <h2>No active auctions yet</h2>
                    <p className="text-muted">The marketplace can still have listings before a seller opens auction rooms for them.</p>
                    <Link className="primary-button" to="/">
                        See Listings
                    </Link>
                </section>
            )}
        </div>
    );
};

export default BuyerAuctionsPage;
