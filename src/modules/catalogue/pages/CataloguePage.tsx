import React, { useState, useEffect } from 'react';

interface CatalogueItem {
    id: number;
    title: string;
    description: string;
    startingPrice: number;
    currentPrice: number;
    imageUrl: string | null;
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

    const fetchItems = async (params: SearchParams) => {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams();
        if (params.keyword) query.append('keyword', params.keyword);
        if (params.minPrice) query.append('minPrice', params.minPrice);
        if (params.maxPrice) query.append('maxPrice', params.maxPrice);

        const url = `/api/v1/catalogue/listings/search${query.toString() ? '?' + query.toString() : ''}`;

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

    return (
        <div className="dashboard-container">
            <h1>Catalogue</h1>

            <form className="search-form" onSubmit={handleSearch}>
                <label>
                    Keyword
                    <input
                        className="form-input"
                        type="text"
                        placeholder="e.g. iPhone"
                        value={searchParams.keyword}
                        onChange={(e) => setSearchParams(p => ({ ...p, keyword: e.target.value }))}
                    />
                </label>
                <label>
                    Min Price
                    <input
                        className="form-input"
                        type="number"
                        placeholder="e.g. 10000"
                        value={searchParams.minPrice}
                        min={0}
                        onChange={(e) => setSearchParams(p => ({ ...p, minPrice: e.target.value }))}
                    />
                </label>
                <label>
                    Max Price
                    <input
                        className="form-input"
                        type="number"
                        placeholder="e.g. 500000"
                        value={searchParams.maxPrice}
                        min={0}
                        onChange={(e) => setSearchParams(p => ({ ...p, maxPrice: e.target.value }))}
                    />
                </label>
                <button className="search-button" type="submit">Search</button>
                <button className="search-button" type="button" onClick={handleReset}
                    style={{ backgroundColor: '#718096' }}>
                    Reset
                </button>
            </form>

            {error && <div className="toast-error">{error}</div>}

            {loading ? (
                <div className="loading-state">Loading catalogue from API Gateway...</div>
            ) : (
                <ul className="auction-list">
                    {items.length > 0 ? (
                        items.map((item) => (
                            <li key={item.id} className="auction-item">
                                <div className="item-details">
                                    <strong>{item.title}</strong>
                                    <small className="text-muted">ID: {item.id}</small>
                                    {item.description && (
                                        <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                                            {item.description}
                                        </span>
                                    )}
                                    <div>
                                        <span className={`status-badge status-${item.status}`}>
                                            {item.status}
                                        </span>
                                        {item.hasBids && (
                                            <span className="status-badge"
                                                style={{ background: '#ed8936', marginLeft: 6 }}>
                                                Has Bids
                                            </span>
                                        )}
                                    </div>
                                    {item.endTime && (
                                        <small className="text-muted">
                                            Ends: {new Date(item.endTime).toLocaleString()}
                                        </small>
                                    )}
                                </div>
                                <div className="interaction-section" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                        Starting: ${item.startingPrice?.toFixed(2)}
                                    </span>
                                    <span className="price">${item.currentPrice?.toFixed(2)}</span>
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

