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

    const selectedAuction = auctions[0];
    const selectedMeta = selectedAuction ? buildAuctionCardMeta(selectedAuction) : null;
    const thumbnailSeeds = selectedAuction
        ? [selectedAuction.id, `${selectedAuction.id}-2`, `${selectedAuction.id}-3`]
        : [];

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>{id && id !== 'demo' ? 'Auction Detail' : 'Live Auctions Dashboard'}</h1>
                <p>
                    Total: {auctions.length} • Open:{' '}
                    {auctions.filter((auction) => !CLOSED_STATUSES.has(auction.status)).length}
                </p>
            </section>

            {error && <div className="toast-error">{error}</div>}

            {loading ? (
                <div className="loading-state">Fetching operational data from API Gateway...</div>
            ) : !selectedAuction || !selectedMeta ? (
                <div className="empty-state">No matching auctions found in the data persistence layer.</div>
            ) : (
                <div className="auction-layout">
                    <section className="panel">
                        <div className="auction-image-main">
                            <img
                                src={`https://picsum.photos/seed/${selectedAuction.id}/900/700`}
                                alt={`Listing ${selectedAuction.listingId}`}
                            />
                        </div>
                        <div className="auction-thumbs">
                            {thumbnailSeeds.map((seed) => (
                                <img key={seed} src={`https://picsum.photos/seed/${seed}/240/180`} alt="Auction" />
                            ))}
                        </div>
                        <h2>Listing #{selectedAuction.listingId}</h2>
                        <p className="text-muted">Auction ID: {selectedAuction.id}</p>
                        <div className="catalog-status-row">
                            <span className={`status-badge status-${selectedAuction.status}`}>{selectedMeta.statusLabel}</span>
                            <span className={`auction-time-left ${selectedMeta.isClosed ? 'auction-time-left-closed' : ''}`}>
                                {selectedMeta.timeLeftLabel}
                            </span>
                        </div>
                        <p className="text-muted">
                            Min increment: ${selectedAuction.minimumIncrement.toFixed(2)} • Ends:{' '}
                            {new Date(selectedAuction.endTime).toLocaleString()}
                        </p>
                    </section>

                    <aside className="panel section-stack">
                        <h3>Place Your Bid</h3>
                        <div className="auction-price">${selectedMeta.currentHighest.toFixed(2)}</div>
                        <small className="text-muted">Current highest bid</small>
                        <label className="field">
                            Your amount
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
                            disabled={selectedMeta.isClosed}
                        >
                            {selectedMeta.isClosed ? 'Closed' : 'Place Bid'}
                        </button>
                    </aside>
                </div>
            )}
        </div>
    );
};

export default AuctionDetailPage;
