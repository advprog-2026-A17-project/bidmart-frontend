import React, { useState } from 'react';
import { apiUrl } from '../../../config/api';

interface ForgotPasswordFormProps {
    onBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // TODO: Move this to auth-api.ts later
            const response = await fetch(apiUrl('/api/v1/auth/forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                setError(errData.message || 'Failed to request password reset. Please try again.');
                return;
            }

            setSuccess('If an account exists for that email, we have sent a password reset link.');
            setEmail('');
        } catch (err: unknown) {
            setError('Failed to connect to the server. Please check your network.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleResetSubmit} className="auth-form">
            <div className="form-header text-center" style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Reset Password</h3>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            </div>

            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

            <label className="field">
                <span>Email Address</span>
                <input
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                />
            </label>

            <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
            
            <button type="button" className="secondary-button" onClick={onBackToLogin}>
                Back to Login
            </button>
        </form>
    );
};

export default ForgotPasswordForm;