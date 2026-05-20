import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import { QRCodeSVG } from 'qrcode.react';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { ProfileAvatarWithFallback } from '../../../components/ProfileAvatar';
import { isValidImageReference, MAX_AVATAR_IMAGE_BYTES, readAvatarImageFile } from '../../../utils/avatar-image';

type AvatarInputMode = 'upload' | 'link';

interface Session {
    tokenId: string;
    email: string;
    revoked: boolean;
    createdAt: string;
    deviceInfo: string | null;
}

interface UserProfileResponse {
    id: string;
    email: string;
    enabled: boolean;
    twoFactorEnabled: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    shippingAddress: string | null;
    oauthProvider: string | null;
}

const formatSessionDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Format' : date.toLocaleString();
};

const ProfilePage: React.FC = () => {
    const { user, tokenId, logout, updateUserProfile } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const location = useLocation();
    const navigate = useNavigate();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
    const [sessions, setSessions] = useState<Session[]>([]);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [originalProfile, setOriginalProfile] = useState({
        displayName: '',
        avatarUrl: '',
        shippingAddress: ''
    });
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [oauthProvider, setOauthProvider] = useState<string | null>(null);
    const [oauthLinkBusy, setOauthLinkBusy] = useState(false);
    
    // 2FA States
    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
    const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);
    const [disableCode, setDisableCode] = useState('');

    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionToRevoke, setSessionToRevoke] = useState<Session | null>(null);
    const [revokeAllBusy, setRevokeAllBusy] = useState(false);
    const [avatarInputMode, setAvatarInputMode] = useState<AvatarInputMode>('link');
    const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);
    const isProfileComplete = Boolean(displayName.trim()) && Boolean(shippingAddress.trim());

    const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !isEditing) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            setError('Please choose an image file (PNG, JPG, or WebP).');
            return;
        }
        if (file.size > MAX_AVATAR_IMAGE_BYTES) {
            setError('Profile image must be 600 KB or smaller.');
            return;
        }
        setAvatarUploadBusy(true);
        setError(null);
        try {
            const dataUrl = await readAvatarImageFile(file);
            setAvatarUrl(dataUrl);
            setAvatarInputMode('upload');
        } catch {
            setError('Unable to read the selected image.');
        } finally {
            setAvatarUploadBusy(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        let active = true;

        const fetchProfile = async () => {
            setProfileLoading(true);
            setError(null);
            try {
                const response = await authenticatedFetch(
                    gatewayUrl('/api/v1/auth/profile')
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
                updateUserProfile({
                    displayName: fetchedName || null,
                    avatarUrl: fetchedAvatar || null,
                    shippingAddress: fetchedAddress || null,
                });
                setOauthProvider(payload.oauthProvider ?? null);
                setIsTwoFactorEnabled(payload.twoFactorEnabled === true);
                
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
    }, [authenticatedFetch, updateUserProfile, user]);

    useEffect(() => {
        if (!user) return;
        authenticatedFetch(gatewayUrl('/api/v1/auth/sessions'))
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

        const trimmedAvatar = avatarUrl.trim();
        if (trimmedAvatar && !isValidImageReference(trimmedAvatar)) {
            setError('Avatar must be a valid image URL or uploaded image.');
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
            updateUserProfile({
                displayName: updatedName || null,
                avatarUrl: updatedAvatar || null,
                shippingAddress: updatedAddress || null,
            });
            setIsTwoFactorEnabled(payload.twoFactorEnabled === true);
            
            setOriginalProfile({
                displayName: updatedName,
                avatarUrl: updatedAvatar,
                shippingAddress: updatedAddress
            });
            
            setMessage('Profile updated successfully.');
            setIsEditing(false);

            const profileNowComplete = Boolean(updatedName.trim()) && Boolean(updatedAddress.trim());
            const redirectTarget = (location.state as { from?: string } | null)?.from;
            if (profileNowComplete && redirectTarget && redirectTarget !== '/profile') {
                navigate(redirectTarget, { replace: true });
            }
        } catch (err: unknown) {
            setError('Failed to update profile.');
            console.error(err);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setDisplayName(originalProfile.displayName);
        setAvatarUrl(originalProfile.avatarUrl);
        setShippingAddress(originalProfile.shippingAddress);
        setError(null);
        setIsEditing(false);
    };

    const handlePasswordSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) return;

        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
            setError('Password is required.');
            return;
        }
        if (trimmedPassword !== passwordConfirm) {
            setError('Passwords do not match.');
            return;
        }

        setPasswordSaving(true);
        setError(null);
        setMessage(null);

        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: trimmedPassword }),
            });

            if (!response.ok) {
                setError(await readApiError(response, 'Password update failed'));
                return;
            }

            setMessage('Password updated successfully.');
            setPassword('');
            setPasswordConfirm('');
            setShowPassword(false);
            setShowPasswordConfirm(false);
        } catch (err: unknown) {
            setError('Failed to update password.');
            console.error(err);
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleGoogleLink = useCallback(async (credential: string) => {
        if (!user) {
            return;
        }
        setError(null);
        setMessage(null);

        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/oauth/link'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'google', idToken: credential }),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, 'Google account linking failed'));
        }

        setOauthProvider('google');
        setMessage('Google account connected.');
    }, [authenticatedFetch, user]);

    const setupTwoFactor = async () => {
        if (!user) return;
        setError(null);
        setMessage(null);
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
            setError(await readApiError(response, '2FA verification failed. Please check the code and try again.'));
            return;
        }
        setMessage('Two-factor authentication enabled successfully.');
        setTwoFactorCode('');
        setTwoFactorSecret(null);
        setQrCodeUrl(null);
        setIsTwoFactorEnabled(true);
    };

    const disableTwoFactor = async () => {
        if (!user) return;
        setError(null);
        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/2fa/disable'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, code: disableCode }),
        });
        
        if (!response.ok) {
            setError(await readApiError(response, 'Failed to disable 2FA. Please check the code and try again.'));
            return;
        }
        
        setMessage('Two-factor authentication has been disabled.');
        setIsTwoFactorEnabled(false);
        setIsDisabling2FA(false);
        setDisableCode('');
    };

    const executeRevokeAllSessions = async () => {
        setError(null);
        setMessage(null);
        setRevokeAllBusy(true);
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/sessions/revoke-all'), {
                method: 'POST',
            });
            if (!response.ok) {
                setError(await readApiError(response, 'Failed to revoke all sessions'));
                return;
            }
            setSessions([]);
            logout();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to revoke all sessions.');
        } finally {
            setRevokeAllBusy(false);
        }
    };

    const executeRevokeSession = async () => {
        if (!sessionToRevoke) return;
        setError(null);
        setMessage(null);

        try {
            const response = await authenticatedFetch(gatewayUrl(`/api/v1/auth/sessions/${sessionToRevoke.tokenId}`), {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                setError(await readApiError(response, 'Session revocation failed'));
                setSessionToRevoke(null);
                return;
            }

            const revokedCurrentSession = Boolean(
                tokenId && sessionToRevoke.tokenId === tokenId
            );
            const remainingSessions = sessions.filter((session) => session.tokenId !== sessionToRevoke.tokenId);
            setSessions(remainingSessions);
            setSessionToRevoke(null);

            if (revokedCurrentSession || remainingSessions.length === 0) {
                logout();
            } else {
                setMessage('Session successfully revoked.');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to revoke session.');
            setSessionToRevoke(null);
        }
    };

    if (!user) {
        return (
            <div className="page-wrap">
                <section className="page-head">
                    <h1>Account</h1>
                    <p>Manage identity, security, and profile details</p>
                </section>

                <section className="panel access-panel center-content">
                    <span className="hero-badge">Public Preview</span>
                    <h2>Sign in to open your account center</h2>
                    <p className="text-muted">
                        Your profile stores verification status, shipping details, active sessions, OAuth links, and two-factor settings.
                    </p>
                    <div className="access-actions">
                        <Link className="primary-button" to="/login">Sign In or Register</Link>
                        <Link className="secondary-button" to="/">Explore Auctions</Link>
                    </div>
                </section>
            </div>
        );
    }

    const hasLinkedProvider = Boolean(oauthProvider);

    return (
        <div className="page-wrap">
            <section className="page-head">
                <BackButton fallback="/" />
                <h1>Profile</h1>
                <p>{user.email}</p>
            </section>
            {error && <div className="toast-error">{error}</div>}
            {message && <div className="toast-success">{message}</div>}
            {!profileLoading && !isProfileComplete && (
                <div className="panel center-content" style={{ marginBottom: '1rem' }}>
                    <span className="hero-badge">Profile Required</span>
                    <h2 style={{ marginTop: '0.75rem' }}>Complete your profile to use BidMart</h2>
                    <p className="text-muted">
                        Display name and shipping address are required before you can browse, bid, sell, or manage your wallet.
                    </p>
                </div>
            )}

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
                        <div className="profile-avatar-editor">
                            <ProfileAvatarWithFallback
                                src={avatarUrl}
                                name={displayName || user.email}
                                size={96}
                            />
                            <div className="profile-avatar-editor-body">
                                <span className="eyebrow">Profile picture</span>
                                <p className="text-muted">
                                    Shown in the navbar, seller listings, and bid history.
                                </p>
                                {isEditing ? (
                                    <>
                                        <div className="avatar-method-tabs" role="tablist" aria-label="Avatar source">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={avatarInputMode === 'upload'}
                                                className={avatarInputMode === 'upload' ? 'avatar-method-tab avatar-method-tab-active' : 'avatar-method-tab'}
                                                onClick={() => setAvatarInputMode('upload')}
                                            >
                                                Upload image
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={avatarInputMode === 'link'}
                                                className={avatarInputMode === 'link' ? 'avatar-method-tab avatar-method-tab-active' : 'avatar-method-tab'}
                                                onClick={() => setAvatarInputMode('link')}
                                            >
                                                Image link
                                            </button>
                                        </div>
                                        {avatarInputMode === 'upload' ? (
                                            <label className="field">
                                                <span>Upload from device</span>
                                                <input
                                                    className="form-input"
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    disabled={avatarUploadBusy}
                                                    onChange={handleAvatarFileChange}
                                                />
                                                <small className="text-muted">PNG, JPG, or WebP up to 600 KB.</small>
                                            </label>
                                        ) : (
                                            <label className="field">
                                                <span>Image URL</span>
                                                <input
                                                    className="form-input"
                                                    value={avatarUrl}
                                                    onChange={(event) => setAvatarUrl(event.target.value)}
                                                    placeholder="https://example.com/avatar.jpg"
                                                />
                                            </label>
                                        )}
                                        {avatarUrl && (
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => setAvatarUrl('')}
                                            >
                                                Remove photo
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted">
                                        {avatarUrl ? 'Photo saved.' : 'No profile photo yet. Edit profile to add one.'}
                                    </p>
                                )}
                            </div>
                        </div>
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
                <h3>Set Password</h3>
                <p className="text-muted">
                    Add a password so you can sign in without Google OAuth.
                </p>
                <form onSubmit={handlePasswordSave} className="section-stack">
                    <label className="field">
                        <span>New password</span>
                        <div className="password-row">
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setShowPassword((value) => !value)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </label>
                    <label className="field">
                        <span>Confirm password</span>
                        <div className="password-row">
                            <input
                                className="form-input"
                                type={showPasswordConfirm ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={passwordConfirm}
                                onChange={(event) => setPasswordConfirm(event.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setShowPasswordConfirm((value) => !value)}
                            >
                                {showPasswordConfirm ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </label>
                    <button className="primary-button" type="submit" disabled={passwordSaving}>
                        {passwordSaving ? 'Saving...' : 'Save Password'}
                    </button>
                </form>
            </div>

            <div className="panel section-stack">
                <h3>Connected Accounts</h3>
                <p className="text-muted">
                    Manage third-party login providers linked to your BidMart identity.
                </p>
                <div className="connected-accounts-list">
                    <div className="connected-account-item">
                        <div className="connected-account-info">
                            <div className="connected-account-icon">
                                <span className="material-symbols-outlined" style={{ color: '#4285F4' }}>
                                    account_circle
                                </span>
                            </div>
                            <div className="connected-account-details">
                                <strong>Google Account</strong>
                                <span className="text-muted">
                                    {hasLinkedProvider ? 'Primary login provider' : 'Sign in using your Google credentials'}
                                </span>
                            </div>
                        </div>
                        
                        {googleClientId && !hasLinkedProvider ? (
                            <div className="connected-account-action">
                                <GoogleLoginButton
                                    clientId={googleClientId}
                                    disabled={oauthLinkBusy}
                                    onError={(message) => setError(message)}
                                    onClearError={() => setError(null)}
                                    onBusyChange={setOauthLinkBusy}
                                    onCredential={handleGoogleLink}
                                    className="oauth-button-standalone"
                                    width={220}
                                />
                            </div>
                        ) : hasLinkedProvider ? (
                            <span className="status-badge status-AVAILABLE">Linked</span>
                        ) : (
                            <span className="text-muted">Not configured</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="panel section-stack">
                <h3>Two-Factor Authentication</h3>
                
                {isTwoFactorEnabled ? (
                    <div className="summary-box" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ color: '#15803d', fontWeight: 'bold', margin: 0 }}>
                                Authenticator App is Active
                            </p>
                            <button 
                                className="secondary-button" 
                                type="button" 
                                onClick={() => {
                                    setIsDisabling2FA(!isDisabling2FA);
                                    setDisableCode('');
                                    setError(null);
                                }}
                                style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '4px 8px', fontSize: '12px' }}
                            >
                                {isDisabling2FA ? 'Cancel' : 'Turn Off 2FA'}
                            </button>
                        </div>
                        
                        {isDisabling2FA ? (
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #bbf7d0' }}>
                                <label className="field">
                                    <span style={{ color: '#166534' }}>Enter 6-digit code to disable</span>
                                    <input
                                        className="form-input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={6}
                                        placeholder="123456"
                                        value={disableCode}
                                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                                        style={{ borderColor: '#bbf7d0' }}
                                    />
                                </label>
                                <button 
                                    className="primary-button" 
                                    type="button" 
                                    onClick={disableTwoFactor}
                                    disabled={disableCode.length !== 6}
                                    style={{ width: '100%', backgroundColor: '#dc2626', borderColor: '#dc2626', marginTop: '10px' }}
                                >
                                    Confirm Disable
                                </button>
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                                Your account is currently protected with two-factor authentication.
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {!twoFactorSecret && (
                            <button className="primary-button" type="button" onClick={setupTwoFactor}>
                                Set Up 2FA
                            </button>
                        )}
                        
                        {twoFactorSecret && (
                            <div className="summary-box" style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#555' }}>
                                    Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
                                </p>
                                
                                {qrCodeUrl ? (
                                    <div style={{ padding: '15px', background: 'white', display: 'inline-block', borderRadius: '8px', marginBottom: '15px' }}>
                                        <QRCodeSVG value={qrCodeUrl} size={200} />
                                    </div>
                                ) : (
                                    <div>Loading QR Code...</div>
                                )}

                                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#777' }}>
                                    Or enter this secret manually: <br/><strong style={{ letterSpacing: '2px' }}>{twoFactorSecret}</strong>
                                </p>

                                <div style={{ textAlign: 'left' }}>
                                    <label className="field">
                                        <span>Verification code</span>
                                        <input
                                            className="form-input"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            maxLength={6}
                                            autoComplete="one-time-code"
                                            placeholder="123456"
                                            value={twoFactorCode}
                                            onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
                                        />
                                    </label>
                                    <button 
                                        className="primary-button" 
                                        type="button" 
                                        onClick={verifyTwoFactor}
                                        disabled={twoFactorCode.length !== 6}
                                        style={{ width: '100%', marginTop: '10px' }}
                                    >
                                        Verify 2FA
                                    </button>
                                    <button 
                                        className="secondary-button" 
                                        type="button" 
                                        onClick={() => {
                                            setTwoFactorSecret(null);
                                            setQrCodeUrl(null);
                                            setTwoFactorCode('');
                                            setError(null);
                                        }}
                                        style={{ width: '100%', marginTop: '10px' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Active Sessions</h3>
                    {sessions.length > 0 && (
                        <button
                            className="secondary-button"
                            type="button"
                            onClick={executeRevokeAllSessions}
                            disabled={revokeAllBusy}
                            style={{ color: '#dc2626', borderColor: '#dc2626' }}
                        >
                            {revokeAllBusy ? 'Revoking...' : 'Revoke all sessions'}
                        </button>
                    )}
                </div>
                {sessions.length ? sessions.map((session) => (
                    <div key={session.tokenId} className="transaction-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #eee' }}>
                        
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>
                                {session.deviceInfo || 'Unknown Device'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                                {session.email} <span style={{ margin: '0 6px', color: '#ccc' }}>•</span> Created: {formatSessionDate(session.createdAt)}
                            </div>
                        </div>

                        <button 
                            className="secondary-button" 
                            type="button" 
                            onClick={() => setSessionToRevoke(session)}
                        >
                            Revoke
                        </button>
                    </div>
                )) : <div className="empty-state">No active sessions found.</div>}
            </div>

            {sessionToRevoke && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="panel section-stack" style={{ background: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0 }}>Revoke Session</h3>
                        <p>Are you sure you want to revoke the session created on <strong>{formatSessionDate(sessionToRevoke.createdAt)}</strong>?</p>
                        
                        <div className="toast-error" style={{ margin: '12px 0', padding: '10px', fontSize: '0.9em' }}>
                            <strong>Warning:</strong> If you revoke your currently active session, you will be logged out immediately.
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button className="secondary-button" onClick={() => setSessionToRevoke(null)}>
                                Cancel
                            </button>
                            <button 
                                className="primary-button" 
                                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }} 
                                onClick={executeRevokeSession}
                            >
                                Yes, Revoke
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProfilePage;
