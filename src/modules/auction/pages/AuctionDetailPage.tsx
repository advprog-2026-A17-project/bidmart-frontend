import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { buildAuctionCardMeta, type Auction } from '../utils/auction-card-meta';
import { apiUrl } from '../../../config/api';

const DUMMY_BIDDER_ID = "123e4567-e89b-12d3-a456-426614174000";
const CLOSED_STATUSES = new Set(['CLOSED', 'WON', 'UNSOLD']);

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown error';
};
const AuctionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
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

            let data: Auction[] = await response.json();

            if (id && id !== 'demo') {
                data = data.filter(auction => auction.id === id);
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
            setError('Failed to connect to backend API.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAuctions();
    }, [fetchAuctions]);

    const handleBidChange = (auctionId: string, value: string) => {
        setBidInputs(prev => ({ ...prev, [auctionId]: parseFloat(value) }));
    };

    const placeBid = async (auctionId: string) => {
        const amount = bidInputs[auctionId];
        if (!amount) return;

        const payload = {
            bidderId: DUMMY_BIDDER_ID,
            bidAmount: amount
        };

        try {
            const response = await fetch(apiUrl(`/api/v1/auctions/${auctionId}/bids`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Validation failed');
            }

            setError(null);

            await fetchAuctions();
        } catch (err: unknown) {
            console.error('Bidding failed:', err);
            setError(`Transaction Failed: ${getErrorMessage(err)}`);
        }
    };

    return (
        <div className="dashboard-container">
            <h1>{id && id !== 'demo' ? 'Auction Detail Room' : 'Live Auctions Dashboard'}</h1>
            <div className="auction-toolbar">
                <span>Total: {auctions.length}</span>
                <span>Open: {auctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)).length}</span>
            </div>

            {error && <div className="toast-error">{error}</div>}

            {loading ? (
                <div className="loading-state">Fetching operational data from API Gateway...</div>
            ) : (
                <ul className="auction-list">
                    {auctions.length > 0 ? (
                        auctions.map(auction => {
                            const cardMeta = buildAuctionCardMeta(auction);

                            return (
                                <li key={auction.id} className="auction-item">
                                    <div className="item-details">
                                        <strong>Listing ID: {auction.listingId}</strong>
                                        <small className="text-muted">Auction ID: {auction.id}</small>
                                        <div>
                                            <span className={`status-badge status-${auction.status}`}>
                                                {cardMeta.statusLabel}
                                            </span>
                                            <span className={`auction-time-left ${cardMeta.isClosed ? 'auction-time-left-closed' : ''}`}>
                                                {cardMeta.timeLeftLabel}
                                            </span>
                                        </div>
                                        <small className="text-muted">
                                            Min Increment: ${auction.minimumIncrement.toFixed(2)} | Ends: {new Date(auction.endTime).toLocaleString()}
                                        </small>
                                    </div>
                                    <div className="interaction-section">
                                        <span className="price">${cardMeta.currentHighest.toFixed(2)}</span>
                                        <input
                                            type="number"
                                            className="bid-input"
                                            value={bidInputs[auction.id] || cardMeta.minNextBid}
                                            step={auction.minimumIncrement}
                                            min={cardMeta.minNextBid}
                                            disabled={cardMeta.isClosed}
                                            onChange={(e) => handleBidChange(auction.id, e.target.value)}
                                        />
                                        <button
                                            className="bid-button"
                                            onClick={() => placeBid(auction.id)}
                                            disabled={cardMeta.isClosed}
                                        >
                                            {cardMeta.isClosed ? 'Closed' : 'Place Bid'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })
                    ) : (
                        <li className="empty-state">No matching auctions found in the data persistence layer.</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default AuctionDetailPage;
