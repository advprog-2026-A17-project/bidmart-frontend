import React, { useCallback, useEffect, useState } from 'react';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';

type ListingRecord = {
    id: string;
    title?: string;
    status?: string;
    sellerId?: string;
};

const AdminListingsPage: React.FC = () => {
    const authenticatedFetch = useAuthenticatedFetch();
    const [listings, setListings] = useState<ListingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const loadListings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/catalogue/listings'));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load listings'));
            }
            const payload = await response.json() as ListingRecord[];
            setListings(Array.isArray(payload) ? payload : []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to load listings.');
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    useEffect(() => {
        void loadListings();
    }, [loadListings]);

    const disableListing = async (listingId: string) => {
        setNotice(null);
        setError(null);
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/catalogue/listings/${encodeURIComponent(listingId)}/admin/close`),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'Disabled by administrator' }),
                },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to disable listing'));
            }
            setNotice(`Listing ${listingId} disabled.`);
            await loadListings();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to disable listing.');
        }
    };

    return (
        <div className="section-stack">
            <section className="page-head studio-head">
                <h1>Listings</h1>
                <p className="text-muted">Review marketplace listings and disable policy violations.</p>
            </section>
            {error && <div className="toast-error">{error}</div>}
            {notice && <div className="toast-success">{notice}</div>}
            {loading ? (
                <div className="loading-state">Loading listings...</div>
            ) : (
                <div className="management-list">
                    {listings.map((listing) => (
                        <article key={listing.id} className="management-card">
                            <div>
                                <h3>{listing.title || listing.id}</h3>
                                <p className="text-muted">Seller {listing.sellerId} · Status {listing.status}</p>
                            </div>
                            {listing.status !== 'CANCELLED' && (
                                <button
                                    type="button"
                                    className="danger-button"
                                    onClick={() => void disableListing(listing.id)}
                                >
                                    Disable listing
                                </button>
                            )}
                        </article>
                    ))}
                    {listings.length === 0 && <p className="text-muted">No listings found.</p>}
                </div>
            )}
        </div>
    );
};

export default AdminListingsPage;
