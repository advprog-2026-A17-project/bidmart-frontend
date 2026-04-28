import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../../config/api';
import { CATALOGUE_LISTINGS_SEARCH_PATH } from '../api/endpoints';
import { Link } from 'react-router-dom';

interface CatalogueItem {
    id: number;
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

    const fetchItems = async (params: SearchParams) => {
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
            const data: CatalogueItem[] = await response.json();
            setItems(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Fetch failed:', message);
            setError('Failed to connect to Catalogue Service via API Gateway.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems(appliedParams);
    }, [appliedParams]);

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

    const visibleItems = [...items].sort((a, b) => {
        if (sortBy === 'price-asc') return a.currentPrice - b.currentPrice;
        if (sortBy === 'price-desc') return b.currentPrice - a.currentPrice;
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    });

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
                <div className="loading-state">Loading catalogue from API Gateway...</div>
            ) : (
                <ul className="catalog-grid">
                    {visibleItems.length > 0 ? (
                        visibleItems.map((item) => (
                            <li key={item.id} className="catalog-card">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.title} className="catalog-image" />
                                ) : (
                                    <div className="catalog-image catalog-image-fallback">No Image</div>
                                )}
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
                        <li className="empty-state">No items found matching your search criteria.</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default CataloguePage;
