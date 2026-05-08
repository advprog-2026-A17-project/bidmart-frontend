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

const detailTitle = (id?: string): string =>
    id && id !== 'demo' ? 'Auction Detail' : 'Live Auctions Dashboard';

const openAuctionCount = (auctions: Auction[]): number =>
    auctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)).length;

const AuctionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [bidInputs, setBidInputs] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [listingDetails, setListingDetails] = useState<any>(null);

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

            if (data.length > 0 && id && id !== 'demo') {
                try {
                    const listingId = data[0].listingId;
                    const listingRes = await authenticatedFetch(apiUrl(`${CATALOGUE_LISTINGS_BASE_PATH}/${listingId}`));
                    if (listingRes.ok) {
                        const listingData = await listingRes.json();
                        setListingDetails(listingData);
                    }
                } catch (listingErr) {
                    console.warn('Could not fetch listing details:', listingErr);
                }
            }

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

    const selectedAuction = auctions[0];
    const selectedMeta = selectedAuction ? buildAuctionCardMeta(selectedAuction) : null;
    const thumbnailSeeds = selectedAuction
        ? [selectedAuction.id, `${selectedAuction.id}-2`, `${selectedAuction.id}-3`]
        : [];

    let content: React.ReactNode;
    if (loading) {
        content = <div className="loading-state">Fetching operational data from API Gateway...</div>;
    } else if (!selectedAuction || !selectedMeta) {
        content = <div className="empty-state">No matching auctions found in the data persistence layer.</div>;
    } else {
        content = (
            <div className="auction-layout">
                <section className="panel">
                    <div className="auction-image-main">
                        {listingDetails?.imageUrl ? (
                            <img
                                src={listingDetails.imageUrl}
                                alt={listingDetails.title || `Listing ${selectedAuction.listingId}`}
                                style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', borderRadius: '8px' }}
                            />
                        ) : (
                            <img
                                src={`https://picsum.photos/seed/${selectedAuction.id}/900/700`}
                                alt={`Listing ${selectedAuction.listingId}`}
                            />
                        )}
                    </div>
                    <h2>{listingDetails?.title || `Listing #${selectedAuction.listingId}`}</h2>
                    {listingDetails?.description && (
                        <p style={{ marginTop: '8px', lineHeight: '1.6', color: 'var(--text-secondary, #aaa)' }}>{listingDetails.description}</p>
                    )}
                    {listingDetails?.category && (
                        <span className="category-badge" style={{ marginTop: '12px', display: 'inline-block' }}>{listingDetails.category}</span>
                    )}
                    <p className="text-muted" style={{ marginTop: '8px' }}>Auction ID: {selectedAuction.id}</p>
                    <div className="catalog-status-row">
                        <span className={`status-badge status-${selectedAuction.status}`}>{selectedMeta.statusLabel}</span>
                        <span className={`auction-time-left ${selectedMeta.isClosed ? 'auction-time-left-closed' : ''}`}>
                            {selectedMeta.timeLeftLabel}
                        </span>
                    </div>
                    <p className="text-muted">
                        Starting Price: ${selectedAuction.startingPrice.toFixed(2)} • Min increment: ${selectedAuction.minimumIncrement.toFixed(2)} • Ends:{' '}
                        {new Date(selectedAuction.endTime).toLocaleString()}
                    </p>
                </section>

                <aside className="panel section-stack">
                    <h3>Place Your Bid</h3>
                    <div className="auction-price">${selectedMeta.currentHighest.toFixed(2)}</div>
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
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>{detailTitle(id)}</h1>
                <p>
                    Total: {auctions.length} • Open: {openAuctionCount(auctions)}
                </p>
            </section>

            {error && <div className="toast-error">{error}</div>}
            {content}
        </div>
    );
};

export default AuctionDetailPage;
