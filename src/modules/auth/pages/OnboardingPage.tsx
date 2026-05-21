import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { primaryRole } from '../../../context/primaryRole';
import PasswordField from '../../../components/PasswordField';

type OnboardingStatus = {
    profileCompleted: boolean;
    passwordSet: boolean;
    needsPassword: boolean;
    needsRole: boolean;
    role: string | null;
    displayName?: string | null;
    shippingAddress?: string | null;
};

const OnboardingPage: React.FC = () => {
    const { user, logout } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const navigate = useNavigate();
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'BUYER' | 'SELLER'>('BUYER');
    const [displayName, setDisplayName] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/onboarding'));
                if (!response.ok) {
                    throw new Error(await readApiError(response, 'Failed to load onboarding status'));
                }
                const payload = await response.json() as OnboardingStatus;
                setStatus(payload);
                if (payload.profileCompleted) {
                    navigate(primaryRole(user) === 'SELLER' ? '/seller-studio' : '/', { replace: true });
                    return;
                }
                if (payload.role === 'BUYER' || payload.role === 'SELLER') {
                    setRole(payload.role);
                }
                setDisplayName(payload.displayName ?? '');
                setShippingAddress(payload.shippingAddress ?? '');
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Unable to load onboarding.');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [authenticatedFetch, navigate, user]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            const body: Record<string, string> = {
                displayName: displayName.trim(),
                shippingAddress: shippingAddress.trim(),
                role,
            };
            if (status?.needsPassword && password.trim()) {
                body.password = password;
            }
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/onboarding'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to complete onboarding'));
            }
            await response.json() as OnboardingStatus;
            navigate(role === 'SELLER' ? '/seller-studio' : '/', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to save onboarding.');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="panel center-content">
                <p className="text-muted">Sign in to continue onboarding.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="loading-state">Preparing your account...</div>;
    }

    return (
        <div className="page-wrap narrow-form">
            <section className="page-head">
                <h1>Complete your account</h1>
                <p className="text-muted">
                    Lengkapi profil, pilih peran (Pembeli atau Penjual), dan set password jika Anda masuk dengan Google.
                </p>
            </section>
            {error && <div className="toast-error">{error}</div>}
            <form className="panel section-stack" onSubmit={submit}>
                {status?.needsPassword && (
                    <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
                )}
                {status?.needsRole && (
                    <label>
                        Marketplace role
                        <select value={role} onChange={(event) => setRole(event.target.value as 'BUYER' | 'SELLER')}>
                            <option value="BUYER">Buyer</option>
                            <option value="SELLER">Seller</option>
                        </select>
                    </label>
                )}
                <label>
                    Display name
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </label>
                <label>
                    Shipping address
                    <textarea value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} required />
                </label>
                <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? 'Saving...' : 'Continue to BidMart'}
                </button>
                <button type="button" className="secondary-button" onClick={logout}>
                    Sign out
                </button>
            </form>
        </div>
    );
};

export default OnboardingPage;
