import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { gatewayUrl, readApiError } from '../../../config/apiClient';

interface Session {
    tokenId: string;
    email: string;
    revoked: boolean;
    expiresAt: string;
}

interface UserProfileResponse {
    id: string;
    email: string;
    enabled: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    shippingAddress: string | null;
}

const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    
    // State tambahan untuk mode edit
    const [isEditing, setIsEditing] = useState(false);
    
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    
    // State untuk menyimpan data original agar bisa di-cancel
    const [originalProfile, setOriginalProfile] = useState({
        displayName: '',
        avatarUrl: '',
        shippingAddress: ''
    });

    const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isProfileComplete = Boolean(displayName.trim()) && Boolean(shippingAddress.trim());

    useEffect(() => {
        if (!user) return;
        let active = true;

        const fetchProfile = async () => {
            setProfileLoading(true);
            setError(null);
            try {
                const response = await authenticatedFetch(
                    gatewayUrl(`/api/v1/auth/profile?email=${encodeURIComponent(user.email)}`)
                );
                if (!response.ok) {
                    throw new Error(await readApiError(response, 'Profile lookup failed'));
                }
                const payload = await response.json() as UserProfileResponse;
                if (!active) return;
                
                const fetchedName = payload.displayName ?? '';
                const fetchedAvatar = payload.avatarUrl ?? '';
                const fetchedAddress = payload.shippingAddress ?? '';

                setDisplayName(fetchedName);
                setAvatarUrl(fetchedAvatar);
                setShippingAddress(fetchedAddress);
                
                // Simpan salinan data awal
                setOriginalProfile({
                    displayName: fetchedName,
                    avatarUrl: fetchedAvatar,
                    shippingAddress: fetchedAddress
                });

            } catch (err: unknown) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Failed to load profile.');
            } finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            active = false;
        };
    }, [authenticatedFetch, user]);

    useEffect(() => {
        if (!user) return;
        authenticatedFetch(gatewayUrl(`/api/v1/auth/sessions?email=${encodeURIComponent(user.email)}`))
            .then(async (response) => {
                if (!response.ok) throw new Error(await readApiError(response, 'Session lookup failed'));
                return response.json();
            })
            .then((payload: Session[]) => setSessions(payload))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load sessions'));
    }, [authenticatedFetch, user]);

    const handleProfileSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) return;
        const trimmedName = displayName.trim();
        const trimmedAddress = shippingAddress.trim();

        if (!trimmedName) {
            setError('Display name is required.');
            return;
        }

        if (!trimmedAddress) {
            setError('Shipping address is required.');
            return;
        }

        setProfileSaving(true);
        setError(null);
        setMessage(null);

        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/profile'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    displayName: trimmedName,
                    avatarUrl: avatarUrl.trim() || null,
                    shippingAddress: trimmedAddress || null,
                }),
            });

            if (!response.ok) {
                setError(await readApiError(response, 'Profile update failed'));
                return;
            }

            const payload = await response.json() as UserProfileResponse;
            const updatedName = payload.displayName ?? '';
            const updatedAvatar = payload.avatarUrl ?? '';
            const updatedAddress = payload.shippingAddress ?? '';

            setDisplayName(updatedName);
            setAvatarUrl(updatedAvatar);
            setShippingAddress(updatedAddress);
            
            // Perbarui data original setelah sukses menyimpan
            setOriginalProfile({
                displayName: updatedName,
                avatarUrl: updatedAvatar,
                shippingAddress: updatedAddress
            });
            
            setMessage('Profile updated successfully.');
            setIsEditing(false); // Tutup mode edit setelah berhasil
        } catch (err: unknown) {
            setError('Failed to update profile.');
            console.error(err);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleCancelEdit = () => {
        // Kembalikan input ke data semula
        setDisplayName(originalProfile.displayName);
        setAvatarUrl(originalProfile.avatarUrl);
        setShippingAddress(originalProfile.shippingAddress);
        setError(null);
        setIsEditing(false);
    };

    const setupTwoFactor = async () => {
        if (!user) return;
        setError(null);
        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/2fa/setup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        if (!response.ok) {
            setError(await readApiError(response, '2FA setup failed'));
            return;
        }
        const payload = await response.json() as { secret: string; qrCodeUrl: string };
        setTwoFactorSecret(payload.secret);
        setQrCodeUrl(payload.qrCodeUrl);
    };

    const verifyTwoFactor = async () => {
        if (!user) return;
        setError(null);
        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/2fa/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, code: twoFactorCode }),
        });
        if (!response.ok) {
            setError(await readApiError(response, '2FA verification failed'));
            return;
        }
        setMessage('Two-factor authentication enabled.');
        setTwoFactorCode('');
    };

    const revokeSession = async (tokenId: string) => {
        setError(null);
        const response = await authenticatedFetch(gatewayUrl(`/api/v1/auth/sessions/${tokenId}`), {
            method: 'DELETE',
        });
        if (!response.ok) {
            setError(await readApiError(response, 'Session revocation failed'));
            return;
        }
        setSessions((current) => current.filter((session) => session.tokenId !== tokenId));
    };

    if (!user) {
        return <div className="page-wrap"><div className="empty-state">Please sign in to manage your profile.</div></div>;
    }

    return (
        <div className="page-wrap">
            <section className="page-head">
                <h1>Profile</h1>
                <p>{user.email}</p>
            </section>
            {error && <div className="toast-error">{error}</div>}
            {message && <div className="toast-success">{message}</div>}

            <div className="panel section-stack">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Profile Details</h3>
                    {!profileLoading && !isEditing && (
                        <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
                            Edit Profile
                        </button>
                    )}
                </div>
                
                {!profileLoading && !isProfileComplete && (
                    <div className="toast-error">Complete your profile to access the rest of BidMart.</div>
                )}
                {profileLoading ? (
                    <div className="loading-state">Loading profile details...</div>
                ) : (
                    <form onSubmit={handleProfileSave} className="section-stack">
                        <label className="field">
                            <span>Display name</span>
                            <input
                                className="form-input"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="Your name"
                                disabled={!isEditing}
                                required
                            />
                        </label>
                        <label className="field">
                            <span>Avatar URL</span>
                            <input
                                className="form-input"
                                value={avatarUrl}
                                onChange={(event) => setAvatarUrl(event.target.value)}
                                placeholder="https://..."
                                disabled={!isEditing}
                            />
                        </label>
                        <label className="field">
                            <span>Shipping address</span>
                            <textarea
                                className="form-input form-textarea"
                                value={shippingAddress}
                                onChange={(event) => setShippingAddress(event.target.value)}
                                placeholder="Street, city, province, postal code"
                                disabled={!isEditing}
                                required
                            />
                        </label>
                        <div className="panel-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted">Required before you can bid or sell.</span>
                            {isEditing && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        className="secondary-button" 
                                        type="button" 
                                        onClick={handleCancelEdit} 
                                        disabled={profileSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button className="primary-button" type="submit" disabled={profileSaving}>
                                        {profileSaving ? 'Saving...' : 'Save Profile'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                )}
            </div>

            <div className="panel section-stack">
                <h3>Two-Factor Authentication</h3>
                <button className="primary-button" type="button" onClick={setupTwoFactor}>
                    Set Up 2FA
                </button>
                {twoFactorSecret && (
                    <div className="summary-box">
                        <div>Secret: {twoFactorSecret}</div>
                        <div>QR URL: {qrCodeUrl}</div>
                        <label className="field">
                            <span>Verification code</span>
                            <input
                                className="form-input"
                                value={twoFactorCode}
                                onChange={(event) => setTwoFactorCode(event.target.value)}
                            />
                        </label>
                        <button className="primary-button" type="button" onClick={verifyTwoFactor}>
                            Verify 2FA
                        </button>
                    </div>
                )}
            </div>

            <div className="panel">
                <h3>Active Sessions</h3>
                {sessions.length ? sessions.map((session) => (
                    <div key={session.tokenId} className="transaction-item">
                        <span>{session.email}</span>
                        <span>{new Date(session.expiresAt).toLocaleString()}</span>
                        <button className="secondary-button" type="button" onClick={() => revokeSession(session.tokenId)}>
                            Revoke
                        </button>
                    </div>
                )) : <div className="empty-state">No active sessions found.</div>}
            </div>
        </div>
    );
};

export default ProfilePage;