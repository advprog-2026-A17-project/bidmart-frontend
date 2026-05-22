import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { primaryRole } from '../../../context/primaryRole';
import PasswordField from '../../../components/PasswordField';
import PageToast from '../../../components/PageToast';

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
    const { user, logout, refreshSession } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const navigate = useNavigate();
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
                    navigate(payload.role === 'SELLER' || primaryRole(user) === 'SELLER' ? '/seller-studio' : '/', { replace: true });
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
            let refreshedSession = await refreshSession();
            if (refreshedSession && primaryRole(refreshedSession.user) !== role) {
                refreshedSession = await refreshSession();
            }
            if (!refreshedSession || primaryRole(refreshedSession.user) !== role) {
                throw new Error('Akun tersimpan, tetapi session belum bisa diperbarui. Silakan login ulang.');
            }
            navigate(primaryRole(refreshedSession.user) === 'SELLER' ? '/seller-studio' : '/', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to save onboarding.');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="onboarding-wrap">
                <div className="onboarding-card panel center-content">
                    <p className="text-muted">Masuk untuk melanjutkan pengaturan akun.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="onboarding-wrap">
                <div className="onboarding-card panel loading-state">Menyiapkan akun Anda...</div>
            </div>
        );
    }

    const stepCount = (status?.needsPassword ? 1 : 0) + (status?.needsRole ? 1 : 0) + 1;

    return (
        <div className="onboarding-wrap">
            <div className="onboarding-card panel">
                <div className="auth-logo-wrap onboarding-brand">
                    <div className="app-logo">BM</div>
                    <p className="eyebrow">Selamat datang</p>
                    <h1>Lengkapi akun Anda</h1>
                    <p className="text-muted onboarding-lead">
                        Satu langkah lagi sebelum mulai menawar atau berjualan di BidMart.
                    </p>
                </div>

                <div className="onboarding-steps" aria-hidden="true">
                    {Array.from({ length: stepCount }, (_, index) => (
                        <span key={index} className="onboarding-step-dot onboarding-step-dot-active" />
                    ))}
                </div>

                <PageToast error={error} />

                <form className="onboarding-form auth-form" onSubmit={submit}>
                    {status?.needsPassword && (
                        <section className="onboarding-section">
                            <div className="onboarding-section-head">
                                <span className="material-symbols-outlined onboarding-section-icon" aria-hidden="true">
                                    lock
                                </span>
                                <div>
                                    <h2>Password login</h2>
                                    <p className="text-muted">Agar Anda bisa masuk tanpa Google di lain waktu.</p>
                                </div>
                            </div>
                            <PasswordField
                                label="Password"
                                value={password}
                                onChange={setPassword}
                                autoComplete="new-password"
                                visible={showPassword}
                                onVisibleChange={setShowPassword}
                            />
                        </section>
                    )}

                    {status?.needsRole && (
                        <section className="onboarding-section">
                            <div className="onboarding-section-head">
                                <span className="material-symbols-outlined onboarding-section-icon" aria-hidden="true">
                                    badge
                                </span>
                                <div>
                                    <h2>Pilih peran</h2>
                                    <p className="text-muted">Tentukan cara Anda menggunakan marketplace.</p>
                                </div>
                            </div>
                            <div className="account-type-grid" role="group" aria-label="Marketplace role">
                                <button
                                    type="button"
                                    className={`account-type-card ${role === 'BUYER' ? 'account-type-card-active' : ''}`}
                                    onClick={() => setRole('BUYER')}
                                    aria-pressed={role === 'BUYER'}
                                >
                                    <span className="material-symbols-outlined" aria-hidden="true">shopping_cart</span>
                                    <strong>Pembeli</strong>
                                    <small>Ikut lelang dan beli barang</small>
                                </button>
                                <button
                                    type="button"
                                    className={`account-type-card ${role === 'SELLER' ? 'account-type-card-active' : ''}`}
                                    onClick={() => setRole('SELLER')}
                                    aria-pressed={role === 'SELLER'}
                                >
                                    <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                                    <strong>Penjual</strong>
                                    <small>Pasang listing dan kelola lelang</small>
                                </button>
                            </div>
                        </section>
                    )}

                    <section className="onboarding-section">
                        <div className="onboarding-section-head">
                            <span className="material-symbols-outlined onboarding-section-icon" aria-hidden="true">
                                person
                            </span>
                            <div>
                                <h2>Profil</h2>
                                <p className="text-muted">Nama tampilan dan alamat pengiriman untuk transaksi.</p>
                            </div>
                        </div>
                        <label className="field">
                            <span className="field-label">Nama tampilan</span>
                            <input
                                className="form-input"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="Contoh: Aldo"
                                required
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">Alamat pengiriman</span>
                            <textarea
                                className="form-input form-textarea"
                                value={shippingAddress}
                                onChange={(event) => setShippingAddress(event.target.value)}
                                placeholder="Jalan, kota, kode pos"
                                required
                            />
                        </label>
                    </section>

                    <div className="onboarding-actions">
                        <button type="submit" className="primary-button auth-primary-action" disabled={saving}>
                            {saving ? 'Menyimpan...' : 'Lanjut ke BidMart'}
                        </button>
                        <button type="button" className="secondary-button" onClick={logout}>
                            Keluar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OnboardingPage;
