import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../../config/api';
import { CATALOGUE_LISTINGS_SEARCH_PATH } from '../api/endpoints';
import { Link } from 'react-router-dom';

interface CatalogueItem {
    id: number | string;
    title: string;
    description: string;
    startingPrice: number;
    currentPrice: number;
    imageUrl: string | null;
    category?: string;
    status: string;
    endTime: string;
    hasBids: boolean;
}

interface SearchParams {
    keyword: string;
    minPrice: string;
    maxPrice: string;
}

const CataloguePage: React.FC = () => {
    const [items, setItems] = useState<CatalogueItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useState<SearchParams>({
        keyword: '',
        minPrice: '',
        maxPrice: '',
    });
    const [appliedParams, setAppliedParams] = useState<SearchParams>({
        keyword: '',
        minPrice: '',
        maxPrice: '',
    });
    const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');

    const parseCatalogueItems = (payload: unknown): CatalogueItem[] => {
        if (Array.isArray(payload)) {
            return payload as CatalogueItem[];
        }
        if (payload && typeof payload === 'object' && Array.isArray((payload as { content?: unknown }).content)) {
            return (payload as { content: CatalogueItem[] }).content;
        }
        return [];
    };

    const fetchItems = useCallback(async (params: SearchParams) => {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams();
        if (params.keyword) query.append('keyword', params.keyword);
        if (params.minPrice) query.append('minPrice', params.minPrice);
        if (params.maxPrice) query.append('maxPrice', params.maxPrice);

        const url = apiUrl(`${CATALOGUE_LISTINGS_SEARCH_PATH}${query.toString() ? '?' + query.toString() : ''}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                setError(`HTTP error! status: ${response.status}`);
                return;
            }
            const data: unknown = await response.json();
            setItems(parseCatalogueItems(data));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Fetch failed:', message);
            setError('Failed to connect to Catalogue Service via API Gateway.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems(appliedParams);
    }, [appliedParams, fetchItems]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setAppliedParams({ ...searchParams });
    };

    const handleReset = () => {
        const empty: SearchParams = { keyword: '', minPrice: '', maxPrice: '' };
        setSearchParams(empty);
        setAppliedParams(empty);
    };

    const renderTimeLeft = (endTime: string) => {
        const diff = new Date(endTime).getTime() - Date.now();
        if (diff <= 0) return 'Ended';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${mins}m left`;
        return `${mins}m left`;
    };

    const buildFallbackImage = (itemId: CatalogueItem['id']) =>
        `https://picsum.photos/seed/${encodeURIComponent(String(itemId))}/640/480`;

    const resolveImageSrc = (item: CatalogueItem) => {
        const url = item.imageUrl?.trim();
        return url ? url : buildFallbackImage(item.id);
    };

    const handleImageError = (
        event: React.SyntheticEvent<HTMLImageElement>,
        itemId: CatalogueItem['id']
    ) => {
        const target = event.currentTarget;
        target.onerror = null;
        target.src = buildFallbackImage(itemId);
    };

    const visibleItems = [...items].sort((a, b) => {
        if (sortBy === 'price-asc') return a.currentPrice - b.currentPrice;
        if (sortBy === 'price-desc') return b.currentPrice - a.currentPrice;
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    });

    const catalogueSkeleton = (
        <ul className="catalog-grid skeleton-grid" aria-busy="true" aria-label="Loading listings">
            {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="catalog-card skeleton-card">
                    <div className="catalog-image skeleton-block" />
                    <div className="catalog-meta">
                        <span className="skeleton-line skeleton-line-short" />
                        <span className="skeleton-line" />
                        <span className="skeleton-line skeleton-line-medium" />
                    </div>
                    <div className="catalog-pricing">
                        <span className="skeleton-line skeleton-line-medium" />
                        <span className="skeleton-button" />
                    </div>
                </li>
            ))}
        </ul>
    );

    return (
        <div className="page-wrap">
            <section className="hero">
                <p className="hero-badge">Real-time Bidding</p>
                <h1>Explore Auctions</h1>
                <p>Discover active listings from every category and place bids before time runs out.</p>
            </section>

            <div className="panel">
                <form className="search-form" onSubmit={handleSearch}>
                    <label>
                        Search
                        <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. iPhone, gaming console"
                            value={searchParams.keyword}
                            onChange={(e) => setSearchParams((p) => ({ ...p, keyword: e.target.value }))}
                        />
                    </label>
                    <label>
                        Min Price
                        <input
                            className="form-input"
                            type="number"
                            placeholder="0"
                            value={searchParams.minPrice}
                            min={0}
                            onChange={(e) => setSearchParams((p) => ({ ...p, minPrice: e.target.value }))}
                        />
                    </label>
                    <label>
                        Max Price
                        <input
                            className="form-input"
                            type="number"
                            placeholder="100000"
                            value={searchParams.maxPrice}
                            min={0}
                            onChange={(e) => setSearchParams((p) => ({ ...p, maxPrice: e.target.value }))}
                        />
                    </label>
                    <label>
                        Sort
                        <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'price-asc' | 'price-desc')}>
                            <option value="recent">Ending Soon</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                        </select>
                    </label>
                    <button className="primary-button" type="submit">Apply</button>
                    <button className="secondary-button" type="button" onClick={handleReset}>Reset</button>
                </form>
            </div>

            {error && <div className="toast-error">{error}</div>}

            {loading ? (
                catalogueSkeleton
            ) : (
                <ul className="catalog-grid">
                    {visibleItems.length > 0 ? (
                        visibleItems.map((item) => (
                            <li key={item.id} className="catalog-card">
                                <img
                                    src={resolveImageSrc(item)}
                                    alt={item.title}
                                    className="catalog-image"
                                    loading="lazy"
                                    onError={(event) => handleImageError(event, item.id)}
                                />
                                <div className="catalog-meta">
                                    <div className="catalog-top-row">
                                        {item.category && <span className="category-badge">{item.category}</span>}
                                        <span className={`status-badge status-${item.status}`}>{item.status}</span>
                                    </div>
                                    <strong>{item.title}</strong>
                                    <small className="text-muted">{item.description || 'No description provided.'}</small>
                                    <small className="text-muted">{renderTimeLeft(item.endTime)}</small>
                                </div>
                                <div className="catalog-pricing">
                                    <div>
                                        <span className="text-muted catalog-starting-price">Starting: ${item.startingPrice?.toFixed(2)}</span>
                                        <span className="price">${item.currentPrice?.toFixed(2)}</span>
                                    </div>
                                    <Link to={`/auctions/${item.id}`} className="primary-button card-cta">
                                        View Auction
                                    </Link>
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="empty-state catalog-empty-state">No items found matching your search criteria.</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default CataloguePage;
