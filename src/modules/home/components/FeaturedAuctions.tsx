import { Link } from 'react-router-dom';
import { useNowTick } from '../../../hooks/useNowTick';
import { formatMoney } from '../../../utils/money';
import { formatTimeLeft, resolveHomeListingImage, type HomeListing } from '../useHomeListings';

interface FeaturedAuctionsProps {
    listings: HomeListing[];
    loading: boolean;
    error?: string | null;
}

export default function FeaturedAuctions({ listings, loading, error }: FeaturedAuctionsProps) {
    const nowMs = useNowTick(30_000);

    return (
        <section className="home-section" aria-labelledby="featured-auctions-heading">
            <div className="section-title-row">
                <div>
                    <p className="eyebrow">Bid now</p>
                    <h2 id="featured-auctions-heading">Live auctions ending soon</h2>
                </div>
                <Link to="/marketplace" className="text-link">View all</Link>
            </div>
            {loading ? (
                <div className="home-auction-grid" aria-busy="true">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="home-auction-card skeleton-card">
                            <span className="skeleton-block" />
                            <span className="skeleton-line" />
                            <span className="skeleton-line skeleton-line-medium" />
                        </div>
                    ))}
                </div>
            ) : listings.length > 0 ? (
                <div className="home-auction-grid">
                    {listings.slice(0, 4).map((listing, index) => (
                        <Link key={listing.id} to={`/listings/${listing.id}`} className="home-auction-card">
                            <img src={resolveHomeListingImage(listing, index)} alt={listing.title} loading="lazy" />
                            <div className="home-auction-card-body">
                                <span className="time-badge compact">
                                    <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                                    {formatTimeLeft(listing.endTime, nowMs)}
                                </span>
                                <strong>{listing.title}</strong>
                                <span className="text-muted">{listing.category ?? 'Auction lot'}</span>
                                <div className="home-auction-price">
                                    <span>Current bid</span>
                                    <strong>{formatMoney(listing.currentPrice || listing.startingPrice)}</strong>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="catalog-empty-state home-backend-empty">
                    <span className="material-symbols-outlined" aria-hidden="true">cloud_sync</span>
                    <strong>No live auctions from backend yet.</strong>
                    <p className="text-muted">
                        {error
                            ? 'The marketplace API is not reachable right now. Start the backend stack, then refresh this page.'
                            : 'Published catalogue listings will appear here automatically after sellers create and publish them.'}
                    </p>
                    <Link to="/marketplace" className="secondary-button">Open Marketplace</Link>
                </div>
            )}
        </section>
    );
}
