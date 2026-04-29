import React, { useMemo, useState } from 'react';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';

type Step = 'details' | 'images' | 'auction' | 'review';

const CATEGORIES = [
    'Electronics',
    'Furniture',
    'Collectibles',
    'Fashion',
    'Sports',
    'Art & Antiques',
    'Home & Garden',
    'Toys & Games',
];

const CONDITIONS = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'used', label: 'Used' },
];

const AUCTION_DURATIONS = [1, 3, 5, 7, 10];

const SellPage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [step, setStep] = useState<Step>('details');
    const [published, setPublished] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdListingId, setCreatedListingId] = useState<string | null>(null);
    const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);
    const [createdAt] = useState(() => Date.now());
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        categoryId: '',
        condition: '',
        startingBid: '',
        reservePrice: '',
        minimumIncrement: '1',
        duration: 7,
        images: [] as string[],
    });

    const isDetailsComplete = Boolean(
        formData.title && formData.description && formData.category && formData.condition
    );
    const isAuctionComplete = Boolean(formData.startingBid && Number(formData.startingBid) > 0);

    const steps = useMemo(
        () => [
            { id: 'details' as const, label: 'Item Details', done: isDetailsComplete },
            { id: 'images' as const, label: 'Images', done: formData.images.length > 0 },
            { id: 'auction' as const, label: 'Auction Settings', done: isAuctionComplete },
            { id: 'review' as const, label: 'Review & Publish', done: false },
        ],
        [formData.images.length, isAuctionComplete, isDetailsComplete]
    );

    const moveStep = (direction: 'prev' | 'next') => {
        const idx = steps.findIndex((item) => item.id === step);
        const next = direction === 'next' ? idx + 1 : idx - 1;
        if (next >= 0 && next < steps.length) {
            setStep(steps[next].id);
        }
    };

    const publishListing = async () => {
        if (!user) {
            setError('Please sign in as a seller before publishing.');
            return;
        }
        setError(null);
        const listingResponse = await authenticatedFetch(gatewayUrl('/api/v1/catalogue/listings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: formData.title,
                description: formData.description,
                category: formData.category,
                categoryId: formData.categoryId || null,
                condition: formData.condition,
                sellerId: user.id,
                startingPrice: Number(formData.startingBid),
                imageUrl: formData.images[0] ?? null,
            }),
        });
        if (!listingResponse.ok) {
            setError(await readApiError(listingResponse, 'Listing creation failed'));
            return;
        }
        const listing = await listingResponse.json() as { id: string | number };
        const listingId = String(listing.id);
        setCreatedListingId(listingId);

        const now = Math.floor(Date.now() / 1000);
        const auctionResponse = await authenticatedFetch(gatewayUrl('/api/v1/auctions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listingId,
                sellerId: user.id,
                startingPrice: Number(formData.startingBid),
                reservePrice: Number(formData.reservePrice || formData.startingBid),
                minimumIncrement: Number(formData.minimumIncrement || 1),
                startTime: now,
                endTime: now + formData.duration * 24 * 60 * 60,
            }),
        });
        if (!auctionResponse.ok) {
            setError(await readApiError(auctionResponse, 'Auction creation failed'));
            return;
        }
        const auction = await auctionResponse.json() as { id: string };
        setCreatedAuctionId(auction.id);
        setPublished(true);
    };

    const cancelListing = async () => {
        if (!createdListingId) return;
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${createdListingId}/cancel`), {
            method: 'POST',
        });
        if (!response.ok) {
            setError(await readApiError(response, 'Listing cancellation failed'));
            return;
        }
        setPublished(false);
        setCreatedListingId(null);
        setCreatedAuctionId(null);
    };

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>Create Listing</h1>
                <p>Start selling your items on BidMart</p>
            </section>

            {published && <div className="toast-success">Listing published successfully.</div>}
            {error && <div className="toast-error">{error}</div>}

            <div className="steps-row">
                {steps.map((item, idx) => (
                    <button key={item.id} type="button" className="step-item" onClick={() => setStep(item.id)}>
                        <span
                            className={`step-badge ${
                                step === item.id ? 'step-active' : item.done ? 'step-done' : ''
                            }`}
                        >
                            {item.done && step !== item.id ? '✓' : idx + 1}
                        </span>
                        <span className="step-label">{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="panel">
                {step === 'details' && (
                    <div className="section-stack">
                        <h3>Item Details</h3>
                        <label className="field">
                            Title
                            <input
                                className="form-input"
                                value={formData.title}
                                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                                placeholder="Be specific and descriptive"
                            />
                        </label>
                        <label className="field">
                            Description
                            <textarea
                                className="form-input form-textarea"
                                value={formData.description}
                                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Include details about condition, features, and any defects"
                            />
                        </label>
                        <label className="field">
                            Category
                            <select
                                className="form-input"
                                value={formData.category}
                                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                            >
                                <option value="">Select a category</option>
                                {CATEGORIES.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            Category ID
                            <input
                                className="form-input"
                                value={formData.categoryId}
                                onChange={(e) => setFormData((p) => ({ ...p, categoryId: e.target.value }))}
                                placeholder="Optional category identifier"
                            />
                        </label>
                        <div>
                            <div className="field-label">Condition</div>
                            <div className="chip-grid">
                                {CONDITIONS.map((cond) => (
                                    <button
                                        key={cond.value}
                                        type="button"
                                        className={`chip ${formData.condition === cond.value ? 'chip-active' : ''}`}
                                        onClick={() =>
                                            setFormData((p) => ({
                                                ...p,
                                                condition: cond.value,
                                            }))
                                        }
                                    >
                                        {cond.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {step === 'images' && (
                    <div className="section-stack">
                        <h3>Upload Images</h3>
                        <button
                            type="button"
                            className="upload-zone"
                            onClick={() =>
                                setFormData((p) =>
                                    p.images.length
                                        ? p
                                        : { ...p, images: ['image-1', 'image-2', 'image-3'] }
                                )
                            }
                        >
                            <strong>Drop images here or click to upload</strong>
                            <span>JPG, PNG up to 10MB each. Add 1-12 images.</span>
                        </button>
                        {formData.images.length > 0 && (
                            <div className="image-mock-grid">
                                {formData.images.map((img, idx) => (
                                    <div key={`${img}-${idx}`} className="image-mock-card">
                                        Image {idx + 1}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {step === 'auction' && (
                    <div className="section-stack">
                        <h3>Auction Settings</h3>
                        <label className="field">
                            Starting Bid
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                value={formData.startingBid}
                                onChange={(e) => setFormData((p) => ({ ...p, startingBid: e.target.value }))}
                                placeholder="0.00"
                            />
                        </label>
                        <label className="field">
                            Reserve Price
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                value={formData.reservePrice}
                                onChange={(e) => setFormData((p) => ({ ...p, reservePrice: e.target.value }))}
                                placeholder="Optional reserve"
                            />
                        </label>
                        <label className="field">
                            Minimum Increment
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                value={formData.minimumIncrement}
                                onChange={(e) => setFormData((p) => ({ ...p, minimumIncrement: e.target.value }))}
                                placeholder="1.00"
                            />
                        </label>
                        <div>
                            <div className="field-label">Auction Duration</div>
                            <div className="chip-grid">
                                {AUCTION_DURATIONS.map((duration) => (
                                    <button
                                        key={duration}
                                        type="button"
                                        className={`chip ${formData.duration === duration ? 'chip-active' : ''}`}
                                        onClick={() => setFormData((p) => ({ ...p, duration }))}
                                    >
                                        {duration} day{duration > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="summary-box">
                            <div>Insertion fee: 2.5%</div>
                            <div>Final value fee: 5%</div>
                            <div>
                                Estimated end:{' '}
                                {new Date(
                                    createdAt + formData.duration * 24 * 60 * 60 * 1000
                                ).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                )}

                {step === 'review' && (
                    <div className="section-stack">
                        <h3>Review & Publish</h3>
                        <div className="summary-box">
                            <div>Title: {formData.title || '(No title)'}</div>
                            <div>Category: {formData.category || 'Not selected'}</div>
                            <div>
                                Condition:{' '}
                                {CONDITIONS.find((item) => item.value === formData.condition)?.label ??
                                    'Not selected'}
                            </div>
                            <div>Starting Bid: ${formData.startingBid || '0.00'}</div>
                            <div>Reserve Price: ${formData.reservePrice || formData.startingBid || '0.00'}</div>
                            <div>Duration: {formData.duration} days</div>
                            {createdListingId && <div>Listing ID: {createdListingId}</div>}
                            {createdAuctionId && <div>Auction ID: {createdAuctionId}</div>}
                        </div>
                        <button
                            type="button"
                            className="primary-button"
                            onClick={publishListing}
                        >
                            Publish Listing
                        </button>
                        {createdListingId && (
                            <button type="button" className="secondary-button" onClick={cancelListing}>
                                Cancel Listing
                            </button>
                        )}
                    </div>
                )}

                <div className="panel-footer">
                    <button type="button" className="secondary-button" disabled={step === 'details'} onClick={() => moveStep('prev')}>
                        Previous
                    </button>
                    {step !== 'review' && (
                        <button
                            type="button"
                            className="primary-button"
                            disabled={(step === 'details' && !isDetailsComplete) || (step === 'auction' && !isAuctionComplete)}
                            onClick={() => moveStep('next')}
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SellPage;
