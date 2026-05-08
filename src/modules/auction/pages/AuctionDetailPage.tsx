import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { buildAuctionCardMeta, type Auction } from '../utils/auction-card-meta';
import { parseAuctionsResponse } from '../utils/parse-auctions-response';
import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { CATALOGUE_LISTINGS_BASE_PATH } from '../../catalogue/api/endpoints';

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

const AuctionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [bidInputs, setBidInputs] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [listingDetails, setListingDetails] = useState<any>(null);
    const [listingLoading, setListingLoading] = useState<boolean>(true);

    // Fetch listing details directly from catalogue service
    useEffect(() => {
        const fetchListing = async () => {
            if (!id || id === 'demo') {
                setListingLoading(false);
                return;
            }
            try {
                const res = await authenticatedFetch(apiUrl(`${CATALOGUE_LISTINGS_BASE_PATH}/${id}`));
                if (res.ok) {
                    const data = await res.json();
                    setListingDetails(data);
                }
            } catch (err) {
                console.warn('Could not fetch listing details:', err);
            } finally {
                setListingLoading(false);
            }
        };
        fetchListing();
    }, [id, authenticatedFetch]);

    const fetchAuctions = useCallback(async () => {
        try {
            setError(null);
            const response = await authenticatedFetch(apiUrl('/api/v1/auctions'));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responsePayload: unknown = await response.json();
            let data: Auction[] = parseAuctionsResponse(responsePayload);

            if (id && id !== 'demo') {
                data = data.filter(auction => auction.listingId === id || auction.id === id);
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
    }, [authenticatedFetch, id]);

    useEffect(() => {
        fetchAuctions();
        const interval = globalThis.setInterval(fetchAuctions, 10_000);
        return () => globalThis.clearInterval(interval);
    }, [fetchAuctions]);

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

    const formatPrice = (price: any) => {
        if (price === null || price === undefined) return '-';
        const num = typeof price === 'string' ? parseFloat(price) : price;
        if (isNaN(num)) return '-';
        return `$${num.toFixed(2)}`;
    };

    const isLoading = loading || listingLoading;
    const selectedAuction = auctions[0];
    const selectedMeta = selectedAuction ? buildAuctionCardMeta(selectedAuction) : null;
    const hasAuction = Boolean(selectedAuction && selectedMeta);
    const isDemoOrList = !id || id === 'demo';

    // Determine page title
    const pageTitle = isDemoOrList
        ? 'Live Auctions Dashboard'
        : listingDetails?.title
            ? listingDetails.title
            : 'Listing Detail';

    let content: React.ReactNode;
    if (isLoading) {
        content = <div className="loading-state">Loading details...</div>;
    } else if (isDemoOrList && auctions.length === 0) {
        content = <div className="empty-state">No active auctions found.</div>;
    } else if (!isDemoOrList && !listingDetails && !hasAuction) {
        content = <div className="empty-state">Listing not found.</div>;
    } else {
        content = (
            <div className="auction-layout">
                <section className="panel">
                    {/* Listing Image */}
                    <div className="auction-image-main">
                        {listingDetails?.imageUrl ? (
                            <img
                                src={listingDetails.imageUrl}
                                alt={listingDetails.title || 'Listing'}
                                style={{width: '100%', maxHeight: '500px', objectFit: 'cover', borderRadius: '8px'}}
                            />
                        ) : (
                            <div className="catalog-image catalog-image-fallback" style={{height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'}}>No Image Available</div>
                        )}
                    </div>

                    {/* Listing Title */}
                    <h2 style={{marginTop: '16px'}}>{listingDetails?.title || (selectedAuction ? `Auction #${selectedAuction.id.slice(0, 8)}` : 'Listing Detail')}</h2>

                    {/* Description */}
                    {listingDetails?.description && (
                        <p style={{marginTop: '8px', lineHeight: '1.6', color: 'var(--text-secondary, #aaa)'}}>{listingDetails.description}</p>
                    )}

                    {/* Badges row: Category, Condition, Status */}
                    <div className="catalog-top-row" style={{marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        {listingDetails?.category && (
                            <span className="category-badge">{listingDetails.category}</span>
                        )}
                        {listingDetails?.condition && (
                            <span className="status-badge status-ACTIVE" style={{textTransform: 'capitalize'}}>{listingDetails.condition}</span>
                        )}
                        {listingDetails?.status && (
                            <span className={`status-badge status-${listingDetails.status}`}>{listingDetails.status}</span>
                        )}
                        {selectedAuction && selectedMeta && (
                            <span className={`auction-time-left ${selectedMeta.isClosed ? 'auction-time-left-closed' : ''}`}>
                                {selectedMeta.timeLeftLabel}
                            </span>
                        )}
                    </div>

                    {/* Category ID */}
                    {listingDetails?.categoryEntity?.id && (
                        <p className="text-muted" style={{marginTop: '8px'}}>Category ID: {listingDetails.categoryEntity.id}</p>
                    )}

                    {/* Price Info */}
                    <div style={{marginTop: '12px'}}>
                        {listingDetails?.startingPrice != null && (
                            <p className="text-muted">Starting Price: {formatPrice(listingDetails.startingPrice)}</p>
                        )}
                        {listingDetails?.currentPrice != null && (
                            <p className="text-muted">Current Price: {formatPrice(listingDetails.currentPrice)}</p>
                        )}
                    </div>

                    {/* Auction-specific info */}
                    {selectedAuction && (
                        <div style={{marginTop: '8px'}}>
                            <p className="text-muted">Auction ID: {selectedAuction.id}</p>
                            <p className="text-muted">
                                Min increment: {formatPrice(selectedAuction.minimumIncrement)} • Ends: {new Date(selectedAuction.endTime).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* No auction notice */}
                    {!hasAuction && listingDetails && (
                        <div className="summary-box" style={{marginTop: '16px', padding: '16px', borderRadius: '8px'}}>
                            <p>This listing does not have an active auction yet.</p>
                        </div>
                    )}
                </section>

                {/* Bidding panel - only show if auction exists */}
                {hasAuction && selectedAuction && selectedMeta && (
                    <aside className="panel section-stack">
                        <h3>Place Your Bid</h3>
                        <div className="auction-price">{formatPrice(selectedMeta.currentHighest)}</div>
                        <small className="text-muted">Current highest bid</small>
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
                            {bidButtonLabel(selectedMeta.isClosed, Boolean(user))}
                        </button>
                        <button
                            className="secondary-button"
                            onClick={() => closeAuction(selectedAuction.id)}
                            disabled={!user || !selectedMeta.isClosed}
                        >
                            Close Auction
                        </button>
                    </aside>
                )}
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>{pageTitle}</h1>
                {isDemoOrList && (
                    <p>
                        Total: {auctions.length} • Open: {auctions.filter(a => !CLOSED_STATUSES.has(a.status)).length}
                    </p>
                )}
            </section>

            {error && <div className="toast-error">{error}</div>}
            {content}
        </div>
    );
};

export default AuctionDetailPage;
