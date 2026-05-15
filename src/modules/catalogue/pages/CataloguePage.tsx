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

    const formatMoney = (value: number | undefined) =>
        `$${(value ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

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
    const liveItems = items.filter((item) => item.status === 'ACTIVE' || item.status === 'AVAILABLE');
    const featuredItem = visibleItems[0];
    const hotLots = visibleItems.slice(1, 4);
    const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;

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
            <section className="market-hero">
                <div className="market-hero-copy">
                    <p className="eyebrow">Live Market</p>
                    <h1>Discover Auctions</h1>
                    <p>Track active lots, compare bids, and move quickly on listings before the closing window tightens.</p>
                    <div className="market-hero-actions">
                        <a href="#catalogue-results" className="primary-button">
                            <span className="material-symbols-outlined" aria-hidden="true">sensors</span>
                            View Live Lots
                        </a>
                        <Link to="/seller-studio" className="secondary-button">
                            <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                            Start Selling
                        </Link>
                    </div>
                </div>
                <div className="market-hero-panel" aria-label="Marketplace summary">
                    <div>
                        <span className="metric-label">Live Lots</span>
                        <strong>{loading ? '--' : liveItems.length}</strong>
                    </div>
                    <div>
                        <span className="metric-label">Categories</span>
                        <strong>{loading ? '--' : categoryCount}</strong>
                    </div>
                    <div>
                        <span className="metric-label">Ending Next</span>
                        <strong>{loading || !featuredItem ? '--' : renderTimeLeft(featuredItem.endTime)}</strong>
                    </div>
                </div>
            </section>

            <div className="panel toolbar-panel">
                <form className="search-form" onSubmit={handleSearch}>
                    <label className="field">
                        <span>Search</span>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Search lots, categories, asset IDs"
                            value={searchParams.keyword}
                            onChange={(e) => setSearchParams((p) => ({ ...p, keyword: e.target.value }))}
                        />
                    </label>
                    <label className="field">
                        <span>Min Price</span>
                        <input
                            className="form-input"
                            type="number"
                            placeholder="0"
                            value={searchParams.minPrice}
                            min={0}
                            onChange={(e) => setSearchParams((p) => ({ ...p, minPrice: e.target.value }))}
                        />
                    </label>
                    <label className="field">
                        <span>Max Price</span>
                        <input
                            className="form-input"
                            type="number"
                            placeholder="100000"
                            value={searchParams.maxPrice}
                            min={0}
                            onChange={(e) => setSearchParams((p) => ({ ...p, maxPrice: e.target.value }))}
                        />
                    </label>
                    <label className="field">
                        <span>Sort</span>
                        <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'price-asc' | 'price-desc')}>
                            <option value="recent">Ending Soon</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                        </select>
                    </label>
                    <button className="primary-button" type="submit">
                        <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                        Apply
                    </button>
                    <button className="secondary-button" type="button" onClick={handleReset}>
                        <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
                        Reset
                    </button>
                </form>
            </div>

            {error && <div className="toast-error">{error}</div>}

            {loading ? (
                catalogueSkeleton
            ) : (
                <>
                    {featuredItem && (
                        <section className="market-overview-grid" aria-label="Featured marketplace activity">
                            <Link to={`/listings/${featuredItem.id}`} className="hero-lot-card">
                                <img
                                    src={resolveImageSrc(featuredItem)}
                                    alt={featuredItem.title}
                                    loading="eager"
                                    onError={(event) => handleImageError(event, featuredItem.id)}
                                />
                                <div className="hero-lot-overlay" />
                                <div className="hero-lot-badges">
                                    <span className="hero-badge">Hero Lot</span>
                                    <span className="time-badge">
                                        <span className="material-symbols-outlined" aria-hidden="true">timer</span>
                                        {renderTimeLeft(featuredItem.endTime)}
                                    </span>
                                </div>
                                <div className="hero-lot-content">
                                    <div>
                                        <h2>{featuredItem.title}</h2>
                                        <p>{featuredItem.description || 'No description provided.'}</p>
                                    </div>
                                    <div className="hero-lot-price">
                                        <span>Current Bid</span>
                                        <strong>{formatMoney(featuredItem.currentPrice)}</strong>
                                    </div>
                                </div>
                            </Link>

                            <aside className="hot-lots-panel">
                                <div className="section-title-row">
                                    <div>
                                        <p className="eyebrow">Urgency</p>
                                        <h2>Hot Lots Ending</h2>
                                    </div>
                                    <span className="material-symbols-outlined section-title-icon" aria-hidden="true">local_fire_department</span>
                                </div>
                                <div className="hot-lots-list">
                                    {hotLots.length > 0 ? (
                                        hotLots.map((item) => (
                                            <Link key={item.id} to={`/listings/${item.id}`} className="hot-lot-card">
                                                <img
                                                    src={resolveImageSrc(item)}
                                                    alt={item.title}
                                                    loading="lazy"
                                                    onError={(event) => handleImageError(event, item.id)}
                                                />
                                                <div>
                                                    <span className="time-badge compact">
                                                        <span className="material-symbols-outlined" aria-hidden="true">timer</span>
                                                        {renderTimeLeft(item.endTime)}
                                                    </span>
                                                    <strong>{item.title}</strong>
                                                    <span className="text-muted">{formatMoney(item.currentPrice)}</span>
                                                </div>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="empty-state compact-empty">No urgent lots yet.</div>
                                    )}
                                </div>
                            </aside>
                        </section>
                    )}

                    <div className="section-title-row" id="catalogue-results">
                        <div>
                            <p className="eyebrow">Recent Action</p>
                            <h2>Available Lots</h2>
                        </div>
                        <span className="section-count">{visibleItems.length} results</span>
                    </div>

                    <ul className="catalog-grid">
                        {visibleItems.length > 0 ? (
                            visibleItems.map((item) => (
                                <li key={item.id} className="catalog-card">
                                    <div className="catalog-image-wrap">
                                        <img
                                            src={resolveImageSrc(item)}
                                            alt={item.title}
                                            className="catalog-image"
                                            loading="lazy"
                                            onError={(event) => handleImageError(event, item.id)}
                                        />
                                        <span className={`status-badge status-${item.status}`}>{item.status}</span>
                                    </div>
                                    <div className="catalog-meta">
                                        <div className="catalog-top-row">
                                            {item.category && <span className="category-badge">{item.category}</span>}
                                            {item.hasBids && <span className="activity-badge">Active Bids</span>}
                                        </div>
                                        <strong>{item.title}</strong>
                                        <small className="text-muted">{item.description || 'No description provided.'}</small>
                                    </div>
                                    <div className="catalog-pricing">
                                        <div>
                                            <span className="text-muted catalog-starting-price">Starting: {formatMoney(item.startingPrice)}</span>
                                            <span className="price">{formatMoney(item.currentPrice)}</span>
                                        </div>
                                        <div className="catalog-card-actions">
                                            <span className="time-badge compact">
                                                <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                                                {renderTimeLeft(item.endTime)}
                                            </span>
                                            <Link to={`/listings/${item.id}`} className="primary-button card-cta">
                                                <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                                                Details
                                            </Link>
                                        </div>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="empty-state catalog-empty-state">No items found matching your search criteria.</li>
                        )}
                    </ul>
                </>
            )}
        </div>
    );
};

export default CataloguePage;
