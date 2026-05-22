import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../../components/AppIcon';

interface HeroSlide {
    id: string;
    title: string;
    copy: string;
    imageUrl: string;
    badge: string;
}

const heroSlides: HeroSlide[] = [
    {
        id: 'marketplace-floor',
        title: 'BidMart Marketplace',
        copy: 'Browse live listings, manage wallet-backed bids, and continue winning lots into orders from one workspace.',
        imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=80',
        badge: 'Marketplace',
    },
    {
        id: 'seller-studio',
        title: 'Curated Auction Flow',
        copy: 'Follow live price movement, wallet-backed bidding, and transparent order continuation from one marketplace.',
        imageUrl: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1800&q=80',
        badge: 'Live lots',
    },
    {
        id: 'wallet-orders',
        title: 'Wallet To Order Flow',
        copy: 'Top up, bid, settle, ship, confirm, and resolve disputes through connected backend services.',
        imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1800&q=80',
        badge: 'Secure flow',
    },
];

const usePrefersReducedMotion = () => {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduced(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

    return reduced;
};

export default function HeroCarousel() {
    const slides = useMemo(() => heroSlides, []);
    const [activeIndex, setActiveIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        if (paused || reducedMotion || slides.length <= 1) return;
        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % slides.length);
        }, 12000);
        return () => window.clearInterval(timer);
    }, [paused, reducedMotion, slides.length]);

    const active = slides[activeIndex] ?? slides[0];
    const goTo = (nextIndex: number) => {
        setActiveIndex((nextIndex + slides.length) % slides.length);
    };

    return (
        <section
            className="home-hero"
            aria-roledescription="carousel"
            aria-label="Marketplace photo highlights"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <img
                className="home-hero-image"
                src={active.imageUrl}
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
            />
            <div className="home-hero-scrim" />
            <div className="home-hero-copy">
                <p className="eyebrow">{active.badge}</p>
                <h1>{active.title}</h1>
                <p>{active.copy}</p>
                <div className="home-hero-meta">
                    <span className="hero-badge hero-badge-light">Bid</span>
                    <span className="hero-badge hero-badge-light">Sell</span>
                    <span className="hero-badge hero-badge-light">Win</span>
                </div>
                <div className="home-hero-actions">
                    <Link to="/marketplace" className="primary-button home-hero-primary">
                        <AppIcon name="home" />
                        Browse Marketplace
                    </Link>
                </div>
            </div>
            <div className="home-hero-controls">
                <button type="button" className="icon-button hero-control" onClick={() => goTo(activeIndex - 1)} aria-label="Previous marketplace photo">
                    <AppIcon name="chevronLeft" />
                </button>
                <div className="hero-dots" aria-label="Marketplace photo selector">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            type="button"
                            className={`hero-dot ${index === activeIndex ? 'hero-dot-active' : ''}`}
                            onClick={() => goTo(index)}
                            aria-label={`Show ${slide.title} banner`}
                            aria-current={index === activeIndex}
                        />
                    ))}
                </div>
                <button type="button" className="icon-button hero-control" onClick={() => goTo(activeIndex + 1)} aria-label="Next marketplace photo">
                    <AppIcon name="chevronRight" />
                </button>
            </div>
        </section>
    );
}
