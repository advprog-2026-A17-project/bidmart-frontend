import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../../config/api';
import { CATALOGUE_LISTINGS_SEARCH_PATH, CATALOGUE_LISTINGS_BASE_PATH } from '../api/endpoints';
import { Link } from 'react-router-dom';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { useAuth } from '../../../context/useAuth';

interface CatalogueItem {
    id: string;
    title: string;
    description: string;
    sellerId: string;
    startingPrice: number;
    currentPrice: number;
    imageUrl: string | null;
    category?: string;
    condition?: string;
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
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const isSeller = user?.roles?.some(r => r.name?.toUpperCase() === 'SELLER') ?? false;
    const isOwner = (sellerId: string) => isSeller && user?.id === sellerId;
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
            const response = await authenticatedFetch(url);
            if (!response.ok) {
                setError(`HTTP error! status: ${response.status}`);
                return;
            }
            const data = await response.json();
            setItems(data.content || data || []);
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

    const deleteListing = async (id: string) => {
        if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) return;
        try {
            const response = await authenticatedFetch(apiUrl(`${CATALOGUE_LISTINGS_BASE_PATH}/${id}`), {
                method: 'DELETE',
            });
            if (!response.ok) {
                const message = await response.text();
                setError(`Failed to delete listing: ${message}`);
                return;
            }
            setItems((prev) => prev.filter((item) => item.id !== id));
        } catch (err: unknown) {
            setError('Failed to connect to Catalogue Service for deletion.');
        }
    };

    const renderTimeLeft = (endTime: string) => {
        if (!endTime) return 'Ended';
        const diff = new Date(endTime).getTime() - Date.now();
        if (diff <= 0) return 'Ended';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${mins}m left`;
        return `${mins}m left`;
    };

    const formatPrice = (price: any) => {
        if (price === null || price === undefined) return '-';
        const num = typeof price === 'string' ? parseFloat(price) : price;
        if (isNaN(num)) return '-';
        return `$${num.toFixed(2)}`;
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
                            <li key={item.id} className="catalog-card" style={{position: 'relative'}}>
                                {isOwner(item.sellerId) && (
                                    <button
                                        onClick={() => deleteListing(item.id)}
                                        title="Delete listing"
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            zIndex: 10,
                                            background: 'rgba(220, 38, 38, 0.9)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '36px',
                                            height: '36px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                            transition: 'transform 0.15s, background 0.15s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(185, 28, 28, 1)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.9)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                    </button>
                                )}
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.title} className="catalog-image" />
                                ) : (
                                    <div className="catalog-image catalog-image-fallback">No Image</div>
                                )}
                                <div className="catalog-meta">
                                    <div className="catalog-top-row">
                                        {item.category && <span className="category-badge">{item.category}</span>}
                                        {item.condition && <span className="status-badge status-ACTIVE" style={{textTransform: 'capitalize'}}>{item.condition}</span>}
                                        <span className={`status-badge status-${item.status}`}>{item.status}</span>
                                    </div>
                                    <strong>{item.title}</strong>
                                    <small className="text-muted">{item.description || 'No description provided.'}</small>
                                    <small className="text-muted">{renderTimeLeft(item.endTime)}</small>
                                </div>
                                <div className="catalog-pricing">
                                    <div>
                                        <span className="text-muted catalog-starting-price">Starting: {formatPrice(item.startingPrice)}</span>
                                        <span className="price">{item.currentPrice != null ? formatPrice(item.currentPrice) : formatPrice(item.startingPrice)}</span>
                                    </div>
                                    <Link to={`/auctions/${item.id}`} className="primary-button card-cta">
                                        View Details
                                    </Link>
                                    {isOwner(item.sellerId) && (
                                        <Link to={`/edit/${item.id}`} className="secondary-button" style={{textAlign: 'center', marginTop: '8px'}}>Edit</Link>
                                    )}
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
