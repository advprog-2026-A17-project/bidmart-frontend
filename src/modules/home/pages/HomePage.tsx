import { Link } from 'react-router-dom';
import CategoryShowcase from '../components/CategoryShowcase';
import FeaturedAuctions from '../components/FeaturedAuctions';
import HeroCarousel from '../components/HeroCarousel';
import MarketplaceTrustPanel from '../components/MarketplaceTrustPanel';
import { useHomeListings } from '../useHomeListings';
import AppIcon from '../../../components/AppIcon';

export default function HomePage() {
    const { endingSoon, categories, loading, error } = useHomeListings();

    return (
        <div className="home-page">
            <HeroCarousel />

            <section className="home-action-strip" aria-label="Primary marketplace actions">
                <Link to="/marketplace" className="home-action-card">
                    <AppIcon name="home" className="home-action-icon" />
                    <div>
                        <strong>Browse live lots</strong>
                        <span>Search active auctions and ending-soon deals.</span>
                    </div>
                </Link>
            </section>

            <FeaturedAuctions listings={endingSoon} loading={loading} error={error} />
            <CategoryShowcase categories={categories} />
            <MarketplaceTrustPanel />
        </div>
    );
}
