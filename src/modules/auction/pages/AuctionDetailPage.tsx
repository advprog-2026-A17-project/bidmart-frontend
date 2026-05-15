import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { useAuctionRealtime } from '../hooks/useAuctionRealtime';
import { buildAuctionCardMeta, type Auction } from '../utils/auction-card-meta';
import { parseAuctionsResponse } from '../utils/parse-auctions-response';
import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';

const CLOSED_STATUSES = new Set(['CLOSED', 'WON', 'UNSOLD']);

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown error';
};

const safeAuctionPath = (auctionId: string, suffix: string): string =>
    `/api/v1/auctions/${encodeURIComponent(auctionId)}${suffix}`;

const bidButtonLabel = (isClosed: boolean, isSignedIn: boolean): string => {
    if (isClosed) {
        return 'Closed';
    }
    return isSignedIn ? 'Place Bid' : 'Sign in to Bid';
};

const detailTitle = (id?: string): string =>
    id ? 'Auction Room' : 'Active Auctions';

const openAuctionCount = (auctions: Auction[]): number =>
    auctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)).length;

const formatMoney = (value: number): string =>
    `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const hasReachedEndTime = (auction: Auction): boolean =>
    new Date(auction.endTime).getTime() <= Date.now();

const AuctionSkeleton = () => (
    <div className="auction-layout skeleton-grid" aria-busy="true" aria-label="Loading auctions">
        <section className="panel section-stack skeleton-card">
            <div className="auction-image-main skeleton-block" />
            <div className="auction-thumbs">
                <span className="skeleton-thumb" />
                <span className="skeleton-thumb" />
                <span className="skeleton-thumb" />
            </div>
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line-medium" />
            <span className="skeleton-line skeleton-line-short" />
        </section>
        <aside className="panel section-stack skeleton-card">
            <span className="skeleton-line skeleton-line-medium" />
            <span className="skeleton-line skeleton-line-large" />
            <span className="skeleton-line" />
            <span className="skeleton-button" />
            <span className="skeleton-button" />
        </aside>
    </div>
);

const AuctionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [bidInputs, setBidInputs] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState<boolean>(true);

    const fetchAuctions = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(apiUrl('/api/v1/auctions'));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responsePayload: unknown = await response.json();
            let data: Auction[] = parseAuctionsResponse(responsePayload);

            if (id) {
                data = data.filter(auction => auction.id === id || auction.listingId === id);
            }

            setAuctions(data);

            const initialInputs: { [key: string]: number } = {};
            data.forEach(auction => {
                const currentHighest = auction.currentHighestBid !== null ? auction.currentHighestBid : auction.startingPrice;
                initialInputs[auction.id] = currentHighest + auction.minimumIncrement;
            });

            setBidInputs(prev => ({ ...initialInputs, ...prev }));
        } catch (err: unknown) {
            console.error('Fetch execution failed:', err);
            setError(`Failed to load auctions: ${getErrorMessage(err)}`);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAuctions();
    }, [fetchAuctions]);

    const realtimeDestinations = useMemo(
        () => id ? ['/topic/auctions', `/topic/auctions/${id}`] : ['/topic/auctions'],
        [id]
    );
    const handleRealtimeEvent = useCallback(() => {
        void fetchAuctions();
    }, [fetchAuctions]);
    const { isConnected } = useAuctionRealtime(realtimeDestinations, handleRealtimeEvent);

    const handleBidChange = (auctionId: string, value: string) => {
        setBidInputs(prev => ({ ...prev, [auctionId]: parseFloat(value) }));
    };

    const placeBid = async (auctionId: string) => {
        const amount = bidInputs[auctionId];
        if (!amount) return;
        if (!user) {
            setError('Please sign in before placing a bid.');
            return;
        }

        const payload = {
            bidderId: user.id,
            bidAmount: amount
        };

        try {
            const response = await authenticatedFetch(apiUrl(safeAuctionPath(auctionId, '/bids')), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(await readApiError(response, 'Bid placement failed'));
            }

            setError(null);

            await fetchAuctions();
        } catch (err: unknown) {
            console.error('Bidding failed:', err);
            setError(`Transaction Failed: ${getErrorMessage(err)}`);
        }
    };

    const closeAuction = async (auctionId: string) => {
        try {
            const response = await authenticatedFetch(apiUrl(safeAuctionPath(auctionId, '/close')), {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Auction close failed'));
            }
            await fetchAuctions();
        } catch (err: unknown) {
            setError(`Close failed: ${getErrorMessage(err)}`);
        }
    };

    const selectedAuction = auctions[0];
    const selectedMeta = selectedAuction ? buildAuctionCardMeta(selectedAuction) : null;
    const thumbnailSeeds = selectedAuction
        ? [selectedAuction.id, `${selectedAuction.id}-2`, `${selectedAuction.id}-3`]
        : [];

    let content: React.ReactNode;
    if (loading) {
        content = <AuctionSkeleton />;
    } else if (!selectedAuction || !selectedMeta) {
        content = <div className="empty-state">No matching auction found.</div>;
    } else {
        const quickBidOptions = [1, 2, 5].map((multiplier) => {
            const amount = selectedMeta.currentHighest + selectedAuction.minimumIncrement * multiplier;
            return {
                increment: selectedAuction.minimumIncrement * multiplier,
                amount,
            };
        });
        const liveHistoryRows = auctions.slice(0, 5);
        const isSeller = user?.id === selectedAuction.sellerId;
        const canSettleAuction = isSeller && hasReachedEndTime(selectedAuction) && !selectedMeta.isClosed;

        content = (
            <div className="auction-command-grid">
                <section className="auction-asset-panel">
                    <div className="auction-image-main">
                        <img
                            src={`https://picsum.photos/seed/${selectedAuction.id}/960/720`}
                            alt={`Listing ${selectedAuction.listingId}`}
                        />
                        <div className="auction-image-badges">
                            <span className={`status-badge status-${selectedAuction.status}`}>{selectedMeta.statusLabel}</span>
                            <span className="category-badge">
                                <span className="material-symbols-outlined" aria-hidden="true">verified</span>
                                Inspected
                            </span>
                        </div>
                    </div>
                    <div className="auction-thumbs">
                        {thumbnailSeeds.map((seed) => (
                            <img key={seed} src={`https://picsum.photos/seed/${seed}/240/180`} alt="Auction" />
                        ))}
                    </div>
                    <div className="auction-detail-copy">
                        <p className="eyebrow">Lot #{selectedAuction.listingId}</p>
                        <h2>Institutional Auction Asset</h2>
                        <p className="text-muted">Auction ID: {selectedAuction.id}</p>
                        <div className="auction-spec-grid">
                            <div>
                                <span>Start Price</span>
                                <strong>{formatMoney(selectedAuction.startingPrice)}</strong>
                            </div>
                            <div>
                                <span>Reserve</span>
                                <strong>{formatMoney(selectedAuction.reservePrice)}</strong>
                            </div>
                            <div>
                                <span>Increment</span>
                                <strong>{formatMoney(selectedAuction.minimumIncrement)}</strong>
                            </div>
                            <div>
                                <span>Ends</span>
                                <strong>{new Date(selectedAuction.endTime).toLocaleDateString()}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="auction-side-stack">
                    <aside className="bid-console">
                        <div className={`bid-console-status ${selectedMeta.isClosed ? 'bid-console-status-closed' : ''}`}>
                            <span className="material-symbols-outlined" aria-hidden="true">
                                {selectedMeta.isClosed ? 'lock' : 'check_circle'}
                            </span>
                            {selectedMeta.isClosed ? 'Auction Closed' : 'Live Bidding Open'}
                        </div>
                        <div className="bid-console-body">
                            <div className="bid-console-top">
                                <div>
                                    <span className="metric-label">Ending In</span>
                                    <strong className={`auction-time-left ${selectedMeta.isClosed ? 'auction-time-left-closed' : ''}`}>
                                        {selectedMeta.timeLeftLabel}
                                    </strong>
                                </div>
                                <div>
                                    <span className="metric-label">Status</span>
                                    <strong>{selectedMeta.statusLabel}</strong>
                                </div>
                            </div>
                            <div className="current-bid-block">
                                <span>Current Bid</span>
                                <strong>{formatMoney(selectedMeta.currentHighest)}</strong>
                                <small>Minimum next bid: {formatMoney(selectedMeta.minNextBid)}</small>
                            </div>
                            <label className="field">
                                <span>Your amount</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={bidInputs[selectedAuction.id] || selectedMeta.minNextBid}
                                    step={selectedAuction.minimumIncrement}
                                    min={selectedMeta.minNextBid}
                                    disabled={selectedMeta.isClosed}
                                    onChange={(e) => handleBidChange(selectedAuction.id, e.target.value)}
                                />
                            </label>
                            <button
                                className="primary-button"
                                onClick={() => placeBid(selectedAuction.id)}
                                disabled={selectedMeta.isClosed || !user}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                                {bidButtonLabel(selectedMeta.isClosed, Boolean(user))}
                            </button>
                            <div className="quick-bid-grid">
                                {quickBidOptions.map((option) => (
                                    <button
                                        key={option.amount}
                                        type="button"
                                        className="quick-bid-button"
                                        disabled={selectedMeta.isClosed}
                                        onClick={() => handleBidChange(selectedAuction.id, String(option.amount))}
                                    >
                                        <span>+ {formatMoney(option.increment)}</span>
                                        <strong>{formatMoney(option.amount)}</strong>
                                    </button>
                                ))}
                            </div>
                            {isSeller && (
                                <div className="seller-settlement-box">
                                    <p className="text-muted">
                                        Settlement is available to the seller after the auction reaches its end time.
                                    </p>
                                    <button
                                        className="secondary-button"
                                        onClick={() => closeAuction(selectedAuction.id)}
                                        disabled={!canSettleAuction}
                                    >
                                        <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                        Settle Auction
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>

                    <section className="auction-history-panel">
                        <div className="section-title-row">
                            <div>
                                <p className="eyebrow">Live Desk</p>
                                <h2>Auction Watchlist</h2>
                            </div>
                            <span className="live-dot" aria-hidden="true" />
                        </div>
                        <div className="auction-history-list">
                            {liveHistoryRows.map((auction) => {
                                const meta = buildAuctionCardMeta(auction);
                                return (
                                    <div key={auction.id} className="auction-history-row">
                                        <div>
                                            <strong>Lot #{auction.listingId}</strong>
                                            <span>{meta.timeLeftLabel}</span>
                                        </div>
                                        <strong>{formatMoney(meta.currentHighest)}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <section className="page-head">
                <BackButton fallback="/active-auctions" />
                <p className="eyebrow">Buyer Auction Room</p>
                <h1>{detailTitle(id)}</h1>
                <p>
                    Total: {auctions.length} • Open: {openAuctionCount(auctions)} • {isConnected ? 'Live updates connected' : 'Realtime offline'}
                </p>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {content}
        </div>
    );
};

export default AuctionDetailPage;
