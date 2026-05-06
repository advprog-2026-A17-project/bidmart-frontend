import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
const MAX_IMAGE_BYTES = 600 * 1024;

const toAmountCents = (value: string): number => Math.round(Number(value || 0) * 100);
const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unknown error';
const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read image file.'));
        reader.readAsDataURL(file);
    });

const SellPage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const isSeller = user?.roles?.some((role) => role.name === 'SELLER') ?? false;
    const roleSummary = user?.roles?.map((role) => role.name).join(', ') ?? 'No active role';
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

    const handleImageUpload = async (files: FileList | null) => {
        if (!files?.length) {
            return;
        }
        setError(null);
        try {
            const selectedFiles = Array.from(files).slice(0, 3);
            const images = await Promise.all(
                selectedFiles.map((file) => {
                    if (!file.type.startsWith('image/')) {
                        throw new Error('Please upload image files only.');
                    }
                    if (file.size > MAX_IMAGE_BYTES) {
                        throw new Error('Each image must be 600KB or smaller for this demo.');
                    }
                    return readImageFile(file);
                })
            );
            setFormData((previous) => ({ ...previous, images }));
        } catch (err: unknown) {
            setError(toErrorMessage(err));
        }
    };

    const rollbackCreatedListing = async (listingId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/cancel`), {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing rollback failed'));
        }
    };

    const publishCreatedListing = async (listingId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/publish`), {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing publish failed'));
        }
    };

    const markAuctionCreated = async (listingId: string, auctionId: string) => {
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/catalogue/listings/${listingId}/auction-created`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auctionId }),
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Listing auction marker failed'));
        }
    };

    const publishListing = async () => {
        if (!user || !isSeller) {
            setError('Only seller accounts can publish listings. Sign in with a SELLER role to continue.');
            return;
        }
        setError(null);
        let listingId: string | null = null;
        try {
            const listingResponse = await authenticatedFetch(gatewayUrl('/api/v1/catalogue/listings'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    category: formData.category,
                    condition: formData.condition,
                    sellerId: user.id,
                    startingPrice: toAmountCents(formData.startingBid),
                    imageUrl: formData.images[0] ?? null,
                }),
            });
            if (!listingResponse.ok) {
                setError(await readApiError(listingResponse, 'Listing creation failed'));
                return;
            }
            const listing = await listingResponse.json() as { id: string | number };
            listingId = String(listing.id);
            setCreatedListingId(listingId);
            await publishCreatedListing(listingId);

            const now = Math.floor(Date.now() / 1000);
            const auctionResponse = await authenticatedFetch(gatewayUrl('/api/v1/auctions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listingId,
                    sellerId: user.id,
                    auctionType: 'ENGLISH',
                    startingPrice: toAmountCents(formData.startingBid),
                    reservePrice: toAmountCents(formData.reservePrice || formData.startingBid),
                    minimumIncrement: toAmountCents(formData.minimumIncrement || '1'),
                    startTime: now,
                    endTime: now + formData.duration * 24 * 60 * 60,
                }),
            });
            if (!auctionResponse.ok) {
                throw new Error(await readApiError(auctionResponse, 'Auction creation failed'));
            }
            const auction = await auctionResponse.json() as { id: string | number };
            const auctionId = String(auction.id);
            await markAuctionCreated(listingId, auctionId);
            setCreatedAuctionId(auctionId);
            setPublished(true);
        } catch (err: unknown) {
            if (listingId) {
                try {
                    await rollbackCreatedListing(listingId);
                    setCreatedListingId(null);
                } catch (rollbackError: unknown) {
                    setError(`${toErrorMessage(err)} ${toErrorMessage(rollbackError)}`);
                    return;
                }
            }
            setError(toErrorMessage(err));
        }
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

    if (!user || !isSeller) {
        const isSignedOut = !user;
        return (
            <div className="page-wrap">
                <section className="page-head">
                    <h1>{isSignedOut ? 'Sell on BidMart' : 'Seller access required'}</h1>
                    <p>{isSignedOut ? 'Create an account as a seller to publish auction listings.' : 'Buyer accounts can browse, bid, and manage wallet funds.'}</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">{isSignedOut ? 'Public Preview' : 'Buyer Account'}</span>
                    <h2>{isSignedOut ? 'Start with a seller account' : 'This page is for sellers'}</h2>
                    <p className="text-muted">
                        {isSignedOut
                            ? 'Seller accounts can create listings, attach product photos, configure auction rules, and publish to the marketplace.'
                            : 'Your current role does not allow listing creation. Use a seller account when you need to publish items.'}
                    </p>
                    {user && <p className="access-role-summary">Current role: {roleSummary}</p>}
                    <div className="access-actions">
                        <Link className="primary-button" to={isSignedOut ? '/login' : '/'}>
                            {isSignedOut ? 'Sign In or Register' : 'Back to Explore'}
                        </Link>
                        <Link className="secondary-button" to="/wallet">
                            {isSignedOut ? 'View Wallet Preview' : 'Go to Wallet'}
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

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
                        <label className="upload-zone">
                            <strong>Drop images here or click to upload</strong>
                            <span>JPG, PNG, or WebP up to 600KB each. Add up to 3 images.</span>
                            <input
                                className="file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                onChange={(event) => handleImageUpload(event.target.files)}
                            />
                        </label>
                        {formData.images.length > 0 && (
                            <div className="image-mock-grid">
                                {formData.images.map((img, idx) => (
                                    <div key={`${img}-${idx}`} className="image-mock-card">
                                        <img src={img} alt={`Upload preview ${idx + 1}`} />
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
                            <span>Starting Bid</span>
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
                            <span>Reserve Price</span>
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
                            <span>Minimum Increment</span>
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
