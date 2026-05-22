import { Link } from 'react-router-dom';
import type { CategoryOption } from '../../catalogue/utils/categories';

interface CategoryShowcaseProps {
    categories: CategoryOption[];
}

const fallbackCategories = ['Electronics', 'Fashion', 'Collectibles', 'Home', 'Sports', 'Lifestyle'];

export default function CategoryShowcase({ categories }: CategoryShowcaseProps) {
    const visibleCategories = categories.length > 0
        ? categories.map((category) => category.label)
        : fallbackCategories;

    return (
        <section className="home-section" aria-labelledby="category-showcase-heading">
            <div className="section-title-row">
                <div>
                    <p className="eyebrow">Explore</p>
                    <h2 id="category-showcase-heading">Popular categories</h2>
                </div>
            </div>
            <div className="category-showcase-grid">
                {visibleCategories.slice(0, 8).map((category, index) => (
                    <Link
                        key={`${category}-${index}`}
                        to={`/marketplace?category=${encodeURIComponent(category)}`}
                        className="category-showcase-card"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {index % 4 === 0 ? 'devices' : index % 4 === 1 ? 'diamond' : index % 4 === 2 ? 'chair' : 'sports_soccer'}
                        </span>
                        <strong>{category}</strong>
                    </Link>
                ))}
            </div>
        </section>
    );
}
