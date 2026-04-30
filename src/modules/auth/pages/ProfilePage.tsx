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

const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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
