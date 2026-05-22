import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import PageToast from '../../../components/PageToast';
import AppIcon from '../../../components/AppIcon';

type ListingRecord = {
    id: string;
    title?: string;
    status?: string;
    sellerId?: string;
    category?: string | null;
    startingPrice?: number | null;
    currentPrice?: number | null;
    endTime?: string | null;
};

type AdminListingFilters = {
    keyword: string;
    category: string;
    status: string;
    minPrice: string;
    maxPrice: string;
    endBefore: string;
    sortBy: 'recent' | 'price-asc' | 'price-desc';
};

const EMPTY_FILTERS: AdminListingFilters = {
    keyword: '',
    category: '',
    status: '',
    minPrice: '',
    maxPrice: '',
    endBefore: '',
    sortBy: 'recent',
};

const listingPrice = (listing: ListingRecord): number =>
    Number(listing.currentPrice ?? listing.startingPrice ?? 0);

const AdminListingsPage: React.FC = () => {
    const authenticatedFetch = useAuthenticatedFetch();
    const [listings, setListings] = useState<ListingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [filters, setFilters] = useState<AdminListingFilters>(EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<AdminListingFilters>(EMPTY_FILTERS);

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

    const categories = useMemo(() => (
        Array.from(new Set(listings.map((listing) => listing.category).filter(Boolean) as string[])).sort()
    ), [listings]);

    const statuses = useMemo(() => (
        Array.from(new Set(listings.map((listing) => listing.status).filter(Boolean) as string[])).sort()
    ), [listings]);

    const filteredListings = useMemo(() => {
        const keyword = appliedFilters.keyword.trim().toLowerCase();
        const category = appliedFilters.category.trim().toLowerCase();
        const status = appliedFilters.status.trim().toLowerCase();
        const minPrice = appliedFilters.minPrice ? Number(appliedFilters.minPrice) : null;
        const maxPrice = appliedFilters.maxPrice ? Number(appliedFilters.maxPrice) : null;
        const endBefore = appliedFilters.endBefore ? new Date(appliedFilters.endBefore).getTime() : null;

        const filtered = listings.filter((listing) => {
            const title = (listing.title ?? listing.id).toLowerCase();
            const seller = (listing.sellerId ?? '').toLowerCase();
            const listingCategory = (listing.category ?? '').toLowerCase();
            const listingStatus = (listing.status ?? '').toLowerCase();
            const price = listingPrice(listing);
            const endMs = listing.endTime ? new Date(listing.endTime).getTime() : null;

            if (keyword && !title.includes(keyword) && !seller.includes(keyword) && !String(listing.id).toLowerCase().includes(keyword)) {
                return false;
            }
            if (category && listingCategory !== category) {
                return false;
            }
            if (status && listingStatus !== status) {
                return false;
            }
            if (minPrice != null && price < minPrice) {
                return false;
            }
            if (maxPrice != null && price > maxPrice) {
                return false;
            }
            if (endBefore != null && Number.isFinite(endBefore) && (!endMs || endMs > endBefore)) {
                return false;
            }
            return true;
        });

        return filtered.sort((a, b) => {
            if (appliedFilters.sortBy === 'price-asc') {
                return listingPrice(a) - listingPrice(b);
            }
            if (appliedFilters.sortBy === 'price-desc') {
                return listingPrice(b) - listingPrice(a);
            }
            return String(b.endTime ?? '').localeCompare(String(a.endTime ?? ''));
        });
    }, [appliedFilters, listings]);

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

    const applyFilters = (event: React.FormEvent) => {
        event.preventDefault();
        const minPrice = filters.minPrice.trim();
        const maxPrice = filters.maxPrice.trim();
        if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
            setError('Min price must be less than or equal to max price.');
            return;
        }
        setError(null);
        setAppliedFilters({ ...filters, keyword: filters.keyword.trim(), minPrice, maxPrice });
    };

    const resetFilters = () => {
        setFilters(EMPTY_FILTERS);
        setAppliedFilters(EMPTY_FILTERS);
        setError(null);
    };

    return (
        <div className="section-stack">
            <section className="page-head studio-head">
                <h1>Listings</h1>
                <p className="text-muted">Review marketplace listings and disable policy violations.</p>
            </section>
            <PageToast error={error} success={notice} />
            <form className="panel admin-listing-filters" onSubmit={applyFilters}>
                <label className="field">
                    <span>Search</span>
                    <input
                        className="form-input"
                        value={filters.keyword}
                        onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                        placeholder="Title, listing id, seller"
                    />
                </label>
                <label className="field">
                    <span>Category</span>
                    <select
                        className="form-input"
                        value={filters.category}
                        onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                    >
                        <option value="">All categories</option>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </label>
                <label className="field">
                    <span>Status</span>
                    <select
                        className="form-input"
                        value={filters.status}
                        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                    >
                        <option value="">All statuses</option>
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                </label>
                <label className="field">
                    <span>Min price</span>
                    <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={filters.minPrice}
                        onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))}
                    />
                </label>
                <label className="field">
                    <span>Max price</span>
                    <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={filters.maxPrice}
                        onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))}
                    />
                </label>
                <label className="field">
                    <span>Ending before</span>
                    <input
                        className="form-input"
                        type="datetime-local"
                        value={filters.endBefore}
                        onChange={(event) => setFilters((current) => ({ ...current, endBefore: event.target.value }))}
                    />
                </label>
                <label className="field">
                    <span>Sort</span>
                    <select
                        className="form-input"
                        value={filters.sortBy}
                        onChange={(event) => setFilters((current) => ({
                            ...current,
                            sortBy: event.target.value as AdminListingFilters['sortBy'],
                        }))}
                    >
                        <option value="recent">Most recent</option>
                        <option value="price-asc">Price low to high</option>
                        <option value="price-desc">Price high to low</option>
                    </select>
                </label>
                <div className="admin-listing-filter-actions">
                    <button type="submit" className="primary-button">
                        <AppIcon name="filter" />
                        Apply
                    </button>
                    <button type="button" className="secondary-button" onClick={resetFilters}>
                        <AppIcon name="refresh" />
                        Reset
                    </button>
                </div>
            </form>
            {loading ? (
                <div className="loading-state">Loading listings...</div>
            ) : (
                <div className="management-list">
                    {filteredListings.map((listing) => (
                        <article key={listing.id} className="management-card">
                            <div>
                                <h3>{listing.title || listing.id}</h3>
                                <p className="text-muted">Seller {listing.sellerId} · Status {listing.status}</p>
                                <div className="admin-listing-meta">
                                    <span>{listing.category || 'Uncategorized'}</span>
                                    <span>{listingPrice(listing).toLocaleString('id-ID')}</span>
                                    <span>{listing.endTime ? new Date(listing.endTime).toLocaleString() : 'No end time'}</span>
                                </div>
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
                    {filteredListings.length === 0 && <p className="text-muted">No listings found.</p>}
                </div>
            )}
        </div>
    );
};

export default AdminListingsPage;
