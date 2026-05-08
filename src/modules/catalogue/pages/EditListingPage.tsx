import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { CATALOGUE_LISTINGS_BASE_PATH } from '../api/endpoints';

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

const EditListingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Keep the full original listing to preserve fields that shouldn't change
    const [originalListing, setOriginalListing] = useState<any>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        imageUrl: '',
        startingPrice: '',
    });

    useEffect(() => {
        const fetchListing = async () => {
            if (!id) return;
            try {
                const response = await authenticatedFetch(gatewayUrl(`${CATALOGUE_LISTINGS_BASE_PATH}/${id}`));
                if (!response.ok) {
                    setError('Failed to fetch listing data.');
                    setLoading(false);
                    return;
                }
                const data = await response.json();
                
                if (data.sellerId !== user?.id) {
                    setError('You do not have permission to edit this listing.');
                    setLoading(false);
                    return;
                }

                setOriginalListing(data);
                setFormData({
                    title: data.title || '',
                    description: data.description || '',
                    category: data.category || '',
                    imageUrl: data.imageUrl || '',
                    startingPrice: data.startingPrice != null ? String(data.startingPrice) : '',
                });
            } catch (err) {
                setError('Failed to load listing.');
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchListing();
        } else {
            setError('Please log in as a seller to edit listings.');
            setLoading(false);
        }
    }, [id, user, authenticatedFetch]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Max 10MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setFormData((p) => ({
                    ...p,
                    imageUrl: event.target!.result as string,
                }));
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSave = async () => {
        if (!id || !originalListing) return;
        setSaving(true);
        setError(null);

        const updatedListing = {
            ...originalListing,
            title: formData.title,
            description: formData.description,
            category: formData.category,
            imageUrl: formData.imageUrl,
            startingPrice: formData.startingPrice ? Math.round(Number(formData.startingPrice) * 100) / 100 : originalListing.startingPrice,
        };

        try {
            const response = await authenticatedFetch(gatewayUrl(`${CATALOGUE_LISTINGS_BASE_PATH}/${id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedListing),
            });

            if (!response.ok) {
                setError(await readApiError(response, 'Failed to update listing'));
                setSaving(false);
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 1500);
        } catch (err) {
            setError('Network error while saving listing.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrap">
                <div className="loading-state">Loading listing details...</div>
            </div>
        );
    }

    if (error && !originalListing) {
        return (
            <div className="page-wrap">
                <div className="toast-error">{error}</div>
            </div>
        );
    }

    const isComplete = Boolean(formData.title && formData.description && formData.category);

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>Edit Listing</h1>
                <p>Update your listing details below.</p>
            </section>

            {success && <div className="toast-success">Listing updated successfully!</div>}
            {error && <div className="toast-error">{error}</div>}

            <div className="panel">
                <div className="section-stack">
                    <h3>Basic Details</h3>
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
                        Starting Price
                        <input
                            className="form-input"
                            type="number"
                            min={1}
                            value={formData.startingPrice}
                            onChange={(e) => setFormData((p) => ({ ...p, startingPrice: e.target.value }))}
                            placeholder="0.00"
                        />
                    </label>
                </div>

                <div className="section-stack" style={{ marginTop: '24px' }}>
                    <h3>Listing Image</h3>
                    <label className="upload-zone" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/webp" 
                            onChange={handleImageUpload} 
                            style={{ display: 'none' }} 
                        />
                        <strong>Drop new image here or click to upload</strong>
                        <span>Replaces current image. JPG, PNG up to 10MB.</span>
                    </label>
                    {formData.imageUrl && (
                        <div style={{ marginTop: '16px' }}>
                            <p className="field-label">Current Image Preview:</p>
                            <img 
                                src={formData.imageUrl} 
                                alt="Listing Preview" 
                                style={{ maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} 
                            />
                        </div>
                    )}
                </div>

                <div className="panel-footer" style={{ marginTop: '32px' }}>
                    <button 
                        type="button" 
                        className="secondary-button" 
                        onClick={() => navigate('/')}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="primary-button"
                        disabled={!isComplete || saving}
                        onClick={handleSave}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditListingPage;
